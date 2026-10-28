import { describe, it, expect, vi } from "vitest";
import {
  GarminSync,
  GarminPersonalSource,
  normalizeActivity,
  emptyDetail,
} from "../../src/main/garmin";
import { HttpError } from "../../src/main/http";
import type { Store } from "../../src/main/store";
import type {
  Activity,
  ActivityDetail,
  SyncState,
} from "../../src/shared/models";
function fixture() {
  const config = new Map<string, unknown>(),
    activities = new Map<string, Activity>(),
    details = new Map<string, ActivityDetail>();
  const store = {
    get: (k: string, f: unknown) => config.get(k) ?? f,
    set: (k: string, v: unknown) => config.set(k, v),
    db: { transaction: (fn: () => void) => fn },
    activities: () => [...activities.values()],
    upsert: (_s: string, a: Activity) => activities.set(a.id, a),
    saveDetail: (_s: string, id: string, d: ActivityDetail) =>
      details.set(id, d),
    settings: () => ({ athlete: { ftp: 275, lthr: 182, weight: 80 } }),
  } as unknown as Store;
  const a = (id: number) =>
    normalizeActivity({
      activityId: id,
      activityName: "Ride",
      startTimeGMT: "2026-01-01 10:00:00",
      duration: 300,
      distance: 1000,
    });
  return { store, config, activities, details, a };
}
describe("resumable Garmin import", () => {
  it("preserves inferred interval evidence when summaries are refreshed", async () => {
    const f = fixture();
    const pattern = {
      repetitions: 4,
      workSeconds: 242,
      workWatts: 312,
      recoveryWatts: 42,
    };
    f.activities.set("1", {
      ...f.a(1),
      type: "intervals",
      intervalPattern: pattern,
      detailStatus: "ready",
    });
    const source = {
      listActivities: vi
        .fn()
        .mockResolvedValueOnce([f.a(1)])
        .mockResolvedValueOnce([]),
      getActivity: vi.fn(),
    } as unknown as GarminPersonalSource;
    await new GarminSync(f.store, source, () => {}).run();
    expect(f.activities.get("1")).toMatchObject({
      type: "intervals",
      intervalPattern: pattern,
    });
    expect(source.getActivity).not.toHaveBeenCalled();
  });
  it("imports every year across pages without a season cutoff", async () => {
    const f = fixture();
    const rows = [2012, 2019, 2026].map((year, i) => ({
      ...f.a(i + 1),
      date: Date.UTC(year, 0, 1),
    }));
    const list = vi
      .fn()
      .mockResolvedValueOnce([rows[0]])
      .mockResolvedValueOnce([rows[1]])
      .mockResolvedValueOnce([rows[2]])
      .mockResolvedValueOnce([]);
    const source = {
      listActivities: list,
      getActivity: vi.fn().mockResolvedValue(emptyDetail()),
    } as unknown as GarminPersonalSource;
    await new GarminSync(f.store, source, () => {}).run();
    expect(
      [...f.activities.values()].map((a) => new Date(a.date).getUTCFullYear()),
    ).toEqual([2012, 2019, 2026]);
    expect(list.mock.calls.map((c) => c[0])).toEqual([0, 1, 2, 3]);
  });
  it("persists completed pages, resumes at the saved offset and never duplicates summaries", async () => {
    const f = fixture();
    const list = vi
      .fn()
      .mockResolvedValueOnce([f.a(1), f.a(2)])
      .mockRejectedValueOnce(new HttpError(429, 120000))
      .mockResolvedValueOnce([f.a(3)])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([f.a(1), f.a(2), f.a(3)])
      .mockResolvedValueOnce([]);
    const get = vi.fn().mockResolvedValue(emptyDetail());
    const source = {
      listActivities: list,
      getActivity: get,
    } as unknown as GarminPersonalSource;
    const sync = new GarminSync(f.store, source, () => {});
    await sync.run();
    expect(f.config.get("garminOffset")).toBe(2);
    expect(f.activities.size).toBe(2);
    expect((f.config.get("sync") as SyncState).state).toBe("error");
    await sync.run();
    expect(list.mock.calls[2][0]).toBe(2);
    expect(f.activities.size).toBe(3);
    expect(get).toHaveBeenCalledTimes(3);
    expect(f.config.get("garminOffset")).toBe(0);
    await sync.run();
    expect(f.activities.size).toBe(3);
    expect(get).toHaveBeenCalledTimes(3);
    expect(f.details.size).toBe(3);
  });
  it("coalesces concurrent synchronization requests", async () => {
    const f = fixture();
    let release!: (a: Activity[]) => void;
    const list = vi
      .fn()
      .mockImplementation(() => new Promise<Activity[]>((r) => (release = r)));
    const sync = new GarminSync(
      f.store,
      { listActivities: list } as unknown as GarminPersonalSource,
      () => {},
    );
    const first = sync.run(),
      second = sync.run();
    expect(first).toBe(second);
    release([]);
    await first;
    expect(list).toHaveBeenCalledTimes(1);
  });
  it("preserves summaries and retries failed detail downloads", async () => {
    const f = fixture();
    const list = vi
      .fn()
      .mockResolvedValueOnce([f.a(1)])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([f.a(1)])
      .mockResolvedValueOnce([]);
    const get = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(emptyDetail());
    const sync = new GarminSync(
      f.store,
      {
        listActivities: list,
        getActivity: get,
      } as unknown as GarminPersonalSource,
      () => {},
    );
    await sync.run();
    expect(f.activities.get("1")?.detailStatus).toBe("error");
    await sync.run();
    expect(f.activities.get("1")?.detailStatus).toBe("unavailable");
    expect(get).toHaveBeenCalledTimes(2);
  });
});

it("retries only selected failed downloads without changing import progress", async () => {
  const f = fixture();
  f.config.set("garminOffset", 99);
  f.config.set("sync", { lastSync: 123 });
  f.activities.set("1", { ...f.a(1), detailStatus: "error" });
  f.activities.set("2", { ...f.a(2), detailStatus: "error" });
  f.activities.set("3", { ...f.a(3), detailStatus: "ready" });
  f.activities.set("4", { ...f.a(4), detailStatus: "pending" });
  const source = {
    listActivities: vi.fn(),
    getActivity: vi.fn().mockResolvedValue(emptyDetail()),
  } as unknown as GarminPersonalSource;
  await new GarminSync(f.store, source, () => {}).run(["1", "3", "4"]);
  expect(source.listActivities).not.toHaveBeenCalled();
  expect(source.getActivity).toHaveBeenCalledExactlyOnceWith("1");
  expect(f.activities.get("1")?.detailStatus).toBe("unavailable");
  expect(f.activities.get("2")?.detailStatus).toBe("error");
  expect(f.activities.get("3")?.detailStatus).toBe("ready");
  expect(f.activities.get("4")?.detailStatus).toBe("pending");
  expect(f.config.get("garminOffset")).toBe(99);
  expect(f.config.get("sync")).toMatchObject({ lastSync: 123, state: "error" });
  vi.mocked(source.getActivity).mockResolvedValue({
    ...emptyDetail(),
    rows: [
      { x: 0, p: 0, ps: 0, hr: null, cad: null, elev: null, km: null, v: null },
    ],
  });
  await new GarminSync(f.store, source, () => {}).run(["2"]);
  expect(f.activities.get("2")?.detailStatus).toBe("ready");
  expect(f.config.get("sync")).toMatchObject({
    lastSync: 123,
    state: "offline",
  });
  expect(f.config.get("garminOffset")).toBe(99);
});
