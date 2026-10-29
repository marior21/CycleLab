import type { Activity, Sample } from "../shared/models";
import { detectIntervalPattern } from "./intervalPattern";

export const BLOCK_ENTER = 0.88,
  BLOCK_EXIT = 0.75;
const WINDOW = 10,
  MIN_BLOCK = 20,
  LONG_BLOCK = 60,
  MERGE_GAP = 15,
  SERIES = 5,
  SERIES_GAP = 90,
  MAX_GAP = 30;
export interface WorkBlock {
  /** Elapsed seconds, stable if samples are downloaded again. */
  x0: number;
  x1: number;
  i0: number;
  i1: number;
  dur: number;
  avgP: number | null;
  hr: number | null;
}

/** Power smoothed over a centred 10 s window, ignoring missing samples. */
function smooth(rows: Sample[]) {
  const out: (number | null)[] = [];
  let lo = 0,
    hi = 0,
    sum = 0,
    n = 0;
  for (let i = 0; i < rows.length; i++) {
    while (hi < rows.length && rows[hi].x <= rows[i].x + WINDOW / 2) {
      const p = rows[hi++].p;
      if (p !== null) {
        sum += p;
        n++;
      }
    }
    while (rows[lo].x < rows[i].x - WINDOW / 2) {
      const p = rows[lo++].p;
      if (p !== null) {
        sum -= p;
        n--;
      }
    }
    out.push(n ? sum / n : null);
  }
  return out;
}

/** Index range → block with time-weighted averages. */
export function workBlock(rows: Sample[], i0: number, i1: number): WorkBlock {
  const avg = (key: "p" | "hr") => {
    let sum = 0,
      weight = 0;
    for (let i = i0; i < i1; i++) {
      const v = rows[i][key],
        dt = rows[i + 1].x - rows[i].x;
      if (v === null || dt > MAX_GAP) continue;
      sum += v * dt;
      weight += dt;
    }
    return weight ? Math.round(sum / weight) : null;
  };
  return {
    x0: rows[i0].x,
    x1: rows[i1].x,
    i0,
    i1,
    dur: rows[i1].x - rows[i0].x,
    avgP: avg("p"),
    hr: avg("hr"),
  };
}

/**
 * Work blocks on the power signal: they start above 88 % of FTP and end below
 * 75 %, so over-unders stay whole, and blocks less than 15 s apart are joined.
 * A gap over 30 s ends a block. Efforts of 60 s or more are always proposed;
 * shorter ones (20–60 s) only as a series of 5 or more, like 30/30, so isolated
 * surges on a hilly ride are not.
 */
export function detectWorkBlocks(rows: Sample[], ftp: number | null) {
  if (!ftp || ftp <= 0 || rows.length < 2) return [];
  const power = smooth(rows),
    spans: [number, number][] = [];
  let start: number | null = null;
  const close = (end: number) => {
    const last = spans.at(-1);
    if (start === null) return;
    if (last && rows[start].x - rows[last[1]].x <= MERGE_GAP) last[1] = end;
    else spans.push([start, end]);
    start = null;
  };
  for (let i = 0; i < rows.length; i++) {
    if (start !== null && rows[i].x - rows[i - 1].x > MAX_GAP) close(i - 1);
    const p = power[i];
    if (start === null) {
      if (p !== null && p >= ftp * BLOCK_ENTER) start = i;
    } else if (p === null || p < ftp * BLOCK_EXIT) close(i - 1);
  }
  if (start !== null) close(rows.length - 1);
  const blocks = spans
    .map(([i0, i1]) => workBlock(rows, i0, i1))
    .filter((b) => b.dur >= MIN_BLOCK);
  const keep = blocks.map((b) => b.dur >= LONG_BLOCK);
  for (let k = 0; k < blocks.length;) {
    let end = k;
    while (
      end + 1 < blocks.length &&
      !keep[k] &&
      !keep[end + 1] &&
      blocks[end + 1].x0 - blocks[end].x1 <= SERIES_GAP
    )
      end++;
    if (!keep[k] && end - k + 1 >= SERIES) keep.fill(true, k, end + 1);
    k = end + 1;
  }
  return blocks.filter((_, k) => keep[k]);
}

/** Repetitions among the blocks, judged by the lap-based detector. */
export function blockPattern(
  rows: Sample[],
  blocks: WorkBlock[],
): Activity["intervalPattern"] {
  const laps = blocks.flatMap((b, k) => {
    const next = blocks[k + 1];
    return next ? [b, workBlock(rows, b.i1, next.i0)] : [b];
  });
  return detectIntervalPattern(laps);
}

/** Saved manual blocks (elapsed seconds) mapped onto the current samples. */
export function savedBlocks(rows: Sample[], ranges: [number, number][]) {
  const at = (x: number) => {
    const i = rows.findIndex((r) => r.x >= x);
    return i < 0 ? rows.length - 1 : i;
  };
  return ranges
    .map(([x0, x1]) => workBlock(rows, at(x0), at(x1)))
    .filter((b) => b.i1 > b.i0)
    .sort((a, b) => a.x0 - b.x0);
}
