import { it, expect } from "vitest";
import {
  Encoder,
  Profile,
  type FileIdMesg,
  type RecordMesg,
  type LapMesg,
} from "@garmin/fitsdk";
import { zipSync } from "fflate";
import { decodeFit } from "../../src/main/garmin";
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
