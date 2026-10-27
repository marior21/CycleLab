import { expect, it } from "vitest";
import {
  averageGrade,
  overlayProfile,
  segmentProfile,
} from "../../src/domain/segmentProfile";
import type { Sample } from "../../src/shared/models";
const sample = (x: number, km: number | null, elev: number | null): Sample => ({
  x,
  km,
  elev,
  p: 250,
  ps: 240,
  hr: 150,
  cad: null,
  v: null,
});
it("calculates average grade from net elevation and distance", () => {
  expect(averageGrade(100, 400, 5)).toBe(6);
  expect(averageGrade(400, 100, 5)).toBe(-6);
  expect(averageGrade(100, 100, 5)).toBe(0);
  expect(averageGrade(null, 100, 5)).toBeNull();
  expect(averageGrade(100, undefined, 5)).toBeNull();
  expect(averageGrade(100, 400, null)).toBeNull();
  expect(averageGrade(100, 400, 0)).toBeNull();
});
it("uses the selected samples and reports uphill and downhill grades", () => {
  const rows = segmentProfile([
    sample(40, 1, 100),
    sample(42, 1.01, 101),
    sample(44, 1.02, 100),
  ]);
  expect(rows.map((r) => r.x)).toEqual([0, 2, 4]);
  expect(rows[0].grade).toBeNull();
  expect(rows[1].grade).toBeCloseTo(10);
  expect(rows[2].grade).toBeCloseTo(-10);
  expect(rows[1]).toMatchObject({ p: 250, hr: 150, elev: 101, v: null });
  expect(segmentProfile([{ ...sample(0, 0, 0), v: 24.5 }])[0].v).toBe(24.5);
  expect(segmentProfile([{ ...sample(0, 0, 0), v: 0 }])[0].v).toBe(0);
});
it("accumulates short samples and leaves missing or invalid data unknown", () => {
  expect(
    segmentProfile([
      sample(0, 0, 100),
      sample(1, 0.003, 100.3),
      sample(2, 0.006, 100.6),
    ])[2].grade,
  ).toBeCloseTo(10);
  for (const next of [
    sample(1, null, 101),
    sample(1, 1, 101),
    sample(1, 0.9, 101),
    sample(1, 1.01, null),
    sample(40, 1.01, 101),
  ]) {
    expect(segmentProfile([sample(0, 1, 100), next])[1].grade).toBeNull();
  }
  expect(
    segmentProfile([{ ...sample(0, 0, 0), p: null, hr: null }])[0],
  ).toMatchObject({ p: null, hr: null });
  expect(segmentProfile([])).toEqual([]);
});

it("overlays independent scales while preserving actual values and missing samples", () => {
  const source = segmentProfile([
    { ...sample(0, 0, 100), p: 100, hr: 120, v: 10 },
    { ...sample(1, 0.01, 200), p: 300, hr: 120, v: 20 },
    { ...sample(2, 0.02, null), p: null, hr: null, v: null },
  ]);
  const plotted = overlayProfile(source);
  expect(plotted[0]).toMatchObject({
    elevPlot: 0,
    pPlot: 0,
    hrPlot: 50,
    vPlot: 0,
    p: 100,
    hr: 120,
    v: 10,
  });
  expect(plotted[1]).toMatchObject({
    elevPlot: 100,
    pPlot: 100,
    hrPlot: 50,
    vPlot: 100,
  });
  expect(plotted[2]).toMatchObject({
    elevPlot: null,
    pPlot: null,
    hrPlot: null,
    vPlot: null,
  });
  expect(overlayProfile([])).toEqual([]);
});
