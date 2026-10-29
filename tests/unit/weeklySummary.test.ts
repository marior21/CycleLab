import { describe, expect, it } from "vitest";
import { ACTS } from "../../src/data/demo/fixtures";
import { DAY } from "../../src/domain/analysis";
import { weekStart, weeklySummary } from "../../src/domain/weeklySummary";

// Wednesday 2026-10-28 12:00 UTC → week starts Monday 26 Oct.
const today = Date.UTC(2026, 9, 28, 12);
const act = (id: string, date: number, extra = {}) => ({
  ...ACTS[0],
  id,
  date,
  dur: 3600,
  dist: 30,
  elev: 300,
  tss: 50,
  IF: 0.7,
  ...extra,
});

describe("weekly summary", () => {
  it("starts weeks on Monday UTC", () => {
    expect(weekStart(today)).toBe(Date.UTC(2026, 9, 26));
    expect(weekStart(Date.UTC(2026, 9, 26))).toBe(Date.UTC(2026, 9, 26));
  });

  it("marks partial weeks, compares the same days and keeps missing data out of totals", () => {
    const mon = Date.UTC(2026, 9, 26, 8);
    const activities = [
      act("now1", mon),
      act("now2", mon + DAY, { dist: null, IF: 0.9 }),
      act("prev1", mon - 7 * DAY, { elev: 100 }),
      // Previous Friday: outside the first three days, so not compared.
      act("prev2", mon - 3 * DAY),
    ];
    const s = weeklySummary(
      {
        today,
        activities,
        efforts: {
          now1: [{ t: 300, l: "5 min", p: 280, i0: 1, i1: 30 }],
          prev2: [{ t: 300, l: "5 min", p: 400 }],
        },
      },
      0,
      "previous",
    );
    expect(s.partial).toBe(true);
    expect(s.days).toBe(3);
    expect(s.activities.map((a) => a.id)).toEqual(["now1", "now2"]);
    expect(s.reference[0].map((a) => a.id)).toEqual(["prev1"]);
    expect(s.metrics.dist.value).toBe(30);
    expect(s.metrics.dist.missing.map((a) => a.id)).toEqual(["now2"]);
    expect(s.metrics.elev).toMatchObject({ value: 600, base: 100, delta: 500 });
    expect(s.intensity.find((i) => i.key === "hard")!.seconds).toBe(3600);
    expect(s.efforts.find((e) => e.t === 300)).toMatchObject({
      now: { p: 280, activity: { id: "now1" } },
      before: null,
    });
  });

  it("averages four reference weeks and leaves unknown bases empty", () => {
    const mon = Date.UTC(2026, 9, 19, 8);
    const s = weeklySummary(
      {
        today,
        activities: [
          act("w1", mon),
          act("w2", mon - 7 * DAY, { tss: 150 }),
          act("w3", mon - 14 * DAY),
          act("w4", mon - 21 * DAY, { tss: null }),
        ],
        efforts: {},
      },
      1,
      "average",
    );
    expect(s.partial).toBe(false);
    // The fourth reference week is empty: a real zero, not unknown.
    expect(s.metrics.dur).toMatchObject({ value: 3600, base: 2700 });
    // w4 only has an activity without TSS: that week, and so the base, is unknown.
    expect(s.metrics.tss).toMatchObject({ base: null, baseMissing: 1 });
    expect(s.sessions).toEqual({ value: 1, base: 0.75 });
  });
});
