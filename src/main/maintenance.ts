import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import type { MaintenanceInfo, Source } from "../shared/models";
import type { Store } from "./store";

export function maintenance(store: Store): MaintenanceInfo {
  const size = (path: string) => (existsSync(path) ? statSync(path).size : 0);
  const backups = join(dirname(store.db.name), "backups");
  return {
    databaseBytes: ["", "-wal", "-shm"].reduce(
      (n, suffix) => n + size(store.db.name + suffix),
      0,
    ),
    backupBytes: existsSync(backups)
      ? readdirSync(backups, { withFileTypes: true })
          .filter((e) => e.isFile())
          .reduce((n, e) => n + size(join(backups, e.name)), 0)
      : 0,
    sources: (["demo", "garmin"] as const).map((source) => {
      const count = (table: string, condition = "") =>
        (
          store.db
            .prepare(
              `SELECT count(*) AS n FROM ${table} WHERE source=? ${condition}`,
            )
            .get(source) as { n: number }
        ).n;
      const status = (value: string) =>
        count(
          "activities",
          `AND coalesce(json_extract(summary,'$.detailStatus'), CASE WHEN detail IS NULL THEN 'pending' WHEN json_array_length(detail,'$.rows') > 0 THEN 'ready' ELSE 'unavailable' END)='${value}'`,
        );
      return {
        source,
        activities: count("activities"),
        ready: status("ready"),
        pending: status("pending"),
        failed: status("error"),
        unavailable: status("unavailable"),
        messages: count("messages"),
        segments: count("segments"),
      };
    }),
  };
}

export function deleteLocal(
  store: Store,
  source: Source,
  scope: "messages" | "all",
) {
  store.db.transaction(() => {
    for (const table of scope === "messages"
      ? ["messages", "conversations"]
      : [
          "messages",
          "conversations",
          "segment_results",
          "segments",
          "activities",
        ])
      store.db.prepare(`DELETE FROM ${table} WHERE source=?`).run(source);
    if (scope === "all") {
      store.set(
        `activityRevision:${source}`,
        store.get(`activityRevision:${source}`, 0) + 1,
      );
      if (source === "garmin") {
        store.set("garminOffset", 0);
        store.set("garminAutoSync", false);
        store.set("settings", {
          ...store.settings(),
          athlete: { ftp: null, weight: null, lthr: null },
        });
      }
      store.set(source === "demo" ? "demoSync" : "sync", {
        state: "offline",
        phase: "Datos locales borrados",
        completed: 0,
        total: null,
        lastSync: null,
      });
    }
  })();
  store.recover();
}

// Allowlist only: never serialize settings, messages, activities, paths or errors.
export function diagnostic(store: Store, version: string) {
  return {
    format: "cyclelab-diagnostic",
    version: 1,
    appVersion: version,
    platform: process.platform,
    arch: process.arch,
    schemaVersion: store.db.pragma("user_version", { simple: true }),
    storage: maintenance(store),
  };
}
