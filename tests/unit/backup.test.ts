import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateBackup } from "../../src/main/backup";
const data = {
  settings: [],
  activities: [],
  messages: [],
  conversations: [],
  segments: [],
  segment_results: [],
};
function archive(tables: unknown = data, patch = {}) {
  const text = JSON.stringify(tables);
  return JSON.stringify({
    format: "CycleLab backup",
    version: 1,
    schemaVersion: 4,
    createdAt: new Date().toISOString(),
    sha256: createHash("sha256").update(text).digest("hex"),
    data: text,
    ...patch,
  });
}
describe("backup validation", () => {
  it("accepts current and previous supported schemas", () => {
    expect(validateBackup(archive())).toEqual(data);
    expect(
      validateBackup(
        archive(
          { settings: [], activities: [], messages: [] },
          { schemaVersion: 1 },
        ),
      ),
    ).toEqual(data);
  });
  it("accepts legacy connection flags so pre-migration snapshots remain recoverable", () => {
    const tables = {
      ...data,
      settings: [
        {
          key: "settings",
          value: JSON.stringify({
            theme: "dark",
            source: "garmin",
            model: null,
            athlete: { ftp: 280, weight: null, lthr: null },
            garminConfigured: true,
            openrouterConfigured: false,
            maptilerConfigured: false,
          }),
        },
      ],
    };
    expect(validateBackup(archive(tables))).toEqual(tables);
  });
  it.each([
    "truncated",
    archive(data, { version: 2 }),
    archive(data, { schemaVersion: 7 }),
    archive(data, { sha256: "damaged" }),
    archive({ ...data, secrets: [] }),
    archive({
      ...data,
      settings: [{ key: "settings", value: '{"theme":"invalid"}' }],
    }),
    archive({
      ...data,
      messages: [{ source: "demo", id: "a", payload: "{}" }],
    }),
    archive({ ...data, settings: [{ key: "unknown", value: "null" }] }),
    archive({
      ...data,
      activities: [
        {
          source: "demo",
          id: "a",
          date: 0,
          summary: "{}",
          detail: null,
          best: null,
        },
      ],
    }),
  ])("rejects damaged, invalid or incompatible archives", (text) => {
    expect(() => validateBackup(text)).toThrow(/dañada o es incompatible/);
  });
});
