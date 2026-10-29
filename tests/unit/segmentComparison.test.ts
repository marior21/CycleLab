import { describe, expect, it } from "vitest";
import {
  compareSegmentAttempts,
  timeSectors,
} from "../../src/domain/segmentComparison";
import type { Sample } from "../../src/shared/models";
const sample = (
  x: number,
  km: number | null,
  p: number | null = 200,
): Sample => ({ x, km, p, ps: p, hr: 150, v: 25, cad: null, elev: null });

it("aligns by distance from each start, preserving units and elapsed time sign", () => {
  const rows = compareSegmentAttempts(
    [sample(100, 10), sample(110, 10.1), sample(120, 10.2)],
    [sample(200, 20), sample(215, 20.1), sample(230, 20.2)],
  );
  expect(rows[0]).toMatchObject({
    x: 0,
    ap: 200,
    bp: 200,
    delta: 0,
    ahr: 150,
    av: 25,
  });
  expect(rows.at(-1)?.delta).toBeCloseTo(-10);
});

it("interpolates short spans and never stretches or extrapolates unequal distances", () => {
  const rows = compareSegmentAttempts(
    [sample(0, 0, 0), sample(20, 0.1, 200)],
    [sample(0, 0), sample(10, 0.05), sample(30, 0.15)],
  );
  expect(rows.find((r) => r.x === 0.05)).toMatchObject({ ap: 100, delta: 0 });
  expect(rows.at(-1)).toMatchObject({ ap: null, delta: null, bp: 200 });
});

it("inserts breaks for time gaps, distance gaps and missing distance even on identical grids", () => {
  for (const rows of [
    [sample(0, 0), sample(31, 0.1)],
    [sample(0, 0), sample(20, 0.21)],
    [sample(0, 0), sample(10, null), sample(20, 0.1)],
  ]) {
    const result = compareSegmentAttempts(rows, rows);
    expect(
      result.some((r) => r.ap === null && r.bp === null && r.delta === null),
    ).toBe(true);
    expect(result.at(-1)?.ap).toBe(200);
  }
});

it("preserves missing sensors and measured zeros independently", () => {
  const rows = compareSegmentAttempts(
    [sample(0, 0, null), sample(20, 0.1, 0)],
    [sample(0, 0), sample(10, 0.05), sample(20, 0.1)],
  );
  expect(rows[1]).toMatchObject({ ap: null, ahr: 150, delta: 0 });
  expect(rows.at(-1)?.ap).toBe(0);
});

it("rejects reversed/reset distances, unordered times and absent origins", () => {
  const valid = [sample(0, 0), sample(10, 0.1)];
  for (const invalid of [
    [],
    [sample(0, null), sample(10, 0.1)],
    [sample(0, 0.1), sample(10, 0)],
    [sample(10, 0), sample(0, 0.1)],
  ])
    expect(compareSegmentAttempts(invalid, valid)).toEqual([]);
});

it("includes pauses in elapsed time and uses departure at duplicate distance", () => {
  const rows = compareSegmentAttempts(
    [sample(0, 0), sample(10, 0.1), sample(50, 0.1), sample(60, 0.2)],
    [sample(0, 0), sample(10, 0.1), sample(20, 0.2)],
  );
  expect(rows.find((r) => r.x === 0.1)?.delta).toBe(40);
  expect(rows.at(-1)?.delta).toBe(40);
});

it("does not turn subtraction noise from different distance origins into time differences", () => {
  const a = Array.from({ length: 51 }, (_, i) => sample(i * 2, i / 100));
  const b = Array.from({ length: 51 }, (_, i) =>
    sample(200 + i * 2, (100 + i) / 100),
  );
  const rows = compareSegmentAttempts(a, b);
  expect(rows.filter((r) => r.delta !== null).every((r) => r.delta === 0)).toBe(
    true,
  );
});

describe("time sectors", () => {
  const row = (x: number, delta: number | null) => ({ x, delta });
  it("splits the cumulative difference and adds up to the total", () => {
    const rows = [
      row(0, 0),
      row(0.5, -2),
      row(1, -3),
      row(1.5, 1),
      row(2.4, 4),
    ];
    const sectors = timeSectors(rows, 1);
    expect(sectors.map((s) => [s.from, s.to])).toEqual([
      [0, 1],
      [1, 2],
      [2, 2.4],
    ]);
    expect(sectors[0].change).toBeCloseTo(-3);
    // 2 km lies between 1.5 (1) and 2.4 (4): interpolated to 1 + 3 × 5/9.
    expect(sectors[1].change).toBeCloseTo(17 / 3);
    expect(sectors[2].change).toBeCloseTo(4 / 3);
    expect(sectors.reduce((s, x) => s + x.change, 0)).toBeCloseTo(4);
  });
  it("merges stretches whose boundary falls in a gap and flags them", () => {
    const rows = [
      row(0, 0),
      row(0.9, 2),
      row(1.05, null),
      row(1.2, 3),
      row(3, 5),
    ];
    const sectors = timeSectors(rows, 1);
    expect(sectors.map((s) => [s.from, s.to, s.gap])).toEqual([
      [0, 2, true],
      [2, 3, false],
    ]);
    expect(sectors.reduce((s, x) => s + x.change, 0)).toBeCloseTo(5);
  });
  it("stops at the last known difference and rejects unusable input", () => {
    const rows = [row(0, 0), row(1.5, -1), row(2, null)];
    expect(timeSectors(rows, 1).at(-1)).toMatchObject({ to: 1.5 });
    expect(timeSectors([], 1)).toEqual([]);
    expect(timeSectors([row(0, 0)], 1)).toEqual([]);
    expect(timeSectors([row(0, null), row(1, 2)], 1)).toEqual([]);
  });
  it("works on real comparison rows", () => {
    const a = Array.from({ length: 31 }, (_, i) => sample(i * 10, i * 0.1));
    const b = Array.from({ length: 31 }, (_, i) => sample(i * 11, i * 0.1));
    const sectors = timeSectors(compareSegmentAttempts(a, b), 1);
    expect(sectors).toHaveLength(3);
    for (const s of sectors) expect(s.change).toBeCloseTo(-10);
  });
});
