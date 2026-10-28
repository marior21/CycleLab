import { SegmentAttempts } from "./SegmentAttempts";
import { useEffect, useState } from "react";
import type { ActivityDetail } from "../../shared/models";
import { Badge, Button, Metric, Panel, StateBlock } from "../components/ui";
import { RouteMap } from "../components/RouteMap";
import { routeSelection } from "../../domain/analysis";
import { averageGrade } from "../../domain/segmentProfile";
import { duration, number, date } from "../format";
import type { PageProps } from "./shared";

export function Segments(p: PageProps & { climbsOnly?: boolean }) {
  const segments = p.climbsOnly
    ? p.segments.filter((s) => s.isClimb === true)
    : p.segments;
  const [id, setId] = useState(segments[0]?.id);
  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const segment = segments.find((s) => s.id === id) ?? segments[0];
  const activity = p.data.activities.find((a) => a.id === segment?.activityId);
  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setError("");
    setConfirm(false);
    if (segment)
      window.cyclelab
        .getActivity(p.demo ? "demo" : "garmin", segment.activityId)
        .then((d) => {
          if (!cancelled) setDetail(d);
        })
        .catch((e) => {
          if (!cancelled) setError(String(e.message));
        });
    return () => {
      cancelled = true;
    };
  }, [segment?.id, segment?.activityId, p.demo]);
  useEffect(() => {
    p.onContext({
      screen: p.climbsOnly ? "climbs" : "segments",
      segmentId: segment?.id,
    });
  }, [p.onContext, p.climbsOnly, segment?.id]);
  if (!segment)
    return (
      <div className="page">
        <StateBlock
          title={
            p.climbsOnly ? "Sin puertos marcados" : "Sin segmentos guardados"
          }
          detail={
            p.climbsOnly
              ? "Marca un segmento como puerto para verlo aquí. Seguirá disponible en Segmentos."
              : "Abre una actividad y pulsa Crear segmento para seleccionar el tramo y guardarlo con un nombre."
          }
        />
        <Button onClick={() => p.go(p.climbsOnly ? "segments" : "activities")}>
          {p.climbsOnly ? "Ir a Segmentos" : "Ir a Actividades"}
        </Button>
      </div>
    );
  return (
    <>
      <div className="list-pane climb-list">
        <div className="filters">
          <div className="label">
            {p.climbsOnly ? "Mis puertos" : "Mis segmentos"}
          </div>
          <div className="small cl-faint">
            {p.climbsOnly
              ? "Segmentos marcados como puertos."
              : "Todos tus tramos guardados, incluidos los puertos."}
          </div>
        </div>
        <div
          className="activity-list"
          role="listbox"
          aria-label={p.climbsOnly ? "Puertos" : "Segmentos"}
        >
          {segments.map((s) => (
            <div
              className="climb-item"
              role="option"
              aria-selected={segment.id === s.id}
              tabIndex={0}
              key={s.id}
              onClick={() => setId(s.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setId(s.id);
                }
              }}
            >
              <div className="act-name">
                {s.name} {s.isClimb && <Badge>Puerto</Badge>}
              </div>
              <div className="act-meta">
                {number(s.dist, 2)} km · {number(s.gain)} m+ ·{" "}
                {duration(s.end - s.start)}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="detail">
        <div className="page">
          <div className="toolbar">
            <div>
              <div className="detail-heading">{segment.name}</div>
              <div className="small cl-faint">
                {activity?.name} · {activity ? date(activity.date) : ""} ·{" "}
                {duration(segment.start)}–{duration(segment.end)}
              </div>
            </div>
            <Button
              icon="coach"
              onClick={() =>
                p.ask("Analiza este tramo del segmento seleccionado")
              }
            >
              Analizar este tramo
            </Button>
            <Button
              onClick={() =>
                p.openActivity(segment.activityId, [segment.i0, segment.i1])
              }
            >
              Ver actividad
            </Button>
          </div>
          <div className="toolbar">
            <Button
              disabled={busy}
              aria-pressed={!!segment.isClimb}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await window.cyclelab.setSegmentClimb(
                    p.demo ? "demo" : "garmin",
                    segment.id,
                    !segment.isClimb,
                  );
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "No se pudo cambiar la clasificación.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {segment.isClimb
                ? "Quitar marca de puerto"
                : "Marcar como puerto"}
            </Button>
          </div>
          <Panel
            title="Tramo guardado"
            subtitle="Métricas de la selección original."
          >
            <div className="sel-bar">
              <Metric
                label="Distancia"
                value={number(segment.dist, 2)}
                unit="km"
              />
              <Metric label="Desnivel" value={number(segment.gain)} unit="m+" />
              <Metric
                label="Pendiente media"
                value={number(
                  averageGrade(
                    detail?.rows[segment.i0]?.elev,
                    detail?.rows[segment.i1]?.elev,
                    segment.dist,
                  ),
                  1,
                )}
                unit="%"
              />
              <Metric
                label="Duración"
                value={duration(segment.end - segment.start)}
              />
              <Metric
                label="Potencia media"
                value={number(segment.avgP)}
                unit="W"
              />
              <Metric label="FC media" value={number(segment.hr)} unit="ppm" />
            </div>
          </Panel>
          <SegmentAttempts
            key={`${p.demo}:${segment.id}`}
            source={p.demo ? "demo" : "garmin"}
            id={segment.id}
            segment={segment}
            detail={detail}
            openActivity={p.openActivity}
          />
          {error && <p role="alert">{error}</p>}
          {detail && (
            <>
              <Panel title="Ubicación del tramo">
                {detail.points.length ? (
                  <RouteMap
                    geographic={
                      p.demo
                        ? undefined
                        : {
                            rows: detail.rows,
                            configured: p.maptilerConfigured,
                            theme: p.theme,
                            onSettings: () => p.go("settings"),
                          }
                    }
                    zoomToHighlight
                    points={detail.points}
                    features={detail.features}
                    markers={detail.markers}
                    highlight={routeSelection(detail.pointIndices, [
                      segment.i0,
                      segment.i1,
                    ])}
                  />
                ) : (
                  <StateBlock
                    title="Sin ruta disponible"
                    detail="Esta actividad no contiene coordenadas utilizables."
                  />
                )}
              </Panel>
            </>
          )}
          <div className="toolbar">
            {confirm ? (
              <>
                <span>
                  ¿Eliminar «{segment.name}»? La actividad se conserva.
                </span>
                <Button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await window.cyclelab.deleteSegment(
                        p.demo ? "demo" : "garmin",
                        segment.id,
                      );
                      setConfirm(false);
                    } catch (e) {
                      setError(
                        e instanceof Error ? e.message : "No se pudo eliminar.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Confirmar eliminación
                </Button>
                <Button disabled={busy} onClick={() => setConfirm(false)}>
                  Cancelar
                </Button>
              </>
            ) : (
              <Button variant="ghost" onClick={() => setConfirm(true)}>
                Eliminar segmento
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
