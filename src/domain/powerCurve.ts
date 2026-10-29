import type {
  Activity,
  ActivityDetail,
  Dataset,
  PeriodZones,
} from "../shared/models";
import { zones } from "./analysis";

export interface PeriodBest {
  t: number;
  p: number;
  activityId: string;
  date: number;
  i0?: number;
  i1?: number;
}
/** Best power per duration among activities in [from, to), keeping its origin. */
export function periodBests(
  data: Pick<Dataset, "activities" | "efforts">,
  from: number,
  to: number,
) {
  const out = new Map<number, PeriodBest>();
  for (const a of data.activities) {
    if (a.date < from || a.date >= to) continue;
    for (const e of data.efforts[a.id] ?? []) {
      if (e.p === null || (out.get(e.t)?.p ?? -1) >= e.p) continue;
      out.set(e.t, {
        t: e.t,
        p: e.p,
        activityId: a.id,
        date: a.date,
        i0: e.i0,
        i1: e.i1,
      });
    }
  }
  return out;
}

export const CP_DURATIONS = [300, 600, 1200];
export type CriticalPower =
  | { ok: true; cp: number; wPrime: number; r2: number }
  | { ok: false; reason: string };
/**
 * Two-parameter work–time model (W = CP·t + W′) fitted by least squares to
 * the best 5, 10 and 20 min efforts. Only defensible when all three exist,
 * decrease with duration, fit the line (R² ≥ 0.98) and give a plausible W′.
 */
export function criticalPower(power: (t: number) => number | null) {
  const points = CP_DURATIONS.map((t) => ({ t, p: power(t) }));
  const missing = points.filter((x) => x.p === null).map((x) => x.t / 60);
  if (missing.length)
    return {
      ok: false,
      reason: `Faltan esfuerzos de ${missing.join(", ")} min en el periodo.`,
    } as CriticalPower;
  const pts = points as { t: number; p: number }[];
  if (pts.some((x, i) => i && x.p >= pts[i - 1].p))
    return {
      ok: false,
      reason: "Los esfuerzos de 5, 10 y 20 min no bajan con la duración.",
    } as CriticalPower;
  const n = pts.length,
    mt = pts.reduce((s, x) => s + x.t, 0) / n,
    mw = pts.reduce((s, x) => s + x.p * x.t, 0) / n;
  const sxy = pts.reduce((s, x) => s + (x.t - mt) * (x.p * x.t - mw), 0),
    sxx = pts.reduce((s, x) => s + (x.t - mt) ** 2, 0);
  const cp = sxy / sxx,
    wPrime = mw - cp * mt;
  const ssr = pts.reduce(
      (s, x) => s + (x.p * x.t - (cp * x.t + wPrime)) ** 2,
      0,
    ),
    sst = pts.reduce((s, x) => s + (x.p * x.t - mw) ** 2, 0);
  const r2 = 1 - ssr / sst;
  if (!(r2 >= 0.98 && wPrime >= 3000 && wPrime <= 40000 && cp > 0))
    return {
      ok: false,
      reason:
        "Ajuste poco fiable: los esfuerzos no siguen el modelo; probablemente no fueron máximos.",
    } as CriticalPower;
  return { ok: true, cp: Math.round(cp), wPrime, r2 } as CriticalPower;
}

/** Power time in zones over several activities, each with the FTP valid on its date. */
export function periodZones(
  items: {
    activity: Activity;
    detail: ActivityDetail | null;
    ftp: number | null;
  }[],
): PeriodZones {
  const total = zones([], "p", 1);
  const coverage = {
    activities: items.length,
    counted: 0,
    noSamples: 0,
    noPower: 0,
    noFtp: 0,
  };
  for (const { detail, ftp } of items) {
    if (!detail?.rows.length) coverage.noSamples++;
    else if (!detail.rows.some((r) => r.p !== null)) coverage.noPower++;
    else if (!ftp) coverage.noFtp++;
    else {
      coverage.counted++;
      zones(detail.rows, "p", ftp).forEach(
        (z, i) => (total[i].value += z.value),
      );
    }
  }
  return { zones: total, coverage };
}
