import type Database from "better-sqlite3";
import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
import { settingsSchema } from "../shared/settings";

export const schemaVersion = 5;
const source = z.enum(["demo", "garmin"]),
  num = z.number(),
  nullable = num.nullable();
const stats = z.object({
  dur: num,
  avgP: nullable,
  np: nullable,
  hr: nullable,
  cad: nullable,
  max: nullable,
  gain: nullable,
  dist: nullable,
});
const effort = z.object({
  t: num,
  l: z.string(),
  p: nullable,
  i0: num.optional(),
  i1: num.optional(),
  season: nullable.optional(),
});
const sample = z.object({
  x: num,
  km: nullable,
  p: nullable,
  ps: nullable,
  hr: nullable,
  cad: nullable,
  elev: nullable,
  v: nullable,
  lat: nullable.optional(),
  lon: nullable.optional(),
});
const point = z.tuple([num, num]);
const detail = z.object({
  rows: z.array(sample),
  laps: z.array(
    stats.extend({
      id: z.string(),
      label: z.string(),
      kind: z.string(),
      i0: num,
      i1: num,
    }),
  ),
  points: z.array(point),
  pointIndices: z.array(num).optional(),
  features: z.array(
    z.object({
      type: z.enum([
        "sea",
        "coast",
        "water",
        "road",
        "track",
        "contour",
        "contour-major",
        "label",
        "peak",
      ]),
      points: z.array(point).optional(),
      at: point.optional(),
      label: z.string().optional(),
    }),
  ),
  markers: z.array(z.object({ index: num, label: z.string() })),
  best: z.array(effort),
});
const activity = z.object({
  id: z.string(),
  name: z.string(),
  date: num,
  type: z.enum([
    "endurance",
    "intervals",
    "climb",
    "mtb",
    "indoor",
    "gravel",
    "cycling",
  ]),
  device: z.string(),
  dur: num,
  dist: nullable,
  elev: nullable,
  np: nullable,
  avgP: nullable,
  hr: nullable,
  cad: nullable,
  kj: nullable,
  tss: nullable,
  IF: nullable,
  classification: z
    .object({ reason: z.string(), estimated: z.boolean() })
    .optional(),
  intervalPattern: z
    .object({
      repetitions: num,
      workSeconds: num,
      workWatts: num,
      recoveryWatts: num,
    })
    .optional(),
});
const segment = stats.extend({
  id: z.string(),
  name: z.string(),
  activityId: z.string(),
  i0: num.int().nonnegative(),
  i1: num.int().nonnegative(),
  start: num,
  end: num,
  isClimb: z.boolean().optional(),
});
const result = z.object({
  status: z.enum(["running", "done", "error"]),
  revision: num,
  scanned: num,
  total: num,
  skipped: num,
  attempts: z.array(
    stats.extend({
      id: z.string(),
      activityId: z.string(),
      activityName: z.string(),
      date: num,
      i0: num,
      i1: num,
      original: z.boolean(),
    }),
  ),
  note: z.string().optional(),
  error: z.string().optional(),
});
const message = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  text: z.string(),
  status: z.enum(["running", "done", "error"]),
  createdAt: num,
  model: z.string().optional(),
  tools: z.array(
    z.object({
      tool: z.enum([
        "buscar_actividades",
        "analizar_intervalos",
        "comparar_ascensiones",
        "curva_potencia",
        "carga_entrenamiento",
      ]),
      args: z.string(),
      title: z.string(),
      kind: z.enum(["table", "line", "bar"]),
      rows: z.array(z.record(z.string(), z.union([num, z.string(), z.null()]))),
      series: z.array(
        z.object({
          key: z.string(),
          label: z.string(),
          color: z.string(),
          dash: z.boolean().optional(),
          axis: z.enum(["left", "right"]).optional(),
        }),
      ),
      columns: z
        .array(z.object({ key: z.string(), label: z.string() }))
        .optional(),
      note: z.string().optional(),
    }),
  ),
});
// Validate JSON without stripping fields added by the domain or old versions.
const json = (schema: z.ZodType) =>
  z.string().superRefine((text, ctx) => {
    try {
      if (schema.safeParse(JSON.parse(text)).success) return;
    } catch {
      /* Invalid JSON is reported below. */
    }
    ctx.addIssue({
      code: "custom",
      message: "Contenido de la copia no válido.",
    });
  });
