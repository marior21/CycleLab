import { useState } from "react";
import {
  Button,
  Chip,
  DataTable,
  Metric,
  Panel,
  Segmented,
  StateBlock,
} from "../components/ui";
import { LineChart } from "../components/charts";
import { date, effort, number } from "../format";
import { ratio, type PageProps } from "./shared";
const ticks = [1, 5, 15, 60, 300, 1200, 3600, 14400];
export function Performance(p: PageProps) {
  const keys = [
    ...new Set(
      p.data.curve.flatMap((r) =>
        Object.keys(r).filter((k) => k.startsWith("s")),
      ),
    ),
  ]
    .sort()
    .reverse();
  const [seasons, setSeasons] = useState<string[]>(keys.slice(0, 2)),
    [unit, setUnit] = useState("w"),
    [dur, setDur] = useState("p1200");
  const weight = p.data.athlete.weight;
  const curve = p.data.curve.map((r) =>
    Object.fromEntries(
      Object.entries(r).map(([k, v]) => [
        k,
        k === "x" || unit === "w"
          ? v
          : weight && typeof v === "number"
            ? v / weight
            : null,
      ]),
    ),
  );
  const series = keys
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
  const at = (t: number, key?: string) => {
    const k = key ?? keys[0];
    if (!k) return null;
    const row = p.data.curve.find((r) => r.x === t);
    return typeof row?.[k] === "number" ? Number(row[k]) : null;
  };
  const table = [5, 60, 300, 1200, 3600, 14400].map((t) => ({
    id: t,
    l: effort(t),
    a: at(t),
    b: keys[1] ? at(t, keys[1]) : null,
  }));
  const tone = dur === "p300" ? "z5" : dur === "p1200" ? "power" : "z2";
  return (
    <div className="page">
      <div className="toolbar">
        {keys.map((key, i) => (
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
            p.ask("Analiza mi curva de potencia frente a la temporada anterior")
          }
        >
          Analizar con IA
        </Button>
      </div>
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
          value={p.demo ? 285 : "–"}
          unit="W"
          delta={p.demo ? 17 : undefined}
          deltaUnit=" W"
          sub={p.demo ? "vs. 2025" : "Sin modelo ajustado"}
        />
        <Metric
          label="W′ (capacidad anaeróbica)"
          value={p.demo ? "17,0" : "–"}
          unit="kJ"
          delta={p.demo ? 0.5 : undefined}
          deltaUnit=" kJ"
          sub={p.demo ? "vs. 2025" : "Sin modelo ajustado"}
        />
        <Metric
          label="Pico 5 s"
          value={number(at(5))}
          unit="W"
          delta={
            keys[1] && at(5) !== null && at(5, keys[1]) !== null
              ? at(5)! - at(5, keys[1])!
              : undefined
          }
          deltaUnit=" W"
          sub={
            keys[1] ? "vs. " + keys[1].slice(1) : "Mejor marca de la temporada"
          }
        />
        <Metric
          label="Fondo 4 h"
          value={number(at(14400))}
          unit="W"
          delta={
            keys[1] && at(14400) !== null && at(14400, keys[1]) !== null
              ? at(14400)! - at(14400, keys[1])!
              : undefined
          }
          deltaUnit=" W"
          sub={
            p.data.athlete.ftp && at(14400) !== null
              ? number((at(14400)! / p.data.athlete.ftp) * 100) + "% FTP"
              : "Sin referencia FTP"
          }
        />
      </div>
      <div className="row">
        <Panel
          className="grow"
          title="Curva de potencia"
          subtitle="Máxima potencia media por duración · escala logarítmica"
        >
          {unit === "wkg" && !weight ? (
            <StateBlock
              title="Falta el peso"
              action={
                <Button onClick={() => p.go("settings")}>
                  Completar perfil
                </Button>
              }
            />
          ) : series.length && curve.length ? (
            <LineChart
              data={curve}
              xType="log"
              height={300}
              legend
              xTicks={ticks}
              xFormat={effort}
              yFormat={(v) => number(v, unit === "w" ? 0 : 2)}
              series={series}
              refLines={
                p.data.athlete.ftp
                  ? [
                      {
                        value:
                          unit === "w"
                            ? p.data.athlete.ftp
                            : p.data.athlete.ftp / weight!,
                        label:
                          "FTP " +
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
                keys.length
                  ? "Ninguna temporada seleccionada"
                  : "Sin datos de potencia"
              }
              detail={
                keys.length
                  ? "Activa al menos una temporada para dibujar la curva."
                  : "Sincroniza actividades con potenciómetro."
              }
            />
          )}
        </Panel>
        <Panel
          className="durations-panel"
          flush
          title="Duraciones clave"
          subtitle={keys
            .slice(0, 2)
            .map((k) => k.slice(1))
            .join(" frente a ")}
        >
          <DataTable
            rows={table}
            columns={[
              { key: "l", label: "Duración" },
              {
                key: "a",
                label: keys[0]?.slice(1) ?? "Actual",
                align: "right",
                render: (r) => <strong>{number(r.a)} W</strong>,
              },
              {
                key: "w",
                label: "W/kg",
                align: "right",
                render: (r) => ratio(r.a, weight),
              },
              {
                key: "b",
                label: keys[1]?.slice(1) ?? "Anterior",
                align: "right",
                render: (r) => number(r.b) + " W",
              },
              {
                key: "d",
                label: "Δ",
                align: "right",
                render: (r) =>
                  r.a !== null && r.b ? (
                    <span className={r.a >= r.b ? "delta-good" : "delta-bad"}>
                      {r.a >= r.b ? "+" : ""}
                      {number((r.a / r.b - 1) * 100, 1)} %
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
