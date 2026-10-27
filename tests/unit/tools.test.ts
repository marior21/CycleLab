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
      tools.run("buscar_actividades", {}, { screen: "coach" }).rows.length,
    ).toBeLessThanOrEqual(20);
  });
});
