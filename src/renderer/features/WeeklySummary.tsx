import { useState } from "react";
import type { Activity } from "../../shared/models";
import { DAY } from "../../domain/analysis";
import {
  weekStart,
  weeklySummary,
  type Comparison,
  type WeekMetric,
  type WeeklySummary as Summary,
} from "../../domain/weeklySummary";
import {
  Badge,
  Button,
  DataTable,
  Panel,
  Segmented,
  ZoneBar,
} from "../components/ui";
import { date, effort, number, shortDuration } from "../format";
import type { PageProps } from "./shared";

const METRICS: Record<
  WeekMetric,
  { label: string; format: (v: number) => string }
> = {
  dur: { label: "Tiempo", format: shortDuration },
  dist: { label: "Distancia", format: (v) => `${number(v, 1)} km` },
  elev: { label: "Desnivel", format: (v) => `${number(v)} m` },
  tss: { label: "Carga", format: (v) => `${number(v)} TSS` },
};
const INTENSITY = {
  easy: { label: "Suave", name: "IF < 0,75", color: "z2" },
  moderate: { label: "Moderada", name: "IF 0,75–0,85", color: "z3" },
  hard: { label: "Intensa", name: "IF ≥ 0,85", color: "z5" },
  unknown: { label: "Sin IF", name: "Sin datos", color: "faint" },
};

const signed = (v: number, format: (v: number) => string) =>
  (v > 0 ? "+" : v < 0 ? "−" : "±") + format(Math.abs(v));
const percent = (v: number | null, base: number | null) =>
  v === null || !base
    ? ""
    : ` (${signed(Math.round(((v - base) / base) * 100), String)} %)`;

function reference(s: Summary, comparison: Comparison) {
  return (
    (comparison === "previous"
      ? "la semana anterior"
      : "la media de las 4 semanas anteriores") +
    (s.partial ? " en los mismos días" : "")
  );
}

/** Deterministic text built only from the local totals. */
export function summaryText(s: Summary, comparison: Comparison) {
  const m = s.metrics,
    out = [
      `${s.partial ? `Semana en curso (${s.days} de 7 días)` : "Semana completa"}: ${s.activities.length} ${s.activities.length === 1 ? "sesión" : "sesiones"}` +
        (s.activities.length
          ? `, ${METRICS.dur.format(m.dur.value ?? 0)}, ${m.dist.value === null ? "distancia desconocida" : METRICS.dist.format(m.dist.value)} y ${m.elev.value === null ? "desnivel desconocido" : METRICS.elev.format(m.elev.value)}.`
          : "."),
    ];
  const changes = (["dur", "elev", "tss"] as const)
    .filter((k) => m[k].delta !== null && m[k].base)
    .map(
      (k) =>
        `${METRICS[k].label.toLowerCase()}${percent(m[k].value, m[k].base)}`,
    );
  if (changes.length)
    out.push(`Frente a ${reference(s, comparison)}: ${changes.join(", ")}.`);
  const hard = s.intensity.find((i) => i.key === "hard")!.seconds;
  if (hard) out.push(`${shortDuration(hard)} en sesiones intensas.`);
  const records = s.efforts.filter(
    (e) => e.now && (!e.before || e.now.p! > e.before.p!),
  );
  if (records.length)
    out.push(
      `Mejor que la referencia en ${records.map((e) => `${effort(e.t)} (${number(e.now!.p)} W)`).join(", ")}.`,
    );
  const missing = (["dist", "elev", "tss"] as const).filter(
    (k) => m[k].missing.length,
  );
  if (missing.length)
    out.push(
      `Faltan datos de ${missing.map((k) => `${METRICS[k].label.toLowerCase()} en ${m[k].missing.length}`).join(", ")} ${s.activities.length === 1 ? "actividad" : "actividades"}.`,
    );
  return out.join(" ");
}

