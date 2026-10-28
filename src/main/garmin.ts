import { classifyActivity } from "../domain/classification";
import { z } from "zod";
import { unzipSync } from "fflate";
import { Decoder, Stream } from "@garmin/fitsdk";
import type { GarminSource } from "../domain/providers";
import type {
  Activity,
  ActivityDetail,
  Lap,
  Sample,
  SyncState,
} from "../shared/models";
import {
  bestEfforts,
  smoothPower,
  stats,
  projectRoute,
} from "../domain/analysis";
import { HttpError, request, type Fetcher } from "./http";
import type { Store } from "./store";
const BASE = "https://personal.connectapi.garmin.com";
const obj = z.record(z.string(), z.unknown());
const num = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
export const emptyDetail = (): ActivityDetail => ({
  rows: [],
  laps: [],
  points: [],
  features: [],
  markers: [],
  best: [],
});
export function normalizeActivity(value: unknown): Activity {
  const a = obj.parse(value),
    id = z
      .union([
        z.string().regex(/^\d+$/),
        z.number().int().nonnegative().refine(Number.isSafeInteger),
      ])
      .parse(a.activityId);
  const type = obj.parse(a.activityType ?? {});
  const dateText = z.string().parse(a.startTimeGMT);
  const date = Date.parse(
    dateText.replace(" ", "T") +
      (/Z$|[+-]\d\d:\d\d$/.test(dateText) ? "" : "Z"),
  );
  if (!Number.isFinite(date))
    throw new Error("Garmin devolvió una fecha no válida.");
  const dur = z.number().nonnegative().parse(a.duration);
  const dist = num(a.distance),
    p = num(a.avgPower);
  return classifyActivity({
    id: String(id),
    name:
      typeof a.activityName === "string"
        ? a.activityName
        : "Actividad de ciclismo",
    date,
    type: "cycling",
    garminType: typeof type.typeKey === "string" ? type.typeKey : undefined,
    device: typeof a.deviceName === "string" ? a.deviceName : "Garmin",
    dur,
    dist: dist === null ? null : dist / 1000,
    elev: num(a.elevationGain),
    np: num(a.normPower),
    avgP: p,
    hr: num(a.averageHR),
    cad: num(a.averageBikingCadenceInRevPerMinute),
    kj: p === null ? null : (p * dur) / 1000,
    tss: num(a.trainingStressScore),
    IF: num(a.intensityFactor),
    detailStatus: "pending",
  });
}
export function decodeFit(bytes: Uint8Array): ActivityDetail {
  if (bytes[0] === 80 && bytes[1] === 75) {
    const files = unzipSync(bytes, {
      filter: (f) =>
        /\.fit$/i.test(f.name) && f.originalSize < 100 * 1024 * 1024,
    });
    const fit = Object.entries(files).find(([name]) => /\.fit$/i.test(name));
    if (!fit) return emptyDetail();
    bytes = fit[1];
  }
  const stream = Stream.fromByteArray(Array.from(bytes));
  if (!Decoder.isFIT(stream)) return emptyDetail();
  const decoded = new Decoder(stream).read({
    convertTypesToStrings: true,
    convertDateTimesToDates: true,
    applyScaleAndOffset: true,
  });
  if (decoded.errors.length)
    throw new Error("No se pudo leer el archivo FIT de esta actividad.");
  const messages = decoded.messages as unknown as Record<
    string,
    Record<string, unknown>[]
  >;
  const records = messages.recordMesgs ?? [];
  const time = (v: unknown) =>
    v instanceof Date ? v.getTime() / 1000 : typeof v === "number" ? v : NaN;
  const valid = records
    .filter((r) => Number.isFinite(time(r.timestamp)))
    .sort((a, b) => time(a.timestamp) - time(b.timestamp));
  if (!valid.length) return emptyDetail();
  const start = time(valid[0].timestamp);
  const rows: Sample[] = valid.map((r) => ({
    x: time(r.timestamp) - start,
    km: num(r.distance) === null ? null : Number(r.distance) / 1000,
    p: num(r.power),
    ps: null,
    hr: num(r.heartRate),
    cad: num(r.cadence),
    elev: num(r.enhancedAltitude) ?? num(r.altitude),
    v:
      (num(r.enhancedSpeed) ?? num(r.speed)) === null
        ? null
        : Number(r.enhancedSpeed ?? r.speed) * 3.6,
    lat:
      num(r.positionLat) === null
        ? null
        : (Number(r.positionLat) * 180) / 2 ** 31,
    lon:
      num(r.positionLong) === null
        ? null
        : (Number(r.positionLong) * 180) / 2 ** 31,
  }));
  smoothPower(rows);
  const laps: Lap[] = (messages.lapMesgs ?? []).map((l, i) => {
    const begin = time(l.startTime) - start,
      end = time(l.timestamp) - start;
    let i0 = rows.findIndex((r) => r.x >= begin),
      i1 = rows.findLastIndex((r) => r.x <= end);
    if (i0 < 0) i0 = 0;
    if (i1 < i0) i1 = i0;
    return {
      id: `lap-${i}`,
      label: `Vuelta ${i + 1}`,
      kind: String(l.intensity ?? "lap"),
      i0,
      i1,
      ...stats(rows, i0, i1),
    };
  });
  return {
    rows,
    laps,
    ...projectRoute(rows),
    features: [],
    markers: [],
    best: bestEfforts(rows),
  };
}
export class GarminPersonalSource implements GarminSource {
  private token: string | null = null;
  private expires = 0;
  constructor(
    private key: () => string,
    private fetcher: Fetcher = fetch,
  ) {}
  reset() {
    this.token = null;
    this.expires = 0;
  }
  async authenticate() {
    const response = await request(
      BASE + "/personalapitoken-service/personal-api/personal-api-key/token",
      { method: "POST", headers: { Authorization: "ApiKey " + this.key() } },
      this.fetcher,
    );
    // Garmin Personal can return the JWT directly, without a JSON envelope.
    const body = (await response.text()).trim();
    try {
      const data: unknown =
        body.startsWith("{") || body.startsWith('"') ? JSON.parse(body) : body;
      const envelope = typeof data === "string" ? null : obj.parse(data);
      const token = z
        .string()
        .min(1)
        .max(16384)
        .regex(/^[A-Za-z0-9._~-]+$/)
        .parse(
          envelope ? (envelope.access_token ?? envelope.accessToken) : data,
        );
      if (
        !envelope &&
        !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)
      )
        throw new Error("Invalid token");
      const lifetime = num(envelope?.expires_in) ?? 86400;
      if (lifetime <= 0) throw new Error("Invalid token lifetime");
      this.token = token;
      this.expires = Date.now() + Math.min(lifetime, 86400) * 1000 - 600000;
    } catch {
      this.reset();
      // Parse errors may contain credentials: never forward their message to IPC.
      throw new Error(
        "Garmin devolvió una respuesta de autenticación no válida. Vuelve a intentarlo.",
      );
    }
  }
  async api(path: string, retry = true): Promise<Response> {
    if (!this.token || Date.now() >= this.expires) await this.authenticate();
    try {
      return await request(
        BASE + path,
        { headers: { Authorization: "Bearer " + this.token } },
        this.fetcher,
      );
    } catch (e) {
      if (e instanceof HttpError && e.status === 401 && retry) {
        this.reset();
        return this.api(path, false);
      }
      throw e;
    }
  }
  async listActivities(offset: number, limit: number) {
    const response = await this.api(
      `/activitylist-service/activities/search/activities?activityType=cycling&excludeChildren=false&sortOrder=asc&start=${offset}&limit=${limit}`,
    );
    return z
      .array(z.unknown())
      .parse(await response.json())
      .map(normalizeActivity);
  }
  async getActivity(id: string) {
    if (!/^\d+$/.test(id))
      throw new Error("Identificador de actividad no válido.");
    try {
      const r = await this.api("/download-service/files/activity/" + id);
      if (Number(r.headers.get("content-length")) > 100 * 1024 * 1024)
        throw new Error("El archivo de actividad supera el tamaño admitido.");
      const bytes = new Uint8Array(await r.arrayBuffer());
      if (bytes.byteLength > 100 * 1024 * 1024)
        throw new Error("El archivo de actividad supera el tamaño admitido.");
      return decodeFit(bytes);
    } catch (e) {
      if (e instanceof HttpError && e.status === 404) return emptyDetail();
      throw e;
    }
  }
  async thresholds(id: string) {
    const data = obj.parse(
      await (await this.api("/activity-service/activity/" + id)).json(),
    );
    const s = obj.parse(data.summaryDTO ?? {});
    return {
      ftp:
        num(s.functionalThresholdPower) ??
        num(s.directFunctionalThresholdPower),
      lthr: num(s.lactateThresholdHeartRate),
    };
  }
}
export class GarminSync {
  private running: Promise<void> | null = null;
  constructor(
    private store: Store,
    private source: GarminPersonalSource,
    private changed: () => void,
    private finished: () => void = () => {},
  ) {}
  run(retryIds?: string[]) {
    if (this.running) return this.running;
    this.running = this.import(retryIds).finally(() => {
      this.running = null;
      this.finished();
    });
    return this.running;
  }
  private update(patch: Partial<SyncState>) {
    const old = this.store.get<SyncState>("sync", {
      state: "offline",
      phase: "Sin sincronizar",
      completed: 0,
      total: null,
      lastSync: null,
    });
    this.store.set("sync", { ...old, ...patch });
    this.changed();
  }
  private async import(retryIds?: string[]) {
    try {
      this.update({
        state: "syncing",
        phase: retryIds
          ? "Reintentando muestras fallidas"
          : "Importando resúmenes",
        completed: 0,
        total: null,
        error: undefined,
      });
      let offset = this.store.get("garminOffset", 0);
      for (; !retryIds;) {
        const batch = await this.source.listActivities(offset, 99);
        if (!batch.length) break;
        const existing = new Map(
          this.store.activities("garmin").map((a) => [a.id, a]),
        );
        this.store.db.transaction(() => {
          for (const a of batch) {
            const old = existing.get(a.id);
            this.store.upsert(
              "garmin",
              classifyActivity({
                ...a,
                structuredIntervals: old?.structuredIntervals,
                intervalPattern: old?.intervalPattern,
                detailStatus: old?.detailStatus ?? "pending",
              }),
            );
          }
          offset += batch.length;
          this.store.set("garminOffset", offset);
        })();
        this.update({ completed: offset });
      }
      const pending = this.store
        .activities("garmin")
        .filter((a) =>
          retryIds
            ? a.detailStatus === "error" && retryIds.includes(a.id)
            : a.detailStatus === "pending" || a.detailStatus === "error",
        );
      this.update({
        phase: "Descargando muestras e intervalos",
        completed: 0,
        total: pending.length,
      });
      for (let i = 0; i < pending.length; i++) {
        const a = pending[i];
        try {
          const detail = await this.source.getActivity(a.id);
          this.store.saveDetail("garmin", a.id, detail);
          this.store.upsert(
            "garmin",
            classifyActivity(
              {
                ...a,
                detailStatus: detail.rows.length ? "ready" : "unavailable",
              },
              detail,
            ),
          );
        } catch (e) {
          if (
            e instanceof HttpError &&
            (e.status === 401 || e.status === 403 || e.status === 429)
          )
            throw e;
          this.store.upsert("garmin", { ...a, detailStatus: "error" });
        }
        this.update({ completed: i + 1 });
      }
      const latest = this.store.activities("garmin")[0],
        settings = this.store.settings();
      if (
        !retryIds &&
        latest &&
        (!settings.athlete.ftp || !settings.athlete.lthr)
      ) {
        try {
          const thresholds = await this.source.thresholds(latest.id);
          this.store.set("settings", {
            ...settings,
            athlete: {
              ...settings.athlete,
              ftp: settings.athlete.ftp ?? thresholds.ftp,
              lthr: settings.athlete.lthr ?? thresholds.lthr,
            },
          });
        } catch {
          /* Optional thresholds do not discard a completed import. */
        }
      }
      if (!retryIds) this.store.set("garminOffset", 0);
      const activities = this.store.activities("garmin");
      const detailErrors = activities.filter(
        (a) => a.detailStatus === "error",
      ).length;
      const remaining = activities.filter(
        (a) => a.detailStatus === "pending",
      ).length;
      this.update({
        state: detailErrors
          ? "error"
          : retryIds && remaining
            ? "offline"
            : "synced",
        phase: detailErrors
          ? `${detailErrors} actividades sin muestras; reintenta la sincronización.`
          : retryIds
            ? remaining
              ? `Muestras reintentadas; quedan ${remaining} pendientes de sincronizar.`
              : "Reintento de muestras completado"
            : "Sincronización completada",
        ...(retryIds ? {} : { lastSync: Date.now() }),
        error: detailErrors
          ? "Algunas muestras no se han podido descargar. Los resúmenes se han conservado."
          : undefined,
      });
    } catch (e) {
      this.update({
        state: "error",
        error: e instanceof Error ? e.message : "No se pudo sincronizar.",
        phase: "Importación guardada; puedes reintentar.",
      });
    }
  }
}
