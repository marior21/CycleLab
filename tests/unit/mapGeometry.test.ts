import { expect, it } from "vitest";
import type { Feature, LineString } from "geojson";
import { mergeRouteLines } from "../../src/renderer/components/mapGeometry";
const edge = (
  a: number,
  b: number,
  color = "gray",
  selected = false,
): Feature<LineString> => ({
  type: "Feature",
  properties: { color, selected },
  geometry: {
    type: "LineString",
    coordinates: [
      [a, 0],
      [b, 0],
    ],
  },
});
it("joins dense GPS edges into a continuous stroke without mutating input", () => {
  const edges = Array.from({ length: 1000 }, (_, i) =>
    edge(i / 100000, (i + 1) / 100000),
  );
  const lines = mergeRouteLines(edges);
  expect(lines).toHaveLength(1);
  expect(lines[0].geometry.coordinates).toHaveLength(1001);
  expect(edges[0].geometry.coordinates).toHaveLength(2);
});
it("preserves color, selection boundaries and GPS gaps", () => {
  expect(
    mergeRouteLines([
      edge(0, 1),
      edge(1, 2, "red"),
      edge(2, 3, "red", true),
      edge(5, 6, "red", true),
    ]),
  ).toHaveLength(4);
  expect(mergeRouteLines([])).toEqual([]);
});
