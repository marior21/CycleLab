import type { Sample, Segment, Stats } from "../shared/models";
import { stats } from "./analysis";

type Point = { lat: number; lon: number };
const TOLERANCE = 35;
const STEP = 20;
export function hasGPS(r: Sample): r is Sample & Point {
  return (
    Number.isFinite(r.lat) &&
    Number.isFinite(r.lon) &&
    Math.abs(r.lat!) <= 90 &&
    Math.abs(r.lon!) <= 180
  );
}
function distance(a: Point, b: Point) {
  const rad = Math.PI / 180;
  const lat = (b.lat - a.lat) * rad;
  const lon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(lat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(lon / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(Math.min(1, h)));
}
function track(rows: Sample[]) {
  if (rows.length < 2 || !hasGPS(rows[0]) || !hasGPS(rows[rows.length - 1]))
    return null;
  const points = rows.filter(hasGPS);
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const d = distance(points[i - 1], points[i]);
    if (
      points[i].x <= points[i - 1].x ||
      points[i].x - points[i - 1].x > 30 ||
      d > 200
    )
      return null;
    length += d;
  }
  return { points, length };
}
function resample(points: Point[]) {
  const result = [points[0]];
  let remaining = STEP;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    const d = distance(a, b);
    for (let offset = remaining; offset <= d; offset += STEP) {
      const t = offset / d;
      result.push({
        lat: a.lat + (b.lat - a.lat) * t,
        lon: a.lon + (b.lon - a.lon) * t,
      });
    }
    remaining = (((remaining - d) % STEP) + STEP) % STEP || STEP;
  }
  result.push(points[points.length - 1]);
  return result;
}
export function segmentReference(rows: Sample[], segment: Segment) {
  const route = track(rows.slice(segment.i0, segment.i1 + 1));
  if (!route) return null;
  if (route.length < 100) return null;
  return { ...route, sampled: resample(route.points) };
}
export function segmentStats(rows: Sample[], i0: number, i1: number): Stats {
  return {
    ...stats(rows, i0, i1 - 1),
    gain: stats(rows, i0, i1).gain,
    dur: rows[i1].x - rows[i0].x,
    dist:
      rows[i0].km !== null && rows[i1].km !== null
        ? rows[i1].km! - rows[i0].km!
        : null,
  };
}
// Every point must follow the entire reference in order, not merely touch its endpoints.
async function sameRoute(
  a: Point[],
  b: Point[],
  yieldWork: () => Promise<void>,
) {
  let previous = new Uint8Array(b.length);
  for (let i = 0; i < a.length; i++) {
    const current = new Uint8Array(b.length);
    let reachable = false;
    for (let j = 0; j < b.length; j++) {
      if (
        ((i === 0 && j === 0) ||
          previous[j] ||
          (j > 0 && (previous[j - 1] || current[j - 1]))) &&
        distance(a[i], b[j]) <= TOLERANCE
      ) {
        current[j] = 1;
        reachable = true;
      }
    }
    if (!reachable) return false;
    previous = current;
    if (i % 16 === 0) await yieldWork();
  }
  return previous[b.length - 1] === 1;
}
function crossings(rows: Sample[], target: Point) {
  const hits: number[] = [];
  let best = -1,
    nearest = Infinity;
  rows.forEach((r, i) => {
    const d = hasGPS(r) ? distance(r, target) : Infinity;
    if (d <= TOLERANCE) {
      if (d < nearest) {
        nearest = d;
        best = i;
      }
    } else if (best >= 0) {
      hits.push(best);
      best = -1;
      nearest = Infinity;
    }
  });
  if (best >= 0) hits.push(best);
  return hits;
}
export async function matchSegment(
  reference: NonNullable<ReturnType<typeof segmentReference>>,
  rows: Sample[],
  yieldWork: () => Promise<void> = async () => {},
) {
  const starts = crossings(rows, reference.points[0]);
  const ends = crossings(rows, reference.points[reference.points.length - 1]);
  const result: { i0: number; i1: number }[] = [];
  let lastEnd = -1;
  for (const i0 of starts) {
    if (i0 < lastEnd) continue;
    for (const i1 of ends) {
      if (i1 <= i0) continue;
      const route = track(rows.slice(i0, i1 + 1));
      if (!route) continue;
      if (route.length > reference.length * 1.2 + 2 * TOLERANCE) break;
      if (
        Math.abs(route.length - reference.length) >
        Math.max(reference.length * 0.2, 2 * TOLERANCE)
      )
        continue;
      if (
        await sameRoute(reference.sampled, resample(route.points), yieldWork)
      ) {
        result.push({ i0, i1 });
        lastEnd = i1;
        break;
      }
    }
    await yieldWork();
  }
  return result;
}
