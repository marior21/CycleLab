import type { Activity, ActivityDetail, Athlete } from "../shared/models";
import { profileNote } from "../domain/athlete";
import { percentChange } from "../domain/analysis";
import { FATIGUE, TYPES, date, duration, effort, number } from "./format";

type Cell = string | number | null | undefined;
const cell = (v: Cell) => {
  if (v == null || (typeof v === "number" && !Number.isFinite(v))) return "";
  let s = String(v);
  // Keep spreadsheets from running user text (names, notes) as formulas.
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};
export const toCsv = (rows: Cell[][]) =>
  rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
const round = (v: number | null, digits = 0) =>
  v === null ? null : Math.round(v * 10 ** digits) / 10 ** digits;
const origin = (a: Activity, demo: boolean) =>
  demo
    ? "Datos de demostración"
    : a.provenance
      ? `Archivo FIT · ${a.provenance.file}`
      : "Garmin";

export function activitiesCsv(list: Activity[], demo: boolean) {
  return toCsv([
    [
      "fecha_utc",
      "actividad",
      "tipo",
      "tipo_automatico",
      "duracion_s",
      "distancia_km",
      "desnivel_m",
      "potencia_normalizada_w",
      "potencia_media_w",
      "fc_media_ppm",
      "cadencia_rpm",
      "trabajo_kj",
      "tss",
      "if",
      "rpe_declarado",
      "fatiga_declarada",
      "notas_declaradas",
      "procedencia",
      "id",
    ],
    ...list.map((a) => [
      new Date(a.date).toISOString().slice(0, 16).replace("T", " "),
      a.name,
      TYPES[a.type].label,
      a.automaticType ? TYPES[a.automaticType].label : null,
      Math.round(a.dur),
      round(a.dist, 2),
      round(a.elev),
      a.np,
      a.avgP,
      a.hr,
      a.cad,
      round(a.kj),
      round(a.tss, 1),
      round(a.IF, 2),
      a.feel?.rpe,
      a.feel?.fatigue ? FATIGUE[a.feel.fatigue] : null,
      a.feel?.notes || null,
      origin(a, demo),
      a.id,
    ]),
  ]);
}

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const table = (head: string[], rows: string[][]) =>
  `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
const page = (title: string, demo: boolean, body: string) =>
  `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:14px/1.5 system-ui,sans-serif;max-width:860px;margin:32px auto;padding:0 16px;color:#1b1d22}h1{font-size:24px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 8px}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #d9dce3;padding:6px 8px;text-align:left}td+td,th+th{text-align:right}.muted{color:#5d6370}.demo{border:1px dashed #b07400;padding:8px 12px;border-radius:6px}</style></head><body>${
    demo
      ? '<p class="demo"><strong>Datos de demostración.</strong> Las cifras de este informe son ficticias.</p>'
      : ""
  }${body}<p class="muted">Generado por CycleLab el ${esc(
    new Date().toISOString().slice(0, 10),
  )}. IF y TSS se conservan del origen, sin recalcular.</p></body></html>`;
const unit = (v: number | null, u: string, digits = 0) =>
  u === "time" ? duration(v) : number(v, digits) + (u ? " " + u : "");

const summary = (a: Activity): [string, string][] => [
  ["Duración", duration(a.dur)],
  ["Distancia", unit(a.dist, "km", 1)],
  ["Desnivel", unit(a.elev, "m")],
  ["Potencia normalizada", unit(a.np, "W")],
  ["Potencia media", unit(a.avgP, "W")],
  ["FC media", unit(a.hr, "ppm")],
  ["Cadencia media", unit(a.cad, "rpm")],
  ["Trabajo", unit(a.kj, "kJ")],
  ["IF · TSS", `${number(a.IF, 2)} · ${number(a.tss)}`],
];
export function activityReport(
  a: Activity,
  d: ActivityDetail,
  athlete: Athlete,
  demo: boolean,
) {
  const feel = a.feel && [
    ["RPE", number(a.feel.rpe)],
    ["Fatiga", a.feel.fatigue ? FATIGUE[a.feel.fatigue] : "–"],
    ["Notas", a.feel.notes || "–"],
  ];
  return page(
    a.name,
    demo,
    `<h1>${esc(a.name)}</h1><p class="muted">${esc(
      `${date(a.date, true)} · ${TYPES[a.type].label}${a.automaticType ? ` (manual; automática: ${TYPES[a.automaticType].label})` : ""} · ${origin(a, demo)}`,
    )}</p><p class="muted">${esc(profileNote(athlete, a.date))}</p><h2>Resumen registrado</h2>${table(
      ["Métrica", "Valor"],
      summary(a),
    )}${
      feel
        ? `<h2>Sensaciones declaradas</h2><p class="muted">Anotadas por el deportista; no son métricas del dispositivo.</p>${table(["", "Valor"], feel)}`
        : ""
    }${
      d.laps.length
        ? `<h2>Vueltas</h2>${table(
            ["Vuelta", "Duración", "Pot. media", "NP", "FC", "Cadencia"],
            d.laps.map((l) => [
              l.label,
              duration(l.dur),
              unit(l.avgP, "W"),
              unit(l.np, "W"),
              unit(l.hr, "ppm"),
              unit(l.cad, "rpm"),
            ]),
          )}`
        : ""
    }${
      d.best.some((e) => e.p !== null)
        ? `<h2>Mejores esfuerzos</h2>${table(
            ["Duración", "Potencia"],
            d.best
              .filter((e) => e.p !== null)
              .map((e) => [effort(e.t), unit(e.p, "W")]),
          )}`
        : ""
    }`,
  );
}

export function comparisonValues(
  a: Activity,
  b: Activity,
  da: ActivityDetail,
  db: ActivityDetail,
): [string, number | null, number | null, string, number][] {
  const eff = (x: Activity) => (x.np !== null && x.hr ? x.np / x.hr : null);
  return [
    ["Duración", a.dur, b.dur, "time", 0],
    ["Distancia", a.dist, b.dist, "km", 1],
    ["Desnivel", a.elev, b.elev, "m", 0],
    ["Pot. normalizada", a.np, b.np, "W", 0],
    ["Pot. media", a.avgP, b.avgP, "W", 0],
    ["FC media", a.hr, b.hr, "ppm", 0],
    ["Eficiencia (NP/FC)", eff(a), eff(b), "", 2],
    ["TSS", a.tss, b.tss, "", 0],
    [
      "Mejor 20 min",
      da.best.find((e) => e.t === 1200)?.p ?? null,
      db.best.find((e) => e.t === 1200)?.p ?? null,
      "W",
      0,
    ],
  ];
}
export function comparisonReport(
  a: Activity,
  b: Activity,
  da: ActivityDetail,
  db: ActivityDetail,
  athlete: Athlete,
  demo: boolean,
) {
  const title = `${a.name} frente a ${b.name}`;
  return page(
    title,
    demo,
    `<h1>${esc(title)}</h1>${[a, b]
      .map(
        (x, i) =>
          `<p class="muted">${i ? "B" : "A"} · ${esc(`${x.name} · ${date(x.date, true)} · ${origin(x, demo)} · ${profileNote(athlete, x.date)}`)}</p>`,
      )
      .join("")}<h2>Métricas</h2>${table(
      ["Métrica", "A", "B", "B frente a A"],
      comparisonValues(a, b, da, db).map(([k, va, vb, u, digits], i) => {
        const change = i < 3 ? null : percentChange(va, vb);
        return [
          k,
          unit(va, u, digits),
          unit(vb, u, digits),
          change === null
            ? "–"
            : `${change >= 0 ? "+" : ""}${number(change, 1)} %`,
        ];
      }),
    )}`,
  );
}
