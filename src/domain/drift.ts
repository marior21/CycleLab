import type { Sample } from "../shared/models";

export const DRIFT_MIN_SECONDS = 20 * 60;
const SAMPLE_GAP = 30,
  MAX_PAUSE = 120,
  MIN_COVERAGE = 0.95,
  MAX_VI = 1.1;
export type Drift =
  | {
      ok: true;
      /** Pa:FC decoupling in %: positive means heart rate rose for the same power. */
      drift: number;
      /** Efficiency (W per bpm) of each half by moving time. */
      first: number;
      second: number;
      vi: number;
      /** Seconds of short pauses and stops left out of the calculation. */
      paused: number;
    }
  | { ok: false; reason: string };
const decimal = (v: number, digits: number) =>
  v.toFixed(digits).replace(".", ",");

/**
 * Power/heart-rate decoupling between the two halves of a steady stretch.
 * Pauses and stops up to 2 min are left out; a longer one breaks the stretch.
 */
export function cardiacDrift(
  rows: Sample[],
  i0 = 0,
  i1 = rows.length - 1,
): Drift {
  const sel = rows.slice(i0, i1 + 1),
    dt = sel.map(() => 0);
  let paused = 0,
    stopped = 0;
  for (let i = 0; i + 1 < sel.length; i++) {
    const gap = sel[i + 1].x - sel[i].x;
    if (gap > MAX_PAUSE)
      return {
        ok: false,
        reason: `Incluye una pausa de ${Math.round(gap)} s sin muestras; solo se descuentan las de hasta 2 min.`,
      };
    stopped = sel[i].v === 0 ? stopped + gap : 0;
    if (stopped > MAX_PAUSE)
      return {
        ok: false,
        reason:
          "Incluye una parada de más de 2 min; solo se descuentan las más cortas.",
      };
    if (gap > SAMPLE_GAP || sel[i].v === 0) paused += gap;
    else dt[i] = gap;
  }
  const moving = dt.reduce((a, b) => a + b, 0);
  if (moving < DRIFT_MIN_SECONDS)
    return {
      ok: false,
      reason: `Necesita al menos 20 min estables en movimiento; el tramo tiene ${Math.floor(moving / 60)} min.`,
    };
  const weighted = (value: (r: Sample) => number | null) => {
    let sum = 0,
      weight = 0;
    sel.forEach((r, i) => {
      const v = value(r);
      if (v === null || !dt[i]) return;
      sum += v * dt[i];
      weight += dt[i];
    });
    return { mean: weight ? sum / weight : null, share: weight / moving };
  };
  for (const [key, label] of [
    ["p", "Potencia"],
    ["hr", "FC"],
  ] as const) {
    const { share } = weighted((r) => r[key]);
    if (share < MIN_COVERAGE)
      return {
        ok: false,
        reason: `${label} registrada en el ${Math.floor(share * 100)} % del tiempo en movimiento; se necesita al menos el 95 %.`,
      };
  }
  const avgP = weighted((r) => r.p).mean,
    p4 = weighted((r) => (r.ps === null ? null : r.ps ** 4)).mean;
  if (!avgP || !p4)
    return { ok: false, reason: "Sin potencia útil en el tramo." };
  // Judge the VI as shown (two decimals) so «VI 1,10» is never rejected as above 1,10.
  const vi = Math.round((p4 ** 0.25 / avgP) * 100) / 100;
  if (vi > MAX_VI)
    return {
      ok: false,
      reason: `Potencia demasiado variable (VI ${decimal(vi, 2)}); la deriva solo es fiable en esfuerzos estables (VI ≤ 1,10).`,
    };
  const sums = [0, 1].map(() => ({ p: 0, hr: 0 }));
  let elapsed = 0;
  sel.forEach((r, i) => {
    if (r.p !== null && r.hr !== null && dt[i]) {
      const half = sums[elapsed < moving / 2 ? 0 : 1];
      half.p += r.p * dt[i];
      half.hr += r.hr * dt[i];
    }
    elapsed += dt[i];
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
    paused,
  };
}
