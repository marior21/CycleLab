import { sortAttempts, type AttemptSort } from "./segmentSort";
import { useEffect, useState } from "react";
import { SegmentComparison } from "./SegmentComparison";
import { SegmentProfile } from "./SegmentProfile";
import type {
  ActivityDetail,
  Segment,
  SegmentAttempt,
  SegmentResults,
  Source,
} from "../../shared/models";
import { includedAttempts } from "../../domain/segments";
import { LineChart } from "../components/charts";
import { Button, DataTable, Metric, Panel, StateBlock } from "../components/ui";
import { duration, number } from "../format";

const day = (v: number) =>
  new Date(v).toLocaleDateString("es-ES", { timeZone: "UTC" });

export function SegmentAttempts(p: {
  source: Source;
  id: string;
  segment: Segment;
  detail: ActivityDetail | null;
  openActivity: (id: string, selection?: [number, number]) => void;
}) {
  const [checked, setChecked] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [selected, setSelected] = useState<SegmentAttempt | null>(null);
  const [report, setReport] = useState<SegmentResults | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [excluding, setExcluding] = useState<{
    attempt: SegmentAttempt;
    reason: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
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
  // shortcut: exclusions are keyed by attempt id (activity + sample range); if a re-download shifts the samples, the exclusion stops matching and the attempt reappears for review.
  const included = report ? includedAttempts(p.segment, report.attempts) : [];
  const excluded =
    report?.attempts.filter((a) => p.segment.excluded?.[a.id]) ?? [];
  const pair = checked.flatMap((id) => included.find((a) => a.id === id) ?? []);
  const best = included.reduce<SegmentAttempt | null>(
    (value, a) => (a.dur != null && (!value || a.dur < value.dur!) ? a : value),
    null,
  );
  const history = included.toSorted((a, b) => a.date - b.date || a.i0 - b.i0);
  const last = history.at(-1);
  async function setExcluded(attemptId: string, reason: string | null) {
    setBusy(true);
    setError("");
    try {
      await window.cyclelab.setAttemptExcluded(
        p.source,
        p.id,
        attemptId,
        reason,
      );
      setExcluding(null);
      setChecked((current) => current.filter((id) => id !== attemptId));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo guardar la revisión.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
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
              {excluded.length
                ? ` ${excluded.length} ${excluded.length === 1 ? "coincidencia excluida" : "coincidencias excluidas"} manualmente.`
                : ""}
            </p>
            {report.note && <p className="small cl-faint">{report.note}</p>}
            <div className="sel-bar">
              <Metric label="Resultados" value={included.length} />
              <Metric
                label="Mejor tiempo"
                value={duration(best?.dur)}
                sub={best ? day(best.date) : undefined}
              />
              <Metric
                label="Último intento"
                value={duration(last?.dur)}
                sub={last ? day(last.date) : undefined}
              />
            </div>
            {history.length >= 2 && (
              <LineChart
                data={history.map((a, i) => ({ i, dur: a.dur, date: a.date }))}
                x="i"
                height={160}
                zeroBased={false}
                xFormat={(i) => (history[i] ? day(history[i].date) : "")}
                yFormat={(v) => duration(v)}
                tooltipTitle={(i) => history[i]?.activityName}
                series={[
                  {
                    key: "dur",
                    label: "Tiempo",
                    color: "brand",
                    format: (v) => duration(v),
                  },
                ]}
                ariaLabel="Evolución del tiempo en el segmento por fecha"
              />
            )}
            {excluding && (
              <form
                className="toolbar"
                onSubmit={(e) => {
                  e.preventDefault();
                  void setExcluded(excluding.attempt.id, excluding.reason);
                }}
              >
                <span>
                  Excluir «{excluding.attempt.activityName}» del{" "}
                  {day(excluding.attempt.date)}:
                </span>
                <input
                  className="input"
                  autoFocus
                  maxLength={200}
                  aria-label="Motivo de la exclusión"
                  placeholder="Motivo, p. ej. camino paralelo"
                  value={excluding.reason}
                  onChange={(e) =>
                    setExcluding({ ...excluding, reason: e.target.value })
                  }
                  onKeyDown={(e) => e.key === "Escape" && setExcluding(null)}
                />
                <Button
                  type="submit"
                  disabled={busy || !excluding.reason.trim()}
                >
                  Excluir coincidencia
                </Button>
                <Button disabled={busy} onClick={() => setExcluding(null)}>
                  Cancelar
                </Button>
              </form>
            )}
            <div className="toolbar">
              <span className="small cl-faint">
                Marca dos intentos para comparar · {pair.length}/2
              </span>
              <Button
                disabled={pair.length !== 2}
                onClick={() => setComparing(true)}
              >
                Comparar intentos
              </Button>
            </div>
            <DataTable
              checked={checked}
              onCheck={(id) => {
                setComparing(false);
                setChecked((current) =>
                  current.includes(String(id))
                    ? current.filter((value) => value !== id)
                    : [...current, String(id)].slice(-2),
                );
              }}
              rows={sortAttempts(included, sort)}
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
              selected={selected?.id}
              onSelect={(_id, attempt) => setSelected(attempt)}
              columns={[
                {
                  key: "date",
                  label: "Fecha",
                  render: (a) => day(a.date),
                },
                {
                  key: "activityName",
                  label: "Actividad",
                  render: (a) => (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        p.openActivity(a.activityId);
                      }}
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
                {
                  key: "review",
                  label: "Revisión",
                  render: (a) =>
                    !a.original && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={(e) => {
                          e.stopPropagation();
                          setExcluding({ attempt: a, reason: "" });
                        }}
                      >
                        Excluir
                      </Button>
                    ),
                },
              ]}
              empty="No hay pasos completos identificados."
            />
            {excluded.length > 0 && (
              <DataTable
                compact
                rows={excluded}
                rowKey="id"
                columns={[
                  {
                    key: "date",
                    label: "Excluida",
                    render: (a) => day(a.date),
                  },
                  { key: "activityName", label: "Actividad" },
                  {
                    key: "reason",
                    label: "Motivo",
                    render: (a) => p.segment.excluded?.[a.id],
                  },
                  {
                    key: "restore",
                    label: "",
                    align: "right",
                    render: (a) => (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => void setExcluded(a.id, null)}
                      >
                        Restaurar
                      </Button>
                    ),
                  },
                ]}
              />
            )}
          </>
        )}
      </Panel>
      {comparing && pair.length === 2 && (
        <SegmentComparison
          key={pair.map((a) => a.id).join("|")}
          source={p.source}
          attempts={[pair[0], pair[1]]}
          openActivity={p.openActivity}
          onClose={() => setComparing(false)}
        />
      )}
      <SegmentProfile
        source={p.source}
        segment={p.segment}
        original={p.detail}
        attempt={selected}
      />
    </>
  );
}
