import { useEffect, useMemo, useRef, useState } from "react";
import type { Activity, ActivityDetail } from "../../shared/models";
import { nearest, routeSelection } from "../../domain/analysis";
import { segmentStats } from "../../domain/segmentMatching";
import { Button, Metric, Panel } from "../components/ui";
import { LineChart } from "../components/charts";
import { RouteMap } from "../components/RouteMap";
import { duration, number } from "../format";
import type { PageProps } from "./shared";

export function SegmentCreator(
  p: PageProps & {
    activity: Activity;
    detail: ActivityDetail;
    range: [number, number];
    /** Opened from a suggested climb: starts marked as a climb. */
    climb?: boolean;
    onCancel: () => void;
    onSaved: (climb: boolean) => void;
  },
) {
  const [range, setRange] = useState(p.range);
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [climb, setClimb] = useState(p.climb ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hover, setHover] = useState<number | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  const { rows, points, pointIndices } = p.detail;
  const last = rows.length - 1;
  const distance = rows.every((r) => r.km !== null);
  const x = distance ? "km" : "x";
  const format = (value: number) =>
    distance ? `${number(value, 2)} km` : duration(value);
  const metrics = useMemo(() => segmentStats(rows, ...range), [rows, range]);
  const highlight = routeSelection(pointIndices, range);
  const select = (next: [number, number] | null) => {
    if (!next) {
      setRange([0, last]);
      return;
    }
    const lo = Math.max(0, Math.min(last - 1, Math.min(...next)));
    setRange([lo, Math.max(lo + 1, Math.min(last, Math.max(...next)))]);
  };
  const move = (endpoint: number, value: number) => {
    setRange(([a, b]) =>
      endpoint === 0
        ? [Math.max(0, Math.min(b - 1, value)), b]
        : [a, Math.min(last, Math.max(a + 1, value))],
    );
  };
  return (
    <div className="page segment-creator">
      <div className="toolbar">
        <Button variant="ghost" onClick={p.onCancel} disabled={busy}>
          Volver a la actividad
        </Button>
        <span className="small cl-faint">{p.activity.name}</span>
        <span className="push small cl-faint">
          Paso {step} de 2 ·{" "}
          {step === 1 ? "Seleccionar tramo" : "Nombre y revisión"}
        </span>
      </div>
      <div className="segment-workspace">
        <aside className="segment-guide">
          <h2 ref={heading} tabIndex={-1}>
            {step === 1 ? "Selecciona tu segmento" : "Ponle nombre al segmento"}
          </h2>
          <p className="cl-muted">
            {step === 1
              ? "Ajusta el inicio y el final con los deslizadores. También puedes arrastrar sobre el perfil de elevación para seleccionar un tramo."
              : "Elige un nombre que te ayude a reconocer este tramo. Se guardará en Segmentos para consultar tus esfuerzos."}
          </p>
          <div className="segment-summary" aria-live="polite">
            <Metric
              label="Distancia"
              value={number(metrics.dist, 2)}
              unit="km"
            />
            <Metric label="Desnivel" value={number(metrics.gain)} unit="m+" />
            <Metric label="Duración" value={duration(metrics.dur)} />
          </div>
          {step === 1 ? (
            <>
              <p className="small cl-faint">
                Usa ← → sobre cada deslizador para ajustar una muestra. Esc
                restablece el recorrido completo.
              </p>
              <div className="toolbar">
                <Button onClick={p.onCancel}>Cancelar</Button>
                <Button variant="primary" onClick={() => setStep(2)}>
                  Siguiente
                </Button>
              </div>
            </>
          ) : (
            <form
              className="segment-save"
              onSubmit={async (e) => {
                e.preventDefault();
                if (busy || !name.trim()) return;
                setBusy(true);
                setError("");
                try {
                  await window.cyclelab.saveSegment(
                    p.demo ? "demo" : "garmin",
                    p.activity.id,
                    name,
                    ...range,
                    climb,
                  );
                  p.onSaved(climb);
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "No se pudo guardar el segmento.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label className="segment-name">
                Nombre del segmento
                <input
                  className="input"
                  value={name}
                  maxLength={100}
                  required
                  disabled={busy}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Por ejemplo, subida al mirador"
                />
              </label>
              <label className="segment-climb">
                <input
                  type="checkbox"
                  className="cl-check"
                  checked={climb}
                  disabled={busy}
                  onChange={(e) => setClimb(e.target.checked)}
                />
                Marcar como puerto
              </label>
              <p className="small cl-faint">
                Solo se guarda en CycleLab. No se publica en Strava ni en
                Garmin.
              </p>
              {error && <p role="alert">{error}</p>}
              <div className="toolbar">
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => setStep(1)}
                >
                  Atrás
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={busy || !name.trim()}
                >
                  {busy ? "Guardando…" : "Guardar segmento"}
                </Button>
              </div>
            </form>
          )}
        </aside>
        <div className="segment-visuals">
          <Panel
            title="Tramo de la actividad"
            subtitle={
              p.demo
                ? "Mapa simulado · datos de demostración"
                : "Recorrido GPS de la actividad"
            }
          >
            <fieldset
              className="segment-controls"
              aria-label="Límites del segmento"
              disabled={step === 2}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  select(null);
                }
              }}
            >
              {[0, 1].map((endpoint) => (
                <div className="segment-endpoint" key={endpoint}>
                  <label htmlFor={`segment-endpoint-${endpoint}`}>
                    <b>{endpoint === 0 ? "Inicio" : "Final"}</b>
                    <span>{format(Number(rows[range[endpoint]][x]))}</span>
                  </label>
                  <input
                    id={`segment-endpoint-${endpoint}`}
                    type="range"
                    aria-label={endpoint === 0 ? "Inicio" : "Final"}
                    min={0}
                    max={last}
                    step={1}
                    value={range[endpoint]}
                    aria-valuetext={format(Number(rows[range[endpoint]][x]))}
                    onChange={(e) => move(endpoint, Number(e.target.value))}
                  />
                  <div className="toolbar compact">
                    <Button
                      size="sm"
                      aria-label={`Retrasar ${endpoint === 0 ? "inicio" : "final"}`}
                      disabled={
                        step === 2 ||
                        range[endpoint] === (endpoint === 0 ? 0 : range[0] + 1)
                      }
                      onClick={() => move(endpoint, range[endpoint] - 1)}
                    >
                      ← Atrás
                    </Button>
                    <Button
                      size="sm"
                      aria-label={`Adelantar ${endpoint === 0 ? "inicio" : "final"}`}
                      disabled={
                        step === 2 ||
                        range[endpoint] ===
                          (endpoint === 0 ? range[1] - 1 : last)
                      }
                      onClick={() => move(endpoint, range[endpoint] + 1)}
                    >
                      Adelante →
                    </Button>
                  </div>
                </div>
              ))}
            </fieldset>
            <RouteMap
              points={points}
              features={p.detail.features}
              height={360}
              scale
              highlight={highlight}
              markers={
                highlight
                  ? [
                      { index: highlight[0], label: "I" },
                      { index: highlight[1], label: "F" },
                    ]
                  : []
              }
              cursor={
                hover === null
                  ? null
                  : pointIndices
                    ? pointIndices.indexOf(hover)
                    : hover
              }
              geographic={
                p.demo
                  ? undefined
                  : {
                      rows,
                      theme: p.theme,
                      configured: p.maptilerConfigured,
                      onSettings: () => p.go("settings"),
                      onHover: (i) =>
                        setHover(i === null ? null : (pointIndices?.[i] ?? i)),
                      onSelect:
                        step === 1
                          ? (r) =>
                              select([
                                pointIndices?.[r[0]] ?? r[0],
                                pointIndices?.[r[1]] ?? r[1],
                              ])
                          : undefined,
                    }
              }
              caption="Inicio · verde / Final · rojo"
            />
          </Panel>
          <Panel
            title="Perfil de elevación"
            subtitle={
              step === 1
                ? "Arrastra para seleccionar · el mapa y las métricas se actualizan al ajustar el tramo"
                : "Revisa el tramo antes de guardarlo"
            }
          >
            <LineChart
              data={rows}
              x={x}
              height={180}
              zeroBased={false}
              xFormat={format}
              yFormat={(v) => `${number(v)} m`}
              hoverIndex={hover}
              onHover={setHover}
              selection={[Number(rows[range[0]][x]), Number(rows[range[1]][x])]}
              onSelect={
                step === 1
                  ? (r) =>
                      select(
                        r
                          ? [nearest(rows, x, r[0]), nearest(rows, x, r[1])]
                          : null,
                      )
                  : undefined
              }
              series={[
                {
                  key: "elev",
                  label: "Elevación",
                  color: "elevation",
                  area: true,
                  areaOpacity: 0.28,
                  unit: "m",
                },
              ]}
            />
          </Panel>
        </div>
      </div>
    </div>
  );
}
