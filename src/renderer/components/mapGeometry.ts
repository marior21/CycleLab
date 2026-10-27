import type { Feature, LineString } from "geojson";

// Keep continuous strokes: tiny independent GPS edges can disappear at low zoom.
export function mergeRouteLines(edges: Feature<LineString>[]) {
  const lines: Feature<LineString>[] = [];
  for (const edge of edges) {
    const previous = lines.at(-1);
    const end = previous?.geometry.coordinates.at(-1);
    const start = edge.geometry.coordinates[0];
    if (
      previous &&
      end &&
      end[0] === start[0] &&
      end[1] === start[1] &&
      previous.properties?.color === edge.properties?.color &&
      previous.properties?.selected === edge.properties?.selected
    )
      previous.geometry.coordinates.push(...edge.geometry.coordinates.slice(1));
    else
      lines.push({
        ...edge,
        geometry: {
          ...edge.geometry,
          coordinates: [...edge.geometry.coordinates],
        },
      });
  }
  return lines;
}
