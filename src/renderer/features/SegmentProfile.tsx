import { useEffect, useMemo, useState } from "react";
import type {
  ActivityDetail,
  Segment,
  SegmentAttempt,
  Source,
} from "../../shared/models";
import { overlayProfile, segmentProfile } from "../../domain/segmentProfile";
import { LineChart } from "../components/charts";
import { Button, Panel, StateBlock } from "../components/ui";
import { date, duration, number } from "../format";

export function SegmentProfile(p: {
  source: Source;
  segment: Segment;
  original: ActivityDetail | null;
  attempt: SegmentAttempt | null;
}) {
  const [loaded, setLoaded] = useState<{
    id: string;
    detail: ActivityDetail;
  } | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    if (p.attempt) {
      const id = p.attempt.activityId;
      window.cyclelab
        .getActivity(p.source, id)
        .then((detail) => {
          if (active) setLoaded({ id, detail });
        })
        .catch((e) => {
          if (active)
            setError(
              e instanceof Error
                ? e.message
                : "No se pudo cargar el resultado.",
            );
        });
    }
    return () => {
      active = false;
    };
  }, [p.source, p.attempt, retry]);
  const detail = p.attempt
    ? loaded?.id === p.attempt.activityId
      ? loaded.detail
      : null
    : p.original;
  const range = p.attempt ?? p.segment;
  const profile = useMemo(
    () => segmentProfile(detail?.rows.slice(range.i0, range.i1 + 1) ?? []),
    [detail, range.i0, range.i1],
  );
  const chartData = useMemo(() => overlayProfile(profile), [profile]);
  const series = [
    {
      key: "elev",
      label: "Elevación",
      color: "elevation",
      unit: "m",
      area: true,
    },
    ...(p.attempt
      ? [
          { key: "p", label: "Potencia", color: "power", unit: "W" },
          {
            key: "hr",
            label: "Frecuencia cardíaca",
            color: "heart",
            unit: "ppm",
          },
          { key: "v", label: "Velocidad", color: "speed", unit: "km/h" },
        ]
      : []),
  ];
  return (
    <Panel
      title="Perfil del segmento"
      subtitle={
        p.attempt
          ? `${p.attempt.activityName} · ${date(p.attempt.date)}`
          : "Selección original · selecciona un resultado para ver potencia, pulso y velocidad."
      }
    >
      {error ? (
        <StateBlock
          kind="error"
          title="No se pudo cargar el resultado"
          detail={error}
          action={
            <Button onClick={() => setRetry((n) => n + 1)}>Reintentar</Button>
          }
        />
      ) : !detail ? (
        <StateBlock kind="loading" title="Cargando perfil" />
      ) : !profile.length ? (
        <StateBlock title="Sin muestras para este tramo" />
      ) : (
        <>
          <p className="small cl-faint">
            Cada curva usa su propia escala. Pasa el ratón para consultar los
            valores reales.
          </p>
          <LineChart
            data={chartData}
            legend
            series={series.map((s) => ({
              ...s,
              key: `${s.key}Plot`,
              hideInTooltip: true,
            }))}
            yDomain={[0, 100]}
            hideYAxis
            xFormat={duration}
            tooltipExtra={(row: (typeof chartData)[number]) => (
              <>
                {series.map((s) => (
                  <div className="cl-tip-row" key={s.key}>
                    <i
                      className="cl-swatch"
                      style={{ background: `var(--${s.color})` }}
                    />
                    {s.label}
                    <b>
                      {number(
                        row[s.key as "elev" | "p" | "hr" | "v"],
                        s.key === "v" ? 1 : 0,
                      )}{" "}
                      {s.unit}
                    </b>
                  </div>
                ))}
                <div className="cl-tip-row">
                  Pendiente <b>{number(row.grade, 1)} %</b>
                </div>
              </>
            )}
          />
        </>
      )}
    </Panel>
  );
}
