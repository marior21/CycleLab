import { describe, it, expect } from "vitest";
import {
  filterActivitiesByDate,
  type ActivityDateFilter,
} from "../../src/domain/activityFilters";
import type { Activity } from "../../src/shared/models";
const rows = [
  "2018-05-20T08:00:00Z",
  "2021-03-15T00:00:00Z",
  "2021-03-15T23:59:59.999Z",
  "2021-03-16T00:00:00Z",
  "2026-10-27T09:00:00Z",
].map((date, i) => ({ id: String(i), date: Date.parse(date) }) as Activity);
const filter = (patch: Partial<ActivityDateFilter>) =>
  filterActivitiesByDate(
    rows,
    { period: "all", year: "", from: "", to: "", ...patch },
    Date.parse("2026-10-27T12:00:00Z"),
  );
describe("activity date filters", () => {
  it("finds a complete calendar year from any part of the history", () => {
    expect(filter({ year: "2021" }).activities.map((a) => a.id)).toEqual([
      "1",
      "2",
      "3",
    ]);
    expect(filter({ year: "2018" }).activities).toHaveLength(1);
  });
  it("includes both selected days, including the final millisecond", () => {
    expect(
      filter({ from: "2021-03-15", to: "2021-03-15" }).activities.map(
        (a) => a.id,
      ),
    ).toEqual(["1", "2"]);
  });
  it("supports either date on its own", () => {
    expect(filter({ to: "2018-05-20" }).activities).toHaveLength(1);
    expect(filter({ from: "2021-03-16" }).activities.map((a) => a.id)).toEqual([
      "3",
      "4",
    ]);
  });
  it("rejects reversed and impossible dates", () => {
    expect(filter({ from: "2021-03-16", to: "2021-03-15" }).error).toContain(
      "posterior",
    );
    expect(filter({ from: "2021-02-29" }).error).toContain("válida");
    expect(filter({ from: "oops" }).activities).toEqual([]);
  });
  it("preserves the recent presets and all-history view", () => {
    expect(filter({ period: "90" }).activities.map((a) => a.id)).toEqual(["4"]);
    expect(filter({}).activities).toHaveLength(5);
  });
});
