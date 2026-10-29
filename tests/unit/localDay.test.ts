import { describe, expect, it } from "vitest";
import { Encoder, Profile } from "@garmin/fitsdk";
import type { ActivityMesg, FileIdMesg, RecordMesg } from "@garmin/fitsdk";
import { calendarDate, localTime } from "../../src/domain/analysis";
import { filterActivitiesByDate } from "../../src/domain/activityFilters";
import { weekStart } from "../../src/domain/weeklySummary";
import { fitActivity, normalizeActivity } from "../../src/main/garmin";
import type { Activity } from "../../src/shared/models";

const ride = (date: string, utcOffset: number) =>
  ({
    id: date,
    date: Date.parse(date),
    utcOffset,
  }) as Activity;
const shown = (a: Activity) => ({
  ...a,
  date: calendarDate("garmin", a),
});

describe("local calendar day", () => {
  it("files a ride under the day it happened where it happened", () => {
    // 23:30 UTC on Saturday is already 00:30 on Sunday in Madrid (CET).
    const late = shown(ride("2026-01-10T23:30:00Z", 3600));
    expect(new Date(late.date).toISOString()).toBe("2026-01-11T00:30:00.000Z");
    const filter = { period: "all", year: "", from: "", to: "" };
    expect(
      filterActivitiesByDate(
        [late],
        { ...filter, from: "2026-01-11", to: "2026-01-11" },
        0,
      ).activities,
    ).toHaveLength(1);
    expect(
      filterActivitiesByDate([late], { ...filter, to: "2026-01-10" }, 0)
        .activities,
    ).toHaveLength(0);
    // Sunday 00:30 belongs to the week that started on Monday the 5th.
    expect(new Date(weekStart(late.date)).toISOString().slice(0, 10)).toBe(
      "2026-01-05",
    );
    // New Year's Eve ride at 23:00 in Madrid stays in the old season.
    const eve = shown(ride("2025-12-31T22:00:00Z", 3600));
    expect(
      filterActivitiesByDate([eve], { ...filter, year: "2025" }, 0).activities,
    ).toHaveLength(1);
  });

  it("follows daylight saving changes through the recorded offset", () => {
    // Europe moves to CEST at 01:00 UTC on 29 March 2026.
    const before = shown(ride("2026-03-28T23:30:00Z", 3600)),
      after = shown(ride("2026-03-29T22:30:00Z", 7200));
    expect(new Date(before.date).toISOString().slice(0, 16)).toBe(
      "2026-03-29T00:30",
    );
    expect(new Date(after.date).toISOString().slice(0, 16)).toBe(
      "2026-03-30T00:30",
    );
  });

  it("uses the Mac's zone without an offset and leaves demo dates alone", () => {
    const at = Date.parse("2026-07-01T12:00:00Z");
    expect(localTime(at)).toBe(at - new Date(at).getTimezoneOffset() * 60000);
    expect(calendarDate("demo", { date: at, utcOffset: 7200 })).toBe(at);
  });

  it("reads the offset from Garmin and from FIT files", () => {
    const base = {
      activityId: 1,
      startTimeGMT: "2026-06-01 22:15:00",
      duration: 3600,
    };
    expect(
      normalizeActivity({ ...base, startTimeLocal: "2026-06-02 00:15:00" })
        .utcOffset,
    ).toBe(7200);
    expect(
      normalizeActivity({ ...base, startTimeLocal: "2026-06-01 17:45:00" })
        .utcOffset,
    ).toBe(-16200);
    expect(normalizeActivity(base)).not.toHaveProperty("utcOffset");

    const encoder = new Encoder(),
      start = new Date("2026-06-01T22:15:00Z");
    encoder.onMesg(Profile.MesgNum.FILE_ID, {
      manufacturer: "development",
      timeCreated: start,
      type: "activity",
    } as FileIdMesg);
    for (let i = 0; i < 60; i++)
      encoder.onMesg(Profile.MesgNum.RECORD, {
        timestamp: new Date(+start + i * 1000),
        power: 200,
      } as RecordMesg);
    const end = new Date(+start + 59000);
    encoder.onMesg(Profile.MesgNum.ACTIVITY, {
      timestamp: end,
      localTimestamp: +end / 1000 - 631065600 + 7200,
    } as ActivityMesg);
    expect(fitActivity(encoder.close(), "noche.fit").activity.utcOffset).toBe(
      7200,
    );
  });
});
