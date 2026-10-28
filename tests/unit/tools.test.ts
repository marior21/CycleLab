import { describe, it, expect } from "vitest";
import { AnalysisTools, toolNames } from "../../src/main/coach";
import { demoDataset, DemoGarminSource } from "../../src/data/demo/provider";
import type { Store } from "../../src/main/store";
describe("coach tools", () => {
  it("validates arguments and only emits bounded analysis data, without GPS", async () => {
    const activity = demoDataset.activities[0],
      detail = await new DemoGarminSource().getActivity(activity.id);
    const store = {
      dataset: () => demoDataset,
      detail: () => detail,
      segments: () => [
        { id: "segment", name: "Puerto" },
        { id: "other", name: "Otro" },
      ],
    } as unknown as Store;
    const tools = new AnalysisTools(store, "demo");
    expect(() =>
      tools.run("buscar_actividades", { gps: true }, { screen: "coach" }),
    ).toThrow();
    expect(() =>
      tools.run("carga_entrenamiento", { dias: 99999 }, { screen: "coach" }),
    ).toThrow();
    for (const name of toolNames) {
      const result = tools.run(
        name,
        {},
        { screen: "activities", activityId: activity.id },
      );
      expect(result.tool).toBe(name);
      expect(result.rows.length).toBeGreaterThan(0);
      const json = JSON.stringify(result);
      expect(json).not.toContain('"lat":');
      expect(json).not.toContain('"lon":');
      expect(json).not.toContain('"points":');
    }
    expect(
      tools.coverage({ screen: "activities", activityId: activity.id }),
    ).toContain("FTP: 275 W");
    expect(
      tools.run(
        "analizar_intervalos",
        { actividad: activity.id },
        { screen: "coach" },
      ).note,
    ).toContain("Peso: 80 kg");
    expect(
      tools.run("buscar_actividades", {}, { screen: "coach" }).rows[0].perfil,
    ).toContain("desde 2000-01-01");
    expect(
      tools.run("buscar_actividades", {}, { screen: "coach" }).rows.length,
    ).toBeLessThanOrEqual(20);
  });
});

describe("persisted segment comparisons", () => {
  const attempts = [
    {
      id: "old",
      activityId: "a",
      activityName: "Antigua",
      date: Date.parse("2025-01-01"),
      i0: 0,
      dur: 600,
      avgP: 200,
      hr: 140,
      original: true,
    },
    {
      id: "latest",
      activityId: "b",
      activityName: "Última",
      date: Date.parse("2026-10-28T23:59:00Z"),
      i0: 100,
      dur: 580,
      avgP: null,
      hr: null,
      original: false,
    },
    {
      id: "previous",
      activityId: "b",
      activityName: "Última",
      date: Date.parse("2026-10-28T23:59:00Z"),
      i0: 0,
      dur: 590,
      avgP: 210,
      hr: 150,
      original: false,
    },
  ];
  function setup(status = "done", revision = 3, present = true) {
    const sources: string[] = [];
    const store = {
      dataset: () => ({ ...demoDataset, climbs: [], attempts: [] }),
      segments: (source: string) => {
        sources.push(source);
        return [
          { id: "p", name: "Puerto" },
          { id: "q", name: "Puerto norte" },
        ];
      },
      segmentResults: (source: string) => {
        sources.push(source);
        return present
          ? { status, revision, total: 10, scanned: 8, skipped: 2, attempts }
          : null;
      },
      get: () => 3,
    } as unknown as Store;
    return { tools: new AnalysisTools(store, "garmin"), sources };
  }
  it("uses persisted attempts, chronological order, null metrics and activity references without GPS", () => {
    const { tools, sources } = setup();
    const result = tools.run(
      "comparar_ascensiones",
      { puerto: "Puerto" },
      { screen: "climbs" },
    );
    expect(result.rows.map((r) => r.id)).toEqual(["latest", "previous"]);
    expect(result.rows[0]).toMatchObject({
      activityId: "b",
      tiempo: 580,
      potencia: null,
      FC: null,
    });
    expect(result.note).toContain("8 de 10");
    expect(result.note).toContain("2 sin GPS");
    expect(result.note).toContain("aproximados");
    expect(sources).toEqual(["garmin", "garmin"]);
    expect(JSON.stringify(result)).not.toMatch(/"(lat|lon|points|rowsGPS)":/);
  });
  it("filters inclusive UTC dates and rejects invalid or reversed periods", () => {
    const { tools } = setup();
    const run = (args: object) =>
      tools.run(
        "comparar_ascensiones",
        { puerto: "p", ...args },
        { screen: "coach" },
      );
    expect(run({ desde: "2026-10-28", hasta: "2026-10-28" }).rows).toHaveLength(
      2,
    );
    expect(run({ hasta: "2025-01-01" }).rows.map((r) => r.id)).toEqual(["old"]);
    expect(run({ desde: "2027-01-01" }).note).toContain("No hay dos intentos");
    expect(() => run({ desde: "2026-02-30" })).toThrow();
    expect(() => run({ desde: "2026-01-01", hasta: "2025-01-01" })).toThrow();
  });
  it.each([
    ["running", 3, true],
    ["error", 3, true],
    ["done", 2, true],
    ["done", 3, false],
  ])("marks incomplete results (%s, %s, %s)", (status, revision, present) => {
    const { tools } = setup(status, revision, present);
    expect(
      tools.run("comparar_ascensiones", { puerto: "p" }, { screen: "coach" })
        .note,
    ).toContain("Resultados provisionales");
  });
  it("lists candidates instead of silently choosing an ambiguous or missing segment", () => {
    const { tools } = setup();
    expect(
      tools.run("comparar_ascensiones", {}, { screen: "coach" }).rows,
    ).toHaveLength(2);
    const missing = tools.run(
      "comparar_ascensiones",
      { puerto: "Inexistente" },
      { screen: "coach" },
    );
    expect(missing.rows).toEqual([]);
    expect(missing.note).toContain("No hay segmentos");
  });
});

