import { GeoRouteMap } from "./GeoRouteMap";
import { useMemo } from "react";
import type { RouteMapProps } from "./types";
import { useWidth } from "./charts";
export function RouteMap(p: RouteMapProps) {
  return p.geographic ? (
    <GeoRouteMap
      {...p}
      geographic={p.geographic}
      fallback={<SchematicRouteMap {...p} />}
    />
  ) : (
    <SchematicRouteMap {...p} />
  );
}
function SchematicRouteMap(p: RouteMapProps) {
  const { ref, width: W } = useWidth(),
    H = p.height ?? 220,
    pts = p.points,
    hl = p.highlight,
    zoom = p.zoomToHighlight && hl && hl[1] > hl[0];
  const geo = useMemo(() => {
    if (!W || !pts.length) return null;
    const sub = zoom ? pts.slice(hl![0], hl![1] + 1) : pts;
    const xs = sub.map((p) => p[0]),
      ys = sub.map((p) => p[1]);
    const minx = xs.reduce((a, b) => Math.min(a, b), Infinity),
      maxx = xs.reduce((a, b) => Math.max(a, b), -Infinity),
      miny = ys.reduce((a, b) => Math.min(a, b), Infinity),
      maxy = ys.reduce((a, b) => Math.max(a, b), -Infinity),
      s = Math.min(
        (W - 64) / (maxx - minx || 1),
        (H - 64) / (maxy - miny || 1),
      ),
      ox = (W - (maxx - minx) * s) / 2,
      oy = (H - (maxy - miny) * s) / 2;
    const P = (q: [number, number]) => [
      ox + (q[0] - minx) * s,
      H - (oy + (q[1] - miny) * s),
    ];
    const line = (list: [number, number][], closed = false) =>
      list
        .map(
          (q, i) =>
            (i ? "L" : "M") +
            P(q)
              .map((n) => n.toFixed(1))
              .join(","),
        )
        .join("") + (closed ? "Z" : "");
    return { P, line, s };
  }, [W, H, pts, zoom, hl]);
  return (
    <div ref={ref} className="cl-map" style={{ height: H }}>
      {geo && (
        <svg
          width={W}
          height={H}
          role="img"
          aria-label={p.ariaLabel ?? "Recorrido"}
        >
          {!p.features?.length &&
            Array.from({ length: Math.ceil(W / 32) }, (_, i) => (
              <path key={i} d={`M${i * 32},0V${H}`} stroke="var(--line)" />
            ))}
          {p.features
            ?.filter((f) => f.points)
            .map((f, i) => (
              <path
                key={i}
                d={geo.line(f.points!, f.closed)}
                className={`cl-map-${f.type}`}
              />
            ))}
          <path d={geo.line(pts)} className="cl-map-casing" />
          <path d={geo.line(pts)} className="cl-map-route" />
          {hl && (
            <path
              d={geo.line(pts.slice(hl[0], hl[1] + 1))}
              className="cl-map-hl"
            />
          )}
          {p.markers
            ?.filter((m) => pts[m.index])
            .map((m) => {
              const [x, y] = geo.P(pts[m.index]);
              return (
                <g key={m.index}>
                  <circle cx={x} cy={y} r={8} className="cl-map-marker" />
                  <text
                    x={x}
                    y={y + 3}
                    textAnchor="middle"
                    className="cl-map-marker-text"
                  >
                    {m.label}
                  </text>
                </g>
              );
            })}
          {p.features
            ?.filter((f) => f.at)
            .map((f, i) => {
              const [x, y] = geo.P(f.at!);
              const tw = (f.label?.length ?? 0) * 6,
                end = f.anchor === "end" ? x - 8 - tw > 4 : x + 8 + tw > W - 4;
              return (
                <g key={i}>
                  {f.type === "peak" ? (
                    <path
                      d={`M${x},${y - 5}l4.5,8h-9z`}
                      className="cl-map-peak"
                    />
                  ) : (
                    <circle
                      cx={x}
                      cy={y}
                      r={f.major ? 3 : 2}
                      className="cl-map-town"
                    />
                  )}
                  <text
                    x={
                      f.major
                        ? Math.max(4 + tw / 2, Math.min(W - 4 - tw / 2, x))
                        : end
                          ? x - 8
                          : x + 8
                    }
                    y={f.major ? y - 10 : y + 3.5}
                    textAnchor={f.major ? "middle" : end ? "end" : "start"}
                    className={`cl-map-label ${f.major ? "cl-map-label-major" : ""}`}
                  >
                    {f.label}
                  </text>
                </g>
              );
            })}
          {(hl ?? [0, pts.length - 1]).map((i, j) => (
            <circle
              key={j}
              cx={geo.P(pts[i])[0]}
              cy={geo.P(pts[i])[1]}
              r={5}
              className={j ? "cl-map-end" : "cl-map-start"}
            />
          ))}
          {p.cursor != null && pts[p.cursor] && (
            <circle
              cx={geo.P(pts[p.cursor])[0]}
              cy={geo.P(pts[p.cursor])[1]}
              r={6}
              className="cl-map-cursor"
            />
          )}
          {p.scale &&
            (() => {
              const meters =
                  [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000]
                    .filter((v) => v * geo.s <= 90)
                    .pop() ?? 50,
                px = meters * geo.s;
              return (
                <g className="cl-map-scale">
                  <path d={`M${W - 16 - px},${H - 18}v4h${px}v-4`} />
                  <text x={W - 16 - px / 2} y={H - 21} textAnchor="middle">
                    {meters >= 1000 ? meters / 1000 + " km" : meters + " m"}
                  </text>
                  <path
                    className="cl-map-north"
                    d={`M${W - 20},10l4,12-4,-3-4,3Z`}
                  />
                  <text x={W - 20} y={34} textAnchor="middle">
                    N
                  </text>
                </g>
              );
            })()}
        </svg>
      )}
      {!pts.length && <div className="cl-state">Sin coordenadas GPS</div>}
      {p.caption && <div className="cl-map-caption">{p.caption}</div>}
    </div>
  );
}
