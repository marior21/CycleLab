import { profileMetrics } from "../../domain/athlete";
import { sampleCoverage } from "../../domain/coverage";
import type { GarminSource } from "../../domain/providers";
import { DURATIONS } from "../../domain/analysis";
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
  efforts: Object.fromEntries(ACTS.map((a, i) => [a.id, streams[i].best])),
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
    ...[...new Set([...KEY_DUR.map((d) => d.t), ...DURATIONS])]
      .filter((t) => !CURVE.some((r) => r.x === t))
      .map((t) => ({
        x: t,
        s2026: mmp(t, 2026),
        s2025: mmp(t, 2025),
        s2024: mmp(t, 2024),
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
