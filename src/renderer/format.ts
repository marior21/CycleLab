export const number = (v: number | null | undefined, digits = 0) =>
  v == null || !Number.isFinite(v)
    ? "–"
    : new Intl.NumberFormat("es-ES", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(v);
export const duration = (v: number | null | undefined) => {
  if (v == null) return "–";
  const s = Math.round(v);
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
export const effort = (s: number) =>
  s < 60
    ? `${s} s`
    : s < 3600
      ? `${number(s / 60)} min`
      : `${number(s / 3600, s % 3600 ? 1 : 0)} h`;
export const shortDuration = (s: number) =>
  s >= 3600
    ? `${Math.floor(s / 3600)} h ${String(Math.round((s % 3600) / 60)).padStart(2, "0")}`
    : `${Math.round(s / 60)} min`;
export const date = (v: number, long = false, weekday = false) =>
  new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: long ? "long" : "short",
    ...(long ? { year: "numeric" as const, weekday: "long" as const } : {}),
    ...(weekday ? { weekday: "short" as const } : {}),
    timeZone: "UTC",
  })
    .format(v)
    .replaceAll(".", "");
export const clock = (s: number) =>
  `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`;
export const FATIGUE = {
  fresh: "Fresco",
  normal: "Normal",
  tired: "Cansado",
} as const;
export const TYPES = {
  endurance: { label: "Resistencia", tone: "z2" },
  intervals: { label: "Intervalos", tone: "z5" },
  climb: { label: "Ascensión", tone: "z4" },
  mtb: { label: "BTT", tone: "speed" },
  indoor: { label: "Indoor", tone: "cadence" },
  gravel: { label: "Gravel", tone: "elevation" },
  cycling: { label: "Ciclismo", tone: "muted" },
};
