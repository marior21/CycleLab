import { describe, it, expect } from "vitest";
import {
  bestEfforts,
  DAY,
  compareStreams,
  projectRoute,
  routeSelection,
  nearest,
  realDataset,
  smoothPower,
  stats,
  zones,
} from "../../src/domain/analysis";
import type { Sample } from "../../src/shared/models";
import { ACTS, ATH, getStream } from "../../src/data/demo/fixtures";
const sample = (
  x: number,
  p: number | null,
  km: number | null = x / 1000,
): Sample => ({ x, km, p, ps: p, hr: null, cad: null, elev: null, v: null });
describe("analysis without invented readings", () => {
  it("keeps missing channels unknown and distinguishes zero power", () => {
    expect(stats([sample(0, null), sample(1, null)]).avgP).toBeNull();
    expect(stats([sample(0, 0), sample(1, 0)]).avgP).toBe(0);
    expect(zones([sample(0, null)], "p", 275).every((z) => z.value === 0)).toBe(
      true,
    );
  });
  it("preserves the selected sample when switching axes", () => {
    const rows = [
      sample(0, 100, 0),
      sample(10, 200, 0.1),
      sample(20, 300, 0.5),
    ];
    const i = nearest(rows, "x", 11);
    expect(nearest(rows, "km", rows[i].km!)).toBe(i);
  });
  it("does not claim an effort longer than the samples", () => {
    const rows = Array.from({ length: 60 }, (_, i) => sample(i, 200));
    expect(bestEfforts(rows, [60, 120]).map((e) => e.p)).toEqual([200, null]);
    rows[20].p = null;
    expect(bestEfforts(rows, [60])[0].p).toBeNull();
  });
  it("uses elapsed time for zone durations and smoothing", () => {
    const rows = [sample(0, 100), sample(10, 200), sample(20, 300)];
    smoothPower(rows);
    expect(rows[2].ps).toBe(200);
    expect(zones(rows, "p", 275).reduce((n, z) => n + z.value, 0)).toBe(30);
  });
  it("has deterministic demo data matching the reference", () => {
    expect(ACTS).toHaveLength(84);
    expect(ACTS[0]).toMatchObject({
      name: "3×12′ sweet spot",
      np: 236,
      dist: 46.3,
      dur: 6073,
    });
    expect(getStream(ACTS[0]).rows.length).toBeGreaterThan(500);
    expect(ATH.ftp).toBe(275);
  });
  it("never falls back to demo for a real empty account", () => {
    const data = realDataset([], [], { ftp: null, lthr: null, weight: null });
    expect(data.activities).toEqual([]);
    expect(data.goals).toEqual([]);
    expect(data.curve).toEqual([]);
    expect(data.athlete.ftp).toBeNull();
  });
  it("calculates load using only activities with TSS, including zero", () => {
    const today = Math.floor(Date.now() / DAY) * DAY;
    const activities = [
      { ...ACTS[0], date: today, tss: 42 },
      { ...ACTS[0], date: today - 3 * DAY, tss: null },
      { ...ACTS[0], date: today - 2 * DAY, tss: 0 },
      { ...ACTS[0], date: today - DAY, tss: null },
      { ...ACTS[0], date: today, tss: 42 },
    ];
    const data = realDataset(activities, [], ATH);
    expect(data.activities).toEqual(activities);
    expect(data.load).toEqual([
      { x: today - 2 * DAY, tss: 0, ctl: 0, atl: 0, tsb: 0 },
      { x: today - DAY, tss: 0, ctl: 0, atl: 0, tsb: 0 },
      { x: today, tss: 84, ctl: 2, atl: 12, tsb: 0 },
    ]);
    expect(realDataset([activities[1]], [], ATH).load).toEqual([]);
  });
});

it("retains the longer comparison and does not invent readings after the end", () => {
  const a = [sample(0, 100), sample(1, 100)],
    b = [sample(0, 200), sample(1, 200), sample(2, 200)];
  expect(compareStreams(a, b).at(-1)).toMatchObject({
    x: 2,
    pa: null,
    pb: 200,
  });
});
it("preserves partial GPS routes and selection indices", () => {
  const rows = [
    sample(0, 100),
    { ...sample(1, 100), lat: 43, lon: -4 },
    sample(2, 100),
    { ...sample(3, 100), lat: 43.01, lon: -4.01 },
  ];
  const r = projectRoute(rows);
  expect(r.pointIndices).toEqual([1, 3]);
  expect(r.points).toHaveLength(2);
  expect(routeSelection(r.pointIndices, [2, 3])).toEqual([1, 1]);
  expect(routeSelection(r.pointIndices, [2, 2])).toBeNull();
});
