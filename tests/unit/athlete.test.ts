import { describe, expect, it } from "vitest";
import {
  profileAt,
  profileNote,
  withProfileEntries,
} from "../../src/domain/athlete";
import { realDataset } from "../../src/domain/analysis";
import { settingsSchema } from "../../src/shared/settings";
import { demoDataset } from "../../src/data/demo/provider";
import type { Athlete } from "../../src/shared/models";
const legacy: Athlete = { ftp: 275, weight: 80, lthr: 180 };
const history: Athlete = {
  ...legacy,
  history: [
    { metric: "ftp", value: 240, date: "2024-01-01", origin: "manual" },
    { metric: "weight", value: 75, date: "2024-01-01", origin: "manual" },
    { metric: "lthr", value: 170, date: "2024-01-01", origin: "Garmin" },
  ],
};
describe("dated athlete profile", () => {
  it("never backfills undated or future references", () => {
    expect(profileAt(legacy, Date.parse("2024-06-01"))).toEqual({
      ftp: null,
      weight: null,
      lthr: null,
    });
    expect(profileAt(history, Date.parse("2023-12-31"))).toEqual({
      ftp: null,
      weight: null,
      lthr: null,
    });
    expect(withProfileEntries(legacy, []).ftp).toBe(275);
  });
  it("uses inclusive UTC dates and preserves old sessions when today's FTP changes", () => {
    const updated = withProfileEntries(history, [
      { metric: "ftp", value: 300, date: "2026-01-01", origin: "manual" },
    ]);
    expect(profileAt(updated, Date.parse("2024-01-01T00:00:00Z"))).toEqual({
      ftp: 240,
      weight: 75,
      lthr: 170,
    });
    expect(profileAt(updated, Date.parse("2026-01-01")).ftp).toBe(300);
    expect(profileNote(updated, Date.parse("2024-01-01"))).toContain("Garmin");
  });
  it("corrects matching dates and allows explicit unknown values without changing other magnitudes", () => {
    const corrected = withProfileEntries(history, [
      { metric: "ftp", value: 250, date: "2024-01-01", origin: "manual" },
    ]);
    expect(corrected.history).toHaveLength(3);
    const gap = withProfileEntries(corrected, [
      { metric: "weight", value: null, date: "2025-01-01", origin: "manual" },
    ]);
    expect(profileAt(gap, Date.parse("2025-01-01"))).toEqual({
      ftp: 250,
      weight: null,
      lthr: 170,
    });
  });
  it("validates dates, per-metric ranges and duplicate dates at IPC and backup boundaries", () => {
    const settings = {
      theme: "dark",
      source: "garmin",
      model: null,
      athlete: history,
    };
    expect(settingsSchema.safeParse(settings).success).toBe(true);
    for (const patch of [
      { date: "2024-02-30" },
      { value: 1001 },
      { metric: "lthr", value: 251 },
    ]) {
      expect(
        settingsSchema.safeParse({
          ...settings,
          athlete: {
            ...history,
            history: [{ ...history.history![0], ...patch }],
          },
        }).success,
      ).toBe(false);
    }
    expect(
      settingsSchema.safeParse({
        ...settings,
        athlete: {
          ...history,
          history: [...history.history!, history.history![0]],
        },
      }).success,
    ).toBe(false);
  });
  it("retains imported IF/TSS and associates seasonal marks with the weight on their date", () => {
    const a = {
      ...demoDataset.activities[0],
      date: Date.parse("2024-06-01"),
      tss: 123,
      IF: 0.87,
    };
    const detail = {
      rows: [],
      laps: [],
      points: [],
      features: [],
      markers: [],
      best: [{ t: 300, l: "5 min", p: 300 }],
    };
    const updated = withProfileEntries(history, [
      { metric: "weight", value: 90, date: "2026-01-01", origin: "manual" },
    ]);
    const data = realDataset([a], [detail], updated);
    expect(data.activities[0]).toMatchObject({ tss: 123, IF: 0.87 });
    expect(data.curve[0]).toMatchObject({
      s2024: 300,
      w2024: 75,
      d2024: a.date,
    });
    expect(realDataset([a], [detail], legacy).curve[0].w2024).toBeNull();
  });
});
