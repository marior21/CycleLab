import type { Sample, Segment } from "../shared/models";
import { segmentStats } from "./segmentMatching";

export function createSegment(
  id: string,
  activityId: string,
  name: string,
  rows: Sample[],
  i0: number,
  i1: number,
): Segment {
  if (
    !Number.isInteger(i0) ||
    !Number.isInteger(i1) ||
    i0 < 0 ||
    i1 >= rows.length ||
    i1 <= i0
  )
    throw new Error("Selecciona un tramo con al menos dos muestras.");
  if (!name.trim() || name.trim().length > 100)
    throw new Error("Escribe un nombre de entre 1 y 100 caracteres.");
  return {
    id,
    activityId,
    name: name.trim(),
    i0,
    i1,
    start: rows[i0].x,
    end: rows[i1].x,
    ...segmentStats(rows, i0, i1),
  };
}
