import { describe, it, expect } from "vitest";
import {
  classifyActivity,
  weeklyActivityTotals,
} from "../../src/domain/classification";
import { normalizeActivity } from "../../src/main/garmin";
import type { Activity, Lap } from "../../src/shared/models";
const base = normalizeActivity({
  activityId: 1,
  activityName: "Morning ride",
  duration: 3600,
  startTimeGMT: "2026-10-20 08:00:00",
  activityType: { typeKey: "road_biking" },
});
const classify = (patch: Partial<Activity>) =>
  classifyActivity({ ...base, ...patch });
describe("automatic activity classification", () => {
  it("does not default ordinary or unknown rides to endurance", () => {
    expect(base.type).toBe("cycling");
    expect(classify({ garminType: "new_type" }).type).toBe("cycling");
  });
  it.each([
    ["mountain_biking", "mtb"],
    ["indoor_cycling", "indoor"],
    ["virtual_ride", "indoor"],
    ["gravel_cycling", "gravel"],
  ])("uses Garmin subtype %s", (garminType, type) => {
    expect(classify({ garminType })).toMatchObject({
      type,
      classification: { estimated: false },
    });
  });
  it.each([
    ["3×12 sweet spot", "intervals"],
    ["Series 4x8", "intervals"],
    ["Rodaje Z2", "endurance"],
    ["Fondo del domingo", "endurance"],
    ["Subida al puerto", "climb"],
    ["BTT por el monte", "mtb"],
    ["Rodillo en casa", "indoor"],
    ["Gravel por el valle", "gravel"],
  ])("infers %s from the name and explains its uncertainty", (name, type) => {
    const a = classify({ name });
    expect(a.type).toBe(type);
    expect(a.classification?.estimated).toBe(true);
    expect(a.classification?.reason).toContain("nombre");
  });
  it("distinguishes structured work/rest laps from automatic laps", () => {
    const lap = (kind: string) => ({ kind, dur: 300 }) as Lap;
    expect(
      classifyActivity(base, {
        laps: [lap("active"), lap("recovery"), lap("active")],
      }),
    ).toMatchObject({ type: "intervals", structuredIntervals: true });
    expect(
      classifyActivity(base, {
        laps: [lap("active"), lap("active"), lap("active")],
      }).type,
    ).toBe("cycling");
  });
  it("retains structured evidence during later summary imports", () => {
    expect(
      classify({ structuredIntervals: true, garminType: "indoor_cycling" })
        .type,
    ).toBe("intervals");
  });
  it("marks terrain and steady power classifications as estimates", () => {
    expect(classify({ dist: 40, elev: 1200 })).toMatchObject({
      type: "climb",
      classification: { estimated: true },
    });
    expect(classify({ IF: 0.7, np: 210, avgP: 200 })).toMatchObject({
      type: "endurance",
      classification: { estimated: true },
    });
    expect(classify({ IF: 0.7, np: null, avgP: 200 }).type).toBe("cycling");
    expect(classify({ IF: 0.95, np: 300, avgP: 200 }).type).toBe("cycling");
  });
  it("includes every category in weekly totals", () => {
    const types = [
      "endurance",
      "intervals",
      "climb",
      "mtb",
      "indoor",
      "gravel",
      "cycling",
    ] as const;
    const totals = weeklyActivityTotals(
      types.map((type) => ({ ...base, type, tss: 10 })),
    );
    expect(totals.total).toBe(70);
    expect(totals.indoor).toBe(10);
    expect(totals.cycling).toBe(10);
    expect(weeklyActivityTotals([{ ...base, tss: null }]).complete).toBe(false);
  });
});
