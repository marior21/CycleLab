import type { Sample } from "../shared/models";

const SMOOTH_M = 100,
  MAX_STEP_KM = 0.2,
  MAX_STEP_S = 30,
  START_GAIN = 10,
  TRIM = 3,
  MIN_KM = 0.5,
  MIN_GAIN = 40,
  MIN_GRADE = 3;
export interface ClimbSuggestion {
  i0: number;
  i1: number;
  dist: number;
  gain: number;
  /** Average grade in % from the smoothed profile. */
  grade: number;
}

/** Runs of samples with distance and elevation and no GPS jump or gap. */
function runs(rows: Sample[]) {
  const out: number[][] = [];
  let run: number[] = [];
  rows.forEach((r, i) => {
    if (r.km === null || r.elev === null) return;
    const prev = run.length ? rows[run.at(-1)!] : null;
    if (
      prev &&
      (r.km < prev.km! ||
        r.km - prev.km! > MAX_STEP_KM ||
        r.x - prev.x > MAX_STEP_S)
    ) {
      out.push(run);
      run = [];
    }
    run.push(i);
  });
  out.push(run);
  return out.filter((r) => r.length > 1);
}

/** Elevation averaged over ±100 m of distance, so barometric noise and spikes fade. */
function smooth(rows: Sample[], run: number[]) {
  const km = run.map((i) => rows[i].km!),
    elev = run.map((i) => rows[i].elev!),
    out: number[] = [];
  let lo = 0,
    hi = 0,
    sum = 0;
  for (let k = 0; k < run.length; k++) {
    while (hi < run.length && km[hi] <= km[k] + SMOOTH_M / 1000)
      sum += elev[hi++];
    while (km[lo] < km[k] - SMOOTH_M / 1000) sum -= elev[lo++];
    out.push(sum / (hi - lo));
  }
  return out;
}

/**
 * Climbs on the smoothed profile: from a low point, gain at least 40 m over
 * 0,5 km or more at 3 % or steeper. A descent of more than 15 m (or 10 % of
 * the gain so far) ends the climb at its top; a GPS jump or gap ends it too.
 */
export function suggestClimbs(rows: Sample[]): ClimbSuggestion[] {
  const out: ClimbSuggestion[] = [];
  for (const run of runs(rows)) {
    const elev = smooth(rows, run),
      km = (k: number) => rows[run[k]].km!;
    const close = (low: number, top: number) => {
      // Flat stretches before and after belong to the road, not the climb.
      // Last point near the bottom and first near the top, so a blip on the flat does not stop the trim.
      const base = elev[low],
        peak = elev[top];
      for (let k = top; k > low; k--)
        if (elev[k] <= base + TRIM) {
          low = k;
          break;
        }
      for (let k = low; k < top; k++)
        if (elev[k] >= peak - TRIM) {
          top = k;
          break;
        }
      const dist = km(top) - km(low),
        gain = elev[top] - elev[low],
        grade = dist > 0 ? gain / (dist * 10) : 0;
      if (dist >= MIN_KM && gain >= MIN_GAIN && grade >= MIN_GRADE)
        out.push({ i0: run[low], i1: run[top], dist, gain, grade });
    };
    let low = 0,
      top: number | null = null;
    for (let k = 1; k < run.length; k++) {
      if (top === null) {
        if (elev[k] < elev[low]) low = k;
        else if (elev[k] - elev[low] >= START_GAIN) top = k;
        continue;
      }
      if (elev[k] >= elev[top]) top = k;
      else if (
        elev[top] - elev[k] >
        Math.max(15, (elev[top] - elev[low]) * 0.1)
      ) {
        close(low, top);
        low = k;
        top = null;
      }
    }
    if (top !== null) close(low, top);
  }
  return out;
}
