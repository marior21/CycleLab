import type {
  Activity,
  ActivityType,
  ActivityDetail,
  Sample,
  Lap,
  Attempt,
  MapFeature,
  Goal,
} from "../../shared/models";
type DemoActivity = Omit<
  Activity,
  | "dur"
  | "dist"
  | "elev"
  | "np"
  | "avgP"
  | "hr"
  | "cad"
  | "kj"
  | "tss"
  | "IF"
  | "seed"
  | "elevPerKm"
> & {
  dur: number;
  dist: number;
  elev: number;
  np: number;
  avgP: number;
  hr: number;
  cad: number;
  kj: number;
  tss: number;
  IF: number;
  seed: number;
  elevPerKm: number;
};
type DemoSample = {
  [K in keyof Sample]: NonNullable<Sample[K]>;
};
type Segment = {
  d: number;
  p: number;
  g: number;
  cad: number;
  label: string | null;
  kind: string;
};
type Zone = {
  l: string;
  n: string;
  lo: number;
  hi: number;
};
// Deterministic fixture values and geometry from the supplied design, never used for real accounts.
function rng(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const DAY = 86400000;
export const TODAY = Date.UTC(2026, 9, 27);
export const ATH = { ftp: 275, lthr: 182, weight: 80 };
export const TYPES = {
  endurance: { label: "Resistencia", tone: "z2" },
  intervals: { label: "Intervalos", tone: "z5" },
  climb: { label: "Ascensión", tone: "z4" },
  mtb: { label: "BTT", tone: "speed" },
};
export const CLIMBS = [
  {
    id: "palombera",
    name: "Puerto de Palombera",
    from: "desde Barcenillas",
    km: 17.6,
    grade: 5.5,
    gain: 965,
  },
  {
    id: "lunada",
    name: "Portillo de Lunada",
    from: "desde San Roque de Riomiera",
    km: 11.0,
    grade: 7.0,
    gain: 770,
  },
  {
    id: "estacas",
    name: "Estacas de Trueba",
    from: "desde Vega de Pas",
    km: 8.9,
    grade: 6.4,
    gain: 570,
  },
  {
    id: "brenes",
    name: "Collado de Brenes",
    from: "desde Puente Viesgo",
    km: 6.2,
    grade: 6.1,
    gain: 380,
  },
];
const INTERVALS = [
  { name: "4×8′ umbral", n: 4, work: 480, rec: 240, p: 292, cad: 92 },
  { name: "3×12′ sweet spot", n: 3, work: 720, rec: 300, p: 258, cad: 90 },
  { name: "5×5′ VO₂máx", n: 5, work: 300, rec: 300, p: 322, cad: 96 },
  { name: "2×20′ umbral", n: 2, work: 1200, rec: 420, p: 280, cad: 90 },
  { name: "6×3′ VO₂máx", n: 6, work: 180, rec: 180, p: 338, cad: 98 },
];
const END_NAMES = [
  "Fondo por el valle del Pas",
  "Rodaje Z2 Costa Quebrada",
  "Vuelta al Saja",
  "Resistencia por Trasmiera",
  "Fondo Besaya–Iguña",
  "Rodaje largo Liébana",
];
const MTB_NAMES = [
  "BTT Monte Corona",
  "Ruta del Soplao (recorrido corto)",
  "BTT Sierra del Escudo",
  "BTT pistas de Cabezón",
];
export const PZ = [
  { l: "Z1", n: "Recuperación", lo: 0, hi: 0.55 },
  { l: "Z2", n: "Resistencia", lo: 0.55, hi: 0.75 },
  { l: "Z3", n: "Tempo", lo: 0.75, hi: 0.9 },
  { l: "Z4", n: "Umbral", lo: 0.9, hi: 1.05 },
  { l: "Z5", n: "VO₂máx", lo: 1.05, hi: 1.2 },
  { l: "Z6", n: "Anaeróbico", lo: 1.2, hi: 1.5 },
  { l: "Z7", n: "Neuromuscular", lo: 1.5, hi: 9 },
];
export const HZ = [
  { l: "Z1", n: "Recuperación", lo: 0, hi: 0.81 },
  { l: "Z2", n: "Aeróbico", lo: 0.81, hi: 0.9 },
  { l: "Z3", n: "Tempo", lo: 0.9, hi: 0.94 },
  { l: "Z4", n: "Subumbral", lo: 0.94, hi: 1 },
  { l: "Z5a", n: "Supraumbral", lo: 1, hi: 1.03 },
  { l: "Z5b", n: "Capacidad aeróbica", lo: 1.03, hi: 1.06 },
  { l: "Z5c", n: "Anaeróbico", lo: 1.06, hi: 9 },
];
const R = rng(11);
export const ACTS: DemoActivity[] = [];
export const ATTEMPTS: Attempt[] = [];
let climbIdx = 0;
for (let k = 150; k >= 0; k--) {
  const t = TODAY - k * DAY;
  const dow = new Date(t).getUTCDay();
  const week = Math.floor((150 - k) / 7);
  const recov = week % 4 === 3;
  const form = (150 - k) / 150;
  let type: ActivityType | null = null;
  if (dow === 2) type = "intervals";
  else if (dow === 4) type = R() < 0.8 ? "endurance" : null;
  else if (dow === 6) type = week % 2 ? "climb" : "endurance";
  else if (dow === 0)
    type = R() < 0.55 ? "mtb" : R() < 0.5 ? "endurance" : null;
  else if (dow === 3 && R() < 0.25) type = "endurance";
  if (!type) continue;
  if (recov && type === "intervals" && R() < 0.6) type = "endurance";
  const a: DemoActivity = {
    name: "",
    dur: 0,
    dist: 0,
    elev: 0,
    np: 0,
    avgP: 0,
    hr: 0,
    cad: 0,
    kj: 0,
    tss: 0,
    IF: 0,
    elevPerKm: 0,
    id: "a" + (150 - k),
    seed: 1000 + k,
    date: t + Math.round((7 + R() * 3) * 3600000),
    type: type,
    device: "Edge 840",
  };
  let IF;
  let dur;
  let spd;
  if (type === "endurance") {
    dur = (dow === 6 ? 3.6 + R() * 1.6 : 1.5 + R()) * 3600;
    IF = 0.65 + R() * 0.05;
    spd = 27.5 + R() * 2;
    a.name = END_NAMES[Math.floor(R() * END_NAMES.length)];
    a.elevPerKm = 10 + R() * 5;
  } else if (type === "intervals") {
    a.spec = INTERVALS[week % INTERVALS.length];
    dur = (1.35 + R() * 0.35) * 3600;
    IF = 0.8 + R() * 0.06;
    spd = 27 + R() * 1.5;
    a.name = a.spec.name;
    a.elevPerKm = 5 + R() * 3;
  } else if (type === "climb") {
    const cl = CLIMBS[climbIdx++ % CLIMBS.length];
    dur = (3 + R() * 1.2) * 3600;
    IF = 0.74 + R() * 0.05;
    spd = 23 + R() * 2;
    a.name = cl.name;
    a.elevPerKm = 20 + R() * 5;
    const ap = Math.round(ATH.ftp * (0.87 + 0.07 * form + (R() - 0.5) * 0.035));
    const vam = (ap / ATH.weight) * 282 * (1 - (cl.grade - 6) * 0.015);
    a.attempt = {
      id: "x" + a.id,
      climb: cl.id,
      activityId: a.id,
      date: a.date,
      avgP: ap,
      time: Math.round((cl.gain / vam) * 3600),
      hr: Math.round(ATH.lthr * (0.93 + R() * 0.04)),
      cad: Math.round(77 + R() * 6),
      seed: a.seed,
    };
    ATTEMPTS.push(a.attempt);
  } else {
    dur = (2 + R() * 1.2) * 3600;
    IF = 0.71 + R() * 0.06;
    spd = 14.5 + R() * 2;
    a.name = MTB_NAMES[Math.floor(R() * MTB_NAMES.length)];
    a.elevPerKm = 26 + R() * 8;
  }
  if (recov) {
    dur *= 0.78;
    IF -= 0.03;
  }
  a.dur = Math.round(dur);
  a.IF = IF;
  a.np = Math.round(ATH.ftp * IF);
  a.tss = Math.round((dur / 3600) * IF * IF * 100);
  a.avgP = Math.round(
    a.np * (type === "mtb" ? 0.83 : type === "intervals" ? 0.88 : 0.92),
  );
  a.hr = Math.round(ATH.lthr * (0.5 + 0.42 * IF) + R() * 4);
  a.cad = Math.round(
    { endurance: 86, intervals: 89, climb: 80, mtb: 74 }[type] + R() * 4,
  );
  a.dist = Math.round(((spd * dur) / 3600) * 10) / 10;
  a.elev = Math.round(a.dist * a.elevPerKm);
  a.kj = Math.round((a.avgP * dur) / 1000);
  ACTS.push(a);
}
ACTS.reverse();
// Intentos de temporadas anteriores (2025)
CLIMBS.forEach(function (cl, i) {
  for (let j = 0; j < 3; j++) {
    const ap = Math.round(ATH.ftp * (0.82 + R() * 0.04));
    const vam = (ap / ATH.weight) * 282 * (1 - (cl.grade - 6) * 0.015);
    const d = Date.UTC(2025, 4 + j * 2, 6 + i * 5);
    ATTEMPTS.push({
      id: "h" + cl.id + j,
      climb: cl.id,
      date: d,
      avgP: ap,
      time: Math.round((cl.gain / vam) * 3600),
      hr: Math.round(ATH.lthr * (0.94 + R() * 0.04)),
      cad: Math.round(75 + R() * 5),
      seed: 5000 + i * 10 + j,
    });
  }
});
ATTEMPTS.sort(function (a, b) {
  return b.date - a.date;
});
// Carga: CTL / ATL / TSB
const tssByDay: Record<number, number> = {};
ACTS.forEach(function (a) {
  const d = Math.floor(a.date / DAY);
  tssByDay[d] = (tssByDay[d] || 0) + a.tss;
});
export const LOAD: Record<string, number>[] = [];
let ctl = 46;
let atl = 42;
for (let k2 = 150; k2 >= 0; k2--) {
  const dd = Math.floor((TODAY - k2 * DAY) / DAY);
  const tss = tssByDay[dd] || 0;
  const tsb = ctl - atl;
  ctl += (tss - ctl) / 42;
  atl += (tss - atl) / 7;
  LOAD.push({
    x: dd * DAY,
    tss: tss,
    ctl: Math.round(ctl * 10) / 10,
    atl: Math.round(atl * 10) / 10,
    tsb: Math.round(tsb * 10) / 10,
  });
}
export const NOW = LOAD[LOAD.length - 1];
// Curva de potencia (modelo CP con decaimiento) por temporada
export const SEASONS: Record<
  number,
  {
    cp: number;
    w: number;
    pmax: number;
  }
> = {
  2026: { cp: 285, w: 17000, pmax: 1080 },
  2025: { cp: 268, w: 16500, pmax: 1040 },
  2024: { cp: 259, w: 16000, pmax: 1010 },
};
export function mmp(t: number, s: number) {
  const m = SEASONS[s];
  const tau = m.w / (m.pmax - m.cp);
  let p = m.cp + m.w / (t + tau);
  if (t > 600) p *= 1 - 0.04 * Math.log(t / 600);
  return Math.round(p);
}
export const CURVE: Record<string, number>[] = [];
for (let lt = 0; lt <= Math.log(18000); lt += 0.08) {
  const tt = Math.round(Math.exp(lt));
  if (CURVE.length && CURVE[CURVE.length - 1].x === tt) continue;
  CURVE.push({
    x: tt,
    s2026: mmp(tt, 2026),
    s2025: mmp(tt, 2025),
    s2024: mmp(tt, 2024),
  });
}
export const KEY_DUR = [
  { t: 5, l: "5 s" },
  { t: 60, l: "1 min" },
  { t: 300, l: "5 min" },
  { t: 1200, l: "20 min" },
  { t: 3600, l: "60 min" },
  { t: 14400, l: "4 h" },
];
export const MONTHS = [
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
];
const R2 = rng(42);
export const BESTS = MONTHS.map(function (mo, i) {
  const f = 0.9 + 0.1 * Math.min(1, i / 10) + (R2() - 0.5) * 0.02;
  const f25 = 0.88 + 0.09 * Math.min(1, i / 10) + (R2() - 0.5) * 0.02;
  return {
    x: i,
    m: mo,
    p300: Math.round(mmp(300, 2026) * f),
    p1200: Math.round(mmp(1200, 2026) * f),
    p3600: Math.round(mmp(3600, 2026) * f),
    p300_25: Math.round(mmp(300, 2025) * f25),
    p1200_25: Math.round(mmp(1200, 2025) * f25),
    p3600_25: Math.round(mmp(3600, 2025) * f25),
  };
});
export const GOALS: Goal[] = [
  {
    id: "soplao",
    name: "Soplao BTT",
    date: Date.UTC(2027, 4, 22),
    kind: "BTT · ~120 km · ~2.900 m+",
    ctl: 80,
    long: 5.5 * 3600,
    tone: "speed",
  },
  {
    id: "cantabrona",
    name: "La Cantabrona 2027",
    date: Date.UTC(2027, 5, 12),
    kind: "Marcha de carretera · ~210 km · ~4.000 m+",
    ctl: 90,
    long: 6.5 * 3600,
    tone: "z4",
  },
];
/* ---------- Streams de actividad ---------- */
const STREAM_CACHE: Record<string, ActivityDetail> = {};
function planFor(a: DemoActivity, r: () => number) {
  const segs: Segment[] = [];
  const add = function (
    d: number,
    p: number,
    g: number,
    cad: number,
    label: string | null,
    kind = "other",
  ) {
    segs.push({
      d: d,
      p: p,
      g: g,
      cad: cad,
      label: label,
      kind: kind || "other",
    });
  };
  if (a.type === "intervals") {
    const s = a.spec!;
    add(900, 165, 0.005, 88, "Calentamiento", "warm");
    for (let i = 0; i < s.n; i++) {
      add(
        s.work,
        Math.round(s.p * (1 + (r() - 0.5) * 0.03)),
        0.01,
        s.cad,
        "Serie " + (i + 1),
        "work",
      );
      if (i < s.n - 1) add(s.rec, 135, 0, 85, "Recuperación", "rec");
    }
    const used = segs.reduce(function (x, y) {
      return x + y.d;
    }, 0);
    const rest = Math.max(600, a.dur - used - 600);
    add(rest, 175, 0.005, 87, "Resistencia", "other");
    add(600, 130, -0.005, 84, "Vuelta a la calma", "cool");
  } else if (a.type === "climb") {
    const cl = CLIMBS.filter(function (c) {
      return c.id === a.attempt!.climb;
    })[0];
    const climbT = a.attempt!.time;
    const rem = a.dur - climbT;
    const app = Math.round(rem * 0.45);
    for (let tt = 0; tt < app;) {
      const d = 600 + Math.round(r() * 600);
      add(
        Math.min(d, app - tt),
        180 + Math.round((r() - 0.5) * 40),
        (r() - 0.4) * 0.03,
        87,
        null,
      );
      tt += d;
    }
    add(
      climbT,
      a.attempt!.avgP,
      cl.grade / 100,
      a.attempt!.cad,
      cl.name,
      "climb",
    );
    add(
      Math.round((cl.km / 45) * 3600),
      25,
      -cl.grade / 100,
      0,
      "Descenso",
      "down",
    );
    const back =
      a.dur -
      segs.reduce(function (x, y) {
        return x + y.d;
      }, 0);
    for (let t2 = 0; t2 < back;) {
      const d2 = 600 + Math.round(r() * 600);
      add(
        Math.min(d2, back - t2),
        170 + Math.round((r() - 0.5) * 40),
        (r() - 0.55) * 0.03,
        86,
        null,
      );
      t2 += d2;
    }
  } else {
    const mtb = a.type === "mtb";
    const base = mtb ? 190 : 185;
    for (let t3 = 0; t3 < a.dur;) {
      const d3 = (mtb ? 240 : 480) + Math.round(r() * (mtb ? 420 : 720));
      const g = mtb ? (r() - 0.45) * 0.14 : (r() - 0.45) * 0.07;
      const p = g < -0.01 ? 30 : base + g * (mtb ? 1400 : 2200);
      add(
        Math.min(d3, a.dur - t3),
        Math.round(p),
        g,
        g < -0.01 ? 0 : mtb ? 72 : 86,
        null,
      );
      t3 += d3;
    }
  }
  return segs;
}
export function getStream(a: DemoActivity) {
  if (STREAM_CACHE[a.id]) return STREAM_CACHE[a.id];
  const r = rng(a.seed);
  const segs = planFor(a, r);
  const dt = 10;
  const rows: DemoSample[] = [];
  let hr = 98;
  let elev = a.type === "climb" ? 90 : 40;
  let dist = 0;
  let t = 0;
  const laps: Lap[] = [];
  segs.forEach(function (s) {
    const n = Math.max(1, Math.round(s.d / dt));
    const i0 = rows.length;
    for (let i = 0; i < n; i++) {
      const noise =
        (r() + r() + r() - 1.5) *
        (a.type === "mtb" ? 70 : s.kind === "work" ? 18 : 30);
      let p = s.p <= 40 ? (r() < 0.7 ? 0 : 40 * r()) : Math.max(0, s.p + noise);
      if (s.kind === "work" && i < 2) p = s.p * 1.1;
      const hrT = 88 + (p / ATH.ftp) * (ATH.lthr - 88) * 0.96 + (t / 3600) * 7;
      hr += (hrT - hr) * 0.09;
      hr = Math.min(hr, 192);
      let v =
        s.g > 0.02
          ? Math.min(12, p / (89 * 9.81 * (s.g + 0.006)))
          : s.g < -0.01
            ? 12 + r() * 2
            : Math.cbrt(Math.max(p, 40) / 0.3);
      if (a.type === "mtb") v *= 0.55;
      const cad = p < 15 ? 0 : Math.max(0, s.cad + (r() - 0.5) * 6);
      elev = Math.max(0, elev + v * dt * s.g);
      dist += v * dt;
      rows.push({
        x: t,
        p: Math.round(p),
        hr: Math.round(hr),
        cad: Math.round(cad),
        ps: 0,
        elev: Math.round(elev),
        v: Math.round(v * 36) / 10,
        km: dist / 1000,
      });
      t += dt;
    }
    if (s.label)
      laps.push({
        dur: 0,
        avgP: null,
        np: null,
        hr: null,
        cad: null,
        max: null,
        gain: null,
        dist: null,
        id: "l" + laps.length,
        label: s.label,
        kind: s.kind,
        i0: i0,
        i1: rows.length - 1,
      });
  });
  // Suavizado 30 s para mostrar potencia
  for (let i = 0; i < rows.length; i++) {
    const s0 = Math.max(0, i - 1);
    const s1 = Math.min(rows.length - 1, i + 1);
    let sum = 0;
    for (let j = s0; j <= s1; j++) sum += rows[j].p;
    rows[i].ps = Math.round(sum / (s1 - s0 + 1));
  }
  if (!laps.length) {
    const step = Math.round(rows.length / Math.max(2, Math.round(a.dist / 20)));
    for (let q = 0, li = 1; q < rows.length - 1; q += step, li++)
      laps.push({
        dur: 0,
        avgP: null,
        np: null,
        hr: null,
        cad: null,
        max: null,
        gain: null,
        dist: null,
        id: "l" + li,
        label: "Vuelta " + li + " · " + Math.round(rows[q].km) + " km",
        kind: "auto",
        i0: q,
        i1: Math.min(rows.length - 1, q + step - 1),
      });
  }
  laps.forEach(function (l) {
    Object.assign(l, stats(rows, l.i0, l.i1));
  });
  const map = buildMap(a, rows, laps);
  const out = {
    rows: rows,
    laps: laps,
    points: map.points,
    features: map.features,
    markers: map.markers,
    best: bestEfforts(rows),
  };
  STREAM_CACHE[a.id] = out;
  return out;
}
/* Mapa simulado: bucle con curvas de carretera, zetas en el puerto, relieve alrededor de la cima, costa, río y poblaciones (todo ilustrativo). */
const TOWNS = [
  "Cabezón de la Sal",
  "Torrelavega",
  "Puente Viesgo",
  "Liérganes",
  "Ramales",
  "Ontaneda",
  "Solares",
  "Potes",
];
const VILLAGES = [
  "Ruente",
  "Barcenillas",
  "Sopeña",
  "Selaya",
  "Villacarriedo",
  "Riaño",
  "Bárcena",
  "La Molina",
  "Valle",
  "Cos",
  "Viaña",
  "Saro",
  "Carmona",
  "Terán",
];
function buildMap(a: DemoActivity, rows: DemoSample[], laps: Lap[]) {
  const r = rng(a.seed + 77);
  const N = rows.length;
  const D = Math.max(1, rows[N - 1].km * 1000);
  const mtb = a.type === "mtb";
  const ph = [r() * 6.28, r() * 6.28, r() * 6.28, r() * 6.28];
  const amp = [
    0.25 + r() * 0.15,
    0.12 + r() * 0.1,
    0.06 + r() * 0.06,
    0.03 + r() * 0.03,
  ];
  const climb = laps.filter(function (l) {
    return l.kind === "climb";
  })[0];
  const base: [number, number][] = [];
  const C = [0];
  for (let b = 0; b <= 1200; b++) {
    const th = (b / 1200) * Math.PI * 2;
    const rad =
      1 +
      amp[0] * Math.cos(th + ph[0]) +
      amp[1] * Math.cos(2 * th + ph[1]) +
      amp[2] * Math.cos(3 * th + ph[2]) +
      amp[3] * Math.cos(5 * th + ph[3]);
    base.push([
      Math.cos(th) * rad * (1 + 0.25 * Math.sin(th * 2 + ph[2])),
      Math.sin(th) * rad * 0.72,
    ]);
    if (b)
      C.push(
        C[b - 1] +
          Math.hypot(base[b][0] - base[b - 1][0], base[b][1] - base[b - 1][1]),
      );
  }
  const Lb = C[1200];
  const unit = D / Lb;
  let seg = 0;
  const c0 = climb
    ? climb.i0 + Math.round((climb.i1 - climb.i0) * 0.45)
    : Infinity;
  let pts: [number, number][] = rows.map(function (row, i): [number, number] {
    const m = row.km * 1000;
    const target = (m / D) * Lb;
    while (seg < 1199 && C[seg + 1] < target) seg++;
    const f = (target - C[seg]) / (C[seg + 1] - C[seg] || 1);
    const A = base[seg];
    const B = base[seg + 1];
    const tx = B[0] - A[0];
    const ty = B[1] - A[1];
    const tl = Math.hypot(tx, ty) || 1;
    // Curvas de carretera (m) y zetas en la mitad alta del puerto (±70 m cada 450 m)
    let off = mtb
      ? Math.sin(m / 420 + ph[3]) * 140 + Math.sin(m / 170) * 35
      : Math.sin(m / 900 + ph[0]) * 220 + Math.sin(m / 320 + ph[1]) * 70;
    if (climb && i >= c0 && i <= climb.i1) {
      const ph2 = (m / 450) % 2;
      off += ((ph2 < 1 ? ph2 : 2 - ph2) - 0.5) * 140;
    }
    return [
      A[0] + tx * f - ((ty / tl) * off) / unit,
      A[1] + ty * f + ((tx / tl) * off) / unit,
    ];
  });
  function length() {
    let L = 0;
    for (let j = 1; j < N; j++)
      L += Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]);
    return L;
  }
  const k = D / (length() || 1);
  pts = pts.map(function (q) {
    return [q[0] * k, q[1] * k];
  });
  let minx = Infinity;
  let maxx = -Infinity;
  let miny = Infinity;
  let maxy = -Infinity;
  pts.forEach(function (q) {
    minx = Math.min(minx, q[0]);
    maxx = Math.max(maxx, q[0]);
    miny = Math.min(miny, q[1]);
    maxy = Math.max(maxy, q[1]);
  });
  const span = Math.max(maxx - minx, maxy - miny);
  const feats: MapFeature[] = [];
  let top = 0;
  let minE = Infinity;
  rows.forEach(function (row, i) {
    if (row.elev > rows[top].elev) top = i;
    minE = Math.min(minE, row.elev);
  });
  const maxE = rows[top].elev;
  const step = maxE - minE > 600 ? 100 : 50;
  const sum = pts[top];
  function ring(cx0: number, cy0: number, R: number, seed: number) {
    const o: [number, number][] = [];
    for (let t = 0; t <= 48; t++) {
      const f = (t / 48) * Math.PI * 2;
      const w =
        1 +
        0.2 * Math.sin(2 * f + seed) +
        0.1 * Math.sin(3 * f + seed * 2) +
        0.05 * Math.sin(5 * f + seed * 3);
      o.push([
        cx0 + Math.cos(f) * R * w * 1.25,
        cy0 + Math.sin(f) * R * w * 0.8,
      ]);
    }
    return o;
  }
  const levels: number[] = [];
  for (let lv = Math.ceil((minE + 1) / step) * step; lv <= maxE; lv += step)
    levels.push(lv);
  levels.slice(-14).forEach(function (lv) {
    const tt = (maxE - lv) / (maxE - minE + 1);
    feats.push({
      type: lv % (step * 5) === 0 ? "contour-major" : "contour",
      closed: true,
      points: ring(sum[0], sum[1], (0.05 + tt * 0.75) * span, ph[2] + tt),
    });
  });
  const hx = minx + (maxx - minx) * (r() < 0.5 ? 0.15 : 0.85);
  const hy = miny + (maxy - miny) * (r() < 0.5 ? 0.2 : 0.8);
  for (let q2 = 0; q2 < 4; q2++)
    feats.push({
      type: "contour",
      closed: true,
      points: ring(hx, hy, (0.04 + q2 * 0.07) * span, ph[3] + q2),
    });
  const coastY = maxy + span * (a.type === "climb" ? 0.45 : 0.12);
  const coast: [number, number][] = [];
  for (let cxp = minx - span; cxp <= maxx + span; cxp += span / 20)
    coast.push([
      cxp,
      coastY +
        Math.sin((cxp / span) * 9 + ph[0]) * span * 0.025 +
        Math.sin((cxp / span) * 23) * span * 0.01,
    ]);
  feats.unshift(
    {
      type: "sea",
      closed: true,
      points: coast.concat([
        [maxx + span, coastY + span * 3],
        [minx - span, coastY + span * 3],
      ]),
    },
    { type: "coast", points: coast },
  );
  const river: [number, number][] = [];
  let rx = pts[0][0] + span * 0.06;
  let ry = pts[0][1] - span * 0.4;
  for (; ry < coastY + span * 0.02; ry += span / 30) {
    river.push([rx, ry]);
    rx += Math.sin((ry / span) * 11 + ph[1]) * span * 0.025;
  }
  feats.push(
    {
      type: "road",
      points: river.map(function (q) {
        return [q[0] + span * 0.03, q[1]];
      }),
    },
    { type: "water", points: river },
  );
  for (let rd = 0; rd < 2; rd++) {
    const ang = ph[rd] + rd * 2.4;
    const road: [number, number][] = [];
    for (let d = 0; d <= 1; d += 0.1)
      road.push([
        pts[0][0] +
          Math.cos(ang) * d * span * 1.2 +
          Math.sin(d * 7 + rd) * span * 0.02,
        pts[0][1] + Math.sin(ang) * d * span * 1.2,
      ]);
    feats.push({ type: "road", points: road });
  }
  if (mtb)
    for (let tk = 0; tk < 3; tk++) {
      const ti = Math.floor(r() * N);
      const tr0 = pts[ti];
      const tr: [number, number][] = [];
      for (let d2 = 0; d2 <= 1; d2 += 0.2)
        tr.push([
          tr0[0] + (d2 * 0.25 + Math.sin(d2 * 5) * 0.03) * span * (tk - 1),
          tr0[1] + d2 * 0.2 * span,
        ]);
      feats.push({ type: "track", points: tr });
    }
  const every = D > 60000 ? 20 : D > 25000 ? 10 : 5;
  const markers = [];
  for (let km = every, ri = 0; km < D / 1000 - every / 3; km += every) {
    while (ri < N - 1 && rows[ri].km < km) ri++;
    markers.push({ index: ri, label: String(km) });
  }
  const mx = (minx + maxx) / 2;
  const my = (miny + maxy) / 2;
  function outward(
    q: [number, number],
    d: number,
  ): {
    at: [number, number];
    anchor: "start" | "end";
  } {
    const dx = q[0] - mx;
    const dy = q[1] - my;
    const l = Math.hypot(dx, dy) || 1;
    return {
      at: [q[0] + (dx / l) * d, q[1] + (dy / l) * d],
      anchor: dx < 0 ? "end" : "start",
    };
  }
  feats.push(
    Object.assign(
      {
        type: "label" as const,
        label: TOWNS[a.seed % TOWNS.length],
        major: true,
      },
      outward(pts[0], span * 0.015),
    ),
  );
  for (let v = 0; v < 3; v++) {
    let vi = Math.floor(((v + 0.62) / 3) * N * 0.9);
    if (
      markers.some(function (mk0) {
        return Math.abs(mk0.index - vi) < N * 0.04;
      })
    )
      vi = Math.min(N - 1, vi + Math.round(N * 0.07));
    const vp = pts[Math.min(N - 1, vi)];
    feats.push(
      Object.assign(
        {
          type: "label" as const,
          label: VILLAGES[(a.seed + v * 5) % VILLAGES.length],
        },
        outward(vp, span * 0.06),
      ),
    );
  }
  if (climb)
    feats.push(
      Object.assign(
        {
          type: "peak" as const,
          label: climb.label + " · " + int(maxE) + " m",
        },
        outward(sum, span * 0.02),
        { at: sum },
      ),
    );
  return { points: pts, features: feats, markers: markers };
}
export function stats(rows: DemoSample[], i0: number, i1: number) {
  const n = i1 - i0 + 1;
  let sp = 0;
  let sh = 0;
  let sc = 0;
  let cn = 0;
  let p4 = 0;
  let mx = 0;
  let gain = 0;
  for (let i = i0; i <= i1; i++) {
    const r0 = rows[i];
    sp += r0.p;
    sh += r0.hr;
    if (r0.cad) {
      sc += r0.cad;
      cn++;
    }
    p4 += Math.pow(r0.ps, 4);
    if (r0.p > mx) mx = r0.p;
    if (i > i0 && r0.elev > rows[i - 1].elev)
      gain += r0.elev - rows[i - 1].elev;
  }
  return {
    dur: n * 10,
    avgP: Math.round(sp / n),
    np: Math.round(Math.pow(p4 / n, 0.25)),
    hr: Math.round(sh / n),
    cad: cn ? Math.round(sc / cn) : 0,
    max: mx,
    gain: Math.round(gain),
    dist: rows[i1].km - rows[i0].km,
  };
}
export function bestEfforts(rows: DemoSample[]) {
  const pre = [0];
  rows.forEach(function (r0, i) {
    pre.push(pre[i] + r0.p);
  });
  return [
    { t: 60, l: "1 min" },
    { t: 300, l: "5 min" },
    { t: 600, l: "10 min" },
    { t: 1200, l: "20 min" },
    { t: 3600, l: "60 min" },
  ].map(function (d) {
    const n = d.t / 10;
    let best = 0;
    let at = 0;
    if (n > rows.length) return Object.assign({ p: null }, d);
    for (let i = n; i < pre.length; i++) {
      const v = (pre[i] - pre[i - n]) / n;
      if (v > best) {
        best = v;
        at = i - n;
      }
    }
    return Object.assign(
      { p: Math.round(best), i0: at, i1: at + n - 1, season: mmp(d.t, 2026) },
      d,
    );
  });
}
export function zoneDist(
  rows: DemoSample[],
  key: "p" | "hr",
  zones: Zone[],
  ref: number,
) {
  const out = zones.map(function (z, i) {
    return { label: z.l, name: z.n, value: 0, color: "z" + (i + 1) };
  });
  rows.forEach(function (r0) {
    const f = r0[key] / ref;
    for (let i = 0; i < zones.length; i++)
      if (f < zones[i].hi) {
        out[i].value += 10;
        break;
      }
  });
  return out;
}
/* ---------- Formato ---------- */
export const DF = new Intl.DateTimeFormat("es-ES", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
export const DFL = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
export const DFS = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
export const DFY = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
export function fDate(t: number) {
  return DF.format(t).replace(".", "");
}
export function fDur(s: number) {
  s = Math.round(s);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return hh
    ? hh + ":" + String(mm).padStart(2, "0") + ":" + String(ss).padStart(2, "0")
    : mm + ":" + String(ss).padStart(2, "0");
}
export function fHM(s: number) {
  const hh = Math.floor(s / 3600);
  const mm = Math.round((s % 3600) / 60);
  return hh ? hh + " h " + String(mm).padStart(2, "0") : mm + " min";
}
export function fClock(s: number) {
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  return hh + ":" + String(mm).padStart(2, "0");
}
export function n1(v: number) {
  return (Math.round(v * 10) / 10).toLocaleString("es-ES", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}
export function n2(v: number) {
  return v.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
export function int(v: number) {
  return Math.round(v).toLocaleString("es-ES");
}
export function wkg(p: number) {
  return n2(p / ATH.weight);
}
export function fSec(t: number) {
  return t < 60
    ? t + " s"
    : t < 3600
      ? Math.round(t / 60) + " min"
      : n1(t / 3600).replace(",0", "") + " h";
}
export function pct(a: number, b: number) {
  return Math.round((a / b - 1) * 1000) / 10;
}
export function climbOf(id: string) {
  return CLIMBS.filter(function (c) {
    return c.id === id;
  })[0];
}
export function actOf(id: string) {
  return ACTS.filter(function (a) {
    return a.id === id;
  })[0];
}
export const POWER_BANDS = PZ.slice(0, 6).map(function (z, i) {
  return { from: z.lo * ATH.ftp, to: z.hi * ATH.ftp, color: "z" + (i + 1) };
});
