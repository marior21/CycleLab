import { profileAt, profileNote } from "../../domain/athlete";
import { Coverage } from "./Coverage";
import { ActivityFeel } from "./ActivityFeel";
import {
  activitiesCsv,
  activityReport,
  comparisonReport,
  comparisonValues,
} from "../exports";
import { filterActivitiesByDate } from "../../domain/activityFilters";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Activity,
  ActivityDetail as Detail,
  ActivityType,
  Lap,
} from "../../shared/models";
import {
  nearest,
  stats,
  zones,
  compareStreams,
  percentChange,
  routeSelection,
} from "../../domain/analysis";
import { cardiacDrift } from "../../domain/drift";
import {
  Badge,
  Button,
  Chip,
  DataTable,
  Icon,
  Metric,
  Panel,
  Segmented,
  Skeleton,
  StateBlock,
  ZoneBar,
  tone,
} from "../components/ui";
import { LineChart } from "../components/charts";
import { RouteMap } from "../components/RouteMap";
import { clock, date, duration, number, shortDuration, TYPES } from "../format";
import { ratio, type PageProps } from "./shared";
const ranges = [
  { value: "30", label: "30 d" },
  { value: "90", label: "90 d" },
  { value: "all", label: "Todo" },
];
export function Activities(
  p: PageProps & { actId: string | null; setActId: (id: string) => void },
) {
  const period = p.origin?.period;
  const [range, setRange] = useState(period ? "custom" : p.demo ? "90" : "all"),
    [year, setYear] = useState(""),
    [from, setFrom] = useState(period?.[0] ?? ""),
    [to, setTo] = useState(period?.[1] ?? ""),
    [types, setTypes] = useState(Object.keys(TYPES) as ActivityType[]),
    [query, setQuery] = useState(""),
    [checked, setChecked] = useState<string[]>([]),
    [comparing, setComparing] = useState(false),
    [transfer, setTransfer] = useState<{
      busy?: boolean;
      text?: string;
      error?: boolean;
    } | null>(null);
  const run = async (task: () => Promise<string | null>) => {
    setTransfer({ busy: true });
    try {
      const text = await task();
      setTransfer(text ? { text } : null);
    } catch (e) {
      setTransfer({
        text: e instanceof Error ? e.message : "No se pudo completar.",
        error: true,
      });
    }
  };
  const all = p.data.activities;
  const years = [
    ...new Set(all.map((a) => new Date(a.date).getUTCFullYear())),
  ].sort((a, b) => b - a);
  const dated = useMemo(
    () =>
      filterActivitiesByDate(
        all,
        { period: range, year, from, to },
        p.data.today,
      ),
    [all, range, year, from, to, p.data.today],
  );
  const resetDates = (period = "all") => {
    setRange(period);
    setYear("");
    setFrom("");
    setTo("");
  };
  const list = dated.activities.filter(
    (a) =>
      types.includes(a.type) &&
      a.name.toLowerCase().includes(query.toLowerCase()),
  );
  const a = all.find((a) => a.id === p.actId) ?? all[0];
  const toggle = (id: string) =>
    setChecked((c) =>
      c.includes(id) ? c.filter((x) => x !== id) : [...c, id].slice(-2),
    );
  const select = (id: string) => {
    p.setActId(id);
    setComparing(false);
  };
  return (
    <>
      <div className="list-pane">
        <div className="filters">
          <div className="toolbar compact">
            <div className="search-field">
              <Icon name="search" />
              <input
                value={query}
                aria-label="Buscar actividad"
                placeholder="Buscar actividad"
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Segmented
              label="Fechas"
              value={range}
              onChange={resetDates}
              options={ranges}
            />
          </div>
          <div className="toolbar compact">
            <label className="activity-year">
              Año
              <select
                aria-label="Año de las actividades"
                value={year}
                onChange={(e) => {
                  resetDates();
                  setYear(e.target.value);
                }}
              >
                <option value="">Todos los años</option>
                {years.map((y) => (
                  <option value={String(y)} key={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            {(year || from || to) && (
              <Button size="sm" variant="ghost" onClick={() => resetDates()}>
                Limpiar fechas
              </Button>
            )}
          </div>
          <div className="activity-date-fields">
            <label>
              Desde
              <input
                aria-label="Fecha desde"
                type="date"
                value={from}
                max={to || undefined}
                aria-invalid={!!dated.error}
                aria-describedby={
                  dated.error ? "activity-date-error" : undefined
                }
                onChange={(e) => {
                  setFrom(e.target.value);
                  setYear("");
                  setRange("custom");
                }}
              />
            </label>
            <label>
              Hasta
              <input
                aria-label="Fecha hasta"
                type="date"
                value={to}
                min={from || undefined}
                aria-invalid={!!dated.error}
                aria-describedby={
                  dated.error ? "activity-date-error" : undefined
                }
                onChange={(e) => {
                  setTo(e.target.value);
                  setYear("");
                  setRange("custom");
                }}
              />
            </label>
          </div>
          {dated.error && (
            <div
              id="activity-date-error"
              className="small error-text"
              role="alert"
            >
              {dated.error}
            </div>
          )}
          <div className="chips">
            {Object.entries(TYPES)
              .filter(
                ([key]) =>
                  ["endurance", "intervals", "climb", "mtb"].includes(key) ||
                  all.some((a) => a.type === key),
              )
              .map(([key, t]) => (
                <Chip
                  key={key}
                  active={types.includes(key as ActivityType)}
                  color={t.tone}
                  count={dated.activities.filter((a) => a.type === key).length}
                  onClick={() =>
                    setTypes(
                      types.includes(key as ActivityType)
                        ? types.filter((t) => t !== key)
                        : [...types, key as ActivityType],
                    )
                  }
                >
                  {t.label}
                </Chip>
              ))}
          </div>
          <div className="toolbar compact">
            {!p.demo && (
              <Button
                size="sm"
                variant="ghost"
                icon="plus"
                disabled={p.syncing || !!transfer?.busy}
                onClick={() =>
                  void run(async () => {
                    const r = await window.cyclelab.importFit();
                    return r
                      ? `${r.imported.length} ${r.imported.length === 1 ? "actividad importada" : "actividades importadas"}` +
                          r.skipped
                            .map((s) => ` · ${s.file}: ${s.reason}`)
                            .join("")
                      : null;
                  })
                }
              >
                Importar FIT
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              disabled={!list.length || !!transfer?.busy}
              onClick={() =>
                void run(async () => {
                  const path = await window.cyclelab.saveExport(
                    "csv",
                    `CycleLab-actividades-${new Date().toISOString().slice(0, 10)}`,
                    activitiesCsv(list, p.demo),
                  );
                  return (
                    path &&
                    `${list.length} ${list.length === 1 ? "actividad exportada" : "actividades exportadas"} a ${path}`
                  );
                })
              }
            >
              Exportar CSV
            </Button>
          </div>
          {transfer?.text && (
            <p
              role={transfer.error ? "alert" : "status"}
              className={transfer.error ? "error-text" : "small cl-muted"}
            >
              {transfer.text}
            </p>
          )}
          <div className="toolbar compact">
            <span className="small cl-faint grow">
              {checked.length
                ? `${checked.length} de 2 seleccionadas para comparar`
                : `${list.length} actividades · marca dos para comparar`}
            </span>
            {checked.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setChecked([]);
                  setComparing(false);
                }}
              >
                Limpiar
              </Button>
            )}
            <Button
              size="sm"
              icon="compare"
              variant={checked.length === 2 ? "primary" : "secondary"}
              disabled={checked.length !== 2}
              onClick={() => setComparing(true)}
            >
              Comparar
            </Button>
          </div>
        </div>
        <Coverage p={p} activities={list} period="Filtros actuales" />
        <div className="activity-list" role="listbox" aria-label="Actividades">
          {list.map((x) => (
            <div
              className="act-item"
              key={x.id}
              role="option"
              aria-selected={a?.id === x.id && !comparing}
              tabIndex={0}
              onClick={() => select(x.id)}
              onKeyDown={(e) => {
                if (
                  e.target === e.currentTarget &&
                  (e.key === "Enter" || e.key === " ")
                ) {
                  e.preventDefault();
                  select(x.id);
                }
              }}
            >
              <input
                className="cl-check"
                type="checkbox"
                aria-label={"Comparar " + x.name}
                checked={checked.includes(x.id)}
                onClick={(e) => e.stopPropagation()}
                onChange={() => toggle(x.id)}
              />
              <div className="grow">
                <div className="toolbar compact">
                  <div className="act-name grow">{x.name}</div>
                  <span className="act-meta">{date(x.date, false, true)}</span>
                </div>
                <div className="activity-meta">
                  <Badge
                    title={x.classification?.reason}
                    tone={TYPES[x.type].tone}
                  >
                    {TYPES[x.type].label}
                  </Badge>
                  <span className="act-meta">
                    {duration(x.dur)} · {number(x.dist, 1)} km ·{" "}
                    {number(x.elev)} m · {number(x.np)} W NP
                  </span>
                </div>
              </div>
            </div>
          ))}
          {!list.length && (
            <StateBlock
              title="Sin actividades"
              detail="Ningún entrenamiento coincide con los filtros. Amplía el rango de fechas o activa más tipos."
              action={
                <Button
                  size="sm"
                  onClick={() => {
                    setTypes(Object.keys(TYPES) as ActivityType[]);
                    resetDates();
                    setQuery("");
                  }}
                >
                  Restablecer filtros
                </Button>
              }
            />
          )}
        </div>
      </div>
      <div className="detail">
        {comparing && checked.length === 2 ? (
          <Comparison
            {...p}
            a={all.find((a) => a.id === checked[0])!}
            b={all.find((a) => a.id === checked[1])!}
            onClose={() => setComparing(false)}
          />
        ) : a ? (
          <ActivityDetail key={`${p.demo}:${a.id}`} {...p} a={a} />
        ) : (
          <StateBlock
            title="Tu histórico está vacío"
            detail="Configura Garmin para importar tus actividades o usa «Importar FIT» con archivos locales."
            action={
              <Button onClick={() => p.go("settings")}>
                Configurar Garmin
              </Button>
            }
          />
        )}
      </div>
    </>
  );
}
function ReportButton({ name, html }: { name: string; html: () => string }) {
  const [error, setError] = useState("");
  return (
    <>
      <Button
        onClick={async () => {
          setError("");
          try {
            await window.cyclelab.saveExport("html", name, html());
          } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo exportar.");
          }
        }}
      >
        Exportar informe
      </Button>
      {error && (
        <span role="alert" className="error-text">
          {error}
        </span>
      )}
    </>
  );
}
function useDetail(
  id: string,
  demo: boolean,
  status?: Activity["detailStatus"],
) {
  const [detail, setDetail] = useState<Detail | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setDetail(null);
    setError("");
    Promise.all([
      window.cyclelab.getActivity(demo ? "demo" : "garmin", id),
      new Promise((r) => setTimeout(r, 320)),
    ])
      .then(([d]) => {
        if (active) setDetail(d);
      })
      .catch((e) => {
        if (active) setError(String(e.message));
      });
    return () => {
      active = false;
    };
  }, [id, demo, retry, status]);
  return { detail, error, retry: () => setRetry((n) => n + 1) };
}
export function DetailSkeleton() {
  return (
    <div className="page" aria-busy="true">
      <Skeleton height={22} width="45%" />
      <Skeleton height={14} width="30%" />
      <Skeleton height={180} />
      <Skeleton height={350} />
      <Skeleton height={300} />
    </div>
  );
}
function ActivityDetail(p: PageProps & { a: Activity }) {
  useEffect(() => {
    p.onContext({ screen: "activities", activityId: p.a.id });
  }, [p.onContext, p.a.id]);
  const { detail, error, retry } = useDetail(p.a.id, p.demo, p.a.detailStatus);
  return error ? (
    <StateBlock
      kind="error"
      title="No se pudo abrir la actividad"
      detail={error}
      action={<Button onClick={retry}>Reintentar</Button>}
    />
  ) : !detail ? (
    <DetailSkeleton />
  ) : (
    <Analysis {...p} detail={detail} />
  );
}
function Analysis(p: PageProps & { a: Activity; detail: Detail }) {
  const { a, detail: d, data } = p;
  const [hover, setHover] = useState<number | null>(null),
    [range, setRange] = useState<[number, number] | null>(
      p.origin?.id === a.id &&
        p.origin.range &&
        d.rows[p.origin.range[0]] &&
        d.rows[p.origin.range[1]]
        ? p.origin.range
        : null,
    ),
    [checkedLaps, setCheckedLaps] = useState<string[]>([]),
    [lapId, setLap] = useState<string | null>(null),
    [zone, setZone] = useState("power"),
    [axis, setAxis] = useState("time"),
    [zoom, setZoom] = useState(false);
  const rows = d.rows,
    x = axis === "km" ? "km" : "x";
  const laps = d.laps.filter((l) => l.kind !== "rec");
  const selectedLaps = useMemo(
    () => d.laps.filter((l) => checkedLaps.includes(l.id)),
    [d.laps, checkedLaps],
  );
  useEffect(() => {
    p.onContext({
      screen: "activities",
      activityId: a.id,
      ranges: selectedLaps.length
        ? selectedLaps.map((l) => [l.i0, l.i1])
        : range
          ? [range]
          : undefined,
    });
  }, [p.onContext, a.id, range, selectedLaps]);
  const selectLap = (l: Lap | null) => {
    setCheckedLaps([]);
    setLap(l?.id ?? null);
    setRange(l ? [l.i0, l.i1] : null);
  };
  const latest = useRef({ laps, lapId, selectLap });
  latest.current = { laps, lapId, selectLap };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(".geo-map")) return;
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        target.matches(
          "input:not([type=checkbox]),textarea,select,[contenteditable=true]",
        )
      )
        return;
      const s = latest.current;
      if (e.key === "Escape") {
        s.selectLap(null);
        return;
      }
      if (!s.laps.length) return;
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const i = s.laps.findIndex((l) => l.id === s.lapId);
        s.selectLap(
          s.laps[
            e.key === "ArrowRight"
              ? i < 0
                ? 0
                : Math.min(s.laps.length - 1, i + 1)
              : i < 0
                ? s.laps.length - 1
                : Math.max(0, i - 1)
          ],
        );
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const selected = range ? stats(rows, ...range) : null;
  const drift = useMemo(
    () => (range ? cardiacDrift(rows, ...range) : null),
    [rows, range],
  );
  const distAvailable = rows.length > 0 && rows.every((r) => r.km !== null);
  const common = {
    data: rows,
    x,
    hoverIndex: hover,
    onHover: (i: number | null) => setHover(i),
    selection: range
      ? ([Number(rows[range[0]][x]), Number(rows[range[1]][x])] as [
          number,
          number,
        ])
      : null,
    onSelect: (r: [number, number] | null) => {
      setCheckedLaps([]);
      setLap(null);
      setRange(r ? [nearest(rows, x, r[0]), nearest(rows, x, r[1])] : null);
    },
    xFormat: axis === "km" ? (v: number) => number(v) + " km" : clock,
    tooltipTitle: (_v: number, r: (typeof rows)[number]) =>
      duration(r.x) + " · " + number(r.km, 1) + " km",
  };
  const historical = useMemo(
    () => profileAt(data.athlete, a.date),
    [data.athlete, a.date],
  );
  const zoneRows = useMemo(
    () =>
      zones(
        rows,
        zone === "power" ? "p" : "hr",
        zone === "power" ? historical.ftp : historical.lthr,
      ),
    [rows, zone, historical],
  );
  const ftp = historical.ftp;
  const charts = [
    {
      name: "Potencia (30 s)",
      key: "ps",
      color: "power",
      unit: "W",
      height: 150,
    },
    {
      name: "Frecuencia cardíaca",
      key: "hr",
      color: "heart",
      unit: "ppm",
      height: 96,
    },
    { name: "Cadencia", key: "cad", color: "cadence", unit: "rpm", height: 72 },
    {
      name: "Elevación",
      key: "elev",
      color: "elevation",
      unit: "m",
      height: 96,
    },
  ] as const;
  return (
    <div className="page">
      <div className="toolbar">
        <div className="min-zero">
          <div className="toolbar">
            <div className="detail-heading">{a.name}</div>
            <Badge title={a.classification?.reason} tone={TYPES[a.type].tone}>
              {TYPES[a.type].label}
            </Badge>
          </div>
          <div className="small cl-faint">
            {date(a.date, true)} ·{" "}
            {new Date(a.date).toISOString().slice(11, 16)} ·{" "}
            {a.provenance
              ? `Importada de ${a.provenance.file} · ${a.device}`
              : `Garmin ${a.device}`}
            {p.demo ? " · potenciómetro + banda pectoral" : ""}
          </div>
        </div>
        <div className="push" />
        <Button
          icon="route"
          disabled={rows.length < 2}
          onClick={() =>
            p.createSegment(
              a,
              d,
              range && range[1] > range[0] ? range : [0, rows.length - 1],
            )
          }
        >
          Crear segmento
        </Button>
        <Button
          icon="coach"
          onClick={() =>
            p.ask(
              range || selectedLaps.length
                ? "Analiza exclusivamente los tramos de la selección actual"
                : a.type === "intervals"
                  ? "Analiza los intervalos de esta sesión"
                  : "Resume esta actividad",
            )
          }
        >
          {range || selectedLaps.length
            ? "Analizar este tramo"
            : "Preguntar a la IA"}
        </Button>
        <ReportButton
          name={`CycleLab-${new Date(a.date).toISOString().slice(0, 10)}-${a.name}`}
          html={() => activityReport(a, d, data.athlete, p.demo)}
        />
      </div>
      <p className="small cl-muted">
        {profileNote(data.athlete, a.date)}. Zonas y W/kg: cálculo local.{" "}
        {p.demo
          ? "IF/TSS de demostración."
          : a.provenance
            ? "IF/TSS del archivo FIT, solo si el dispositivo los calculó; umbral de origen no verificado."
            : "IF/TSS importados de Garmin; umbral de origen no verificado."}
      </p>
      {(a.classification || a.automaticType) && (
        <div className="small cl-faint">
          {a.automaticType
            ? `Etiqueta manual · automática: ${TYPES[a.automaticType].label}`
            : a.classification?.estimated
              ? "Clasificación estimada"
              : "Clasificación automática"}
          {a.classification && ` · ${a.classification.reason}`}
        </div>
      )}
      <div className="strip tight-metrics">
        <Metric size="s" label="Duración" value={duration(a.dur)} />
        <Metric
          size="s"
          label="Distancia"
          value={number(a.dist, 1)}
          unit="km"
        />
        <Metric size="s" label="Desnivel" value={number(a.elev)} unit="m" />
        <Metric
          size="s"
          label="Pot. normalizada"
          accent="power"
          value={number(a.np)}
          unit="W"
          sub={ratio(a.np, historical.weight) + " W/kg"}
        />
        <Metric
          size="s"
          label="IF · TSS"
          value={number(a.IF, 2) + " · " + number(a.tss)}
        />
        <Metric
          size="s"
          label="FC media"
          accent="heart"
          value={number(a.hr)}
          unit="ppm"
          sub={
            a.hr && historical.lthr
              ? number((a.hr / historical.lthr) * 100) + "% LTHR"
              : undefined
          }
        />
        <Metric
          size="s"
          label="Cadencia"
          accent="cadence"
          value={number(a.cad)}
          unit="rpm"
        />
        <Metric size="s" label="Trabajo" value={number(a.kj)} unit="kJ" />
      </div>
      <ActivityFeel key={a.id} a={a} source={p.demo ? "demo" : "garmin"} />
      <div className="row">
        <Panel
          className="grow"
          title="Recorrido"
          subtitle={
            p.demo
              ? "Mapa simulado · relieve, costa y poblaciones ilustrativos"
              : "Recorrido GPS · cartografía MapTiler"
          }
          actions={
            <Button
              size="sm"
              variant={zoom && range ? "secondary" : "ghost"}
              icon="target"
              disabled={!range || !d.points.length}
              aria-pressed={zoom && !!range}
              onClick={() => setZoom(!zoom)}
            >
              {zoom && range ? "Ver ruta completa" : "Ajustar al tramo"}
            </Button>
          }
        >
          <RouteMap
            geographic={
              p.demo
                ? undefined
                : {
                    rows: d.rows,
                    configured: p.maptilerConfigured,
                    theme: p.theme,
                    onSettings: () => p.go("settings"),
                    onHover: (i) =>
                      setHover(i === null ? null : (d.pointIndices?.[i] ?? i)),
                    onSelect: (r) => {
                      setCheckedLaps([]);
                      setLap(null);
                      setRange([
                        d.pointIndices?.[r[0]] ?? r[0],
                        d.pointIndices?.[r[1]] ?? r[1],
                      ]);
                    },
                  }
            }
            points={d.points}
            features={d.features}
            markers={d.markers}
            scale
            height={300}
            highlight={routeSelection(d.pointIndices, range)}
            zoomToHighlight={zoom}
            cursor={
              d.pointIndices && hover !== null
                ? d.pointIndices.indexOf(hover)
                : hover
            }
            caption={`${number(a.dist, 1)} km · ${number(a.elev)} m+${p.demo ? " · km cada 10" : ""}`}
          />
        </Panel>
      </div>
      <Panel
        title="Análisis"
        subtitle="Arrastra para seleccionar un tramo · ← → recorre los intervalos · Esc limpia"
        actions={
          <>
            {range && (
              <Button
                size="sm"
                variant="ghost"
                icon="close"
                onClick={() => selectLap(null)}
              >
                Limpiar
              </Button>
            )}
            <Segmented
              label="Eje X"
              value={axis}
              onChange={(v) => {
                if (v === "time" || distAvailable) setAxis(v);
              }}
              options={[
                { value: "time", label: "Tiempo" },
                ...(distAvailable ? [{ value: "km", label: "Distancia" }] : []),
              ]}
            />
          </>
        }
      >
        {selected && (
          <div className="sel-bar" aria-live="polite">
            <span className="label" style={{ color: tone("brand-ink") }}>
              {laps.find((l) => l.id === lapId)?.label ?? "Selección"}
            </span>
            <Metric size="s" label="Duración" value={duration(selected.dur)} />
            <Metric
              size="s"
              label="Pot. media"
              accent="power"
              value={number(selected.avgP)}
              unit="W"
            />
            <Metric size="s" label="NP" value={number(selected.np)} unit="W" />
            <Metric
              size="s"
              label="FC media"
              accent="heart"
              value={number(selected.hr)}
              unit="ppm"
            />
            <Metric
              size="s"
              label="Cadencia"
              value={number(selected.cad)}
              unit="rpm"
            />
            <Metric
              size="s"
              label="Distancia"
              value={number(selected.dist, 1)}
              unit="km"
            />
            <Metric
              size="s"
              label="Deriva Pa:FC"
              accent="heart"
              value={drift?.ok ? number(drift.drift, 1) : "–"}
              unit={drift?.ok ? "%" : undefined}
              sub={drift?.ok ? undefined : "Insuficiente"}
            />
          </div>
        )}
        {drift && (
          <p className="small cl-faint drift-note">
            {drift.ok
              ? `Deriva Pa:FC: eficiencia de ${number(drift.first, 2)} W/ppm en la primera mitad y ${number(drift.second, 2)} W/ppm en la segunda (VI ${number(drift.vi, 2)}). Positiva: la FC sube para la misma potencia; por debajo del 5 % se suele considerar acoplada. Calor, hidratación o descanso no se registran.`
              : `Deriva Pa:FC no calculada. ${drift.reason}`}
          </p>
        )}
        {rows.length ? (
          <div className="stack-charts">
            {charts.map((c, i) => (
              <div key={c.key}>
                <div className="chart-label">
                  <i
                    className="cl-swatch"
                    style={{ background: tone(c.color) }}
                  />
                  {c.name}
                  {hover !== null && rows[hover] && (
                    <b>
                      {number(rows[hover][c.key])} {c.unit}
                    </b>
                  )}
                  {i === 0 && (
                    <span className="cl-faint">· bandas de zona Z1–Z6</span>
                  )}
                </div>
                <LineChart
                  {...common}
                  height={c.height}
                  zeroBased={c.key !== "hr"}
                  hideXAxis={i < 3}
                  yTicks={i > 1 ? 2 : 4}
                  bands={
                    i === 0 && ftp
                      ? [0, 0.55, 0.75, 0.9, 1.05, 1.2].map((from, j) => ({
                          from: from * ftp,
                          to: [0.55, 0.75, 0.9, 1.05, 1.2, 1.5][j] * ftp,
                          color: `z${j + 1}`,
                        }))
                      : []
                  }
                  refLines={
                    c.key === "hr" && historical.lthr
                      ? [
                          {
                            value: historical.lthr,
                            label: "LTHR " + historical.lthr,
                          },
                        ]
                      : []
                  }
                  series={[
                    {
                      key: c.key,
                      label: c.name,
                      color: c.color,
                      unit: c.unit,
                      width: i === 0 ? 1.25 : i === 2 ? 1 : 1.5,
                      area: i === 3,
                      areaOpacity: 0.28,
                    },
                  ]}
                />
              </div>
            ))}
          </div>
        ) : (
          <StateBlock
            title="Sin muestras disponibles"
            detail={
              a.detailStatus === "error"
                ? "No se pudieron descargar las muestras. Reintenta la sincronización."
                : "Esta actividad todavía no tiene un archivo FIT disponible."
            }
          />
        )}
      </Panel>
      <Panel
        flush
        title="Intervalos"
        subtitle="Vueltas y tramos · clic o ↑ ↓ en la tabla, ← → desde cualquier punto, Esc limpia"
        actions={
          <div className="toolbar compact">
            {selectedLaps.length > 0 && (
              <>
                <span className="small">
                  {selectedLaps.length} intervalos seleccionados
                </span>
                <Button
                  size="sm"
                  onClick={() =>
                    p.ask("Analiza exclusivamente los intervalos seleccionados")
                  }
                >
                  Analizar este tramo
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => selectLap(null)}
                >
                  Limpiar selección
                </Button>
              </>
            )}
            <span className="small cl-faint">← → Esc</span>
          </div>
        }
      >
        <DataTable
          compact
          rows={laps}
          checked={checkedLaps}
          checkLabel="Seleccionar intervalo para analizar"
          onCheck={(id) => {
            setLap(null);
            setRange(null);
            setCheckedLaps((current) =>
              current.includes(String(id))
                ? current.filter((v) => v !== id)
                : [...current, String(id)],
            );
          }}
          selected={lapId}
          selectOnFocus
          onEscape={() => selectLap(null)}
          onSelect={(_id, l) => selectLap(l.id === lapId ? null : l)}
          columns={[
            { key: "label", label: "Tramo" },
            {
              key: "km",
              label: "Km",
              align: "right",
              render: (l) =>
                number(rows[l.i0]?.km, 1) + "–" + number(rows[l.i1]?.km, 1),
            },
            {
              key: "dur",
              label: "Duración",
              align: "right",
              render: (l) => duration(l.dur),
            },
            {
              key: "avgP",
              label: "Pot. media",
              align: "right",
              render: (l) => number(l.avgP) + " W",
            },
            {
              key: "wkg",
              label: "W/kg",
              align: "right",
              render: (l) => ratio(l.avgP, historical.weight),
            },
            {
              key: "hr",
              label: "FC",
              align: "right",
              render: (l) => number(l.hr) + " ppm",
            },
            {
              key: "cad",
              label: "Cad.",
              align: "right",
              render: (l) => number(l.cad) + " rpm",
            },
            {
              key: "zone",
              label: "Zona",
              render: (l) => {
                if (!ftp || l.avgP === null) return "–";
                const z =
                  [0.55, 0.75, 0.9, 1.05, 1.2, 1.5, Infinity].findIndex(
                    (b) => l.avgP! / ftp < b,
                  ) + 1;
                return <Badge tone={"z" + z}>Z{z}</Badge>;
              },
            },
          ]}
          empty={<StateBlock title="Sin intervalos registrados" />}
        />
      </Panel>
      <div className="row">
        <Panel
          className="grow"
          flush
          title="Mejores esfuerzos"
          subtitle="vs. mejor marca de la temporada · clic para resaltar"
        >
          <DataTable
            compact
            rows={d.best.filter((b) =>
              [60, 300, 600, 1200, 3600].includes(b.t),
            )}
            rowKey="l"
            onSelect={(_id, b) => {
              if (b.p !== null && b.i0 !== undefined && b.i1 !== undefined) {
                setCheckedLaps([]);
                setLap(null);
                setRange([b.i0, b.i1]);
              }
            }}
            columns={[
              { key: "l", label: "Duración" },
              {
                key: "p",
                label: "Potencia",
                align: "right",
                render: (b) => number(b.p) + " W",
              },
              {
                key: "w",
                label: "W/kg",
                align: "right",
                render: (b) => ratio(b.p, historical.weight),
              },
              {
                key: "season",
                label: "% mejor",
                align: "right",
                render: (b) =>
                  b.p !== null && b.season
                    ? number((b.p / b.season) * 100) + "%"
                    : "–",
              },
            ]}
          />
        </Panel>
        <Panel
          className="grow"
          title="Tiempo en zonas"
          subtitle={
            zone === "power"
              ? `Potencia · FTP ${number(ftp)} W`
              : `Frecuencia cardíaca · LTHR ${number(historical.lthr)} ppm`
          }
          actions={
            <Segmented
              label="Métrica de zonas"
              value={zone}
              onChange={setZone}
              options={[
                { value: "power", label: "Potencia" },
                { value: "hr", label: "FC" },
              ]}
            />
          }
        >
          {!rows.some((r) => (zone === "power" ? r.p : r.hr) !== null) ? (
            <StateBlock
              title="Sin muestras para calcular zonas"
              detail="El tiempo en zonas es desconocido para este canal."
            />
          ) : (zone === "power" ? ftp : historical.lthr) ? (
            <ZoneBar zones={zoneRows} format={shortDuration} />
          ) : (
            <StateBlock
              title="Falta el umbral histórico"
              detail="Añade un valor con fecha de vigencia anterior o igual a la actividad."
              action={
                <Button onClick={() => p.go("settings")}>
                  Completar perfil
                </Button>
              }
            />
          )}
        </Panel>
      </div>
    </div>
  );
}
function Comparison(
  p: PageProps & { a: Activity; b: Activity; onClose: () => void },
) {
  useEffect(() => {
    p.onContext({ screen: "activities", comparison: [p.a.id, p.b.id] });
  }, [p.onContext, p.a.id, p.b.id]);
  const a = useDetail(p.a.id, p.demo, p.a.detailStatus),
    b = useDetail(p.b.id, p.demo, p.b.detailStatus);
  if (a.error || b.error)
    return (
      <StateBlock
        kind="error"
        title="No se pudo comparar"
        detail={a.error || b.error}
        action={
          <Button
            onClick={() => {
              a.retry();
              b.retry();
            }}
          >
            Reintentar
          </Button>
        }
      />
    );
  if (!a.detail || !b.detail) return <DetailSkeleton />;
  const rows = compareStreams(a.detail.rows, b.detail.rows);
  const values = comparisonValues(p.a, p.b, a.detail, b.detail);
  const metrics = values.map(([k, a, b, unit, digits], i) => ({
    id: k,
    k,
    a:
      unit === "time"
        ? duration(a)
        : number(a, digits) + (unit ? " " + unit : ""),
    b:
      unit === "time"
        ? duration(b)
        : number(b, digits) + (unit ? " " + unit : ""),
    d: i < 3 ? null : percentChange(a, b),
  }));
  return (
    <div className="page">
      <div className="toolbar">
        <div>
          <div className="label">Comparación</div>
          <div className="detail-heading">
            {p.a.name} vs {p.b.name}
          </div>
        </div>
        <Button
          icon="coach"
          onClick={() =>
            p.ask(
              "Explica esta comparación entre las dos actividades seleccionadas",
            )
          }
        >
          Explicar esta comparación
        </Button>
        <ReportButton
          name={`CycleLab-comparacion-${new Date(p.a.date).toISOString().slice(0, 10)}-${new Date(p.b.date).toISOString().slice(0, 10)}`}
          html={() =>
            comparisonReport(
              p.a,
              p.b,
              a.detail!,
              b.detail!,
              p.data.athlete,
              p.demo,
            )
          }
        />
        <Button className="push" icon="close" onClick={p.onClose}>
          Cerrar comparación
        </Button>
      </div>
      <p className="small cl-muted">
        A · {profileNote(p.data.athlete, p.a.date)}
        <br />B · {profileNote(p.data.athlete, p.b.date)}
        <br />
        IF/TSS conservados del origen; no recalculados con el perfil actual.
      </p>
      <Panel
        title="Potencia superpuesta"
        subtitle="Alineadas desde el inicio · media 30 s"
      >
        <LineChart
          data={rows}
          height={220}
          legend
          xFormat={clock}
          series={[
            {
              key: "pa",
              label: "A · " + date(p.a.date),
              color: "brand-ink",
              unit: "W",
            },
            {
              key: "pb",
              label: "B · " + date(p.b.date),
              color: "muted",
              unit: "W",
              dash: true,
            },
          ]}
        />
      </Panel>
      <Panel title="Frecuencia cardíaca superpuesta">
        <LineChart
          data={rows}
          height={150}
          legend
          zeroBased={false}
          xFormat={clock}
          series={[
            { key: "ha", label: "A", color: "heart", unit: "ppm" },
            { key: "hb", label: "B", color: "muted", unit: "ppm", dash: true },
          ]}
        />
      </Panel>
      <Panel flush title="Diferencias" subtitle="B respecto a A">
        <DataTable
          compact
          rows={metrics}
          columns={[
            { key: "k", label: "Métrica" },
            { key: "a", label: "A · " + date(p.a.date), align: "right" },
            { key: "b", label: "B · " + date(p.b.date), align: "right" },
            {
              key: "d",
              label: "Δ",
              align: "right",
              render: (r) =>
                r.d === null ? (
                  "–"
                ) : (
                  <span
                    className={
                      r.d > 0 ? "delta-good" : r.d < 0 ? "delta-bad" : ""
                    }
                  >
                    {r.d > 0 ? "+" : ""}
                    {number(r.d, 1)} %
                  </span>
                ),
            },
          ]}
        />
      </Panel>
    </div>
  );
}
