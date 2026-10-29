import { describe, expect, it } from "vitest";
import { suggestClimbs } from "../../src/domain/climbSuggestions";
import type { Sample } from "../../src/shared/models";

/** One sample per 10 m from a profile of [km, grade %] stretches, with noisy altimetry. */
function ride(stretches: [number, number][], noise = 3, spikeEvery = 0) {
  let seed = 11;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return seed / 2 ** 31 - 0.5;
  };
  const rows: Sample[] = [];
  let elev = 100,
    k = 0;
  for (const [km, grade] of stretches)
    for (let m = 0; m < km * 100; m++, k++) {
      elev += grade / 10;
      const spike = spikeEvery && k % spikeEvery === 0 ? 25 : 0;
      rows.push({
        x: k,
        km: k / 100,
        p: 200,
        ps: 200,
        hr: 140,
        cad: 90,
        elev: elev + rand() * 2 * noise + spike,
        v: 36,
      });
    }
  return rows;
}
const summary = (rows: Sample[]) =>
  suggestClimbs(rows).map((c) => ({
    from: Math.round(rows[c.i0].km! * 10) / 10,
    to: Math.round(rows[c.i1].km! * 10) / 10,
    gain: Math.round(c.gain),
    grade: Math.round(c.grade * 10) / 10,
  }));

describe("climb suggestions", () => {
  it("finds a climb on noisy altimetry with spikes", () => {
    const climbs = summary(
      ride(
        [
          [5, 0],
          [3, 6],
          [2, 0],
          [3, -6],
          [2, 0],
        ],
        3,
        97,
      ),
    );
    expect(climbs).toHaveLength(1);
    expect(Math.abs(climbs[0].from - 5)).toBeLessThanOrEqual(0.2);
    expect(Math.abs(climbs[0].to - 8)).toBeLessThanOrEqual(0.2);
    expect(Math.abs(climbs[0].gain - 180)).toBeLessThan(10);
    expect(Math.abs(climbs[0].grade - 6)).toBeLessThan(0.5);
  });
  it("keeps a short dip inside one climb but splits on a real descent", () => {
    expect(
      summary(
        ride([
          [2, 0],
          [2, 6],
          [0.2, -4],
          [2, 6],
          [2, 0],
        ]),
      ),
    ).toHaveLength(1);
    expect(
      summary(
        ride([
          [2, 0],
          [2, 6],
          [1, -5],
          [2, 6],
          [2, 0],
        ]),
      ),
    ).toHaveLength(2);
  });
  it("ignores rollers, false flats and short ramps", () => {
    expect(
      summary(
        ride([
          ...Array.from({ length: 8 }, (): [number, number][] => [
            [0.3, 5],
            [0.3, -5],
          ]).flat(),
        ]),
      ),
    ).toEqual([]);
    expect(
      summary(
        ride([
          [2, 0],
          [4, 2],
          [2, 0],
        ]),
      ),
    ).toEqual([]);
    expect(
      summary(
        ride([
          [2, 0],
          [0.4, 12],
          [2, 0],
        ]),
      ),
    ).toEqual([]);
  });
  it("never spans a GPS jump, a time gap or missing elevation", () => {
    const base = ride([
      [2, 0],
      [4, 6],
      [2, 0],
    ]);
    const jump = base.map((r) => (r.km! > 4 ? { ...r, km: r.km! + 0.5 } : r));
    const gap = base.filter((r) => r.x < 400 || r.x > 460);
    const noElev = base.map((r) =>
      r.x > 380 && r.x < 430 ? { ...r, elev: null } : r,
    );
    for (const rows of [jump, gap, noElev]) {
      const climbs = summary(rows);
      expect(climbs).toHaveLength(2);
      for (const c of climbs) expect(c.to <= 4.05 || c.from >= 4.05).toBe(true);
    }
  });
  it("needs distance and elevation", () => {
    const rows = ride([
      [2, 0],
      [3, 6],
    ]);
    expect(suggestClimbs(rows.map((r) => ({ ...r, km: null })))).toEqual([]);
    expect(suggestClimbs(rows.map((r) => ({ ...r, elev: null })))).toEqual([]);
    expect(suggestClimbs([])).toEqual([]);
  });
});
