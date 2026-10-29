import { Coverage } from "./Coverage";
import { WeeklySummary } from "./WeeklySummary";
import { Goals } from "./Goals";
import { weeklyActivityTotals } from "../../domain/classification";
import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  DataTable,
  Metric,
  Panel,
  Segmented,
  StateBlock,
} from "../components/ui";
import { BarChart, LineChart } from "../components/charts";
import { date, number, TYPES } from "../format";
import { activityColumns, pickNumber, ratio, type PageProps } from "./shared";
import { DAY } from "../../domain/analysis";
export function Dashboard(p: PageProps) {
  const [range, setRange] = useState("12"),
    { data } = p;
  const weeks = Number(range),
    load = data.load.filter(
      (r) =>
        Number(r.x) >=
        Math.floor(data.today / DAY) * DAY - (weeks * 7 - 1) * DAY,
    ),
    now = data.load.at(-1),
    prev = data.load.at(-8);
  const weekly = useMemo(
    () =>
      Array.from({ length: weeks }, (_, i) => {
        const end = data.today - (weeks - 1 - i) * 7 * DAY + DAY,
          start = end - 7 * DAY;
        const acts = data.activities.filter(
          (a) => a.date >= start && a.date < end,
        );
        return {
          x: date(start),
          ...weeklyActivityTotals(acts),
        };
      }),
    [weeks, data],
  );
  const current = weekly.at(-1)!,
    last = weekly.at(-2)!;
  const tsb = pickNumber(now, "tsb"),
    ctl = pickNumber(now, "ctl"),
    atl = pickNumber(now, "atl");
  const incompleteLoad = !p.demo && data.activities.some((a) => a.tss === null);
  const loadValue = (value: number | null) =>
    (value !== null && !p.demo ? "≈" : "") + number(value, 1);
  const longest = Math.max(
    0,
    ...data.activities
      .filter((a) => a.date > data.today - 56 * DAY)
      .map((a) => a.dur),
  );
  return (
    <div className="page">
      <div className="toolbar align-end">
        <div>
          <div className="label">{date(data.today, true)}</div>
          <div className="page-heading">
            {p.demo
              ? "Semana de carga 3 de 4 — buena forma para trabajar umbral"
              : "Tu entrenamiento, en perspectiva"}
          </div>
        </div>
        <div className="push" />
        <Segmented
          label="Rango"
          value={range}
          onChange={setRange}
          options={[
            { value: "6", label: "6 sem" },
            { value: "12", label: "12 sem" },
            { value: "20", label: "20 sem" },
          ]}
        />
      </div>
      <div className="strip metrics-five">
        <Metric
          size="l"
          label="Forma (TSB)"
          accent="form"
          value={loadValue(tsb)}
          sub={
            incompleteLoad ? (
              <Badge tone="warning">Estimación · TSS incompleto</Badge>
            ) : tsb !== null ? (
              <Badge
                tone={tsb < -20 ? "warning" : tsb > 5 ? "info" : "success"}
              >
                {tsb < -20 ? "Fatiga alta" : tsb > 5 ? "Fresco" : "Productiva"}
              </Badge>
            ) : (
              "Sin datos de carga"
            )
          }
        />
        <Metric
          label="Fitness (CTL)"
          accent="fitness"
          value={loadValue(ctl)}
          delta={
            ctl !== null && pickNumber(prev, "ctl") !== null
              ? Math.round((ctl - pickNumber(prev, "ctl")!) * 10) / 10
              : undefined
          }
          sub={p.demo ? "vs. hace 7 días" : "Estimación · vs. hace 7 días"}
        />
        <Metric
          label="Fatiga (ATL)"
          accent="fatigue"
          value={loadValue(atl)}
          delta={
            atl !== null && pickNumber(prev, "atl") !== null
              ? Math.round((atl - pickNumber(prev, "atl")!) * 10) / 10
              : undefined
          }
          lowerIsBetter
          sub={p.demo ? "vs. hace 7 días" : "Estimación · vs. hace 7 días"}
        />
        <Metric
          label="FTP"
          accent="power"
          value={number(data.athlete.ftp)}
          unit="W"
          sub={
            ratio(data.athlete.ftp, data.athlete.weight) +
            " W/kg" +
            (p.demo ? " · test 12 oct" : "")
          }
        />
        <Metric
          label="Carga esta semana"
          value={current.complete ? number(current.total) : "–"}
          unit="TSS"
          sub={`${number(current.hours, 1)} h · semana anterior ${last.complete ? number(last.total) : "–"}`}
        />
      </div>
      <Coverage
        p={p}
        activities={data.activities.filter(
          (a) =>
            a.date >=
              Math.floor(data.today / DAY) * DAY - (weeks * 7 - 1) * DAY &&
            a.date <= data.today,
        )}
        period={`${weeks} semanas`}
      />
      {!p.demo && <div className="small cl-muted">{data.coverage}</div>}
      <WeeklySummary p={p} />
      <div className="row">
        <Panel
          className="grow"
          title={
            p.demo
              ? "Carga de entrenamiento"
              : "Carga de entrenamiento · estimación"
          }
          subtitle="CTL 42 d · ATL 7 d · TSB = CTL − ATL de ayer"
          actions={
            <Button
              size="sm"
              variant="ghost"
              icon="coach"
              onClick={() => p.ask("¿Cómo va mi forma?")}
            >
              Analizar
            </Button>
          }
        >
          {load.length ? (
            <LineChart
              data={load}
              height={236}
              legend
              zeroBased={false}
              xFormat={(v) => date(v)}
              tooltipTitle={(v) => date(v)}
              tooltipExtra={(row) => (
                <div>TSS del día: {number(row.tss as number | null)}</div>
              )}
              series={[
                {
                  key: "ctl",
                  label: "Fitness (CTL)",
                  color: "fitness",
                  width: 2,
                },
                {
                  key: "atl",
                  label: "Fatiga (ATL)",
                  color: "fatigue",
                  dash: true,
                },
                {
                  key: "tsb",
                  label: "Forma (TSB)",
                  color: "form",
                  area: true,
                  areaOpacity: 0.12,
                },
              ]}
              refLines={[{ value: 0, color: "faint" }]}
            />
          ) : (
            <StateBlock
              title="Carga no disponible"
              detail="Faltan datos TSS para calcular la carga del histórico importado."
            />
          )}
        </Panel>
        <Goals
          goals={data.goals}
          today={data.today}
          demo={p.demo}
          ctl={ctl}
          longest={longest}
        />
      </div>
      <div className="row">
        <Panel
          className="grow"
          title="Carga semanal por tipo"
          subtitle="TSS por semana"
        >
          {weekly.every((w) => w.complete) ? (
            <BarChart
              data={weekly}
              height={200}
              legend
              series={Object.entries(TYPES)
                .filter(
                  ([key]) =>
                    ["endurance", "intervals", "climb", "mtb"].includes(key) ||
                    data.activities.some((a) => a.type === key),
                )
                .map(([key, t]) => ({
                  key,
                  label: t.label,
                  color: t.tone,
                }))}
            />
          ) : (
            <StateBlock
              title="Carga incompleta"
              detail="Algunas actividades no contienen TSS."
            />
          )}
        </Panel>
        <Panel
          className="grow"
          title="Evolución de potencia"
          subtitle="Mejor potencia mensual · últimos 12 meses"
          actions={
            <Button
              size="sm"
              variant="ghost"
              iconRight="chevron-right"
              onClick={() => p.go("performance")}
            >
              Rendimiento
            </Button>
          }
        >
          <LineChart
            data={data.bests.slice(-12)}
            height={200}
            legend
            zeroBased={false}
            xTicks={p.demo ? [0, 2, 4, 6, 8, 10, 11] : undefined}
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
              { key: "p300", label: "5 min", color: "z5", unit: "W" },
              {
                key: "p1200",
                label: "20 min",
                color: "power",
                unit: "W",
                width: 2,
              },
              { key: "p3600", label: "60 min", color: "z2", unit: "W" },
            ]}
          />
        </Panel>
      </div>
      <Panel
        flush
        title="Últimas actividades"
        subtitle={
          p.demo
            ? "Sincronizadas desde Garmin Connect"
            : "Histórico local de Garmin"
        }
        actions={
          <Button
            size="sm"
            variant="ghost"
            iconRight="chevron-right"
            onClick={() => p.go("activities")}
          >
            Ver todas
          </Button>
        }
      >
        <DataTable
          rows={data.activities.slice(0, 6)}
          columns={activityColumns}
          onSelect={(id) => p.openActivity(String(id))}
          empty={
            <StateBlock
              title="Todavía no hay actividades"
              action={
                <Button onClick={() => p.go("settings")}>
                  Configurar Garmin
                </Button>
              }
            />
          }
        />
      </Panel>
    </div>
  );
}
