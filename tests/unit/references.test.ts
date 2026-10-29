import { describe, expect, it } from "vitest";
import { messageReferences } from "../../src/domain/references";
import type { ToolView } from "../../src/shared/models";
const tool = (t: Partial<ToolView>): ToolView => ({
  tool: "buscar_actividades",
  args: "{}",
  title: "",
  kind: "table",
  rows: [],
  series: [],
  ...t,
});
describe("messageReferences", () => {
  it("collects periods, activities, attempts and ranges without duplicates", () => {
    const refs = messageReferences([
      tool({
        args: '{"desde":"2024-01-01","hasta":"2024-12-31"}',
        rows: [
          { activityId: "a", actividad: "Rodaje", fecha: "2024-03-01" },
          { activityId: "a", actividad: "Rodaje", fecha: "2024-03-01" },
        ],
      }),
      tool({
        tool: "comparar_ascensiones",
        rows: [{ activityId: "b", actividad: "Puerto", i0: 10, i1: 90 }],
      }),
      tool({
        tool: "analizar_intervalos",
        args: "contexto sin JSON",
        rows: [
          {
            activityId: "a",
            actividad: "Rodaje",
            tramo: "Serie 2",
            i0: 1,
            i1: 5,
          },
        ],
      }),
      tool({
        tool: "carga_entrenamiento",
        kind: "line",
        rows: [{ x: Date.UTC(2026, 0, 2) }, { x: Date.UTC(2026, 0, 1) }],
      }),
    ]);
    expect(refs.map((r) => r.kind)).toEqual([
      "period",
      "activity",
      "attempt",
      "range",
      "period",
    ]);
    expect(refs[0]).toMatchObject({ from: "2024-01-01", to: "2024-12-31" });
    expect(refs[2]).toMatchObject({ activityId: "b", range: [10, 90] });
    expect(refs[3]).toMatchObject({ label: "Serie 2", range: [1, 5] });
    expect(refs[4]).toMatchObject({ from: "2026-01-01", to: "2026-01-02" });
  });
});
