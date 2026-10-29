import { profileAt } from "./athlete";
import { LOAD_PROVENANCE, sampleCoverage } from "./coverage";
import type {
  Activity,
  ActivityDetail,
  Athlete,
  ChartRow,
  Dataset,
  Effort,
  Sample,
  Stats,
} from "../shared/models";
export const DAY = 86400000;
export const DURATIONS = [1, 5, 15, 60, 300, 600, 1200, 3600, 14400, 18000];
export const WEEK_EFFORTS = [60, 300, 1200, 3600];
export const mean = (values: (number | null)[]) => {
  const valid = values.filter(
    (v): v is number => v !== null && Number.isFinite(v),
  );
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
};
export const round = (n: number | null) => (n === null ? null : Math.round(n));
export function nearest(rows: Sample[], key: "x" | "km", value: number) {
  let found = 0,
    d = Infinity;
  rows.forEach((r, i) => {
    if (r[key] !== null && Math.abs(r[key] - value) < d) {
      d = Math.abs(r[key] - value);
      found = i;
    }
  });
  return found;
}
export function sampleDuration(rows: Sample[], i: number) {
  return i + 1 < rows.length
    ? Math.max(0, Math.min(30, rows[i + 1].x - rows[i].x))
    : i
      ? Math.max(0, Math.min(30, rows[i].x - rows[i - 1].x))
      : 1;
}
export function smoothPower(rows: Sample[]) {
  let start = 0;
  for (let i = 0; i < rows.length; i++) {
    while (start < i && rows[i].x - rows[start].x >= 30) start++;
    rows[i].ps = round(mean(rows.slice(start, i + 1).map((r) => r.p)));
  }
  return rows;
}
export function stats(rows: Sample[], i0 = 0, i1 = rows.length - 1): Stats {
  const selected = rows.slice(i0, i1 + 1),
    weights = selected.map((_, i) => sampleDuration(rows, i + i0));
  const weighted = (key: "p" | "hr" | "cad") => {
    let sum = 0,
      w = 0;
    selected.forEach((r, i) => {
      if (r[key] !== null) {
        sum += r[key] * weights[i];
        w += weights[i];
      }
    });
    return w ? sum / w : null;
  };
  const power = selected.map((r) => r.p).filter((x): x is number => x !== null);
  const p4 = mean(selected.map((r) => (r.ps === null ? null : r.ps ** 4)));
  let gain: number | null = null;
  for (let i = 1; i < selected.length; i++) {
    const a = selected[i - 1].elev,
      b = selected[i].elev;
    if (a !== null && b !== null) gain = (gain ?? 0) + Math.max(0, b - a);
  }
  const first = selected[0]?.km,
    last = selected.at(-1)?.km;
  return {
    dur: weights.reduce((a, b) => a + b, 0),
    avgP: round(weighted("p")),
    np: p4 === null ? null : Math.round(p4 ** 0.25),
    hr: round(weighted("hr")),
    cad: round(weighted("cad")),
    max: power.length
      ? power.reduce((a, b) => Math.max(a, b), -Infinity)
      : null,
    gain: round(gain),
    dist: first != null && last != null ? last - first : null,
  };
}
export function bestEfforts(rows: Sample[], durations = DURATIONS): Effort[] {
  const sums = [0],
    covered = [0];
  rows.forEach((r, i) => {
    const dt = sampleDuration(rows, i);
    sums.push(sums[i] + (r.p ?? 0) * dt);
    covered.push(covered[i] + (r.p === null ? 0 : dt));
  });
  return durations.map((t) => {
    let start = 0,
      best: number | null = null,
      at = 0,
      end = 0;
    for (let i = 0; i < rows.length; i++) {
      const endT = rows[i].x + sampleDuration(rows, i);
      while (start < i && endT - rows[start + 1].x >= t) start++;
      const elapsed = endT - rows[start].x;
      if (elapsed < t || elapsed > t + sampleDuration(rows, start)) continue;
      const valid = covered[i + 1] - covered[start];
      if (valid < elapsed - 0.01) continue;
      const p = (sums[i + 1] - sums[start]) / elapsed;
      if (best === null || p > best) {
        best = p;
        at = start;
        end = i;
      }
    }
    return {
      t,
      l: t < 60 ? `${t} s` : t < 3600 ? `${t / 60} min` : `${t / 3600} h`,
      p: round(best),
      i0: at,
      i1: end,
    };
  });
}
export function zones(rows: Sample[], key: "p" | "hr", ref: number | null) {
  const bounds =
    key === "p"
      ? [0.55, 0.75, 0.9, 1.05, 1.2, 1.5, Infinity]
      : [0.81, 0.9, 0.94, 1, 1.03, 1.06, Infinity];
  const labels =
    key === "p"
      ? ["Z1", "Z2", "Z3", "Z4", "Z5", "Z6", "Z7"]
      : ["Z1", "Z2", "Z3", "Z4", "Z5a", "Z5b", "Z5c"];
  const names =
    key === "p"
      ? [
          "Recuperación",
          "Resistencia",
          "Tempo",
          "Umbral",
          "VO₂máx",
          "Anaeróbico",
          "Neuromuscular",
        ]
      : [
          "Recuperación",
          "Aeróbico",
          "Tempo",
          "Subumbral",
          "Supraumbral",
          "Capacidad aeróbica",
          "Anaeróbico",
        ];
  const out = labels.map((label, i) => ({
    label,
    name: names[i],
    value: 0,
    color: `z${i + 1}`,
  }));
  if (!ref) return out;
  rows.forEach((r, i) => {
    const v = r[key];
    if (v !== null) {
      const z = bounds.findIndex((b) => v / ref < b);
      out[z].value += sampleDuration(rows, i);
    }
  });
  return out;
}
export function realDataset(
  activities: Activity[],
  details: ActivityDetail[],
  athlete: Athlete,
): Dataset {
  const today = Date.now(),
    dated = activities
      .filter((a) => a.tss !== null)
      .sort((a, b) => a.date - b.date);
  const missingDays = new Set(
    activities
      .filter((a) => a.tss === null)
      .map((a) => Math.floor(a.date / DAY)),
  );
  const load: ChartRow[] = [];
  if (dated.length) {
    let ctl = 0,
      atl = 0;
    const totals = new Map<number, number>();
    dated.forEach((a) => {
      const d = Math.floor(a.date / DAY);
      totals.set(d, (totals.get(d) ?? 0) + a.tss!);
    });
    for (
      let d = Math.floor(dated[0].date / DAY);
      d <= Math.floor(today / DAY);
      d++
    ) {
      const tss = totals.get(d) ?? 0,
        tsb = ctl - atl;
      ctl += (tss - ctl) / 42;
      atl += (tss - atl) / 7;
      load.push({
        x: d * DAY,
        tss: missingDays.has(d) ? null : tss,
        ctl,
        atl,
        tsb,
      });
    }
  }
  const curve: ChartRow[] = DURATIONS.map((t) => ({ x: t }));
  const months = new Map<string, ChartRow>();
  activities.forEach((a, i) => {
    const detail = details[i];
    if (!detail) return;
    const year = new Date(a.date).getUTCFullYear(),
      mo = new Date(a.date).toISOString().slice(0, 7);
    const monthly = months.get(mo) ?? { x: Date.parse(mo + "-01"), m: mo };
    for (const e of detail.best) {
      if (e.p === null) continue;
      const row = curve.find((r) => r.x === e.t);
      if (
        row &&
        (row["s" + year] === undefined || e.p > Number(row["s" + year]))
      ) {
        row["s" + year] = e.p;
        row["w" + year] = profileAt(athlete, a.date).weight;
        row["d" + year] = a.date;
      }
      monthly["p" + e.t] = Math.max(Number(monthly["p" + e.t] ?? 0), e.p);
    }
    months.set(mo, monthly);
  });
  return {
    sampleCoverage: Object.fromEntries(
      activities.map((a, i) => [a.id, sampleCoverage(details[i] ?? null)]),
    ),
    efforts: Object.fromEntries(
      activities.map((a, i) => [
        a.id,
        (details[i]?.best ?? []).filter((e) => WEEK_EFFORTS.includes(e.t)),
      ]),
    ),
    today,
    athlete,
    activities,
    climbs: [],
    attempts: [],
    goals: [],
    load,
    curve: curve.filter((r) => Object.keys(r).length > 1),
    bests: [...months.values()].sort((a, b) => Number(a.x) - Number(b.x)),
    coverage: `${activities.filter((a) => a.tss === null).length} actividades sin TSS en todo el histórico; también pueden afectar a la carga del periodo seleccionado. ${LOAD_PROVENANCE}`,
  };
}

