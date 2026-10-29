import { useEffect, useMemo, useState } from "react";
import type {
  ActivityDetail,
  SegmentAttempt,
  Source,
} from "../../shared/models";
import {
  compareSegmentAttempts,
  timeSectors,
} from "../../domain/segmentComparison";
import { LineChart } from "../components/charts";
import { Badge, Button, DataTable, Panel, StateBlock } from "../components/ui";
import { date, duration, number } from "../format";

export function SegmentComparison(p: {
  source: Source;
  attempts: [SegmentAttempt, SegmentAttempt];
  openActivity: (id: string, selection?: [number, number]) => void;
  onClose: () => void;
}) {
  const [details, setDetails] = useState<ActivityDetail[] | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [selection, setSelection] = useState<[number, number] | null>(null);
  const [a, b] = p.attempts;
  useEffect(() => {
    let active = true;
    setDetails(null);
    setError("");
    Promise.all(
      [a, b].map((attempt) =>
        window.cyclelab.getActivity(p.source, attempt.activityId),
      ),
    )
      .then((value) => {
        if (active) setDetails(value);
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error
              ? e.message
              : "No se pudieron cargar los intentos.",
          );
      });
    return () => {
      active = false;
    };
  }, [p.source, a.activityId, b.activityId, retry]);
  const rows = useMemo(
    () =>
      details
        ? compareSegmentAttempts(
            details[0].rows.slice(a.i0, a.i1 + 1),
            details[1].rows.slice(b.i0, b.i1 + 1),
          )
        : [],
    [details, a.i0, a.i1, b.i0, b.i1],
  );
  const sectors = useMemo(() => {
    const total = rows.findLast((r) => r.delta !== null)?.x ?? 0;
    return timeSectors(rows, total >= 2 ? 1 : 0.25);
  }, [rows]);
  const seconds = (v: number) =>
    (v < -0.05 ? "−" : v > 0.05 ? "+" : "±") + number(Math.abs(v), 1) + " s";
  const shared = {
    data: rows,
    xFormat: (v: number) => `${number(v, 2)} km`,
    hoverIndex: hover,
    onHover: setHover,
    selection,
    onSelect: setSelection,
    legend: true,
    zeroBased: false,
    yFormat: (v: number) => number(v, 1),
  };
  return (
    <section
      aria-label="Comparación de intentos"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Escape") setSelection(null);
      }}
    >
      <Panel
        title="Comparar intentos"
        actions={<Button onClick={p.onClose}>Cerrar comparación</Button>}
      >
        {[a, b].map((attempt, i) => (
          <div className="toolbar" key={attempt.id}>
            <Button
              onClick={() =>
                p.openActivity(attempt.activityId, [attempt.i0, attempt.i1])
              }
            >
              {i === 0 ? "A" : "B"} · Ver actividad
            </Button>
            <span className="small">
              {attempt.activityName} · {date(attempt.date, true)} ·{" "}
              {duration(attempt.dur)}
              {details &&
                ` · Inicio ${duration(details[i].rows[attempt.i0]?.x)}`}
            </span>
          </div>
        ))}
        <p className="small cl-faint">
          Mismo recorrido y sentido según la búsqueda GPS. Distancia desde el
          inicio de cada intento, sin ajustar longitudes. Tiempos aproximados
          entre muestras; incluyen las pausas (en una parada se usa la salida).
          Interpolación solo entre muestras consecutivas separadas hasta 30 s y
          200 m. Los huecos y sensores ausentes se dejan vacíos.
        </p>
        <p className="small cl-faint">
          Diferencia A − B: valores negativos indican que A llega antes;
          positivos, que A llega después. Arrastra para seleccionar la misma
          distancia en todos los gráficos; Esc limpia la selección.
        </p>
        {selection && (
          <Button size="sm" onClick={() => setSelection(null)}>
            Limpiar selección · {number(selection[0], 2)}–
            {number(selection[1], 2)} km
          </Button>
        )}
        {error ? (
          <StateBlock
            kind="error"
            title="No se pudo cargar la comparación"
            detail={error}
            action={
              <Button onClick={() => setRetry((n) => n + 1)}>Reintentar</Button>
            }
          />
        ) : !details ? (
          <StateBlock kind="loading" title="Cargando intentos" />
        ) : !rows.length ? (
          <StateBlock
            title="Sin distancia utilizable para comparar"
            detail="Los dos intentos necesitan distancia creciente y tiempos ordenados. No se reconstruyen distancias ausentes ni recorridos invertidos."
          />
        ) : (
          <>
            {(
              [
                ["p", "Potencia", "W"],
                ["hr", "Frecuencia cardíaca", "ppm"],
                ["v", "Velocidad", "km/h"],
              ] as const
            ).map(([key, label, unit]) => (
              <div key={key}>
                <h3 className="label">{label}</h3>
                <LineChart
                  {...shared}
                  ariaLabel={`${label} de los intentos sobre distancia`}
                  series={[
                    { key: `a${key}`, label: "A", color: "brand-ink", unit },
                    {
                      key: `b${key}`,
                      label: "B",
                      color: "ink-muted",
                      dash: true,
                      unit,
                    },
                  ]}
                />
              </div>
            ))}
            <h3 className="label">Diferencia de tiempo acumulada</h3>
            <LineChart
              {...shared}
              ariaLabel="Diferencia de tiempo acumulada A menos B"
              series={[
                {
                  key: "delta",
                  label: "A − B",
                  color: "ink",
                  unit: "s",
                  format: (v) => number(v, 1),
                },
              ]}
              refLines={[{ value: 0, label: "Igual tiempo" }]}
            />
            <h3 className="label">Dónde se ganó o perdió tiempo</h3>
            <DataTable
              compact
              rowKey="from"
              rows={sectors}
              selected={
                sectors.find(
                  (s) => s.from === selection?.[0] && s.to === selection?.[1],
                )?.from
              }
              onSelect={(_key, s) => setSelection([s.from, s.to])}
              onEscape={() => setSelection(null)}
              columns={[
                {
                  key: "from",
                  label: "Tramo",
                  render: (s) => `${number(s.from, 2)}–${number(s.to, 2)} km`,
                },
                {
                  key: "change",
                  label: "A − B",
                  align: "right",
                  render: (s) => seconds(s.change),
                },
                {
                  key: "result",
                  label: "Resultado",
                  render: (s) =>
                    Math.abs(s.change) <= 0.05
                      ? "Igual"
                      : s.change < 0
                        ? `A gana ${number(-s.change, 1)} s`
                        : `A pierde ${number(s.change, 1)} s`,
                },
                {
                  key: "gap",
                  label: "Datos",
                  render: (s) =>
                    s.gap ? (
                      <Badge tone="warning">Con hueco</Badge>
                    ) : (
                      "Continuos"
                    ),
                },
              ]}
            />
            <p className="small cl-faint">
              Total A − B ={" "}
              {seconds(sectors.reduce((sum, s) => sum + s.change, 0))}, suma de
              los tramos hasta la última distancia común con tiempo conocido. Un
              tramo con hueco usa solo los tiempos medidos en sus extremos; si
              un límite cae dentro de un hueco, se une al tramo siguiente.
              Viento, tráfico, superficie o paradas no se registran: una
              diferencia de tiempo no demuestra por sí sola un cambio de forma.
            </p>
          </>
        )}
      </Panel>
    </section>
  );
}
