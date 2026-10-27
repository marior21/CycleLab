import { describe, it, expect } from "vitest";
import { detectIntervalPattern } from "../../src/domain/intervalPattern";
import { classifyActivity } from "../../src/domain/classification";
import { normalizeActivity } from "../../src/main/garmin";
import type { Lap } from "../../src/shared/models";
const lap = (dur: number, avgP: number | null) =>
  ({ dur, avgP, kind: "lap" }) as Lap;
// Durations and power visible in the reported session; no identity or GPS.
const repeated = [
  lap(1026, 151),
  lap(243, 313),
  lap(136, 41),
  lap(241, 313),
  lap(154, 35),
  lap(243, 311),
  lap(174, 49),
  lap(242, 309),
  lap(177, 28),
  lap(1686, 175),
];
describe("measured work/recovery patterns", () => {
  it("recognizes four unlabelled 4-minute repetitions without using the title or FTP", () => {
    expect(detectIntervalPattern(repeated)).toEqual({
      repetitions: 4,
      workSeconds: 242,
      workWatts: 312,
      recoveryWatts: 42,
    });
  });
  it("does not confuse steady automatic laps with intervals", () => {
    expect(
      detectIntervalPattern(Array.from({ length: 10 }, () => lap(300, 200))),
    ).toBeUndefined();
  });
  it("rejects irregular hills, insufficient repetitions, and nearly constant power", () => {
    expect(
      detectIntervalPattern([
        lap(240, 300),
        lap(120, 80),
        lap(600, 310),
        lap(120, 80),
        lap(95, 270),
      ]),
    ).toBeUndefined();
    expect(detectIntervalPattern(repeated.slice(0, 5))).toBeUndefined();
    expect(
      detectIntervalPattern([
        lap(240, 300),
        lap(120, 250),
        lap(240, 305),
        lap(120, 250),
        lap(240, 310),
      ]),
    ).toBeUndefined();
  });
  it("does not bridge missing power or long pauses", () => {
    const missing = [...repeated];
    missing[4] = lap(154, null);
    expect(detectIntervalPattern(missing)).toBeUndefined();
    const stopped = [...repeated];
    stopped[4] = lap(1200, 0);
    expect(detectIntervalPattern(stopped)).toBeUndefined();
  });
  it("classifies the session and retains the evidence on summary-only refreshes", () => {
    const activity = normalizeActivity({
      activityId: 1,
      activityName: "Ciclismo en ruta",
      startTimeGMT: "2026-10-20 08:00:00",
      duration: 4320,
      activityType: { typeKey: "road_biking" },
    });
    const classified = classifyActivity(activity, { laps: repeated });
    expect(classified).toMatchObject({
      type: "intervals",
      classification: { estimated: true },
    });
    expect(classified.classification?.reason).toContain("4 bloques de 4:02");
    expect(classifyActivity(classified).type).toBe("intervals");
    expect(
      classifyActivity(classified, { laps: [] }).intervalPattern,
    ).toBeUndefined();
  });
});