export function compareStreams(a: Sample[], b: Sample[]) {
  const times = [...new Set([...a, ...b].map((r) => r.x))].sort(
    (a, b) => a - b,
  );
  let ai = 0,
    bi = 0;
  const at = (rows: Sample[], i: number, t: number) =>
    rows[i] &&
    t >= rows[0].x &&
    t <= rows.at(-1)!.x &&
    Math.abs(rows[i].x - t) <= sampleDuration(rows, i)
      ? rows[i]
      : null;
  return times.map((x) => {
    while (
      ai + 1 < a.length &&
      Math.abs(a[ai + 1].x - x) <= Math.abs(a[ai].x - x)
    )
      ai++;
    while (
      bi + 1 < b.length &&
      Math.abs(b[bi + 1].x - x) <= Math.abs(b[bi].x - x)
    )
      bi++;
    const ra = at(a, ai, x),
      rb = at(b, bi, x);
    return {
      x,
      pa: ra?.ps ?? null,
      pb: rb?.ps ?? null,
      ha: ra?.hr ?? null,
      hb: rb?.hr ?? null,
    };
  });
}
export const percentChange = (a: number | null, b: number | null) =>
  a !== null && a !== 0 && b !== null ? (b / a - 1) * 100 : null;

export function projectRoute(rows: Sample[]) {
  const valid = rows
    .map((r, index) => ({ r, index }))
    .filter(
      ({ r }) =>
        r.lat != null &&
        r.lon != null &&
        Math.abs(r.lat) <= 90 &&
        Math.abs(r.lon) <= 180,
    );
  if (valid.length < 2)
    return { points: [] as [number, number][], pointIndices: [] as number[] };
  const lat0 = valid[0].r.lat!,
    lon0 = valid[0].r.lon!;
  return {
    points: valid.map(
      ({ r }) =>
        [
          (r.lon! - lon0) * 111320 * Math.cos((lat0 * Math.PI) / 180),
          (r.lat! - lat0) * 111320,
        ] as [number, number],
    ),
    pointIndices: valid.map((v) => v.index),
  };
}
export function routeSelection(
  indices: number[] | undefined,
  range: [number, number] | null,
): [number, number] | null {
  if (!indices || !range) return range;
  const start = indices.findIndex((i) => i >= range[0]),
    end = indices.findLastIndex((i) => i <= range[1]);
  return start >= 0 && end >= start ? [start, end] : null;
}
