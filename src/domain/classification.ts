import { detectIntervalPattern } from "./intervalPattern";
import type {
  Activity,
  ActivityDetail,
  ActivityFeel,
  ActivityType,
} from "../shared/models";

const normalized = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function classifyActivity(
  a: Activity,
  detail?: Pick<ActivityDetail, "laps">,
): Activity {
  const name = normalized(a.name),
    sport = normalized(
      a.garminType ?? (a.type === "mtb" ? "mountain_biking" : ""),
    );
  const laps = detail?.laps ?? [];
  const work = laps.filter(
    (l) => l.kind === "active" && l.dur >= 30 && l.dur <= 1800,
  );
  const recovery = laps.some((l) =>
    ["rest", "recovery", "rec"].includes(l.kind),
  );
  const structured = detail
    ? work.length >= 2 && recovery
    : a.structuredIntervals === true;
  const pattern = detail ? detectIntervalPattern(laps) : a.intervalPattern;
  const result = (
    type: ActivityType,
    reason: string,
    estimated = false,
  ): Activity => ({
    ...a,
    type,
    structuredIntervals: structured,
    intervalPattern: pattern,
    classification: { reason, estimated },
  });
  if (structured)
    return result(
      "intervals",
      "Vueltas FIT: al menos dos bloques activos y recuperación.",
    );
  if (pattern)
    return result(
      "intervals",
      `Patrón de potencia: ${pattern.repetitions} bloques de ${Math.floor(pattern.workSeconds / 60)}:${String(pattern.workSeconds % 60).padStart(2, "0")} a ≈${pattern.workWatts} W, con recuperaciones a ≈${pattern.recoveryWatts} W. Clasificación inferida de vueltas repetidas.`,
      true,
    );
  if (
    /\b(intervalos?|intervals?|series|repeticiones|sweet spot|vo2\s?max)\b|\b\d+\s*[x×]\s*\d+/.test(
      name,
    )
  )
    return result(
      "intervals",
      "El nombre de la actividad indica trabajo por intervalos.",
      true,
    );
  if (/mountain|enduro|downhill/.test(sport) || /\b(btt|mtb)\b/.test(name))
    return result(
      "mtb",
      /mountain|enduro|downhill/.test(sport)
        ? "Tipo de actividad de Garmin: " + sport
        : "BTT indicada en el nombre.",
      !/mountain|enduro|downhill/.test(sport),
    );
  if (
    /indoor|virtual|spin/.test(sport) ||
    /\b(rodillo|indoor|zwift|trainerroad|spinning)\b/.test(name)
  )
    return result(
      "indoor",
      /indoor|virtual|spin/.test(sport)
        ? "Tipo de actividad de Garmin: " + sport
        : "Ciclismo indoor indicado en el nombre.",
      !/indoor|virtual|spin/.test(sport),
    );
  if (sport.includes("gravel") || /\bgravel\b/.test(name))
    return result(
      "gravel",
      sport.includes("gravel")
        ? "Tipo de actividad de Garmin: " + sport
        : "Gravel indicado en el nombre.",
      !sport.includes("gravel"),
    );
  if (/\b(ascension|subida|climbing|hill repeats)\b/.test(name))
    return result(
      "climb",
      "El nombre de la actividad indica una ascensión.",
      true,
    );
  if (
    a.dist !== null &&
    a.dist >= 10 &&
    a.elev !== null &&
    a.elev >= 600 &&
    a.elev / a.dist >= 25
  )
    return result(
      "climb",
      "Estimación: al menos 600 m de desnivel y 25 m de ascenso por km. No identifica un puerto.",
      true,
    );
  if (/\b(resistencia|endurance|fondo|rodaje|base|z2|zona 2)\b/.test(name))
    return result(
      "endurance",
      "El nombre de la actividad indica resistencia.",
      true,
    );
  if (
    a.dur >= 2700 &&
    a.IF !== null &&
    a.IF >= 0.55 &&
    a.IF <= 0.8 &&
    a.avgP !== null &&
    a.avgP > 0 &&
    a.np !== null &&
    a.np / a.avgP <= 1.12
  )
    return result(
      "endurance",
      "Estimación: ≥45 min, IF entre 0,55 y 0,80 y potencia estable (NP/media ≤1,12).",
      true,
    );
  return result(
    "cycling",
    "No hay información suficiente para determinar el objetivo del entrenamiento.",
  );
}

export function weeklyActivityTotals(activities: Activity[]) {
  const totals: Record<ActivityType, number> = {
    endurance: 0,
    intervals: 0,
    climb: 0,
    mtb: 0,
    indoor: 0,
    gravel: 0,
    cycling: 0,
  };
  for (const a of activities) totals[a.type] += a.tss ?? 0;
  return {
    ...totals,
    total: activities.reduce((n, a) => n + (a.tss ?? 0), 0),
    hours: activities.reduce((n, a) => n + a.dur / 3600, 0),
    complete: activities.every((a) => a.tss !== null),
  };
}
// A manual label replaces the type but keeps the automatic one and its reason.
export function withFeel(a: Activity, feel?: ActivityFeel): Activity {
  if (!feel) return a;
  return feel.type
    ? { ...a, feel, type: feel.type, automaticType: a.type }
    : { ...a, feel };
}