const sync = z.object({
  state: z.enum(["synced", "syncing", "offline", "error"]),
  phase: z.string(),
  completed: num,
  total: nullable,
  lastSync: nullable,
  error: z.string().optional(),
});
const settingSchemas: Record<string, z.ZodType> = {
  // Older Garmin syncs persisted connection flags; they contain no credentials.
  settings: settingsSchema.extend({
    garminConfigured: z.boolean().optional(),
    openrouterConfigured: z.boolean().optional(),
    maptilerConfigured: z.boolean().optional(),
  }),
  sync,
  demoSync: sync,
  garminOffset: num.int().nonnegative(),
  demoSeeded: z.boolean(),
  classificationVersion: num.int().nonnegative(),
  "activityRevision:demo": num.int().nonnegative(),
  "activityRevision:garmin": num.int().nonnegative(),
};
const tablesSchema = z
  .object({
    settings: z.array(
      z
        .object({ key: z.string(), value: z.string() })
        .strict()
        .superRefine((row, ctx) => {
          if (
            !settingSchemas[row.key] ||
            !json(settingSchemas[row.key]).safeParse(row.value).success
          )
            ctx.addIssue({ code: "custom", message: "Ajuste no válido." });
        }),
    ),
    activities: z.array(
      z
        .object({
          source,
          id: z.string(),
          date: num,
          summary: json(activity),
          detail: json(detail).nullable(),
          best: json(z.array(effort)).nullable().default(null),
        })
        .strict(),
    ),
    messages: z.array(
      z.object({ source, id: z.string(), payload: json(message) }).strict(),
    ),
    segments: z
      .array(
        z.object({ source, id: z.string(), payload: json(segment) }).strict(),
      )
      .default([]),
    segment_results: z
      .array(
        z.object({ source, id: z.string(), payload: json(result) }).strict(),
      )
      .default([]),
  })
  .strict();
const envelope = z
  .object({
    format: z.literal("CycleLab backup"),
    version: z.literal(1),
    schemaVersion: z.number().int().min(1).max(schemaVersion),
    createdAt: z.string().datetime(),
    sha256: z.string(),
    data: z.string(),
  })
  .strict();
const tables = [
  "settings",
  "activities",
  "messages",
  "segments",
  "segment_results",
] as const;
const checksum = (data: string) =>
  createHash("sha256").update(data).digest("hex");

function* snapshot(db: Database.Database): Generator<string> {
  yield "{";
  for (const [index, table] of tables.entries()) {
    yield (index ? "," : "") + JSON.stringify(table) + ":[";
    const exists = db
      .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")
      .get(table);
    let first = true;
    if (exists) {
      for (const row of db
        .prepare(`SELECT * FROM ${table} ORDER BY rowid`)
        .iterate()) {
        if (
          table === "settings" &&
          !Object.hasOwn(settingSchemas, (row as { key: string }).key)
        )
          continue;
        yield (first ? "" : ",") + JSON.stringify(row);
        first = false;
      }
    }
    yield "]";
  }
  yield "}";
}
export function validateBackup(text: string) {
  try {
    const backup = envelope.parse(JSON.parse(text));
    if (checksum(backup.data) !== backup.sha256) throw new Error("checksum");
    const data = tablesSchema.parse(JSON.parse(backup.data));
    for (const table of ["activities", "messages", "segments"] as const)
      for (const row of data[table]) {
        const payload = JSON.parse(
          "summary" in row ? row.summary : row.payload,
        );
        if (payload.id !== row.id) throw new Error("id");
      }
    for (const row of data.segments) {
      const saved = JSON.parse(row.payload);
      const origin = data.activities.find(
        (a) => a.source === row.source && a.id === saved.activityId,
      );
      if (
        !origin?.detail ||
        saved.i1 <= saved.i0 ||
        saved.i1 >= JSON.parse(origin.detail).rows.length
      )
        throw new Error("segment");
    }
    return data;
  } catch {
    throw new Error(
      "La copia está dañada o es incompatible con esta versión de CycleLab. Tus datos no se han sustituido.",
    );
  }
}
export function writeBackup(path: string, db: Database.Database) {
  const temporary = path + "." + randomUUID() + ".tmp";
  try {
    const fd = openSync(temporary, "wx", 0o600);
    try {
      db.transaction(() => {
        const metadata = JSON.stringify({
          format: "CycleLab backup",
          version: 1,
          schemaVersion: db.pragma("user_version", { simple: true }),
          createdAt: new Date().toISOString(),
        });
        const hash = createHash("sha256");
        writeFileSync(fd, metadata.slice(0, -1) + ',"data":"');
        // Escape each record independently; never materialize the entire archive in V8.
        for (const chunk of snapshot(db)) {
          hash.update(chunk);
          writeFileSync(fd, JSON.stringify(chunk).slice(1, -1));
        }
        writeFileSync(fd, '","sha256":"' + hash.digest("hex") + '"}');
        fsyncSync(fd);
      })();
    } finally {
      closeSync(fd);
    }
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
}
export function automaticBackup(db: Database.Database, reason: string): string {
  const dir = join(dirname(db.name), "backups");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const path = join(
    dir,
    `${reason}-${Date.now()}-${randomUUID()}.cyclelab-backup.json`,
  );
  writeBackup(path, db);
  return path;
}
export function restoreBackup(
  db: Database.Database,
  path: string,
  recover: () => void,
): string {
  const data = validateBackup(readFileSync(path, "utf8"));
  const previous = automaticBackup(db, "antes-de-restaurar");
  db.transaction(() => {
    for (const table of tables) {
      db.prepare(`DELETE FROM ${table}`).run();
      const rows = data[table];
      if (!rows.length) continue;
      const columns = Object.keys(rows[0]);
      const insert = db.prepare(
        `INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
      );
      for (const row of rows) insert.run(...Object.values(row));
    }
    db.exec(
      "UPDATE activities SET best=json_extract(detail,'$.best') WHERE best IS NULL AND detail IS NOT NULL",
    );
    recover();
  })();
  return previous;
}
