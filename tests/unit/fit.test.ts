import { it, expect } from "vitest";
import {
  Encoder,
  Profile,
  type FileIdMesg,
  type RecordMesg,
  type LapMesg,
} from "@garmin/fitsdk";
import { zipSync } from "fflate";
import { decodeFit, fitActivity } from "../../src/main/garmin";
import type { SessionMesg } from "@garmin/fitsdk";
it("decodes an actual zipped FIT, preserves absent channels and aligns partial GPS", () => {
  const encoder = new Encoder(),
    start = new Date("2026-10-01T09:00:00Z");
  encoder.onMesg(Profile.MesgNum.FILE_ID, {
    manufacturer: "development",
    product: 1,
    timeCreated: start,
    type: "activity",
  } as FileIdMesg);
  for (let i = 0; i < 65; i++)
    encoder.onMesg(Profile.MesgNum.RECORD, {
      timestamp: new Date(+start + i * 1000),
      distance: i * 10,
      power: 200,
      ...(i % 2
        ? {}
        : {
            positionLat: Math.round((43 * 2 ** 31) / 180),
            positionLong: Math.round(((-4 + i * 0.001) * 2 ** 31) / 180),
          }),
    } as RecordMesg);
  encoder.onMesg(Profile.MesgNum.LAP, {
    startTime: start,
    timestamp: new Date(+start + 64000),
    totalElapsedTime: 64,
    totalTimerTime: 64,
  } as LapMesg);
  const result = decodeFit(zipSync({ "activity.fit": encoder.close() }));
  expect(result.rows).toHaveLength(65);
  expect(result.rows[0].p).toBe(200);
  expect(result.rows[0].hr).toBeNull();
  expect(result.rows[64].km).toBe(0.64);
  expect(result.pointIndices?.slice(0, 3)).toEqual([0, 2, 4]);
  expect(result.laps).toHaveLength(1);
  expect(result.best.find((b) => b.t === 60)?.p).toBe(200);
});

function ride(session: Partial<SessionMesg> = {}) {
  const encoder = new Encoder(),
    start = new Date("2026-10-02T07:30:00Z");
  encoder.onMesg(Profile.MesgNum.FILE_ID, {
    manufacturer: "development",
    serialNumber: 4242,
    timeCreated: start,
    type: "activity",
  } as FileIdMesg);
  for (let i = 0; i < 120; i++)
    encoder.onMesg(Profile.MesgNum.RECORD, {
      timestamp: new Date(+start + i * 1000),
      distance: i * 8,
      power: 250,
      heartRate: 150,
    } as RecordMesg);
  encoder.onMesg(Profile.MesgNum.SESSION, {
    startTime: start,
    timestamp: new Date(+start + 119000),
    sport: "cycling",
    subSport: "gravelCycling",
    trainingStressScore: 12.5,
    ...session,
  } as SessionMesg);
  return encoder.close();
}
it("turns a local FIT into a traceable activity with a stable identity", () => {
  const { activity, detail } = fitActivity(ride(), "Salida gravel.fit");
  expect(activity).toMatchObject({
    id: `fit-${Date.parse("2026-10-02T07:30:00Z") / 1000}-4242`,
    name: "Salida gravel",
    date: Date.parse("2026-10-02T07:30:00Z"),
    type: "gravel",
    device: "development",
    avgP: 250,
    hr: 150,
    tss: 12.5,
    IF: null,
    detailStatus: "ready",
    provenance: { kind: "fit", file: "Salida gravel.fit" },
  });
  expect(activity.dist).toBeCloseTo(0.952, 3);
  expect(detail.rows).toHaveLength(120);
  expect(fitActivity(ride(), "copia.fit").activity.id).toBe(activity.id);
  expect(() => fitActivity(ride({ sport: "running" }), "x.fit")).toThrow(
    "No es una actividad de ciclismo.",
  );
  expect(() => fitActivity(new Uint8Array([1, 2, 3]), "x.fit")).toThrow(
    "No es un archivo FIT válido.",
  );
});
