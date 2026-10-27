import { describe, expect, it } from "vitest";
import { createSegment } from "../../src/domain/segments";
import {
  matchSegment,
  segmentReference,
  segmentStats,
} from "../../src/domain/segmentMatching";
import type { Sample } from "../../src/shared/models";
function rows(points: [number, number][], seconds = 2): Sample[] {
  return points.map(([x, y], i) => ({
    x: i * seconds,
    lat: y / 111195,
    lon: x / 111195,
    km: i / 100,
    p: null,
    ps: null,
    hr: null,
    cad: null,
    elev: null,
    v: null,
  }));
}
const straight = Array.from({ length: 51 }, (_, i): [number, number] => [
  i * 10,
  0,
]);
const original = rows(straight);
const segment = createSegment("id", "a", "x", original, 0, 50);
const reference = segmentReference(original, segment)!;
describe("segment GPS matching", () => {
  it("matches a full route with GPS noise and different sample rate", async () => {
    const candidate = rows(
      Array.from({ length: 101 }, (_, i) => [i * 5, 5]),
      3,
    );
    expect(await matchSegment(reference, candidate)).toEqual([
      { i0: 0, i1: 100 },
    ]);
    expect(segmentStats(candidate, 0, 100)).toMatchObject({
      dur: 300,
      avgP: null,
      hr: null,
      gain: null,
    });
  });
  it("rejects reverse, partial, distant and alternate paths with identical endpoints", async () => {
    for (const points of [
      straight.toReversed(),
      straight.slice(10),
      straight.map(([x, y]): [number, number] => [x, y + 100]),
      straight.map(([x]): [number, number] => [
        x,
        Math.sin((x / 500) * Math.PI) * 150,
      ]),
    ])
      expect(await matchSegment(reference, rows(points))).toEqual([]);
  });
  it("finds repeated passes without counting the reverse return or duplicating endpoint pauses", async () => {
    const loop = [
      ...straight,
      ...straight.toReversed().slice(1),
      ...straight.slice(1),
    ];
    expect(await matchSegment(reference, rows(loop))).toEqual([
      { i0: 0, i1: 50 },
      { i0: 100, i1: 150 },
    ]);
  });
  it("rejects gaps, missing GPS and too-short references", async () => {
    expect(
      segmentReference(rows(straight.slice(0, 5)), { ...segment, i1: 4 }),
    ).toBeNull();
    expect(
      segmentReference(
        original.map((r) => ({ ...r, lat: null })),
        segment,
      ),
    ).toBeNull();
    const broken = original.map((r, i) => ({
      ...r,
      x: r.x + (i >= 25 ? 60 : 0),
    }));
    expect(segmentReference(broken, segment)).toBeNull();
    expect(await matchSegment(reference, broken)).toEqual([]);
  });
  it("requires the interior of a closed loop in the correct order", async () => {
    const circle = Array.from({ length: 81 }, (_, i): [number, number] => [
      100 * Math.cos((i / 80) * Math.PI * 2),
      100 * Math.sin((i / 80) * Math.PI * 2),
    ]);
    const route = rows(circle);
    const ref = segmentReference(route, { ...segment, i1: 80 })!;
    expect(await matchSegment(ref, route)).toEqual([{ i0: 0, i1: 80 }]);
    expect(await matchSegment(ref, rows(circle.toReversed()))).toEqual([]);
  });
});
