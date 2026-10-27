import { setImmediate } from "node:timers/promises";
import type { SegmentResults as Report, Source } from "../shared/models";
import {
  hasGPS,
  matchSegment,
  segmentReference,
  segmentStats,
} from "../domain/segmentMatching";
import type { Store } from "./store";

export class SegmentResults {
  private stopped = false;
  stop() {
    this.stopped = true;
  }
  private queued = new Set<string>();
  private queue = Promise.resolve();
  constructor(
    private store: Store,
    private changed: () => void,
  ) {}
  scheduleAll(source: Source) {
    for (const segment of this.store.segments(source))
      this.get(source, segment.id);
  }
  get(source: Source, id: string, retry = false): Report {
    const segment = this.store.segment(source, id);
    if (!segment) throw new Error("El segmento ya no está disponible.");
    const key = `${source}:${id}`;
    const saved = this.store.segmentResults(source, id);
    const revision = this.store.get(`activityRevision:${source}`, 0);
    if (
      !this.queued.has(key) &&
      (retry ||
        !saved ||
        saved.revision !== revision ||
        saved.status === "running")
    ) {
      this.queued.add(key);
      const report: Report = {
        status: "running",
        revision,
        scanned: 0,
        total: this.store.activities(source).length,
        skipped: 0,
        attempts: saved?.attempts ?? [],
      };
      this.store.saveSegmentResults(source, id, report);
      this.queue = this.queue
        .then(async () => {
          if (this.stopped || !this.store.segment(source, id)) return;
          try {
            await this.scan(source, id);
          } catch (e) {
            if (!this.stopped && this.store.segment(source, id))
              this.store.saveSegmentResults(source, id, {
                ...report,
                status: "error",
                error:
                  e instanceof Error
                    ? e.message
                    : "No se pudo completar la búsqueda.",
              });
          }
        })
        .finally(() => {
          this.queued.delete(key);
          if (!this.stopped) {
            if (
              this.store.segment(source, id) &&
              this.store.segmentResults(source, id)?.revision !==
                this.store.get(`activityRevision:${source}`, 0)
            )
              this.get(source, id);
            this.changed();
          }
        });
    }
    return this.store.segmentResults(source, id)!;
  }
  private async scan(source: Source, id: string) {
    const segment = this.store.segment(source, id);
    if (!segment) return;
    const activities = this.store.activities(source);
    const rows = this.store.detail(source, segment.activityId)?.rows ?? [];
    const reference = segmentReference(rows, segment);
    const report: Report = {
      status: "running",
      revision: this.store.get(`activityRevision:${source}`, 0),
      scanned: 0,
      total: activities.length,
      skipped: 0,
      attempts: [],
    };
    if (!reference)
      report.note =
        "No se puede buscar este tramo: necesita al menos 100 m y GPS continuo en la selección (sin huecos de más de 30 s o 200 m). Se muestra el resultado original.";
    let lastUpdate = 0;
    for (const activity of activities) {
      await setImmediate();
      if (this.stopped || !this.store.segment(source, id)) return;
      const samples =
        activity.id === segment.activityId
          ? rows
          : reference
            ? (this.store.detail(source, activity.id)?.rows ?? [])
            : [];
      if (
        activity.id === segment.activityId &&
        samples[segment.i0] &&
        samples[segment.i1]
      ) {
        report.attempts.push({
          id: `${activity.id}:${segment.i0}:${segment.i1}`,
          activityId: activity.id,
          activityName: activity.name,
          date: activity.date,
          i0: segment.i0,
          i1: segment.i1,
          original: true,
          ...segmentStats(samples, segment.i0, segment.i1),
        });
      }
      if (reference && samples.filter(hasGPS).length >= 2) {
        const matches = await matchSegment(reference, samples, () =>
          setImmediate(),
        );
        for (const { i0, i1 } of matches) {
          if (
            activity.id === segment.activityId &&
            i0 < segment.i1 &&
            i1 > segment.i0
          )
            continue;
          report.attempts.push({
            id: `${activity.id}:${i0}:${i1}`,
            activityId: activity.id,
            activityName: activity.name,
            date: activity.date,
            i0,
            i1,
            original: false,
            ...segmentStats(samples, i0, i1),
          });
        }
      } else report.skipped++;
      report.scanned++;
      if (Date.now() - lastUpdate > 500) {
        if (this.stopped || !this.store.segment(source, id)) return;
        this.store.saveSegmentResults(source, id, report);
        this.changed();
        lastUpdate = Date.now();
      }
    }
    if (this.stopped || !this.store.segment(source, id)) return;
    report.status = "done";
    report.attempts.sort((a, b) => b.date - a.date || a.i0 - b.i0);
    this.store.saveSegmentResults(source, id, report);
  }
}
