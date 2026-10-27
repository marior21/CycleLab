import { sortAttempts, type AttemptSort } from "./segmentSort";
import { useEffect, useState } from "react";
import type { SegmentResults, Source } from "../../shared/models";
import { Button, DataTable, Metric, Panel, StateBlock } from "../components/ui";
import { duration, number } from "../format";

export function SegmentAttempts(p: {
  source: Source;
  id: string;
  openActivity: (id: string) => void;
}) {
  const [report, setReport] = useState<SegmentResults | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [sort, setSort] = useState<AttemptSort>({
    key: "date",
    direction: "descending",
  });
  useEffect(() => {
    let active = true,
      request = 0;
    async function load(force = false) {
      const n = ++request;
      try {
        const value = await window.cyclelab.getSegmentResults(
          p.source,
          p.id,
          force,
        );
        if (active && n === request) {
          setReport(value);
          setError("");
        }
      } catch (e) {
        if (active)
          setError(
            e instanceof Error
              ? e.message
              : "No se pudieron cargar los resultados.",
          );
      }
    }
    void load(retry > 0);
    const unsubscribe = window.cyclelab.onChange(() => {
      void load();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [p.source, p.id, retry]);
  const best = report?.attempts.reduce<number | null>(
    (value, a) => (value === null || a.dur < value ? a.dur : value),
    null,
  );
  return (
    <Panel
      title="Resultados del segmento"
      subtitle="Todo el histórico local · mismo recorrido y sentido · tiempos aproximados según las muestras GPS."
      actions={
        <Button
          size="sm"
          disabled={report?.status === "running"}
          onClick={() => setRetry((n) => n + 1)}
        >
          Volver a buscar
        </Button>
      }
    >
      {!report && !error && (
        <StateBlock kind="loading" title="Buscando resultados" />
      )}
      {(error || report?.error) && (
        <p role="alert">{error || report?.error} Puedes volver a buscar.</p>
      )}
      {report && (
        <>
          <p className="small cl-faint" role="status">
            {report.status === "running"
              ? "Buscando"
              : report.status === "error"
                ? "Búsqueda interrumpida"
                : "Búsqueda completada"}
            : {report.scanned} de {report.total} actividades. {report.skipped}{" "}
            sin GPS utilizable o sin muestras para comparar.
          </p>
          {report.note && <p className="small cl-faint">{report.note}</p>}
          <div className="sel-bar">
            <Metric label="Resultados" value={report.attempts.length} />
            <Metric label="Mejor tiempo" value={duration(best)} />
          </div>
          <DataTable
            rows={sortAttempts(report.attempts, sort)}
            sort={sort}
            onSort={(key) =>
              setSort((current) => ({
                key: key as AttemptSort["key"],
                direction:
                  current.key === key && current.direction === "ascending"
                    ? "descending"
                    : "ascending",
              }))
            }
            rowKey="id"
            columns={[
              {
                key: "date",
                label: "Fecha",
                render: (a) =>
                  new Date(a.date).toLocaleDateString("es-ES", {
                    timeZone: "UTC",
                  }),
              },
              {
                key: "activityName",
                label: "Actividad",
                render: (a) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => p.openActivity(a.activityId)}
                  >
                    {a.activityName}
                    {a.original ? " · original" : ""}
                  </Button>
                ),
              },
              {
                key: "dur",
                label: "Tiempo",
                align: "right",
                render: (a) => duration(a.dur),
              },
              {
                key: "avgP",
                label: "Potencia",
                align: "right",
                render: (a) => number(a.avgP) + " W",
              },
              {
                key: "hr",
                label: "FC",
                align: "right",
                render: (a) => number(a.hr) + " ppm",
              },
              {
                key: "cad",
                label: "Cadencia",
                align: "right",
                render: (a) => number(a.cad) + " rpm",
              },
            ]}
            empty="No hay pasos completos identificados."
          />
        </>
      )}
    </Panel>
  );
}
