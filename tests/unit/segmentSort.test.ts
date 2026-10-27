import { expect, it } from "vitest";
import {
  sortAttempts,
  type AttemptSort,
} from "../../src/renderer/features/segmentSort";
import type { SegmentAttempt } from "../../src/shared/models";
const rows: SegmentAttempt[] = [
  {
    id: "a",
    activityName: "Salida 10",
    date: 20,
    dur: 100,
    avgP: null,
    hr: 150,
    cad: 0,
  },
  {
    id: "b",
    activityName: "Salida 2",
    date: 10,
    dur: 9,
    avgP: 200,
    hr: null,
    cad: 90,
  },
  {
    id: "c",
    activityName: "Ávila",
    date: 30,
    dur: 90,
    avgP: 0,
    hr: 120,
    cad: null,
  },
].map((r) => ({
  activityId: r.id,
  i0: 0,
  i1: 1,
  original: false,
  np: null,
  max: null,
  gain: null,
  dist: null,
  ...r,
}));
it("sorts all displayed columns using raw values without mutating the report", () => {
  const cases: [AttemptSort["key"], string[]][] = [
    ["date", ["b", "a", "c"]],
    ["dur", ["b", "c", "a"]],
    ["avgP", ["c", "b", "a"]],
    ["hr", ["c", "a", "b"]],
    ["cad", ["a", "b", "c"]],
    ["activityName", ["c", "b", "a"]],
  ];
  for (const [key, ids] of cases)
    expect(
      sortAttempts(rows, { key, direction: "ascending" }).map((r) => r.id),
    ).toEqual(ids);
  expect(rows.map((r) => r.id)).toEqual(["a", "b", "c"]);
});
it("keeps missing metrics last in descending order and preserves ties", () => {
  expect(
    sortAttempts(rows, { key: "avgP", direction: "descending" }).map(
      (r) => r.id,
    ),
  ).toEqual(["b", "c", "a"]);
  expect(
    sortAttempts(
      rows.map((r) => ({ ...r, dur: 10 })),
      { key: "dur", direction: "descending" },
    ).map((r) => r.id),
  ).toEqual(["a", "b", "c"]);
});
