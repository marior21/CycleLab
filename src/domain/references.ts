import type { ToolView } from "../shared/models";
export type Reference =
  | {
      kind: "activity" | "attempt" | "range";
      key: string;
      activityId: string;
      name: string;
      date?: string;
      label?: string;
      range?: [number, number];
    }
  | { kind: "period"; key: string; from: string; to: string };
const day = (v: number) => new Date(v).toISOString().slice(0, 10);
/** Activities, attempts, selected ranges and periods a coach answer relied on. */
export function messageReferences(tools: ToolView[]): Reference[] {
  const refs = new Map<string, Reference>();
  for (const t of tools) {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(t.args);
    } catch {
      /* Older answers may store non-JSON arguments. */
    }
    const xs = t.rows.map((r) => r.x).filter((x) => typeof x === "number");
    const [from, to] =
      typeof args.desde === "string" || typeof args.hasta === "string"
        ? [String(args.desde ?? ""), String(args.hasta ?? "")]
        : t.tool === "carga_entrenamiento" && xs.length
          ? [day(Math.min(...xs)), day(Math.max(...xs))]
          : ["", ""];
    if (from || to)
      refs.set(`period:${from}:${to}`, {
        kind: "period",
        key: `period:${from}:${to}`,
        from,
        to,
      });
    for (const r of t.rows) {
      if (typeof r.activityId !== "string") continue;
      const range =
        typeof r.i0 === "number" && typeof r.i1 === "number"
          ? ([r.i0, r.i1] as [number, number])
          : undefined;
      const key = `${r.activityId}:${range ?? ""}`;
      if (refs.has(key)) continue;
      refs.set(key, {
        kind: !range
          ? "activity"
          : t.tool === "comparar_ascensiones"
            ? "attempt"
            : "range",
        key,
        activityId: r.activityId,
        name: String(r.actividad ?? r.activityId),
        date: typeof r.fecha === "string" ? r.fecha : undefined,
        label: typeof r.tramo === "string" ? r.tramo : undefined,
        range,
      });
    }
  }
  return [...refs.values()];
}