describe("selection context and historical search", () => {
  it("calculates only four separate ranges, preserves missing sensors and excludes GPS", async () => {
    const activity = demoDataset.activities[0];
    const detail = await new DemoGarminSource().getActivity(activity.id);
    const ranges: [number, number][] = [
      [0, 5],
      [20, 25],
      [40, 45],
      [60, 65],
    ];
    detail.rows.forEach((r) => {
      r.hr = null;
    });
    const store = {
      dataset: () => demoDataset,
      detail: () => detail,
    } as unknown as Store;
    const tools = new AnalysisTools(store, "demo");
    const result = tools.selection({
      screen: "activities",
      activityId: activity.id,
      ranges,
    })!;
    expect(result.rows).toHaveLength(4);
    expect(result.rows.map((r) => [r.i0, r.i1])).toEqual(ranges);
    expect(result.rows.every((r) => r.hr === null)).toBe(true);
    expect(result.rows[0].dur).toBeLessThan(activity.dur);
    expect(JSON.stringify(result)).not.toMatch(/"(lat|lon|points)":/);
    expect(() =>
      tools.selection({
        screen: "activities",
        activityId: activity.id,
        ranges: [[0, detail.rows.length]],
      }),
    ).toThrow("selección");
    expect(() =>
      tools.selection({
        screen: "activities",
        activityId: "other-source",
        ranges,
      }),
    ).toThrow("origen");
    const pair = tools.selection({
      screen: "activities",
      comparison: [demoDataset.activities[1].id, activity.id],
    })!;
    expect(pair.rows.map((r) => r.activityId)).toEqual([
      demoDataset.activities[1].id,
      activity.id,
    ]);
    expect(pair.rows[1].np).toBe(activity.np);
  });

  it("filters old years and types before pagination and links every activity", () => {
    const activities = Array.from({ length: 45 }, (_, i) => ({
      ...demoDataset.activities[0],
      id: String(i),
      name: "Ruta histórica",
      type: "mtb" as const,
      date: Date.parse("2020-12-31T23:59:00Z") - i * 1000,
    }));
    const store = {
      dataset: () => ({
        ...demoDataset,
        activities: [...demoDataset.activities, ...activities],
      }),
    } as unknown as Store;
    const tools = new AnalysisTools(store, "demo");
    const args = {
      desde: "2020-01-01",
      hasta: "2020-12-31",
      tipos: ["mtb"],
      texto: "histórica",
    };
    const first = tools.run("buscar_actividades", args, { screen: "coach" });
    expect(first.rows).toHaveLength(20);
    expect(first.rows[0].activityId).toBe("0");
    expect(first.note).toContain("45 actividades coincidentes");
    expect(first.note).toContain("siguiente offset: 20");
    const last = tools.run(
      "buscar_actividades",
      { ...args, offset: 40 },
      { screen: "coach" },
    );
    expect(last.rows).toHaveLength(5);
    expect(last.note).toContain("No hay más resultados");
    expect(
      tools.run(
        "buscar_actividades",
        { ...args, tipos: ["indoor"] },
        { screen: "coach" },
      ).rows,
    ).toEqual([]);
    expect(() =>
      tools.run(
        "buscar_actividades",
        { tipos: ["invalid"] },
        { screen: "coach" },
      ),
    ).toThrow();
  });
});

it("finds an activity summary by exact ID in either activity or text without falling back to the list", () => {
  const activity = {
    ...demoDataset.activities[0],
    id: "22821983282",
    name: "Salida de prueba",
  };
  const store = {
    dataset: () => ({
      ...demoDataset,
      activities: [...demoDataset.activities, activity],
    }),
  } as unknown as Store;
  const tools = new AnalysisTools(store, "garmin");
  const run = (args: object) =>
    tools.run("buscar_actividades", args, {
      screen: "activities",
      activityId: activity.id,
    });
  for (const args of [{ texto: activity.id }, { actividad: activity.id }]) {
    expect(run(args).rows).toEqual([
      expect.objectContaining({
        activityId: activity.id,
        actividad: activity.name,
        fecha: new Date(activity.date).toISOString().slice(0, 10),
        duracion: activity.dur,
        km: activity.dist,
        NP: activity.np,
        TSS: activity.tss,
      }),
    ]);
  }
  expect(run({ actividad: "missing" }).rows).toEqual([]);
  expect(run({ texto: "2282198328" }).rows).toEqual([]);
  expect(run({ actividad: activity.id, hasta: "2000-01-01" }).rows).toEqual([]);
  expect(run({ texto: "salida de prueba" }).rows).toHaveLength(1);
  expect(run({}).rows.length).toBeGreaterThan(1);
});
