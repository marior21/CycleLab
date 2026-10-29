import { profileMetrics } from "../../domain/athlete";
import { sampleCoverage } from "../../domain/coverage";
import { WEEK_EFFORTS } from "../../domain/analysis";
import type { GarminSource } from "../../domain/providers";
import type { Dataset } from "../../shared/models";
import {
  ACTS,
  ATTEMPTS,
  ATH,
  BESTS,
  CLIMBS,
  CURVE,
  GOALS,
  LOAD,
  TODAY,
  getStream,
  KEY_DUR,
  mmp,
} from "./fixtures";
export class DemoGarminSource implements GarminSource {
  async listActivities(offset: number, limit: number) {
    return ACTS.slice(offset, offset + limit);
  }
  async getActivity(id: string) {
    const a = ACTS.find((a) => a.id === id);
    if (!a) throw new Error("Actividad no encontrada");
    return getStream(a);
  }
}
const streams = ACTS.map(getStream);
export const demoDataset: Dataset = {
  sampleCoverage: Object.fromEntries(
    ACTS.map((a, i) => [a.id, sampleCoverage(streams[i])]),
  ),
  efforts: Object.fromEntries(
    ACTS.map((a, i) => [
      a.id,
      streams[i].best.filter((e) => WEEK_EFFORTS.includes(e.t)),
    ]),
  ),
  today: TODAY,
  athlete: {
    ...ATH,
    history: profileMetrics.map((metric) => ({
      metric,
      value: ATH[metric],
      date: "2000-01-01",
      origin: "demostración",
    })),
  },
  activities: ACTS,
  attempts: ATTEMPTS,
  climbs: CLIMBS,
  curve: [
    ...CURVE,
    ...KEY_DUR.filter((d) => !CURVE.some((r) => r.x === d.t)).map((d) => ({
      x: d.t,
      s2026: mmp(d.t, 2026),
      s2025: mmp(d.t, 2025),
      s2024: mmp(d.t, 2024),
    })),
  ]
    .sort((a, b) => a.x - b.x)
    .map((r) => ({
      ...r,
      w2026: ATH.weight,
      w2025: ATH.weight,
      w2024: ATH.weight,
    })),
  bests: BESTS,
  goals: GOALS,
  load: LOAD,
  coverage: "Datos de demostración",
};
