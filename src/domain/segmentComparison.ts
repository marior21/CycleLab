import type { Sample } from "../shared/models";

type Point = {
  km: number;
  t: number;
  p: number | null;
  hr: number | null;
  v: number | null;
  index: number;
};
const keys = ["t", "p", "hr", "v"] as const;
const empty = { t: null, p: null, hr: null, v: null };

function continuous(a: Point, b: Point) {
  return (
    b.index === a.index + 1 &&
    b.t > a.t &&
    b.t - a.t <= 30 &&
    b.km > a.km &&
    b.km - a.km <= 0.2
  );
}

function track(rows: Sample[]) {
  const origin = rows[0];
  if (!origin || origin.km === null || !Number.isFinite(origin.km)) return [];
  const points: Point[] = [];
  for (const [index, row] of rows.entries()) {
    if (row.km === null || !Number.isFinite(row.km)) continue;
    const previous = points.at(-1);
    // Never sort a reversed/reset distance stream into an apparently valid route.
    if (
      previous &&
      (row.km - origin.km < previous.km || row.x - origin.x <= previous.t)
    )
      return [];
    points.push({
      km: row.km - origin.km,
      t: row.x - origin.x,
      p: row.p,
      hr: row.hr,
      v: row.v,
      index,
    });
  }
  return points;
}

// Inputs are slices of persisted attempts: the matcher has already checked route and direction.
export function compareSegmentAttempts(a: Sample[], b: Sample[]) {
  const tracks = [track(a), track(b)];
  if (tracks.some((points) => points.length < 2 || points.at(-1)!.km <= 0))
    return [];
  const distances = new Set<number>();
  for (const points of tracks) {
    points.forEach((point, i) => {
      distances.add(point.km);
      const previous = points[i - 1];
      if (previous && !continuous(previous, point) && point.km > previous.km)
        distances.add((previous.km + point.km) / 2);
    });
  }
  const cursors = [0, 0];
  return [...distances]
    .sort((x, y) => x - y)
    .map((km) => {
      const values = tracks.map((points, n) => {
        while (
          cursors[n] + 1 < points.length &&
          points[cursors[n] + 1].km <= km
        )
          cursors[n]++;
        const left = points[cursors[n]],
          right = points[cursors[n] + 1];
        // At a stop, use departure time; elapsed time therefore includes the pause.
        if (left.km === km) return left;
        if (!right || km < left.km || !continuous(left, right)) return empty;
        const ratio = (km - left.km) / (right.km - left.km);
        return Object.fromEntries(
          keys.map((key) => [
            key,
            left[key] === null || right[key] === null
              ? null
              : left[key]! + (right[key]! - left[key]!) * ratio,
          ]),
        ) as typeof empty | Pick<Point, (typeof keys)[number]>;
      });
      const [av, bv] = values;
      return {
        x: km,
        ap: av.p,
        bp: bv.p,
        ahr: av.hr,
        bhr: bv.hr,
        av: av.v,
        bv: bv.v,
        // Sub-millisecond floating-point noise must not create a spurious time scale.
        delta:
          av.t === null || bv.t === null
            ? null
            : Math.round((av.t - bv.t) * 1000) / 1000 || 0,
      };
    });
}
