import type { SegmentAttempt } from "../../shared/models";
export interface AttemptSort {
  key: "date" | "activityName" | "dur" | "avgP" | "hr" | "cad";
  direction: "ascending" | "descending";
}
export function sortAttempts(rows: SegmentAttempt[], sort: AttemptSort) {
  return rows.toSorted((a, b) => {
    const x = a[sort.key],
      y = b[sort.key];
    if (x == null) return y == null ? 0 : 1;
    if (y == null) return -1;
    const comparison =
      typeof x === "string" && typeof y === "string"
        ? x.localeCompare(y, "es", { numeric: true, sensitivity: "base" })
        : Number(x) - Number(y);
    return sort.direction === "ascending" ? comparison : -comparison;
  });
}
