import type { Activity, ActivityType, Dataset } from "../shared/models";
import { DAY } from "./analysis";
import { periodBests } from "./powerCurve";
import { total, type WeekMetric } from "./weeklySummary";

const METRICS: WeekMetric[] = ["dur", "dist", "elev", "tss"];
const totals = (list: Activity[]) =>
  Object.fromEntries(METRICS.map((k) => [k, total(list, k)])) as Record<
    WeekMetric,
    ReturnType<typeof total>
  >;

/** Calendar-year season; a current year is partial up to `today`. */
export function seasonSummary(
  data: Pick<Dataset, "activities" | "efforts" | "today">,
  year: number,
) {
  const from = Date.UTC(year, 0, 1),
    to = Date.UTC(year + 1, 0, 1),
    end = Math.min(to, Math.floor(data.today / DAY) * DAY + DAY);
  const activities = data.activities
    .filter((a) => a.date >= from && a.date < to)
    .sort((a, b) => a.date - b.date);
  const months = Array.from({ length: 12 }, (_, m) => {
    const start = Date.UTC(year, m, 1),
      next = Date.UTC(year, m + 1, 1),
      list = activities.filter((a) => a.date >= start && a.date < next);
    return {
      month: m,
      partial: start < end && next > end,
      future: start >= end,
      count: list.length,
      ...totals(list),
    };
  }).filter((m) => !m.future);
  const types = new Map<ActivityType, number>();
  for (const a of activities) types.set(a.type, (types.get(a.type) ?? 0) + 1);
  const previous = periodBests(data, Date.UTC(year - 1, 0, 1), from);
  return {
    year,
    from,
    to,
    partial: end < to,
    days: Math.max(0, Math.round((end - from) / DAY)),
    yearDays: Math.round((to - from) / DAY),
    activities,
    totals: totals(activities),
    months,
    types: [...types].sort((a, b) => b[1] - a[1]),
    bests: [...periodBests(data, from, to).values()]
      .sort((a, b) => a.t - b.t)
      .map((b) => ({ ...b, previous: previous.get(b.t) ?? null })),
    noPower: activities.filter((a) => a.avgP === null).length,
    noHeart: activities.filter((a) => a.hr === null).length,
  };
}
export type SeasonSummary = ReturnType<typeof seasonSummary>;
