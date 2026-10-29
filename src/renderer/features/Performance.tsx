import { Coverage } from "./Coverage";
import { useEffect, useState } from "react";
import {
  Button,
  Chip,
  DataTable,
  Metric,
  Panel,
  Segmented,
  Skeleton,
  StateBlock,
  ZoneBar,
} from "../components/ui";
import { LineChart } from "../components/charts";
import { date, effort, number, shortDuration } from "../format";
import { ratio, type PageProps } from "./shared";
import { DAY, DURATIONS } from "../../domain/analysis";
import { profileAt } from "../../domain/athlete";
import { criticalPower, periodBests } from "../../domain/powerCurve";
import type { ChartRow, PeriodZones } from "../../shared/models";
const ticks = [1, 5, 15, 60, 300, 1200, 3600, 14400];
interface Record {
  p: number;
  weight: number | null;
  activityId?: string;
  date?: number;
  i0?: number;
  i1?: number;
}
export function Performance(p: PageProps) {
  const keys = [
    ...new Set([
      ...p.data.activities.map((a) => "s" + new Date(a.date).getUTCFullYear()),
      ...p.data.curve.flatMap((r) =>
        Object.keys(r).filter((k) => k.startsWith("s")),
      ),
    ]),
  ]
    .sort()
    .reverse();
  const [seasons, setSeasons] = useState<string[]>(keys.slice(0, 2)),
    [unit, setUnit] = useState("w"),
    [dur, setDur] = useState("p1200"),
    [mode, setMode] = useState("seasons"),
    [reference, setReference] = useState("prev");
  const weight = p.data.athlete.weight;
  const rolling = mode !== "seasons",
    days = Number(mode),
    end = Math.floor(p.data.today / DAY) * DAY + DAY;
  const ranges: [number, number][] = rolling
    ? [
        [end - days * DAY, end],
        reference === "prev"
          ? [end - 2 * days * DAY, end - days * DAY]
          : [end - (365 + days) * DAY, end - 365 * DAY],
      ]
    : keys.slice(0, 2).map((k) => {
        const y = Number(k.slice(1));
        return [Date.UTC(y, 0, 1), Math.min(Date.UTC(y + 1, 0, 1), end)];
      });
  const labels = rolling
    ? [
        `Últimos ${days} días`,
        reference === "prev"
          ? `${days} días anteriores`
          : "Mismos días hace un año",
      ]
    : keys.slice(0, 2).map((k) => k.slice(1));
  const bests = ranges.map(([from, to]) => periodBests(p.data, from, to));
  // Records come from each activity's efforts so they open where they happened;
  // demo seasons use a synthetic curve and stay untraceable.
  const record = (t: number, i: number): Record | null => {
    const best = bests[i]?.get(t);
    if (rolling)
      return best
        ? { ...best, weight: profileAt(p.data.athlete, best.date).weight }
        : null;
    const row = p.data.curve.find((r) => r.x === t),
      value = keys[i] ? row?.[keys[i]] : undefined;
    if (typeof value !== "number") return null;
    return {
      p: value,
      weight: (row?.["w" + keys[i].slice(1)] as number | null) ?? null,
      ...(best?.p === value ? best : {}),
    };
  };
  const source: ChartRow[] = rolling
    ? DURATIONS.map((t) => {
        const a = record(t, 0),
          b = record(t, 1);
        return {
          x: t,
          snow: a?.p ?? null,
          wnow: a?.weight ?? null,
          dnow: a?.date ?? null,
          sbase: b?.p ?? null,
          wbase: b?.weight ?? null,
          dbase: b?.date ?? null,
        };
      }).filter((r) => r.snow !== null || r.sbase !== null)
    : p.data.curve;
  const curve = source.map((r) =>
    Object.fromEntries(
      Object.entries(r).map(([k, v]) => [
        k,
        !/^s(\d{4}|now|base)$/.test(k) || unit === "w"
          ? v
          : typeof r["w" + k.slice(1)] === "number" && typeof v === "number"
            ? v / Number(r["w" + k.slice(1)])
            : null,
      ]),
    ),
  );
  const format = (v: number) => number(v, unit === "w" ? 0 : 2);
  const series = rolling
    ? [
        {
          key: "snow",
          label: labels[0],
          color: "brand-ink",
          width: 2,
          unit: unit === "w" ? "W" : "W/kg",
          format,
        },
        {
          key: "sbase",
          label: labels[1],
          color: "muted",
          dash: true,
          width: 1.5,
          unit: unit === "w" ? "W" : "W/kg",
          format,
        },
      ]
    : keys
        .filter((k) => seasons.includes(k))
        .map((key) => ({
          key,
          label: key === keys[0] ? "Temporada " + key.slice(1) : key.slice(1),
          color: key === keys[0] ? "brand-ink" : "muted",
          dash: key !== keys[0],
          width: key === keys[0] ? 2 : 1.5,
          unit: unit === "w" ? "W" : "W/kg",
          format: (v: number) => number(v, unit === "w" ? 0 : 2),
        }));
  const at = (t: number, i = 0) => record(t, i)?.p ?? null;
  const table = [5, 60, 300, 600, 1200, 3600, 14400].map((t) => ({
    id: t,
    l: effort(t),
    a: record(t, 0),
    b: record(t, 1),
  }));
  const fits = [0, 1].map((i) => criticalPower((t) => at(t, i)));
  const [cp, cpBase] = fits;
  const link = (r: Record | null, what: string) =>
    r?.activityId ? (
      <Button
        size="sm"
        variant="ghost"
        aria-label={`Abrir la actividad de la marca de ${what}`}
        title={r.date ? date(r.date, true) : undefined}
        onClick={() =>
          p.openActivity(
            r.activityId!,
            r.i0 !== undefined && r.i1 !== undefined ? [r.i0, r.i1] : undefined,
          )
        }
      >
        {number(r.p)} W
      </Button>
    ) : (
      number(r?.p ?? null) + " W"
    );
  const [zoneData, setZoneData] = useState<PeriodZones | null>(null),
    [zoneError, setZoneError] = useState("");
  const [z0, z1] = ranges[0] ?? [0, 0],
    profileKey = JSON.stringify(p.data.athlete);
  useEffect(() => {
    let live = true;
    setZoneData(null);
    setZoneError("");
    if (z1 > z0)
      window.cyclelab.periodZones(p.demo ? "demo" : "garmin", z0, z1).then(
        (r) => live && setZoneData(r),
        (e: Error) => live && setZoneError(e.message),
      );
    return () => {
      live = false;
    };
  }, [z0, z1, p.demo, p.syncing, profileKey, p.data.activities.length]);
  const tone = dur === "p300" ? "z5" : dur === "p1200" ? "power" : "z2";
  return (
    <div className="page">
      <div className="toolbar">
        <Segmented
          label="Periodo"
          value={mode}
          onChange={setMode}
          options={[
            { value: "seasons", label: "Temporadas" },
            { value: "42", label: "42 días" },
            { value: "90", label: "90 días" },
          ]}
        />
        {rolling && (
          <Segmented
            label="Referencia"
            value={reference}
            onChange={setReference}
            options={[
              { value: "prev", label: "Periodo anterior" },
              { value: "year", label: "Hace un año" },
            ]}
          />
        )}
        {!rolling &&
          keys.map((key, i) => (
            <Chip
              key={key}
              color={i ? "muted" : "brand"}
              active={seasons.includes(key)}
              onClick={() =>
                setSeasons((s) =>
                  s.includes(key) ? s.filter((k) => k !== key) : [...s, key],
                )
              }
            >
              {i ? key.slice(1) : "Temporada " + key.slice(1)}
            </Chip>
          ))}
        <div className="push" />
        <Segmented
          label="Unidades"
          value={unit}
          onChange={setUnit}
          options={[
            { value: "w", label: "Vatios" },
            { value: "wkg", label: "W/kg" },
          ]}
        />
        <Button
          icon="coach"
          onClick={() =>
            p.ask(
              rolling
                ? `Analiza mi curva de potencia de los últimos ${days} días frente a ${reference === "prev" ? "los " + days + " días anteriores" : "los mismos días de hace un año"}`
                : "Analiza mi curva de potencia frente a la temporada anterior",
            )
          }
        >
          Analizar con IA
        </Button>
      </div>
      <Coverage
        p={p}
        activities={p.data.activities.filter((a) =>
          rolling
            ? ranges.some(([from, to]) => a.date >= from && a.date < to)
            : seasons.includes("s" + new Date(a.date).getUTCFullYear()),
        )}
        period={
          rolling
            ? labels.join(" y ")
            : seasons.length
              ? seasons.map((s) => s.slice(1)).join(", ")
              : "Ninguna temporada seleccionada"
        }
      />
      <div className="strip metrics-five">
        <Metric
          size="l"
          label={p.demo ? "FTP estimado" : "FTP configurado"}
          accent="power"
          value={p.demo ? 273 : number(p.data.athlete.ftp)}
          unit="W"
          sub={
            ratio(p.demo ? 273 : p.data.athlete.ftp, weight) +
            " W/kg" +
            (p.demo ? " · modelo" : "")
          }
        />
        <Metric
          label="Potencia crítica"
          value={cp.ok ? cp.cp : "–"}
          unit="W"
          delta={cp.ok && cpBase.ok ? cp.cp - cpBase.cp : undefined}
          deltaUnit=" W"
          sub={
            cp.ok
              ? `Modelo 5–20 min · R² ${number(cp.r2, 3)}`
              : "Insuficiente · " + cp.reason
          }
        />
        <Metric
          label="W′ (capacidad anaeróbica)"
          value={cp.ok ? number(cp.wPrime / 1000, 1) : "–"}
          unit="kJ"
          delta={
            cp.ok && cpBase.ok
              ? Math.round((cp.wPrime - cpBase.wPrime) / 100) / 10
              : undefined
          }
          deltaUnit=" kJ"
          deltaFormat={(v) => number(v, 1)}
          sub={
            cp.ok
              ? cpBase.ok
                ? "vs. " + labels[1]
                : "Sin modelo en " + (labels[1] ?? "la referencia")
              : "Requiere esfuerzos máximos de 5, 10 y 20 min"
          }
        />
        <Metric
          label="Pico 5 s"
          value={number(at(5))}
          unit="W"
          delta={
            at(5) !== null && at(5, 1) !== null ? at(5)! - at(5, 1)! : undefined
          }
          deltaUnit=" W"
          sub={labels[1] ? "vs. " + labels[1] : "Mejor marca del periodo"}
        />
        <Metric
          label="Fondo 4 h"
          value={number(at(14400))}
          unit="W"
          delta={
            at(14400) !== null && at(14400, 1) !== null
              ? at(14400)! - at(14400, 1)!
              : undefined
          }
          deltaUnit=" W"
          sub={
            p.data.athlete.ftp && at(14400) !== null
              ? number((at(14400)! / p.data.athlete.ftp) * 100) +
                "% del FTP actual (referencia)"
              : "Sin referencia FTP"
          }
        />
      </div>
      <div className="row">
        <Panel
          className="grow"
          title="Curva de potencia"
          subtitle="Máxima potencia media por duración · W/kg con el peso vigente en la actividad de cada marca; sin fecha, sin W/kg"
        >
          {unit === "wkg" &&
          !curve.some((r) =>
            series.some((s) => typeof r[s.key] === "number"),
          ) ? (
            <StateBlock
              title="Falta el peso histórico"
              action={
                <Button onClick={() => p.go("settings")}>
                  Completar perfil
                </Button>
              }
            />
          ) : curve.some((row) =>
              series.some((s) => typeof row[s.key] === "number"),
            ) ? (
            <LineChart
              data={curve}
              xType="log"
              height={300}
              legend
              xTicks={ticks}
              xFormat={effort}
              tooltipTitle={(t, row) =>
                effort(t) +
                " · " +
                series
                  .map(
                    (s) =>
                      s.label +
                      ": " +
                      number(row["w" + s.key.slice(1)] as number | null, 1) +
                      " kg" +
                      (row["d" + s.key.slice(1)]
                        ? " (" + date(Number(row["d" + s.key.slice(1)])) + ")"
                        : ""),
                  )
                  .join(" · ")
              }
              yFormat={(v) => number(v, unit === "w" ? 0 : 2)}
              series={series}
              refLines={
                p.data.athlete.ftp && (unit === "w" || weight)
                  ? [
                      {
                        value:
                          unit === "w"
                            ? p.data.athlete.ftp
                            : p.data.athlete.ftp / weight!,
                        label:
                          "FTP actual · " +
                          (unit === "w"
                            ? number(p.data.athlete.ftp) + " W"
                            : ratio(p.data.athlete.ftp, weight) + " W/kg"),
                        color: "power",
                      },
                    ]
                  : []
              }
            />
          ) : (
            <StateBlock
              title={
                !rolling && !seasons.length && keys.length
                  ? "Ninguna temporada seleccionada"
                  : "Sin datos de potencia"
              }
              detail={
                !rolling && !seasons.length && keys.length
                  ? "Activa al menos una temporada para dibujar la curva."
                  : "No hay muestras de potencia suficientes en las temporadas seleccionadas."
              }
            />
          )}
        </Panel>
        <Panel
          className="durations-panel"
          flush
          title="Duraciones clave"
          subtitle={
            labels.join(" frente a ") +
            (p.demo && !rolling
              ? " · curva de demostración"
              : " · abre cada marca")
          }
        >
          <DataTable
            rows={table}
            columns={[
              { key: "l", label: "Duración" },
              {
                key: "a",
                label: rolling ? "Actual" : (labels[0] ?? "Actual"),
                align: "right",
                render: (r) => <strong>{link(r.a, r.l)}</strong>,
              },
              {
                key: "w",
                label: "W/kg",
                align: "right",
                render: (r) => (
                  <>
                    {ratio(r.a?.p ?? null, r.a?.weight ?? null)}
                    <div className="small cl-muted">
                      {number(r.a?.weight ?? null, 1)} kg
                    </div>
                  </>
                ),
              },
              {
                key: "b",
                label: rolling
                  ? reference === "prev"
                    ? "Anterior"
                    : "Hace 1 año"
                  : (labels[1] ?? "Anterior"),
                align: "right",
                render: (r) => link(r.b, r.l),
              },
              {
                key: "d",
                label: "Δ",
                align: "right",
                render: (r) =>
                  r.a && r.b ? (
                    <span
                      className={r.a.p >= r.b.p ? "delta-good" : "delta-bad"}
                    >
                      {r.a.p >= r.b.p ? "+" : ""}
                      {number((r.a.p / r.b.p - 1) * 100, 1)} %
                    </span>
                  ) : (
                    "–"
                  ),
              },
            ]}
          />
        </Panel>
      </div>
      <Panel
        title="Tiempo en zonas de potencia"
        subtitle={`${labels[0] ?? "Sin periodo"} · con el FTP vigente en la fecha de cada actividad`}
      >
        {zoneError ? (
          <StateBlock
            kind="error"
            title="No se pudo calcular"
            detail={zoneError}
          />
        ) : !zoneData ? (
          <Skeleton height={96} />
        ) : (
          <>
            {zoneData.coverage.counted ? (
              <ZoneBar
                zones={zoneData.zones}
                format={shortDuration}
                ariaLabel={`Tiempo en zonas · ${labels[0]}`}
              />
            ) : (
              <StateBlock
                title="Sin tiempo en zonas"
                detail="Ninguna actividad del periodo tiene muestras de potencia y un FTP vigente en su fecha."
              />
            )}
            <p className="small cl-muted">
              {zoneData.coverage.counted} de {zoneData.coverage.activities}{" "}
              actividades con muestras de potencia y FTP de su fecha
              {[
                [zoneData.coverage.noSamples, "sin muestras"],
                [zoneData.coverage.noPower, "sin potencia"],
                [zoneData.coverage.noFtp, "sin FTP para su fecha"],
              ]
                .filter(([n]) => n)
                .map(([n, label]) => ` · ${n} ${label}`)
                .join("")}
              . Las actividades excluidas no suman tiempo.
            </p>
            {zoneData.coverage.noFtp > 0 && (
              <Button size="sm" onClick={() => p.go("settings")}>
                Completar perfil
              </Button>
            )}
          </>
        )}
      </Panel>
      <Panel
        title="Evolución de mejores marcas"
        subtitle="Mejor potencia de cada mes · temporada actual frente a la anterior"
        actions={
          <Segmented
            label="Duración"
            value={dur}
            onChange={setDur}
            options={[
              { value: "p300", label: "5 min" },
              { value: "p1200", label: "20 min" },
              { value: "p3600", label: "60 min" },
            ]}
          />
        }
      >
        <LineChart
          data={p.data.bests}
          height={220}
          legend
          zeroBased={false}
          xTicks={p.demo ? Array.from({ length: 12 }, (_, i) => i) : undefined}
          xFormat={(v) =>
            p.demo
              ? ([
                  "nov",
                  "dic",
                  "ene",
                  "feb",
                  "mar",
                  "abr",
                  "may",
                  "jun",
                  "jul",
                  "ago",
                  "sep",
                  "oct",
                ][v] ?? "")
              : date(v)
          }
          series={[
            {
              key: dur,
              label:
                effort(Number(dur.slice(1))) +
                " · " +
                (p.demo ? "2025–26" : "Histórico"),
              color: tone,
              unit: "W",
              width: 2,
            },
            ...(p.demo
              ? [
                  {
                    key: dur + "_25",
                    label: effort(Number(dur.slice(1))) + " · 2024–25",
                    color: "muted",
                    unit: "W",
                    dash: true,
                  },
                ]
              : []),
          ]}
        />
      </Panel>
    </div>
  );
}
