import { useEffect, useMemo, useState } from "react";
import type { Activity, ActivityDetail } from "../../shared/models";
import { suggestClimbs } from "../../domain/climbSuggestions";
import { Badge, Button, DataTable, Panel, StateBlock } from "../components/ui";
import { number } from "../format";
import type { PageProps } from "./shared";

/** Climbs found on the elevation profile, saved only after the user confirms. */
export function ClimbSuggestions(p: {
  page: PageProps;
  a: Activity;
  d: ActivityDetail;
  range: [number, number] | null;
  select: (range: [number, number] | null) => void;
}) {
  const rows = p.d.rows,
    source = p.page.demo ? "demo" : "garmin";
  const climbs = useMemo(() => suggestClimbs(rows), [rows]);
  // Saved segments that pass here, by their search results on this activity.
  const [passes, setPasses] = useState<
    { name: string; i0: number; i1: number }[]
  >([]);
  useEffect(() => {
    let live = true;
    Promise.all(
      p.page.segments.map((s) =>
        window.cyclelab
          .getSegmentResults(source, s.id)
          .then((r) =>
            [
              ...(s.activityId === p.a.id ? [s] : []),
              ...r.attempts.filter((t) => t.activityId === p.a.id),
            ].map((t) => ({ name: s.name, i0: t.i0, i1: t.i1 })),
          )
          .catch(() => []),
      ),
    ).then((list) => live && setPasses(list.flat()));
    return () => {
      live = false;
    };
  }, [p.page.segments, p.a.id, source]);
  const saved = (i0: number, i1: number) =>
    passes.find((t) => Math.min(i1, t.i1) - Math.max(i0, t.i0) >= (i1 - i0) / 2)
      ?.name;
  const hasProfile = rows.some((r) => r.elev !== null && r.km !== null);
  const selected = climbs.find(
    (c) => p.range && c.i0 === p.range[0] && c.i1 === p.range[1],
  );
  return (
    <Panel
      flush
      title="Puertos del recorrido"
      subtitle="Subidas de al menos 0,5 km, 40 m y 3 % en el perfil suavizado · nada se guarda sin tu confirmación"
    >
      <DataTable
        compact
        rowKey="i0"
        rows={climbs}
        selected={selected?.i0}
        onSelect={(_key, c) => p.select(c === selected ? null : [c.i0, c.i1])}
        onEscape={() => p.select(null)}
        columns={[
          {
            key: "km",
            label: "Km",
            render: (c) =>
              number(rows[c.i0].km, 1) + "–" + number(rows[c.i1].km, 1),
          },
          {
            key: "dist",
            label: "Distancia",
            align: "right",
            render: (c) => number(c.dist, 1) + " km",
          },
          {
            key: "gain",
            label: "Desnivel",
            align: "right",
            render: (c) => number(c.gain) + " m",
          },
          {
            key: "grade",
            label: "Pendiente",
            align: "right",
            render: (c) => number(c.grade, 1) + " %",
          },
          {
            key: "save",
            label: "",
            align: "right",
            render: (c) => {
              const name = saved(c.i0, c.i1);
              return name ? (
                <Badge tone="success">Ya guardado · {name}</Badge>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Guardar como puerto la subida del km ${number(rows[c.i0].km, 1)}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    p.page.createSegment(p.a, p.d, [c.i0, c.i1], true);
                  }}
                >
                  Guardar como puerto
                </Button>
              );
            },
          },
        ]}
        empty={
          <StateBlock
            title={
              hasProfile
                ? "Sin subidas destacables"
                : "Sin distancia ni altitud para buscar subidas"
            }
          />
        }
      />
    </Panel>
  );
}
