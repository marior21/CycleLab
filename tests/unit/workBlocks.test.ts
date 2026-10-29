import { describe, expect, it } from "vitest";
import {
  blockPattern,
  detectWorkBlocks,
  savedBlocks,
} from "../../src/domain/workBlocks";
import type { Sample } from "../../src/shared/models";

const FTP = 250;
/** 1 Hz ride from [seconds, watts] steps with deterministic ±12 % noise. */
function ride(steps: [number, number][]) {
  let seed = 7;
  const noise = () => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return (seed / 2 ** 31 - 0.5) * 0.24;
  };
  const rows: Sample[] = [];
  let x = 0;
  for (const [seconds, watts] of steps)
    for (let s = 0; s < seconds; s++, x++) {
      const p = Math.round(watts * (1 + noise()));
      rows.push({
        x,
        km: x * 0.008,
        p,
        ps: p,
        hr: 120 + watts / 5,
        cad: 90,
        elev: null,
        v: 29,
      });
    }
  return rows;
}
const repeat = (n: number, ...steps: [number, number][]) =>
  Array.from({ length: n }, () => steps).flat();
const warm: [number, number] = [600, 150];
const durations = (rows: Sample[]) =>
  detectWorkBlocks(rows, FTP).map((b) => b.dur);

describe("work blocks", () => {
  it("finds 4×4 min with its pattern", () => {
    const rows = ride([warm, ...repeat(4, [240, 275], [240, 125]), warm]);
    const blocks = detectWorkBlocks(rows, FTP);
    expect(blocks).toHaveLength(4);
    for (const b of blocks) {
      expect(b.dur).toBeGreaterThan(225);
      expect(b.dur).toBeLessThan(255);
      expect(b.avgP).toBeGreaterThan(260);
    }
    expect(blockPattern(rows, blocks)).toMatchObject({ repetitions: 4 });
  });
  it("finds every 30/30 repetition", () => {
    const d = durations(
      ride([warm, ...repeat(10, [30, 330], [30, 125]), warm]),
    );
    expect(d).toHaveLength(10);
    for (const s of d) expect(Math.abs(s - 30)).toBeLessThan(10);
  });
  it("finds 3×20 min sweet spot", () => {
    const rows = ride([warm, ...repeat(3, [1200, 230], [300, 130]), warm]);
    const blocks = detectWorkBlocks(rows, FTP);
    expect(blocks.map((b) => Math.round(b.dur / 60))).toEqual([20, 20, 20]);
    expect(blockPattern(rows, blocks)).toMatchObject({ repetitions: 3 });
  });
  it("keeps over-unders as one block each", () => {
    const set = repeat(5, [120, 262], [60, 237]);
    const d = durations(
      ride([warm, ...set, [300, 125], ...set, [300, 125], ...set, warm]),
    );
    expect(d).toHaveLength(3);
    for (const s of d) expect(Math.abs(s - 900)).toBeLessThan(20);
  });
  it("proposes nothing for endurance, tempo or sprints", () => {
    expect(durations(ride([[7200, 175]]))).toEqual([]);
    expect(durations(ride([warm, [3600, 200], warm]))).toEqual([]);
    expect(
      durations(ride([warm, ...repeat(6, [10, 700], [290, 160]), warm])),
    ).toEqual([]);
  });
  it("ignores isolated surges but keeps a short series", () => {
    // Hilly ride: 40 s surges every 3 min are terrain, not a session.
    const hilly = ride([warm, ...repeat(10, [40, 320], [140, 170]), warm]);
    expect(durations(hilly)).toEqual([]);
    // Four 30/30 are not yet a series; five are.
    expect(
      durations(ride([warm, ...repeat(4, [30, 330], [30, 125]), warm])),
    ).toEqual([]);
    expect(
      durations(ride([warm, ...repeat(5, [30, 330], [30, 125]), warm])),
    ).toHaveLength(5);
  });
  it("does not split an effort on a short dip", () => {
    const rows = ride([warm, [150, 275], [8, 120], [150, 275], warm]);
    const d = durations(rows);
    expect(d).toHaveLength(1);
    expect(Math.abs(d[0] - 308)).toBeLessThan(15);
  });
  it("reports a single climb without claiming a pattern", () => {
    const rows = ride([
      [1800, 170],
      [1200, 240],
      [1800, 170],
    ]);
    const blocks = detectWorkBlocks(rows, FTP);
    expect(blocks).toHaveLength(1);
    expect(blockPattern(rows, blocks)).toBeUndefined();
  });
  it("needs an FTP and never spans a pause", () => {
    const rows = ride([warm, ...repeat(4, [240, 275], [240, 125]), warm]);
    expect(detectWorkBlocks(rows, null)).toEqual([]);
    // 60 s without samples in the middle of the second repetition.
    const paused = rows.filter((r) => r.x < 1200 || r.x >= 1260);
    const blocks = detectWorkBlocks(paused, FTP);
    expect(blocks).toHaveLength(5);
    for (const b of blocks) expect(b.x0 >= 1260 || b.x1 < 1200).toBe(true);
  });
  it("maps saved ranges onto the samples in order", () => {
    const rows = ride([[600, 150]]);
    const blocks = savedBlocks(rows, [
      [300, 400],
      [10.5, 60],
      [590, 900],
      [700, 800],
    ]);
    expect(blocks.map((b) => [b.x0, b.x1])).toEqual([
      [11, 60],
      [300, 400],
      [590, 599],
    ]);
  });
});
