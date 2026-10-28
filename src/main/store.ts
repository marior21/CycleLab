import { withProfileEntries } from "../domain/athlete";
import { sampleCoverage } from "../domain/coverage";
import type { SampleCoverage } from "../shared/models";
import { classifyActivity } from "../domain/classification";
import Database from "better-sqlite3";
import { automaticBackup, schemaVersion } from "./backup";
import type {
  Activity,
  ActivityDetail,
  ChatMessage,
  Settings,
  Source,
  Segment,
  SegmentResults,
  SyncState,
} from "../shared/models";
import { demoDataset, DemoGarminSource } from "../data/demo/provider";
import { realDataset } from "../domain/analysis";
export class Store {
  readonly db: Database.Database;
  private coverageCache = new Map<string, SampleCoverage>();
  constructor(path: string) {
    this.db = new Database(path);
    const version = this.db.pragma("user_version", { simple: true }) as number;
    if (version > schemaVersion)
      throw new Error(
        "Esta base de datos requiere una versión más reciente de CycleLab.",
      );
    if (version > 0 && version < schemaVersion)
      automaticBackup(this.db, `antes-de-migrar-v${version}`);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.transaction(() => {
      this.db.exec(
        `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS activities (source TEXT NOT NULL, id TEXT NOT NULL, date REAL NOT NULL, summary TEXT NOT NULL, detail TEXT, best TEXT, PRIMARY KEY(source,id)); CREATE TABLE IF NOT EXISTS messages (source TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(source,id)); CREATE TABLE IF NOT EXISTS secrets (provider TEXT PRIMARY KEY, value BLOB NOT NULL); CREATE TABLE IF NOT EXISTS segments (source TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(source,id)); CREATE TABLE IF NOT EXISTS segment_results (source TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(source,id)); PRAGMA user_version = 5;`,
      );
      if (version === 1)
        this.db.exec(
          "ALTER TABLE activities ADD COLUMN best TEXT; UPDATE activities SET best=json_extract(detail,'$.best');",
        );
    })();
    this.recover();
  }
  recover() {
    this.coverageCache.clear();
    this.db
      .prepare(
        "UPDATE messages SET payload=json_set(payload,'$.status','error','$.text','La respuesta se interrumpió al cerrar CycleLab. Puedes volver a enviar la pregunta.') WHERE json_extract(payload,'$.status')='running'",
      )
      .run();
    if (this.get("classificationVersion", 0) < 2) this.reclassifyActivities();
    const old = this.get<SyncState | null>("sync", null);
    if (old?.state === "syncing")
      this.set("sync", {
        ...old,
        state: "offline",
        phase: "Importación interrumpida; se reanudará al sincronizar.",
      });
  }
  reclassifyActivities(): number {
    return this.db.transaction(() => {
      const rows = this.db
        .prepare(
          "SELECT summary, json_extract(detail,'$.laps') AS laps FROM activities WHERE source='garmin'",
        )
        .all() as { summary: string; laps: string | null }[];
      for (const row of rows)
        this.upsert(
          "garmin",
          classifyActivity(
            JSON.parse(row.summary) as Activity,
            row.laps ? { laps: JSON.parse(row.laps) } : undefined,
          ),
        );
      this.set("classificationVersion", 2);
      return rows.length;
    })();
  }
  get<T>(key: string, fallback: T): T {
    const row = this.db
      .prepare("SELECT value FROM settings WHERE key=?")
      .get(key) as { value: string } | undefined;
    return row ? (JSON.parse(row.value) as T) : fallback;
  }
  set(key: string, value: unknown) {
    this.db
      .prepare(
        "INSERT INTO settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      )
      .run(key, JSON.stringify(value));
  }
  settings(): Settings {
    const saved = this.get<Settings>("settings", {
      theme: "dark" as const,
      source: "demo" as Source,
      model: null,
      athlete: { ftp: null, lthr: null, weight: null },
      garminConfigured: false,
      openrouterConfigured: false,
      maptilerConfigured: false,
    });
    return {
      ...saved,
      athlete: withProfileEntries(saved.athlete, []),
      garminConfigured: this.hasSecret("garmin"),
      openrouterConfigured: this.hasSecret("openrouter"),
      maptilerConfigured: this.hasSecret("maptiler"),
    };
  }
  hasSecret(provider: string) {
    return !!this.db
      .prepare("SELECT 1 FROM secrets WHERE provider=?")
      .get(provider);
  }
  secret(provider: string): Buffer | null {
    return (
      (
        this.db
          .prepare("SELECT value FROM secrets WHERE provider=?")
          .get(provider) as { value: Buffer } | undefined
      )?.value ?? null
    );
  }
  saveSecret(provider: string, value: Buffer) {
    this.db
      .prepare(
        "INSERT INTO secrets VALUES (?,?) ON CONFLICT(provider) DO UPDATE SET value=excluded.value",
      )
      .run(provider, value);
  }
  deleteSecret(provider: string) {
    this.db.prepare("DELETE FROM secrets WHERE provider=?").run(provider);
  }
  upsert(source: Source, a: Activity) {
    this.db
      .prepare(
        "INSERT INTO activities(source,id,date,summary) VALUES (?,?,?,?) ON CONFLICT(source,id) DO UPDATE SET date=excluded.date,summary=excluded.summary",
      )
      .run(source, a.id, a.date, JSON.stringify(a));
    this.set(
      `activityRevision:${source}`,
      this.get(`activityRevision:${source}`, 0) + 1,
    );
  }
  activities(source: Source) {
    return (
      this.db
        .prepare(
          "SELECT summary FROM activities WHERE source=? ORDER BY date DESC",
        )
        .all(source) as { summary: string }[]
    ).map((r) => JSON.parse(r.summary) as Activity);
  }
  detail(source: Source, id: string): ActivityDetail | null {
    const r = this.db
      .prepare("SELECT detail FROM activities WHERE source=? AND id=?")
      .get(source, id) as { detail: string | null } | undefined;
    return r?.detail ? (JSON.parse(r.detail) as ActivityDetail) : null;
  }
  saveDetail(source: Source, id: string, detail: ActivityDetail) {
    this.coverageCache.delete(`${source}:${id}`);
    this.db
      .prepare("UPDATE activities SET detail=?,best=? WHERE source=? AND id=?")
      .run(JSON.stringify(detail), JSON.stringify(detail.best), source, id);
    this.set(
      `activityRevision:${source}`,
      this.get(`activityRevision:${source}`, 0) + 1,
    );
  }
  async seed() {
    if (this.get("demoSeeded", false)) return;
    const provider = new DemoGarminSource();
    const details = await Promise.all(
      demoDataset.activities.map((a) => provider.getActivity(a.id)),
    );
    this.db.transaction(() => {
      demoDataset.activities.forEach((a, i) => {
        this.upsert("demo", a);
        this.saveDetail("demo", a.id, details[i]);
      });
      this.set("demoSeeded", true);
    })();
  }
  dataset(source: Source) {
    const activities = this.activities(source);
    const coverage = Object.fromEntries(
      activities.map((a) => {
        const key = `${source}:${a.id}`;
        let value = this.coverageCache.get(key);
        if (!value) {
          value = sampleCoverage(this.detail(source, a.id));
          this.coverageCache.set(key, value);
        }
        return [a.id, value];
      }),
    );
    if (source === "demo" && activities.length)
      return { ...demoDataset, activities, sampleCoverage: coverage };
    const data = realDataset(
      activities,
      (
        this.db
          .prepare(
            "SELECT best FROM activities WHERE source='garmin' ORDER BY date DESC",
          )
          .all() as { best: string | null }[]
      ).map((r) => ({
        rows: [],
        laps: [],
        points: [],
        features: [],
        markers: [],
        best: r.best ? JSON.parse(r.best) : [],
      })),
      this.settings().athlete,
    );
    return { ...data, sampleCoverage: coverage };
  }
  segment(source: Source, id: string): Segment | null {
    const row = this.db
      .prepare("SELECT payload FROM segments WHERE source=? AND id=?")
      .get(source, id) as { payload: string } | undefined;
    return row ? (JSON.parse(row.payload) as Segment) : null;
  }
  segmentResults(source: Source, id: string): SegmentResults | null {
    const row = this.db
      .prepare("SELECT payload FROM segment_results WHERE source=? AND id=?")
      .get(source, id) as { payload: string } | undefined;
    return row ? (JSON.parse(row.payload) as SegmentResults) : null;
  }
  saveSegmentResults(source: Source, id: string, result: SegmentResults) {
    this.db
      .prepare(
        "INSERT INTO segment_results VALUES (?,?,?) ON CONFLICT(source,id) DO UPDATE SET payload=excluded.payload",
      )
      .run(source, id, JSON.stringify(result));
  }
  segments(source: Source): Segment[] {
    return (
      this.db
        .prepare(
          "SELECT payload FROM segments WHERE source=? ORDER BY rowid DESC",
        )
        .all(source) as { payload: string }[]
    ).map((r) => JSON.parse(r.payload) as Segment);
  }
  saveSegment(source: Source, segment: Segment) {
    this.db
      .prepare("INSERT INTO segments VALUES (?,?,?)")
      .run(source, segment.id, JSON.stringify(segment));
  }
  setSegmentClimb(source: Source, id: string, isClimb: boolean) {
    const result = this.db
      .prepare(
        "UPDATE segments SET payload=json_set(payload,'$.isClimb',json(?)) WHERE source=? AND id=?",
      )
      .run(JSON.stringify(isClimb), source, id);
    if (!result.changes) throw new Error("El segmento ya no está disponible.");
  }
  deleteSegment(source: Source, id: string) {
    this.db.transaction(() => {
      this.db
        .prepare("DELETE FROM segments WHERE source=? AND id=?")
        .run(source, id);
      this.db
        .prepare("DELETE FROM segment_results WHERE source=? AND id=?")
        .run(source, id);
    })();
  }
  messages(source: Source) {
    return (
      this.db
        .prepare(
          "SELECT payload FROM messages WHERE source=? ORDER BY json_extract(payload,'$.createdAt'), rowid",
        )
        .all(source) as { payload: string }[]
    ).map((r) => JSON.parse(r.payload) as ChatMessage);
  }
  message(source: Source, message: ChatMessage) {
    this.db
      .prepare(
        "INSERT INTO messages VALUES (?,?,?) ON CONFLICT(source,id) DO UPDATE SET payload=excluded.payload",
      )
      .run(source, message.id, JSON.stringify(message));
  }
  close() {
    this.db.close();
  }
}
