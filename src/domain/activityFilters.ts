import type { Activity } from "../shared/models";
import { DAY } from "./analysis";
export interface ActivityDateFilter {
  period: string;
  year: string;
  from: string;
  to: string;
}
function day(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const timestamp = Date.parse(value + "T00:00:00Z");
  return Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString().slice(0, 10) === value
    ? timestamp
    : NaN;
}
export function filterActivitiesByDate(
  activities: Activity[],
  filter: ActivityDateFilter,
  today: number,
) {
  const from = filter.from ? day(filter.from) : -Infinity,
    to = filter.to ? day(filter.to) + DAY : Infinity;
  if (Number.isNaN(from) || Number.isNaN(to))
    return { activities: [], error: "Introduce una fecha válida." };
  if (from >= to)
    return {
      activities: [],
      error: "La fecha «Desde» no puede ser posterior a «Hasta».",
    };
  const recent =
    filter.period === "30" || filter.period === "90"
      ? today - Number(filter.period) * DAY
      : -Infinity;
  return {
    activities: activities.filter(
      (a) =>
        a.date > recent &&
        a.date >= from &&
        a.date < to &&
        (!filter.year ||
          String(new Date(a.date).getUTCFullYear()) === filter.year),
    ),
    error: "",
  };
}
