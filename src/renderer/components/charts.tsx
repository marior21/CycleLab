import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts/core";
import { LineChart as ELine, BarChart as EBar } from "echarts/charts";
import {
  GridComponent,
  MarkAreaComponent,
  MarkLineComponent,
} from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import type { LineChartProps, BarChartProps, Series } from "./types";
import { Legend, tone } from "./ui";
import { number } from "../format";
echarts.use([
  ELine,
  EBar,
  GridComponent,
  MarkAreaComponent,
  MarkLineComponent,
  SVGRenderer,
]);
type Row = Record<string, number | string | null>;
export function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const obs = new ResizeObserver(() => setWidth(node.clientWidth));
    obs.observe(node);
    setWidth(node.clientWidth);
    return () => obs.disconnect();
  }, []);
  return { ref, width };
}
function color(t: string) {
  const key =
    (
      {
        muted: "ink-muted",
        faint: "ink-faint",
        neutral: "ink-faint",
      } as Record<string, string>
    )[t] ?? t;
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue("--" + key)
      .trim() || t
  );
}
function domain(rows: Row[], series: Series[], zero = true): [number, number] {
  const vals = rows.flatMap((r) =>
    series
      .map((s) => r[s.key])
      .filter((v): v is number => typeof v === "number"),
  );
  if (!vals.length) return [0, 1];
  let min = vals.reduce((a, b) => Math.min(a, b), Infinity),
    max = vals.reduce((a, b) => Math.max(a, b), -Infinity);
  if (zero && min > 0) min = 0;
  if (min === max) {
    min--;
    max++;
  }
  const ticks = niceTicks(min, max, 4),
    step = ticks.length > 1 ? ticks[1] - ticks[0] : 1;
  return [Math.floor(min / step) * step, Math.ceil(max / step) * step];
}
export function niceTicks(min: number, max: number, n: number) {
  const span = max - min;
  if (!(span > 0)) return [min];
  let step = 10 ** Math.floor(Math.log10(span / n));
  const err = span / n / step;
  step *= err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1;
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step)
    out.push(+v.toFixed(10));
  return out;
}
function useChart(
  ref: React.RefObject<HTMLDivElement>,
  option: echarts.EChartsCoreOption,
  width: number,
) {
  const chart = useRef<echarts.ECharts>();
  useEffect(() => {
    if (!ref.current || !width) return;
    chart.current = echarts.init(ref.current, null, { renderer: "svg" });
    return () => {
      chart.current?.dispose();
      chart.current = undefined;
    };
  }, [ref, !!width]);
  useEffect(() => {
    chart.current?.setOption(option, true);
    chart.current?.resize();
  }, [option, width]);
}
export function LineChart(p: LineChartProps) {
  const { ref, width } = useWidth(),
    plot = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null),
    [drag, setDrag] = useState<[number, number] | null>(null);
  const inside = useRef(false);
  const rows = p.data as Row[],
    x = p.x ?? "x",
    H = p.height ?? 220,
    right = p.series.some((s) => s.axis === "right");
  const m = {
    l: p.hideYAxis ? 8 : 40,
    r: right ? 40 : 10,
    t: 8,
    b: p.hideXAxis ? 6 : 22,
  };
  const xs = rows.map((r) => Number(r[x])),
    xd = p.xDomain ?? [
      xs.reduce((a, b) => Math.min(a, b), Infinity),
      xs.reduce((a, b) => Math.max(a, b), -Infinity),
    ];
  const yd =
      p.yDomain ??
      domain(
        rows,
        p.series.filter((s) => s.axis !== "right"),
        p.zeroBased !== false,
      ),
    yr =
      p.yDomainRight ??
      domain(
        rows,
        p.series.filter((s) => s.axis === "right"),
        p.zeroBased !== false,
      );
  const log = p.xType === "log",
    transform = (v: number) => (log ? Math.log(Math.max(v, 0.001)) : v);
  const X = (v: number) =>
    m.l +
    ((transform(v) - transform(xd[0])) /
      (transform(xd[1]) - transform(xd[0]) || 1)) *
      (width - m.l - m.r);
  const Y = (v: number, s: Series) =>
    H -
    m.b -
    ((v - (s.axis === "right" ? yr : yd)[0]) /
      ((s.axis === "right" ? yr : yd)[1] - (s.axis === "right" ? yr : yd)[0] ||
        1)) *
      (H - m.b - m.t);
  const theme = document.documentElement.dataset.theme;
  const option = useMemo(
    () => ({
      animation: false,
      grid: { left: m.l, right: m.r, top: m.t, bottom: m.b },
      xAxis: {
        type: log ? "log" : "value",
        min: xd[0],
        max: xd[1],
        show: false,
      },
      yAxis: [
        { type: "value", min: yd[0], max: yd[1], show: false },
        { type: "value", min: yr[0], max: yr[1], show: false },
      ],
      series: p.series.map((s) => ({
        type: "line",
        data: rows.map((r) => [r[x], r[s.key]]),
        yAxisIndex: s.axis === "right" ? 1 : 0,
        showSymbol: false,
        connectNulls: false,
        silent: true,
        lineStyle: {
          color: color(s.color),
          width: s.line === false ? 0 : (s.width ?? 1.5),
          type: s.dash ? [4, 3] : "solid",
        },
        areaStyle: s.area
          ? {
              color: color(s.color),
              opacity: s.areaOpacity ?? 0.14,
              origin: "start",
            }
          : undefined,
      })),
    }),
    [
      p.data,
      p.series,
      x,
      width,
      H,
      theme,
      log,
      JSON.stringify(xd),
      JSON.stringify(yd),
      JSON.stringify(yr),
    ],
  );
  useChart(plot, option, width);
  const hi = p.hoverIndex === undefined ? hover : p.hoverIndex,
    sel = drag ?? p.selection;
  function valueAt(client: number) {
    const px = Math.max(
      m.l,
      Math.min(
        width - m.r,
        client - (ref.current?.getBoundingClientRect().left ?? 0),
      ),
    );
    const v =
      transform(xd[0]) +
      ((px - m.l) / (width - m.l - m.r)) *
        (transform(xd[1]) - transform(xd[0]));
    return log ? Math.exp(v) : v;
  }
  function finish() {
    if (drag) {
      p.onSelect?.(
        Math.abs(X(drag[1]) - X(drag[0])) > 4
          ? [Math.min(...drag), Math.max(...drag)]
          : null,
      );
      setDrag(null);
    }
  }
  if (!rows.length)
    return (
      <div className="chart-empty" style={{ height: H }}>
        Sin muestras disponibles
      </div>
    );
  const xt =
      p.xTicks ?? niceTicks(xd[0], xd[1], Math.max(2, Math.floor(width / 90))),
    yt = niceTicks(yd[0], yd[1], p.yTicks ?? 4);
  return (
    <div className="cl-chart">
      {p.legend && <Legend series={p.series} />}
      <div
        ref={ref}
        className="chart-surface"
        style={{ height: H }}
        onPointerMove={(e) => {
          inside.current = true;
          const v = valueAt(e.clientX);
          let idx = 0;
          xs.forEach((q, i) => {
            if (Math.abs(q - v) < Math.abs(xs[idx] - v)) idx = i;
          });
          setHover(idx);
          p.onHover?.(idx, rows[idx]);
          if (drag) setDrag([drag[0], v]);
        }}
        onPointerLeave={() => {
          inside.current = false;
          setHover(null);
          p.onHover?.(null, null);
          if (!drag) finish();
        }}
        onPointerDown={(e) => {
          if (p.onSelect) {
            e.currentTarget.setPointerCapture(e.pointerId);
            const v = valueAt(e.clientX);
            setDrag([v, v]);
          }
        }}
        onPointerUp={finish}
        onPointerCancel={() => setDrag(null)}
      >
        <svg className="chart-underlay" width={width} height={H} aria-hidden>
          {(p.bands ?? []).map((b, i) => (
            <rect
              key={i}
              x={m.l}
              y={Y(Math.min(b.to, yd[1]), p.series[0])}
              width={Math.max(0, width - m.l - m.r)}
              height={Math.max(
                0,
                Y(Math.max(b.from, yd[0]), p.series[0]) -
                  Y(Math.min(b.to, yd[1]), p.series[0]),
              )}
              fill={tone(b.color)}
              opacity={b.opacity ?? 0.06}
            />
          ))}
          {yt.map((t) => (
            <line
              key={t}
              x1={m.l}
              x2={width - m.r}
              y1={Y(t, p.series[0])}
              y2={Y(t, p.series[0])}
              stroke="var(--line)"
            />
          ))}
        </svg>
        <div
          ref={plot}
          className="chart-engine"
          style={{ height: H }}
          role="img"
          aria-label={p.ariaLabel ?? "Gráfico"}
        />
        <svg
          className="chart-overlay cl-axis"
          width={width}
          height={H}
          aria-hidden
        >
          {!p.hideYAxis &&
            yt.map((t) => (
              <text
                key={t}
                x={m.l - 8}
                y={Y(t, p.series[0]) + 3}
                textAnchor="end"
              >
                {(p.yFormat ?? number)(t)}
              </text>
            ))}
          {right &&
            niceTicks(yr[0], yr[1], p.yTicks ?? 4).map((t) => (
              <text
                key={t}
                x={width - m.r + 8}
                y={Y(t, { key: "", color: "", axis: "right" }) + 3}
              >
                {(p.yFormatRight ?? number)(t)}
              </text>
            ))}
          {!p.hideXAxis &&
            xt
              .filter((t) => t >= xd[0] && t <= xd[1])
              .map((t) => (
                <text key={t} x={X(t)} y={H - 6} textAnchor="middle">
                  {(p.xFormat ?? number)(t)}
                </text>
              ))}
          {p.refLines?.map((r, i) => (
            <g key={i}>
              <line
                x1={m.l}
                x2={width - m.r}
                y1={Y(r.value, p.series[0])}
                y2={Y(r.value, p.series[0])}
                stroke={tone(r.color ?? "faint")}
                strokeDasharray="3 3"
              />
              <text
                x={width - m.r - 4}
                y={Y(r.value, p.series[0]) - 4}
                textAnchor="end"
              >
                {r.label}
              </text>
            </g>
          ))}
          {sel && (
            <>
              <rect
                x={X(Math.min(...sel))}
                y={m.t}
                width={Math.max(1, Math.abs(X(sel[1]) - X(sel[0])))}
                height={H - m.t - m.b}
                className="cl-sel"
              />
              {sel.map((s, i) => (
                <line
                  key={i}
                  x1={X(s)}
                  x2={X(s)}
                  y1={m.t}
                  y2={H - m.b}
                  className="cl-sel-edge"
                />
              ))}
            </>
          )}
          {hi != null && rows[hi] && (
            <>
              <line
                x1={X(Number(rows[hi][x]))}
                x2={X(Number(rows[hi][x]))}
                y1={m.t}
                y2={H - m.b}
                stroke="var(--ink-faint)"
              />
              {p.series
                .filter((s) => rows[hi][s.key] != null)
                .map((s) => (
                  <circle
                    key={s.key}
                    cx={X(Number(rows[hi][x]))}
                    cy={Y(Number(rows[hi][s.key]), s)}
                    r={3.5}
                    fill={tone(s.color)}
                    stroke="var(--bg-200)"
                  />
                ))}
            </>
          )}
        </svg>
        {inside.current && hi != null && rows[hi] && (
          <div
            className="cl-tip"
            style={{
              left: Math.max(
                0,
                Math.min(width - 180, X(Number(rows[hi][x])) + 12),
              ),
              top: m.t,
            }}
          >
            <div className="cl-tip-head">
              {p.tooltipTitle
                ? p.tooltipTitle(Number(rows[hi][x]), rows[hi])
                : (p.xFormat ?? number)(Number(rows[hi][x]))}
            </div>
            {p.series
              .filter((s) => !s.hideInTooltip)
              .map((s) => (
                <div className="cl-tip-row" key={s.key}>
                  <i
                    className="cl-swatch"
                    style={{ background: tone(s.color) }}
                  />
                  {s.label ?? s.key}
                  <b>
                    {rows[hi][s.key] == null
                      ? "–"
                      : (s.format ?? number)(Number(rows[hi][s.key]))}
                    {s.unit && ` ${s.unit}`}
                  </b>
                </div>
              ))}
            {p.tooltipExtra?.(rows[hi])}
          </div>
        )}
      </div>
    </div>
  );
}
export function BarChart(p: BarChartProps) {
  const { ref, width } = useWidth(),
    plot = useRef<HTMLDivElement>(null);
  const [hi, setHi] = useState<number | null>(null);
  const rows = p.data as Row[],
    H = p.height ?? 180,
    x = p.x ?? "x",
    series = p.line ? [...p.series, p.line] : p.series;
  const theme = document.documentElement.dataset.theme;
  const option = useMemo(
    () => ({
      animation: false,
      grid: {
        left: p.hideYAxis ? 8 : 40,
        right: p.line ? 40 : 8,
        top: 8,
        bottom: 22,
      },
      xAxis: {
        type: "category",
        data: rows.map((r) => (p.xFormat ? p.xFormat(r[x], r) : String(r[x]))),
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: {
          color: color("faint"),
          fontFamily: "JetBrains Mono",
          fontSize: 10,
        },
      },
      yAxis: [
        {
          type: "value",
          min: p.yDomain?.[0] ?? 0,
          max: p.yDomain?.[1],
          splitNumber: 3,
          axisLabel: {
            show: !p.hideYAxis,
            color: color("faint"),
            fontFamily: "JetBrains Mono",
            fontSize: 10,
            formatter: (v: number) => (p.yFormat ?? number)(v),
          },
          splitLine: { lineStyle: { color: color("line") } },
        },
        {
          type: "value",
          scale: !p.line?.zeroBased,
          axisLabel: {
            color: color("faint"),
            fontFamily: "JetBrains Mono",
            fontSize: 10,
          },
          splitLine: { show: false },
        },
      ],
      series: series.map((s, i) => ({
        type: i === p.series.length ? "line" : "bar",
        yAxisIndex: i === p.series.length ? 1 : 0,
        stack: i === p.series.length ? undefined : "total",
        barCategoryGap: "30%",
        showSymbol: false,
        lineStyle: { color: color(s.color), width: 2 },
        data: rows.map((r) => ({
          value: r[s.key],
          itemStyle: { color: color(String(r._color ?? s.color)) },
        })),
      })),
    }),
    [p.data, p.series, p.line, width, theme],
  );
  useChart(plot, option, width);
  return (
    <div className="cl-chart">
      {p.legend && <Legend series={series} />}
      <div
        ref={ref}
        className="chart-surface"
        style={{ height: H }}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const i = Math.floor(
            ((e.clientX - r.left - 40) / (width - 48)) * rows.length,
          );
          setHi(i >= 0 && i < rows.length ? i : null);
        }}
        onMouseLeave={() => setHi(null)}
        onClick={() => {
          if (hi !== null) p.onBarClick?.(rows[hi], hi);
        }}
      >
        <div
          ref={plot}
          style={{ height: H }}
          role="img"
          aria-label={p.ariaLabel ?? "Gráfico de barras"}
        />
        {hi !== null && rows[hi] && (
          <div
            className="cl-tip"
            style={{
              left: Math.min(
                width - 180,
                40 + (hi / rows.length) * (width - 48),
              ),
              top: 8,
            }}
          >
            <div className="cl-tip-head">
              {p.tooltipTitle
                ? p.tooltipTitle(rows[hi][x], rows[hi])
                : String(rows[hi][x])}
            </div>
            {series.map((s) => (
              <div key={s.key} className="cl-tip-row">
                <i
                  className="cl-swatch"
                  style={{ background: tone(s.color) }}
                />
                {s.label}
                <b>
                  {number(
                    typeof rows[hi][s.key] === "number"
                      ? Number(rows[hi][s.key])
                      : null,
                  )}{" "}
                  {s.unit}
                </b>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
