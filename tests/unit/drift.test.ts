import { describe, expect, it } from "vitest";
import { smoothPower } from "../../src/domain/analysis";
import { cardiacDrift } from "../../src/domain/drift";
import type { Sample } from "../../src/shared/models";

const ride = (
  seconds: number,
  at: (x: number) => Partial<Sample> = () => ({}),
): Sample[] =>
  Array.from({ length: seconds + 1 }, (_, x) => ({
    x,
    km: x * 0.008,
    p: 200,
    ps: 200,
    hr: 140,
    cad: 90,
    elev: null,
    v: 29,
    ...at(x),
  }));
const reason = (rows: Sample[]) => {
  const d = cardiacDrift(rows);
  return d.ok ? "" : d.reason;
};

describe("cardiac drift", () => {
  it("is zero for steady power and heart rate", () => {
    const d = cardiacDrift(ride(40 * 60));
    expect(d.ok && d.drift).toBeCloseTo(0);
  });
  it("measures how much heart rate rose for the same power", () => {
    // First half 200 W / 140 bpm, second 200 W / 150 bpm.
    const d = cardiacDrift(
      ride(40 * 60, (x) => ({ hr: x < 20 * 60 ? 140 : 150 })),
    );
    expect(d).toMatchObject({ ok: true });
    if (!d.ok) return;
    expect(d.first).toBeCloseTo(200 / 140);
    expect(d.second).toBeCloseTo(200 / 150, 2);
    expect(d.drift).toBeCloseTo((1 - 140 / 150) * 100, 1);
  });
  it("uses only the selected range", () => {
    const rows = ride(60 * 60, (x) => ({ hr: x < 30 * 60 ? 140 : 170 }));
    const d = cardiacDrift(rows, 0, 25 * 60);
    expect(d.ok && d.drift).toBeCloseTo(0);
  });
  it("rejects short stretches and pauses or stops over 2 min", () => {
    expect(reason(ride(19 * 60))).toMatch(/al menos 20 min/);
    const gap = ride(40 * 60).filter((r) => r.x < 600 || r.x > 730);
    expect(reason(gap)).toMatch(/pausa de 132 s/);
    expect(
      reason(ride(40 * 60, (x) => (x > 600 && x < 730 ? { v: 0 } : {}))),
    ).toMatch(/parada de más de 2 min/);
  });
  it("leaves pauses and stops up to 2 min out of the calculation", () => {
    // A 90 s gap and a 100 s stop at 0 W and 100 bpm must not change a steady ride.
    const rows = ride(42 * 60, (x) =>
      x > 1500 && x < 1600 ? { v: 0, p: 0, ps: 0, hr: 100 } : {},
    ).filter((r) => r.x < 600 || r.x > 690);
    const d = cardiacDrift(rows);
    expect(d).toMatchObject({ ok: true, vi: 1 });
    if (!d.ok) return;
    expect(d.drift).toBeCloseTo(0);
    expect(d.paused).toBeCloseTo(91 + 100, -1);
    // Moving time, not elapsed time, must reach 20 min.
    const short = ride(21 * 60).filter((r) => r.x < 300 || r.x > 400);
    expect(reason(short)).toMatch(/en movimiento; el tramo tiene 19 min/);
  });
  it("splits the halves by moving time", () => {
    // A 1 min gap at 10 min; heart rate rises at 22 min elapsed, 21 min moving: the midpoint.
    const rows = ride(42 * 60 + 60, (x) => ({
      hr: x < 21 * 60 + 60 ? 140 : 150,
    })).filter((r) => r.x < 600 || r.x > 660);
    const d = cardiacDrift(rows);
    expect(d.ok && d.drift).toBeCloseTo((1 - 140 / 150) * 100, 0);
  });
  it("rejects missing sensors", () => {
    expect(
      reason(ride(40 * 60, (x) => (x < 3 * 60 ? { hr: null } : {}))),
    ).toMatch(/FC registrada en el 92 % del tiempo en movimiento/);
    expect(
      reason(ride(40 * 60, (x) => (x < 3 * 60 ? { p: null, ps: null } : {}))),
    ).toMatch(/Potencia registrada/);
    expect(reason(ride(40 * 60, () => ({ hr: null })))).toMatch(/FC/);
  });
  it("rejects variable efforts such as intervals", () => {
    const intervals = ride(40 * 60, (x) => {
      const p = x % 120 < 30 ? 600 : 100;
      return { p, ps: p };
    });
    expect(reason(intervals)).toMatch(/demasiado variable/);
  });
  it("accepts a VI that rounds to the 1,10 limit", () => {
    // One surge per 10 min gives a raw VI of 1,1045, shown as 1,10.
    const edge = smoothPower(
      ride(40 * 60, (x) => ({ p: x % 600 < 60 ? 348 : 185, ps: null })),
    );
    const d = cardiacDrift(edge);
    expect(d.ok ? d.vi : d.reason).toBe(1.1);
  });
});
