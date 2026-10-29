import { describe, expect, it } from "vitest";
import { seasonSummary } from "../../src/domain/season";
import { seasonReport } from "../../src/renderer/exports";
import { demoDataset } from "../../src/data/demo/provider";
import type { Activity, SegmentAttempt } from "../../src/shared/models";

const at = (y: number, m: number, d: number) => Date.UTC(y, m, d, 9);
const ride = (id: string, date: number, patch: Partial<Activity> = {}) =>
  ({
    ...demoDataset.activities[0],
    id,
    name: id,
    date,
    type: "endurance",
    dur: 3600,
    dist: 30,
    elev: 300,
    tss: 60,
    avgP: 200,
    hr: 140,
    ...patch,
  }) as Activity;
const data = {
  today: at(2026, 9, 29),
  activities: [
    ride("old", at(2025, 5, 1)),
    ride("jan", at(2026, 0, 10)),
    ride("feb", at(2026, 1, 3), { dist: null, tss: null, avgP: null }),
    ride("oct", at(2026, 9, 28), { type: "intervals" }),
    ride("next", at(2027, 0, 2)),
  ],
  efforts: {
    old: [{ t: 300, l: "5 min", p: 300, i0: 0, i1: 299 }],
    jan: [{ t: 300, l: "5 min", p: 280, i0: 0, i1: 299 }],
    oct: [
      { t: 300, l: "5 min", p: 320, i0: 10, i1: 309 },
      { t: 60, l: "1 min", p: 400, i0: 5, i1: 64 },
    ],
  },
};

describe("season summary", () => {
  it("covers the calendar year and marks the current one as partial", () => {
    const s = seasonSummary(data, 2026);
    expect(s.activities.map((a) => a.id)).toEqual(["jan", "feb", "oct"]);
    expect(s.partial).toBe(true);
    expect(s.days).toBe(302);
    expect(s.months).toHaveLength(10);
    expect(s.months.at(-1)).toMatchObject({ month: 9, partial: true });
    expect(seasonSummary(data, 2025)).toMatchObject({
      partial: false,
      days: 365,
    });
    expect(seasonSummary(data, 2025).months).toHaveLength(12);
  });
  it("never counts missing values as zero and months add up to the total", () => {
    const s = seasonSummary(data, 2026);
    expect(s.totals.dist.value).toBe(60);
    expect(s.totals.dist.missing.map((a) => a.id)).toEqual(["feb"]);
    expect(s.totals.dur.value).toBe(3 * 3600);
    expect(s.noPower).toBe(1);
    for (const k of ["dur", "elev"] as const)
      expect(s.months.reduce((n, m) => n + (m[k].value ?? 0), 0)).toBe(
        s.totals[k].value,
      );
    expect(s.months[1].tss.value).toBeNull();
    expect(s.types).toEqual([
      ["endurance", 2],
      ["intervals", 1],
    ]);
  });
  it("keeps where each best came from and the previous year's value", () => {
    const s = seasonSummary(data, 2026);
    expect(s.bests.map((b) => [b.t, b.p, b.activityId, b.previous?.p])).toEqual(
      [
        [60, 400, "oct", undefined],
        [300, 320, "oct", 300],
      ],
    );
  });
});

describe("season report", () => {
  const attempt = (date: number, dur: number) =>
    ({ id: String(date), activityId: "x", date, dur }) as SegmentAttempt;
  it("lists every activity, escapes text and marks the demo", () => {
    const s = seasonSummary(
      {
        ...data,
        activities: [ride("<b>Salida</b>", at(2026, 2, 1))],
      },
      2026,
    );
    const html = seasonReport(
      s,
      [
        {
          name: "Alisas & co",
          season: [attempt(at(2026, 3, 1), 900), attempt(at(2026, 4, 1), 870)],
          before: [attempt(at(2025, 3, 1), 860)],
        },
      ],
      true,
    );
    expect(html).toContain("Datos de demostración");
    expect(html).toContain("&lt;b&gt;Salida&lt;/b&gt;");
    expect(html).not.toContain("<b>Salida</b>");
    expect(html).toContain("Alisas &amp; co");
    expect(html).toContain("0:14:30");
    expect(html).toContain("Temporada en curso");
    expect(html).not.toContain("<script");
  });
  it("shows missing data apart instead of zero", () => {
    const html = seasonReport(seasonSummary(data, 2026), [], false);
    expect(html).toContain("60,0 km (+1 sin dato)");
    expect(html).toContain("Marca segmentos como favoritos");
    expect(html).not.toContain("Datos de demostración");
  });
});
