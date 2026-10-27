import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Map,
  NavigationControl,
  ScaleControl,
  LngLatBounds,
  addProtocol,
  setWorkerUrl,
  type GeoJSONSource,
} from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import logo from "../assets/maptiler-logo.svg";
import type { FeatureCollection, Feature, LineString } from "geojson";
import type { RouteMapProps } from "./types";
import { Button, Segmented } from "./ui";
import { hasGPS } from "../../domain/segmentMatching";
import { number } from "../format";
import { mergeRouteLines } from "./mapGeometry";

setWorkerUrl(workerUrl);
addProtocol("cyclemap", async (params, abort) => {
  const url = new URL(params.url);
  if (url.hostname !== "api.maptiler.com")
    throw new Error("Origen de mapa no permitido.");
  abort.signal.throwIfAborted();
  try {
    const result = await window.cyclelab.mapResource(url.pathname + url.search);
    abort.signal.throwIfAborted();
    return {
      data:
        result.kind === "json"
          ? result.data
          : new Uint8Array(result.data).buffer,
    };
  } catch (error) {
    // A cancelled tile must not surface a late IPC/network failure after zooming.
    abort.signal.throwIfAborted();
    throw error;
  }
});
const empty: FeatureCollection = { type: "FeatureCollection", features: [] };
export function GeoRouteMap(
  p: RouteMapProps & {
    geographic: NonNullable<RouteMapProps["geographic"]>;
    fallback: ReactNode;
  },
) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<Map | null>(null),
    latest = useRef(p);
  latest.current = p;
  const samples = useMemo(
    () => p.geographic.rows.filter(hasGPS),
    [p.geographic.rows],
  );
  const coordinates = useMemo(
    () => samples.map((r) => [r.lon, r.lat] as [number, number]),
    [samples],
  );
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [loaded, setLoaded] = useState(0);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState("route");
  const [selecting, setSelecting] = useState(false);
  const [start, setStart] = useState<number | null>(null);
  const selection = useRef({ selecting, start });
  selection.current = { selecting, start };
  const [hover, setHover] = useState<number | null>(null);
  const fit = () => {
    const m = map.current;
    if (!m || !coordinates.length) return;
    const r = latest.current.highlight;
    const subset =
      latest.current.zoomToHighlight && r
        ? coordinates.slice(r[0], r[1] + 1)
        : coordinates;
    if (!subset.length) return;
    const bounds = subset.reduce(
      (b, c) => b.extend(c),
      new LngLatBounds(subset[0], subset[0]),
    );
    m.fitBounds(bounds, {
      padding: Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--map-fit-padding",
        ),
      ),
      maxZoom: 17,
      duration: 0,
    });
  };
  useEffect(() => {
    if (
      !p.geographic.configured ||
      coordinates.length < 2 ||
      !container.current
    )
      return;
    let m: Map | null = null,
      frame = 0;
    setError("");
    setLoaded(0);
    setReady(false);
    try {
      m = new Map({
        container: container.current,
        bounds: coordinates.reduce(
          (b, c) => b.extend(c),
          new LngLatBounds(coordinates[0], coordinates[0]),
        ),
        fitBoundsOptions: {
          padding: Number.parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue(
              "--map-fit-padding",
            ),
          ),
          maxZoom: 17,
        },
        locale: {
          "NavigationControl.ZoomIn": "Acercar",
          "NavigationControl.ZoomOut": "Alejar",
          "NavigationControl.ResetBearing": "Orientar al norte",
          "AttributionControl.ToggleAttribution": "Mostrar atribución",
          "Map.Title": "Mapa del recorrido",
        },
        style: `cyclemap://api.maptiler.com/maps/outdoor-v4${p.geographic.theme === "dark" ? "-dark" : ""}/style.json`,
        attributionControl: {
          compact: false,
          customAttribution:
            '<a href="https://www.maptiler.com/copyright/" target="_blank">© MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap contributors</a>',
        },
        transformRequest: (url) => {
          if (!url.startsWith("cyclemap://"))
            throw new Error("Recurso de cartografía no permitido.");
          return { url };
        },
      });
      map.current = m;
      m.addControl(new NavigationControl({ showCompass: true }), "top-right");
      m.addControl(new ScaleControl({ unit: "metric" }), "top-left");
      m.on("error", (event) => {
        if (!m) return;
        if (
          event.error &&
          "name" in event.error &&
          event.error.name === "AbortError"
        )
          return;
        setError(
          m?.getSource("route")
            ? "No se pudo cargar parte de la cartografía. Puedes seguir usando el mapa o reintentar la descarga."
            : "No se pudo cargar la cartografía. Comprueba la conexión, la cuota o la clave de MapTiler.",
        );
      });
      m.on("idle", () => {
        if (m?.getSource("route")) setReady(true);
      });
      m.on("load", () => {
        if (!m) return;
        const css = getComputedStyle(document.documentElement),
          color = (name: string) => css.getPropertyValue(`--${name}`).trim(),
          size = (name: string) => Number.parseFloat(color(name));
        m.addSource("route", { type: "geojson", data: empty, tolerance: 0 });
        m.addLayer({
          id: "route-outline",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": color("bg-200"),
            "line-width": size("map-route-outline-width"),
          },
        });
        m.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": ["get", "color"],
            "line-width": size("map-route-width"),
          },
        });
        m.addLayer({
          id: "route-selection",
          type: "line",
          source: "route",
          filter: ["==", ["get", "selected"], true],
          paint: {
            "line-color": color("brand-ink"),
            "line-width": size("map-selection-width"),
          },
        });
        m.addSource("route-points", { type: "geojson", data: empty });
        m.addLayer({
          id: "route-points",
          type: "circle",
          source: "route-points",
          paint: {
            "circle-radius": size("map-marker-radius"),
            "circle-color": ["get", "color"],
            "circle-stroke-width": size("map-marker-stroke"),
            "circle-stroke-color": color("bg-200"),
          },
        });
        setLoaded((n) => n + 1);
        fit();
      });
      const nearest = (point: { x: number; y: number }) => {
        let index: number | null = null,
          distance =
            Number.parseFloat(
              getComputedStyle(document.documentElement).getPropertyValue(
                "--map-hit-radius",
              ),
            ) ** 2;
        coordinates.forEach((coordinate, i) => {
          const q = m!.project(coordinate),
            d = (q.x - point.x) ** 2 + (q.y - point.y) ** 2;
          if (d < distance) {
            distance = d;
            index = i;
          }
        });
        return index;
      };
      m.on("mousemove", (e) => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          if (!m) return;
          const i = nearest(e.point);
          setHover(i);
          latest.current.geographic.onHover?.(i);
        });
      });
      m.on("mouseout", () => {
        cancelAnimationFrame(frame);
        setHover(null);
        latest.current.geographic.onHover?.(null);
      });
      m.on("click", (e) => {
        if (!selection.current.selecting) return;
        const i = nearest(e.point);
        if (i === null) return;
        if (selection.current.start === null) setStart(i);
        else if (i !== selection.current.start) {
          latest.current.geographic.onSelect?.([
            Math.min(i, selection.current.start),
            Math.max(i, selection.current.start),
          ]);
          setSelecting(false);
          setStart(null);
        }
      });
    } catch {
      setError("No se pudo iniciar el mapa interactivo en este equipo.");
    }
    const observer = new ResizeObserver(() => m?.resize());
    if (container.current) observer.observe(container.current);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      const previous = m;
      m = null;
      previous?.remove();
      map.current = null;
    };
    // Callbacks and selection are read through refs so cursor movement does not recreate the map.
  }, [coordinates, p.geographic.configured, p.geographic.theme, retry]);
  useEffect(() => {
    fit();
  }, [p.zoomToHighlight, p.highlight?.[0], p.highlight?.[1], loaded]);
  useEffect(() => {
    const m = map.current;
    if (!loaded || !m?.getSource("route")) return;
    const css = getComputedStyle(document.documentElement),
      color = (name: string) => css.getPropertyValue(`--${name}`).trim();
    const features: Feature<LineString>[] = [];
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1],
        b = samples[i];
      if (b.x - a.x > 30) continue;
      const grade =
        a.km !== null &&
        b.km !== null &&
        b.km - a.km >= 0.005 &&
        a.elev !== null &&
        b.elev !== null
          ? (b.elev - a.elev) / ((b.km - a.km) * 10)
          : null;
      const value = mode === "power" ? b.p : mode === "speed" ? b.v : grade;
      const palette =
        mode === "power"
          ? ["z1", "z2", "z3", "z4", "z5", "z6"]
          : mode === "speed"
            ? ["z1", "cadence", "speed"]
            : ["speed", "z2", "z3", "z4", "z5"];
      const thresholds =
        mode === "power"
          ? [100, 200, 250, 300, 400]
          : mode === "speed"
            ? [15, 30]
            : [-2, 2, 5, 9];
      const shade =
        mode === "route" || value === null
          ? "ink-muted"
          : palette[thresholds.filter((t) => value > t).length];
      features.push({
        type: "Feature",
        properties: {
          color: color(shade),
          selected:
            !!p.highlight && i - 1 >= p.highlight[0] && i <= p.highlight[1],
        },
        geometry: {
          type: "LineString",
          coordinates: [coordinates[i - 1], coordinates[i]],
        },
      });
    }
    (m.getSource("route") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: mergeRouteLines(features),
    });
  }, [
    loaded,
    coordinates,
    samples,
    mode,
    p.highlight?.[0],
    p.highlight?.[1],
    p.geographic.theme,
  ]);
  useEffect(() => {
    const m = map.current;
    if (!loaded || !m?.getSource("route-points")) return;
    const css = getComputedStyle(document.documentElement);
    const indices: [number | null | undefined, string][] = [
      [p.highlight?.[0] ?? 0, "success"],
      [p.highlight?.[1] ?? coordinates.length - 1, "danger"],
      [p.cursor, "power"],
      [start, "brand-ink"],
    ];
    (m.getSource("route-points") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: indices
        .filter(([i]) => i != null && coordinates[i])
        .map(([i, color]) => ({
          type: "Feature",
          properties: { color: css.getPropertyValue(`--${color}`).trim() },
          geometry: { type: "Point", coordinates: coordinates[i!] },
        })),
    });
  }, [loaded, coordinates, p.cursor, start, p.geographic.theme, p.highlight]);
  const unavailable = !p.geographic.configured || coordinates.length < 2;
  const row = hover === null ? null : samples[hover];
  return (
    <div
      className="geo-map"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setSelecting(false);
          setStart(null);
        }
      }}
    >
      {!unavailable && (
        <div className="map-toolbar">
          <Segmented
            label="Color de la ruta"
            value={mode}
            onChange={setMode}
            options={[
              { value: "route", label: "Ruta" },
              { value: "power", label: "Potencia" },
              { value: "grade", label: "Pendiente" },
              { value: "speed", label: "Velocidad" },
            ]}
          />
          <Button size="sm" variant="ghost" onClick={fit}>
            Ajustar vista
          </Button>
          {p.geographic.onSelect && (
            <Button
              size="sm"
              variant={selecting ? "primary" : "secondary"}
              onClick={() => {
                setSelecting(!selecting);
                setStart(null);
              }}
            >
              Seleccionar tramo
            </Button>
          )}
        </div>
      )}
      {selecting && (
        <p className="small cl-muted" role="status">
          {start === null
            ? "Haz clic en el inicio del tramo sobre la ruta."
            : "Haz clic en el final del tramo. Esc cancela."}
        </p>
      )}
      {unavailable && p.geographic.configured && (
        <p className="small cl-faint">
          Sin coordenadas suficientes para mostrar el mapa.
        </p>
      )}
      {(!p.geographic.configured || error) && (
        <div className="map-notice" role={error ? "alert" : "status"}>
          <span>{error || "Configura MapTiler para ver la cartografía."}</span>
          <Button size="sm" onClick={p.geographic.onSettings}>
            Ajustes de mapas
          </Button>
          {error && (
            <Button size="sm" onClick={() => setRetry((n) => n + 1)}>
              Reintentar mapa
            </Button>
          )}
        </div>
      )}
      {!unavailable && (
        <div
          className="geo-map-frame"
          data-ready={ready}
          hidden={!!error && !loaded}
          style={{ height: p.height ?? 300 }}
        >
          <div
            ref={container}
            className="geo-map-canvas"
            aria-label={p.ariaLabel ?? "Mapa del recorrido"}
          />
          <a
            className="maptiler-logo"
            href="https://www.maptiler.com"
            target="_blank"
            rel="noreferrer"
          >
            <img src={logo} alt="MapTiler" />
          </a>
        </div>
      )}
      {(unavailable || (error && !loaded)) && p.fallback}
      {!unavailable && (!error || !!loaded) && (
        <div className="small cl-faint map-readout">
          {row
            ? `${number(row.p)} W · ${number(row.v, 1)} km/h · ${number(row.elev)} m`
            : p.caption}
          {mode !== "route" && (
            <span>
              {" "}
              ·{" "}
              {mode === "power"
                ? "Potencia absoluta (W)"
                : mode === "speed"
                  ? "Velocidad (km/h)"
                  : "Pendiente entre muestras (%)"}{" "}
              · gris: sin dato
            </span>
          )}
        </div>
      )}
    </div>
  );
}
