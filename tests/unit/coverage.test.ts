import { describe, expect, it } from "vitest";
import {
  coverageNote,
  coverageReport,
  sampleCoverage,
} from "../../src/domain/coverage";
import { ACTS, ATH } from "../../src/data/demo/fixtures";
import { realDataset, DAY } from "../../src/domain/analysis";
import { emptyDetail } from "../../src/main/garmin";
import { AnalysisTools } from "../../src/main/coach";
import type { Store } from "../../src/main/store";
import type { Sample } from "../../src/shared/models";
const row: Sample = {
  x: 0,
  p: 0,
  ps: 0,
  hr: null,
  cad: null,
  elev: null,
  v: null,
  km: null,
  lat: 0,
  lon: 0,
};

describe("coverage and provenance", () => {
  it("keeps missing downloads unknown, confirms absent sensors and preserves measured zeros", () => {
    const activities = [
      {
        ...ACTS[0],
        id: "1",
        avgP: null,
        np: null,
        hr: null,
        tss: 0,
        detailStatus: "ready" as const,
      },
      {
        ...ACTS[0],
        id: "2",
        avgP: null,
        np: null,
        hr: null,
        tss: null,
        detailStatus: "error" as const,
      },
    ];
    const data = realDataset(
      activities,
      [{ ...emptyDetail(), rows: [row] }],
      ATH,
    );
    expect(coverageReport(data, activities)).toMatchObject({
      total: 2,
      failed: ["2"],
      pending: 0,
      unavailable: 0,
      rows: [
        { id: "power", present: 1, absent: 0, unknown: 1 },
        { id: "heart", present: 0, absent: 1, unknown: 1 },
        { id: "gps", present: 1, absent: 0, unknown: 1 },
        { id: "tss", present: 1, absent: 1, unknown: 0 },
        { id: "samples", present: 1, absent: 1, unknown: 0 },
      ],
    });
    expect(coverageReport(data, [activities[0]]).failed).toEqual([]);
    expect(coverageReport(data, []).total).toBe(0);
    const note = coverageNote(data, activities, "garmin");
    expect(note).toContain("Garmin: resúmenes");
    expect(note).toContain("Cálculo local");
    expect(note).toContain("Estimación local");
    expect(coverageNote(data, activities, "demo")).toContain(
      "Datos de demostración",
    );
    expect(note).not.toContain('"lat"');
  });
  it("does not interpret projected map points or invalid coordinates as GPS", () => {
    expect(sampleCoverage({ ...emptyDetail(), points: [[1, 2]] }).gps).toBe(
      false,
    );
    expect(
      sampleCoverage({ ...emptyDetail(), rows: [{ ...row, lat: 91 }] }).gps,
    ).toBe(false);
  });
  it("gives the coach the same counts for its requested period and retains unknown TSS", () => {
    const today = Math.floor(Date.now() / DAY) * DAY;
    const activities = [
      { ...ACTS[0], id: "old", date: today - 100 * DAY, tss: 50 },
      {
        ...ACTS[0],
        id: "now",
        date: today,
        tss: null,
        detailStatus: "error" as const,
      },
      { ...ACTS[0], id: "known", date: today, tss: 42 },
    ];
    const data = realDataset(activities, [], ATH);
    const tools = new AnalysisTools(
      { dataset: () => data } as unknown as Store,
      "garmin",
    );
    const result = tools.run(
      "carga_entrenamiento",
      { dias: 1 },
      { screen: "dashboard" },
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].tss).toBeNull();
    expect(result.note).toContain(
      coverageNote(data, activities.slice(1), "garmin"),
    );
    expect(result.note).toContain("todo el histórico");
    const curve = tools.run("curva_potencia", {}, { screen: "performance" });
    expect(curve.series.map((s) => s.key)).toContain(
      "s" + new Date(today).getUTCFullYear(),
    );
    expect(curve.note).toContain("Muestras de potencia: 0 actividades");
    expect(
      tools.coverage({ screen: "activities", activityId: "now" }),
    ).toContain("1 actividades");
  });
});
