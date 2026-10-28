import type {
  Activity,
  ActivityDetail,
  Dataset,
  Screen,
  Segment,
} from "../../shared/models";
import type { Column } from "../components/types";
import { Badge } from "../components/ui";
import { date, duration, number, TYPES } from "../format";
export interface PageProps {
  createSegment: (
    activity: Activity,
    detail: ActivityDetail,
    range: [number, number],
  ) => void;
  data: Dataset;
  segments: Segment[];
  demo: boolean;
  syncing: boolean;
  maptilerConfigured: boolean;
  theme: "dark" | "light";
  openActivity: (id: string) => void;
  go: (screen: Screen) => void;
  ask: (text: string) => void;
}
export const activityColumns: Column<Activity>[] = [
  { key: "date", label: "Fecha", render: (a) => date(a.date), width: 110 },
  { key: "name", label: "Actividad", render: (a) => <strong>{a.name}</strong> },
  {
    key: "type",
    label: "Tipo",
    render: (a) => (
      <Badge title={a.classification?.reason} tone={TYPES[a.type].tone}>
        {TYPES[a.type].label}
      </Badge>
    ),
  },
  {
    key: "dur",
    label: "Duración",
    align: "right",
    render: (a) => duration(a.dur),
  },
  {
    key: "dist",
    label: "Distancia",
    align: "right",
    render: (a) => number(a.dist, 1) + " km",
  },
  {
    key: "elev",
    label: "Desnivel",
    align: "right",
    render: (a) => number(a.elev) + " m",
  },
  {
    key: "np",
    label: "NP",
    align: "right",
    render: (a) => number(a.np) + " W",
  },
  {
    key: "hr",
    label: "FC media",
    align: "right",
    render: (a) => number(a.hr) + " ppm",
  },
  { key: "tss", label: "TSS", align: "right", render: (a) => number(a.tss) },
];
export const ratio = (v: number | null, weight: number | null) =>
  v === null || !weight ? "–" : number(v / weight, 2);
export function pickNumber(
  row: Record<string, unknown> | undefined,
  key: string,
) {
  const v = row?.[key];
  return typeof v === "number" ? v : null;
}