export function WeeklySummary({ p }: { p: PageProps }) {
  const [offset, setOffset] = useState("0"),
    [comparison, setComparison] = useState<Comparison>("previous"),
    [metric, setMetric] = useState<WeekMetric>("dur");
  const s = weeklySummary(p.data, Number(offset), comparison),
    m = s.metrics[metric],
    f = METRICS[metric].format,
    text = summaryText(s, comparison);
  const open = (a: Activity, range?: [number, number]) => (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => p.openActivity(a.id, range)}
    >
      {a.name}
    </Button>
  );
  const breakdown = (list: Activity[], weeks: boolean) => (
    <DataTable
      compact
      rows={list}
      onSelect={(id) => p.openActivity(String(id))}
      columns={[
        {
          key: "date",
          label: weeks ? "Fecha" : "Día",
          render: (a) => date(a.date, false, !weeks),
          width: 96,
        },
        { key: "name", label: "Actividad" },
        {
          key: metric,
          label: METRICS[metric].label,
          align: "right",
          render: (a) => (a[metric] === null ? "Sin datos" : f(a[metric]!)),
        },
      ]}
      empty={<span className="small cl-muted">Sin actividades.</span>}
    />
  );
  return (
    <Panel
      title="Resumen semanal"
      subtitle={
        <>
          {date(s.start)} – {date(s.start + 6 * DAY)} · comparado con{" "}
          {reference(s, comparison)}{" "}
          {s.partial && (
            <Badge tone="warning">En curso · {s.days} de 7 días</Badge>
          )}
        </>
      }
      actions={
        <>
          <Segmented
            label="Semana"
            value={offset}
            onChange={setOffset}
            options={[3, 2, 1, 0].map((o) => ({
              value: String(o),
              label: o ? date(weekStart(p.data.today) - o * 7 * DAY) : "Esta",
            }))}
          />
          <Segmented
            label="Comparar con"
            value={comparison}
            onChange={(v) => setComparison(v as Comparison)}
            options={[
              { value: "previous", label: "Anterior" },
              { value: "average", label: "Media 4 sem" },
            ]}
          />
          <Button
            size="sm"
            variant="ghost"
            icon="coach"
            onClick={() =>
              p.ask(
                `Explica mi semana del ${date(s.start)} al ${date(s.start + 6 * DAY)} frente a ${reference(s, comparison)}. Resumen calculado localmente: ${text}`,
              )
            }
          >
            Explicar
          </Button>
        </>
      }
    >
      <p className="week-text">{text}</p>
      <div className="week-grid">
        <div>
          <DataTable
            compact
            rowKey="key"
            selected={metric}
            onSelect={(key) => setMetric(key as WeekMetric)}
            selectOnFocus
            rows={(Object.keys(METRICS) as WeekMetric[]).map((key) => ({
              key,
              ...s.metrics[key],
            }))}
            columns={[
              {
                key: "key",
                label: "Métrica",
                render: (r) => METRICS[r.key].label,
              },
              {
                key: "value",
                label: "Semana",
                align: "right",
                render: (r) =>
                  r.value === null ? "–" : METRICS[r.key].format(r.value),
              },
              {
                key: "base",
                label: "Referencia",
                align: "right",
                render: (r) =>
                  r.base === null ? "–" : METRICS[r.key].format(r.base),
              },
              {
                key: "delta",
                label: "Cambio",
                align: "right",
                render: (r) =>
                  r.delta === null
                    ? "–"
                    : signed(r.delta, METRICS[r.key].format) +
                      percent(r.value, r.base),
              },
              {
                key: "missing",
                label: "Sin datos",
                align: "right",
                render: (r) =>
                  r.missing.length || r.baseMissing
                    ? `${r.missing.length} · ${r.baseMissing} ref.`
                    : "–",
              },
            ]}
          />
          <div className="week-breakdown">
            <div className="label">
              {METRICS[metric].label} · esta semana ={" "}
              {m.value === null ? "–" : f(m.value)}
              {m.missing.length
                ? `, sin contar ${m.missing.length} sin datos`
                : ""}
            </div>
            {breakdown(s.activities, false)}
            <div className="label">
              Referencia = {m.base === null ? "desconocida" : f(m.base)}
              {comparison === "average" ? " (suma ÷ 4 semanas)" : ""}
              {m.baseMissing ? `, ${m.baseMissing} sin datos` : ""}
            </div>
            {breakdown(s.reference.flat(), true)}
          </div>
        </div>
        <div>
          <div className="label">
            Intensidad · tiempo por sesión según su IF
          </div>
          <ZoneBar
            ariaLabel="Distribución de intensidad de la semana"
            format={shortDuration}
            zones={s.intensity.map((i) => ({
              ...INTENSITY[i.key],
              value: i.seconds,
            }))}
          />
          <div className="label">Mejores esfuerzos</div>
          <DataTable
            compact
            rowKey="t"
            rows={s.efforts}
            columns={[
              { key: "t", label: "Duración", render: (e) => effort(e.t) },
              {
                key: "now",
                label: "Semana",
                align: "right",
                render: (e) => (e.now ? `${number(e.now.p)} W` : "–"),
              },
              {
                key: "before",
                label: "Referencia",
                align: "right",
                render: (e) => (e.before ? `${number(e.before.p)} W` : "–"),
              },
              {
                key: "activity",
                label: "Origen",
                render: (e) =>
                  e.now
                    ? open(
                        e.now.activity,
                        e.now.i0 !== undefined && e.now.i1 !== undefined
                          ? [e.now.i0, e.now.i1]
                          : undefined,
                      )
                    : "Sin muestras de potencia",
              },
            ]}
          />
        </div>
      </div>
    </Panel>
  );
}
