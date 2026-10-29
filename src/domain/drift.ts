import type { Sample } from "../shared/models";
import { sampleDuration, stats } from "./analysis";

export const DRIFT_MIN_SECONDS = 20 * 60;
const MAX_PAUSE = 30,
  MIN_COVERAGE = 0.95,
  MAX_VI = 1.1;
export type Drift =
  | {
      ok: true;
      /** Pa:FC decoupling in %: positive means heart rate rose for the same power. */
      drift: number;
      /** Efficiency (W per bpm) of each half by elapsed time. */
      first: number;
      second: number;
      vi: number;
    }
  | { ok: false; reason: string };
const decimal = (v: number, digits: number) =>
  v.toFixed(digits).replace(".", ",");

/** Power/heart-rate decoupling between the two halves of a steady stretch. */
export function cardiacDrift(
  rows: Sample[],
  i0 = 0,
  i1 = rows.length - 1,
): Drift {
  const sel = rows.slice(i0, i1 + 1),
    elapsed = sel.length > 1 ? sel.at(-1)!.x - sel[0].x : 0;
  if (elapsed < DRIFT_MIN_SECONDS)
    return {
      ok: false,
      reason: `Necesita al menos 20 min estables; el tramo dura ${Math.floor(elapsed / 60)} min.`,
    };
  let stopped = 0;
  for (let i = 1; i < sel.length; i++) {
    const gap = sel[i].x - sel[i - 1].x;
    if (gap > MAX_PAUSE)
      return {
        ok: false,
        reason: `Incluye una pausa de ${Math.round(gap)} s sin muestras.`,
      };
    stopped = sel[i - 1].v === 0 ? stopped + gap : 0;
    if (stopped > MAX_PAUSE)
      return { ok: false, reason: "Incluye una parada de más de 30 s." };
  }
  const dt = sel.map((_, i) => sampleDuration(sel, i)),
    total = dt.reduce((a, b) => a + b, 0),
    covered = (key: "p" | "hr") =>
      sel.reduce((n, r, i) => n + (r[key] === null ? 0 : dt[i]), 0) / total;
  for (const [key, label] of [
    ["p", "Potencia"],
    ["hr", "FC"],
  ] as const) {
    const share = covered(key);
    if (share < MIN_COVERAGE)
      return {
        ok: false,
        reason: `${label} registrada en el ${Math.floor(share * 100)} % del tramo; se necesita al menos el 95 %.`,
      };
  }
  const { avgP, np } = stats(sel);
  if (!avgP || np === null)
    return { ok: false, reason: "Sin potencia útil en el tramo." };
  // Judge the VI as shown (two decimals) so «VI 1,10» is never rejected as above 1,10.
  const vi = Math.round((np / avgP) * 100) / 100;
  if (vi > MAX_VI)
    return {
      ok: false,
      reason: `Potencia demasiado variable (VI ${decimal(vi, 2)}); la deriva solo es fiable en esfuerzos estables (VI ≤ 1,10).`,
    };
  const mid = sel[0].x + elapsed / 2,
    sums = [0, 1].map(() => ({ p: 0, hr: 0 }));
  sel.forEach((r, i) => {
    if (r.p === null || r.hr === null) return;
    const half = sums[r.x < mid ? 0 : 1];
    half.p += r.p * dt[i];
    half.hr += r.hr * dt[i];
  });
  if (sums.some((h) => h.hr <= 0 || h.p <= 0))
    return { ok: false, reason: "Sin potencia y FC simultáneas en una mitad." };
  const [first, second] = sums.map((h) => h.p / h.hr);
  return {
    ok: true,
    drift: ((first - second) / first) * 100,
    first,
    second,
    vi,
  };
}
