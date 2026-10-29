import type { Activity, Dataset } from "../shared/models";
import { DAY, WEEK_EFFORTS } from "./analysis";
export type WeekMetric = "dur" | "dist" | "elev" | "tss";
export type Comparison = "previous" | "average";

/** Monday 00:00 UTC of the week containing `t`. */
export const weekStart = (t: number) => {
  const day = Math.floor(t / DAY);
  return (day - ((day + 3) % 7)) * DAY;
};

/** Sum of a metric; activities without it are listed, never counted as zero. */
export function total(activities: Activity[], key: WeekMetric) {
  const known = activities.filter((a) => a[key] !== null);
  return {
    // An empty week is a real zero; a week where every activity lacks the metric is unknown.
    value:
      activities.length && !known.length
        ? null
        : known.reduce((n, a) => n + a[key]!, 0),
    missing: activities.filter((a) => a[key] === null),
  };
}

export const intensity = (a: Activity) =>
  a.IF === null
    ? "unknown"
    : a.IF < 0.75
      ? "easy"
      : a.IF < 0.85
        ? "moderate"
        : "hard";

export function weeklySummary(
  data: Pick<Dataset, "activities" | "today" | "efforts">,
  offset: number,
  comparison: Comparison,
) {
  const start = weekStart(data.today) - offset * 7 * DAY;
  // Partial weeks compare against the same number of days in each reference week.
  const days = Math.min(7, Math.floor((data.today - start) / DAY) + 1);
  const inRange = (from: number) =>
    data.activities
      .filter((a) => a.date >= from && a.date < from + days * DAY)
      .sort((a, b) => a.date - b.date);
  const reference = Array.from(
    { length: comparison === "previous" ? 1 : 4 },
    (_, i) => inRange(start - (i + 1) * 7 * DAY),
  );
  const metric = (key: WeekMetric) => {
    const now = total(inRange(start), key),
      refs = reference.map((r) => total(r, key));
    const base = refs.every((r) => r.value !== null)
      ? refs.reduce((n, r) => n + r.value!, 0) / refs.length
      : null;
    return {
      ...now,
      base,
      baseMissing: refs.reduce((n, r) => n + r.missing.length, 0),
      delta: now.value !== null && base !== null ? now.value - base : null,
    };
  };
  const activities = inRange(start);
  const best = (list: Activity[], t: number) =>
    list
      .flatMap((a) =>
        (data.efforts[a.id] ?? [])
          .filter((e) => e.t === t && e.p !== null)
          .map((e) => ({ ...e, activity: a })),
      )
      .sort((a, b) => b.p! - a.p!)[0] ?? null;
  return {
    start,
    days,
    partial: days < 7,
    activities,
    reference,
    metrics: {
      dur: metric("dur"),
      dist: metric("dist"),
      elev: metric("elev"),
      tss: metric("tss"),
    },
    sessions: {
      value: activities.length,
      base: reference.reduce((n, r) => n + r.length, 0) / reference.length,
    },
    intensity: (["easy", "moderate", "hard", "unknown"] as const).map((k) => ({
      key: k,
      seconds: activities
        .filter((a) => intensity(a) === k)
        .reduce((n, a) => n + a.dur, 0),
    })),
    efforts: WEEK_EFFORTS.map((t) => ({
      t,
      now: best(activities, t),
      before: best(reference.flat(), t),
    })),
  };
}
export type WeeklySummary = ReturnType<typeof weeklySummary>;
