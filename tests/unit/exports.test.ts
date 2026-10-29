import { describe, expect, it } from "vitest";
import {
  activitiesCsv,
  activityReport,
  comparisonReport,
  toCsv,
} from "../../src/renderer/exports";
import { demoDataset, DemoGarminSource } from "../../src/data/demo/provider";

describe("exports", () => {
  it("writes RFC 4180 CSV without letting text run as formulas", () => {
    expect(toCsv([["a,b", 'di "hola"', "=SUM(A1)", -3, null, NaN]])).toBe(
      '"a,b","di ""hola""",\'=SUM(A1),-3,,\r\n',
    );
  });
  it("marks provenance, declared feelings and demo data in the activity CSV", () => {
    const a = {
      ...demoDataset.activities[0],
      type: "climb" as const,
      automaticType: "intervals" as const,
      feel: {
        rpe: 8,
        fatigue: "tired" as const,
        notes: "Viento",
        type: "climb" as const,
      },
      provenance: { kind: "fit" as const, file: "salida.fit" },
    };
    const [head, real] = activitiesCsv([a], false).trim().split("\r\n");
    expect(head.split(",")).toContain("rpe_declarado");
    expect(real).toContain("Ascensión,Intervalos,");
    expect(real).toContain(
      ",8,Cansado,Viento,Archivo FIT · salida.fit," + a.id,
    );
    expect(activitiesCsv([a], true)).toContain("Datos de demostración");
  });
  it("builds escaped, script-free HTML reports", async () => {
    const source = new DemoGarminSource();
    const [x, y] = demoDataset.activities;
    const a = { ...x, name: '<img src=x onerror="alert(1)">' },
      [da, db] = await Promise.all([x, y].map((v) => source.getActivity(v.id)));
    const report = activityReport(a, da, demoDataset.athlete, true);
    expect(report).not.toMatch(/<img|<script/);
    expect(report).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(report).toContain("Datos de demostración.");
    expect(report).toContain("<h2>Mejores esfuerzos</h2>");
    expect(activityReport(x, da, demoDataset.athlete, false)).not.toContain(
      "Datos de demostración",
    );
    const comparison = comparisonReport(
      x,
      y,
      da,
      db,
      demoDataset.athlete,
      false,
    );
    expect(comparison).toContain("B frente a A");
    expect(comparison).toContain("Mejor 20 min");
  });
});
