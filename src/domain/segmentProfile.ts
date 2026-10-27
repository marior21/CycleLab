import type { Sample } from "../shared/models";

export function averageGrade(
  start: number | null | undefined,
  end: number | null | undefined,
  distanceKm: number | null,
) {
  return start != null && end != null && distanceKm !== null && distanceKm > 0
    ? (end - start) / (distanceKm * 10)
    : null;
}

export function segmentProfile(rows: Sample[]) {
  return rows.map((row, i) => {
    let start = i - 1;
    while (
      start > 0 &&
      row.km !== null &&
      rows[start].km !== null &&
      row.km >= rows[start].km! &&
      (row.km - rows[start].km!) * 1000 < 5 &&
      row.x - rows[start - 1].x <= 30
    )
      start--;
    const previous = rows[start];
    const distance =
      row.km !== null && previous?.km != null
        ? (row.km - previous.km) * 1000
        : null;
    return {
      x: row.x - rows[0].x,
      elev: row.elev,
      p: row.p,
      hr: row.hr,
      v: row.v,
      grade:
        distance !== null &&
        distance >= 5 &&
        row.elev !== null &&
        previous.elev !== null &&
        row.x - previous.x <= 30
          ? ((row.elev - previous.elev) / distance) * 100
          : null,
    };
  });
}

// Each metric keeps its original values; only plotted coordinates use a shared range.
export function overlayProfile(rows: ReturnType<typeof segmentProfile>) {
  const keys = ["elev", "p", "hr", "v"] as const;
  const bounds = keys.map((key) => {
    const values = rows
      .map((row) => row[key])
      .filter((v): v is number => v !== null);
    const min = values.reduce((a, b) => Math.min(a, b), Infinity);
    const max = values.reduce((a, b) => Math.max(a, b), -Infinity);
    return { key, min, max };
  });
  return rows.map((row) => ({
    ...row,
    ...Object.fromEntries(
      bounds.map(({ key, min, max }) => [
        `${key}Plot`,
        row[key] === null
          ? null
          : max === min
            ? 50
            : ((row[key] - min) / (max - min)) * 100,
      ]),
    ),
  }));
}
