import { describe, it, expect } from "vitest";
import { createSegment } from "../../src/domain/segments";
import type { Sample } from "../../src/shared/models";
const rows: Sample[] = [0, 1, 2, 3].map((i) => ({
  x: i * 10,
  km: i / 10,
  elev: i * 5,
  p: null,
  ps: null,
  hr: null,
  cad: null,
  v: null,
}));
describe("manual segments", () => {
  it("uses only selected samples and preserves unknown metrics", () => {
    const s = createSegment("id", "activity", " Mirador ", rows, 1, 3);
    expect(s).toMatchObject({
      name: "Mirador",
      start: 10,
      end: 30,
      gain: 10,
      avgP: null,
      hr: null,
      i0: 1,
      i1: 3,
    });
    expect(s.dist).toBeCloseTo(0.2);
  });
  it("rejects invalid bounds and empty names", () => {
    for (const [a, b] of [
      [-1, 2],
      [0, 4],
      [2, 1],
      [1, 1],
      [0.5, 2],
      [0, Infinity],
    ])
      expect(() => createSegment("id", "a", "x", rows, a, b)).toThrow();
    expect(() => createSegment("id", "a", " ", rows, 0, 2)).toThrow();
  });
});
