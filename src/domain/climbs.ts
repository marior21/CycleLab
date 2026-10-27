import type { Attempt, Climb } from "../shared/models";
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function demoClimbProfile(cl: Climb) {
  const r = rng(cl.gain),
    out = [];
  let elev = 0;
  for (let km = 0; km <= cl.km + 1e-6; km += 0.25) {
    const g = cl.grade + Math.sin(km * 1.1 + cl.gain) * 1.6 + (r() - 0.5) * 0.6;
    out.push({
      x: Math.round(km * 100) / 100,
      elev: Math.round(elev),
      g: Math.max(1, g),
    });
    elev += (Math.max(1, g) / 100) * 250;
  }
  const factor = cl.gain / elev;
  out.forEach((p) => (p.elev = Math.round(p.elev * factor)));
  return out;
}
export function demoPacing(
  attempt: Attempt,
  climb: Climb,
  profile: ReturnType<typeof demoClimbProfile>,
) {
  const r = rng(attempt.seed);
  return profile.map((p) =>
    Math.round(
      attempt.avgP * (1 + (p.g - climb.grade) * 0.025 + (r() - 0.5) * 0.025),
    ),
  );
}
