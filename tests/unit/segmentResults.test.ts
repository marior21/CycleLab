import { expect, it, vi } from "vitest";
import { SegmentResults } from "../../src/main/segmentResults";
import type { Store } from "../../src/main/store";
import type { SegmentResults as Report, Sample } from "../../src/shared/models";
import { createSegment } from "../../src/domain/segments";

it("coalesces requests, retains original results without GPS and resumes an interrupted search", async () => {
  const rows: Sample[] = [0, 1].map((i) => ({
    x: i * 10,
    km: i,
    elev: null,
    p: null,
    ps: null,
    hr: null,
    cad: null,
    v: null,
  }));
  const segment = createSegment("id", "a", "Test", rows, 0, 1);
  let saved: Report | null = null;
  const detail = vi.fn(() => ({ rows }));
  const store = {
    segment: () => segment,
    segmentResults: () => saved,
    get: () => 1,
    activities: () => [{ id: "a", name: "a", date: 1 }],
    detail,
    saveSegmentResults: (_s: string, _id: string, r: Report) => {
      saved = structuredClone(r);
    },
  } as unknown as Store;
  const service = new SegmentResults(store, () => {});
  service.get("garmin", "id");
  service.get("garmin", "id");
  await vi.waitFor(() => expect(saved?.status).toBe("done"));
  expect(detail).toHaveBeenCalledTimes(1);
  expect(saved!.attempts[0]).toMatchObject({
    original: true,
    dur: 10,
    avgP: null,
  });
  expect(saved!.note).toContain("GPS");
  saved!.status = "running";
  new SegmentResults(store, () => {}).get("garmin", "id");
  await vi.waitFor(() => expect(saved?.status).toBe("done"));
  expect(detail).toHaveBeenCalledTimes(2);
});

it("keeps cached results after a failed rescan and permits retry", async () => {
  const rows: Sample[] = [0, 1].map((i) => ({
    x: i * 10,
    km: i,
    elev: null,
    p: null,
    ps: null,
    hr: null,
    cad: null,
    v: null,
  }));
  const segment = createSegment("id", "a", "Test", rows, 0, 1);
  let saved: Report | null = null;
  const detail = vi.fn(() => ({ rows }));
  const store = {
    segment: () => segment,
    segmentResults: () => saved,
    get: () => 1,
    activities: () => [{ id: "a", name: "a", date: 1 }],
    detail,
    saveSegmentResults: (_s: string, _id: string, r: Report) => {
      saved = structuredClone(r);
    },
  } as unknown as Store;
  const service = new SegmentResults(store, () => {});
  service.get("garmin", "id");
  await vi.waitFor(() => expect(saved?.status).toBe("done"));
  detail.mockImplementationOnce(() => {
    throw new Error("Read failed");
  });
  service.get("garmin", "id", true);
  await vi.waitFor(() => expect(saved?.status).toBe("error"));
  expect(saved!.attempts).toHaveLength(1);
  service.get("garmin", "id", true);
  await vi.waitFor(() => expect(saved?.status).toBe("done"));
});
