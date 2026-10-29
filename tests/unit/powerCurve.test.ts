import { describe, expect, it } from "vitest";
import {
  criticalPower,
  newRecords,
  periodBests,
  periodZones,
} from "../../src/domain/powerCurve";
import { demoDataset } from "../../src/data/demo/provider";
import { DAY } from "../../src/domain/analysis";
import type { Activity, ActivityDetail } from "../../src/shared/models";

const activity = (id: string, date: number) =>
  ({ ...demoDataset.activities[0], id, date }) as Activity;
describe("power curve references", () => {
  it("keeps the activity and range of each period record", () => {
    const data = {
      activities: [
        activity("a", 10 * DAY),
        activity("b", 20 * DAY),
        activity("c", 40 * DAY),
      ],
      efforts: {
        a: [{ t: 300, l: "5 min", p: 300, i0: 1, i1: 301 }],
        b: [
          { t: 300, l: "5 min", p: 320, i0: 5, i1: 305 },
          { t: 60, l: "1 min", p: null },
        ],
        c: [{ t: 300, l: "5 min", p: 400, i0: 0, i1: 300 }],
      },
    };
    const bests = periodBests(data, 0, 30 * DAY);
    expect(bests.get(300)).toEqual({
      t: 300,
      p: 320,
      activityId: "b",
      date: 20 * DAY,
      i0: 5,
      i1: 305,
    });
    expect(bests.has(60)).toBe(false);
  });
  it("fits CP and W′ only when the efforts allow a defensible model", () => {
    // Synthetic athlete: CP 280 W, W′ 20 kJ.
    const ideal = (t: number) => 280 + 20000 / t;
    const fit = criticalPower(ideal);
    expect(fit).toMatchObject({ ok: true, cp: 280 });
    expect(fit.ok && Math.round(fit.wPrime)).toBe(20000);
    expect(criticalPower((t) => (t === 600 ? null : ideal(t)))).toEqual({
      ok: false,
      reason: "Faltan esfuerzos de 10 min en el periodo.",
    });
    expect(criticalPower((t) => (t === 1200 ? 400 : ideal(t))).ok).toBe(false);
    // Flat submaximal efforts give an implausible W′.
    expect(criticalPower((t) => 250 + 300 / t).ok).toBe(false);
    const at = (t: number) =>
      (demoDataset.curve.find((r) => r.x === t)?.s2026 ?? null) as
        number | null;
    expect(criticalPower(at).ok).toBe(true);
  });
  it("counts zone time only where samples and a dated FTP exist", () => {
    const rows = [0, 1, 2, 3].map((x) => ({
      x,
      km: null,
      p: x < 2 ? 100 : 280,
      ps: null,
      hr: null,
      cad: null,
      elev: null,
      v: null,
    }));
    const detail = { rows } as unknown as ActivityDetail;
    const result = periodZones([
      { activity: activity("a", 0), detail, ftp: 250 },
      { activity: activity("b", 0), detail, ftp: null },
      { activity: activity("c", 0), detail: null, ftp: 250 },
      {
        activity: activity("d", 0),
        detail: {
          rows: rows.map((r) => ({ ...r, p: null })),
        } as unknown as ActivityDetail,
        ftp: 250,
      },
    ]);
    expect(result.coverage).toEqual({
      activities: 4,
      counted: 1,
      noSamples: 1,
      noPower: 1,
      noFtp: 1,
    });
    expect(result.zones.find((z) => z.label === "Z1")?.value).toBe(2);
    expect(result.zones.find((z) => z.label === "Z5")?.value).toBe(2);
  });
});

describe("new records", () => {
  const e = (t: number, p: number | null, i0 = 0) => ({
    t,
    l: `${t} s`,
    p,
    i0,
    i1: i0 + t,
  });
  const data = {
    activities: [
      activity("old", 10 * DAY),
      activity("seen", 20 * DAY),
      activity("new1", 30 * DAY),
      activity("new2", 31 * DAY),
    ],
    efforts: {
      old: [e(300, 300), e(1200, 260)],
      seen: [e(300, 310)],
      new1: [e(300, 320, 40), e(1200, 250), e(5, 900)],
      new2: [e(300, 315), e(1200, null)],
    },
  };
  it("reports only later bests that beat everything up to the mark", () => {
    const records = newRecords(data, 20 * DAY);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      t: 300,
      p: 320,
      activityId: "new1",
      i0: 40,
      i1: 340,
      previous: { p: 310, activityId: "seen" },
    });
  });
  it("ignores durations without an earlier effort and missing power", () => {
    expect(newRecords(data, 20 * DAY).some((r) => r.t === 5)).toBe(false);
    expect(newRecords(data, 20 * DAY).some((r) => r.t === 1200)).toBe(false);
  });
  it("counts activities on the mark itself as already seen", () => {
    expect(newRecords(data, 31 * DAY)).toEqual([]);
    expect(newRecords(data, 30 * DAY)).toEqual([]);
  });
  it("does not report ties", () => {
    const tie = {
      ...data,
      efforts: { ...data.efforts, new1: [e(300, 310)], new2: [] },
    };
    expect(newRecords(tie, 20 * DAY)).toEqual([]);
  });
});
