import type { Athlete, ProfileEntry } from "../shared/models";

export const profileMetrics = ["ftp", "weight", "lthr"] as const;
export const utcDay = (date = Date.now()) =>
  new Date(date).toISOString().slice(0, 10);

export function profileAt(athlete: Athlete, date: number): Athlete {
  const day = utcDay(date);
  const result: Athlete = { ftp: null, weight: null, lthr: null };
  for (const metric of profileMetrics) {
    const entry = athlete.history
      ?.filter((e) => e.metric === metric && e.date <= day)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    result[metric] = entry?.value ?? null;
  }
  return result;
}

export function withProfileEntries(
  athlete: Athlete,
  entries: ProfileEntry[],
): Athlete {
  const history = [
    ...(athlete.history ?? []).filter(
      (old) =>
        !entries.some((e) => e.metric === old.metric && e.date === old.date),
    ),
    ...entries,
  ].sort(
    (a, b) => a.date.localeCompare(b.date) || a.metric.localeCompare(b.metric),
  );
  const current = profileAt({ ...athlete, history }, Date.now());
  // Legacy values without a date remain current references only, never historical ones.
  for (const metric of profileMetrics)
    if (!history.some((e) => e.metric === metric))
      current[metric] = athlete[metric];
  return { ...current, history };
}

export function profileNote(athlete: Athlete, date: number) {
  const ref = profileAt(athlete, date);
  return profileMetrics
    .map((metric) => {
      const entry = athlete.history
        ?.filter((e) => e.metric === metric && e.date <= utcDay(date))
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      const label = metric === "weight" ? "Peso" : metric.toUpperCase();
      return ref[metric] === null
        ? `${label}: sin referencia histórica`
        : `${label}: ${ref[metric]!.toLocaleString("es-ES")} ${metric === "ftp" ? "W" : metric === "weight" ? "kg" : "ppm"} (desde ${entry!.date}, ${entry!.origin})`;
    })
    .join(" · ");
}
