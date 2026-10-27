import type { Activity, Lap } from "../shared/models";
type Pattern = NonNullable<Activity["intervalPattern"]>;
export function detectIntervalPattern(
  laps: Pick<Lap, "dur" | "avgP">[],
): Pattern | undefined {
  let best: Pattern | undefined;
  const valid = (l: (typeof laps)[number] | undefined) =>
    !!l &&
    Number.isFinite(l.dur) &&
    l.dur > 0 &&
    l.avgP !== null &&
    Number.isFinite(l.avgP) &&
    l.avgP >= 0;
  for (let start = 0; start < laps.length; start++) {
    const first = laps[start];
    if (!valid(first) || first.dur < 60 || first.dur > 1200 || !first.avgP)
      continue;
    const work = [first],
      rest: typeof laps = [];
    for (let i = start + 1; i + 1 < laps.length; i += 2) {
      const recovery = laps[i],
        next = laps[i + 1],
        previous = work[work.length - 1];
      if (
        !valid(recovery) ||
        !valid(next) ||
        next.dur < 60 ||
        next.dur > 1200 ||
        Math.abs(next.dur / first.dur - 1) > 0.2 ||
        Math.abs(next.avgP! / first.avgP - 1) > 0.12 ||
        recovery.dur < 20 ||
        recovery.dur > Math.min(600, previous.dur * 2) ||
        recovery.avgP! > Math.min(previous.avgP!, next.avgP!) * 0.6
      )
        break;
      rest.push(recovery);
      work.push(next);
    }
    // Repetition is evidence of structure, not proof of training intent.
    if (work.length >= 3 && (!best || work.length > best.repetitions))
      best = {
        repetitions: work.length,
        workSeconds: Math.round(
          work.reduce((n, l) => n + l.dur, 0) / work.length,
        ),
        workWatts: Math.round(
          work.reduce((n, l) => n + l.avgP!, 0) / work.length,
        ),
        recoveryWatts: Math.round(
          rest.reduce((n, l) => n + l.avgP!, 0) / rest.length,
        ),
      };
  }
  return best;
}
