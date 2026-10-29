export type Source = "demo" | "garmin";
export type Screen =
  | "dashboard"
  | "activities"
  | "performance"
  | "segments"
  | "climbs"
  | "coach"
  | "settings";
export type ActivityType =
  "endurance" | "intervals" | "climb" | "mtb" | "indoor" | "gravel" | "cycling";
export interface ProfileEntry {
  date: string;
  metric: "ftp" | "weight" | "lthr";
  value: number | null;
  origin: "manual" | "Garmin" | "demostración";
}
export interface Athlete {
  history?: ProfileEntry[];
  ftp: number | null;
  lthr: number | null;
  weight: number | null;
}
export interface Activity {
  id: string;
  name: string;
  date: number;
  type: ActivityType;
  garminType?: string;
  structuredIntervals?: boolean;
  intervalPattern?: {
    repetitions: number;
    workSeconds: number;
    workWatts: number;
    recoveryWatts: number;
  };
  classification?: { reason: string; estimated: boolean };
  device: string;
  dur: number;
  dist: number | null;
  elev: number | null;
  np: number | null;
  avgP: number | null;
  hr: number | null;
  cad: number | null;
  kj: number | null;
  tss: number | null;
  IF: number | null;
  seed?: number;
  spec?: IntervalSpec;
  attempt?: Attempt;
  elevPerKm?: number;
  detailStatus?: "pending" | "ready" | "unavailable" | "error";
}
export interface IntervalSpec {
  name: string;
  n: number;
  work: number;
  rec: number;
  p: number;
  cad: number;
}
export interface Sample {
  x: number;
  km: number | null;
  p: number | null;
  ps: number | null;
  hr: number | null;
  cad: number | null;
  elev: number | null;
  v: number | null;
  lat?: number | null;
  lon?: number | null;
}
export interface Stats {
  dur: number;
  avgP: number | null;
  np: number | null;
  hr: number | null;
  cad: number | null;
  max: number | null;
  gain: number | null;
  dist: number | null;
}
export interface Lap extends Stats {
  id: string;
  label: string;
  kind: string;
  i0: number;
  i1: number;
}
export interface Effort {
  t: number;
  l: string;
  p: number | null;
  i0?: number;
  i1?: number;
  season?: number | null;
}
export interface MapFeature {
  type:
    | "sea"
    | "coast"
    | "water"
    | "road"
    | "track"
    | "contour"
    | "contour-major"
    | "label"
    | "peak";
  points?: [number, number][];
  closed?: boolean;
  at?: [number, number];
  label?: string;
  major?: boolean;
  anchor?: "start" | "end";
}
export interface ActivityDetail {
  pointIndices?: number[];
  rows: Sample[];
  laps: Lap[];
  points: [number, number][];
  features: MapFeature[];
  markers: { index: number; label: string }[];
  best: Effort[];
}
export interface Segment extends Stats {
  isClimb?: boolean;
  favorite?: boolean;
  /** Attempt id → reason. Lives on the segment so rescans keep it. */
  excluded?: Record<string, string>;
  id: string;
  name: string;
  activityId: string;
  i0: number;
  i1: number;
  start: number;
  end: number;
}
export interface SegmentAttempt extends Stats {
  id: string;
  activityId: string;
  activityName: string;
  date: number;
  i0: number;
  i1: number;
  original: boolean;
}
export interface SegmentResults {
  status: "running" | "done" | "error";
  revision: number;
  scanned: number;
  total: number;
  skipped: number;
  attempts: SegmentAttempt[];
  note?: string;
  error?: string;
}
export interface Climb {
  id: string;
  name: string;
  from: string;
  km: number;
  grade: number;
  gain: number;
}
export interface Attempt {
  id: string;
  climb: string;
  activityId?: string;
  date: number;
  avgP: number;
  time: number;
  hr: number;
  cad: number;
  seed: number;
}
export interface Goal {
  id: string;
  name: string;
  date: number;
  kind: string;
  ctl: number;
  long: number;
  tone: string;
}
export type ChartRow = Record<string, number | string | null>;
export interface SampleCoverage {
  samples: boolean;
  power: boolean;
  heart: boolean;
  gps: boolean;
}
export interface Dataset {
  sampleCoverage: Record<string, SampleCoverage>;
  today: number;
  athlete: Athlete;
  activities: Activity[];
  climbs: Climb[];
  attempts: Attempt[];
  goals: Goal[];
  load: ChartRow[];
  curve: ChartRow[];
  bests: ChartRow[];
  coverage: string;
}
export interface Settings {
  theme: "dark" | "light";
  source: Source;
  model: string | null;
  athlete: Athlete;
  garminConfigured: boolean;
  openrouterConfigured: boolean;
  maptilerConfigured: boolean;
}
export interface Model {
  id: string;
  name: string;
  context: number;
  promptPrice: number;
  completionPrice: number;
}
export interface SyncState {
  state: "synced" | "syncing" | "error" | "offline";
  phase: string;
  completed: number;
  total: number | null;
  lastSync: number | null;
  error?: string;
}
export type ToolName =
  | "buscar_actividades"
  | "analizar_intervalos"
  | "comparar_ascensiones"
  | "curva_potencia"
  | "carga_entrenamiento";
export interface ToolView {
  tool: ToolName;
  args: string;
  title: string;
  kind: "table" | "line" | "bar";
  rows: ChartRow[];
  series: {
    key: string;
    label: string;
    color: string;
    dash?: boolean;
    axis?: "left" | "right";
  }[];
  columns?: { key: string; label: string }[];
  xType?: "linear" | "log";
  note?: string;
}
export interface ChatMessage {
  context?: CoachContext;
  id: string;
  role: "user" | "assistant";
  text: string;
  status: "running" | "done" | "error";
  tools: ToolView[];
  model?: string;
  createdAt: number;
}
export interface CoachContext {
  screen: Screen;
  activityId?: string;
  ranges?: [number, number][];
  comparison?: [string, string];
  segmentId?: string;
}
export interface AppState {
  settings: Settings;
  segments: Segment[];
  ascents: { count: number; incomplete: boolean };
  dataset: Dataset;
  sync: SyncState;
  messages: ChatMessage[];
}
export type MapResource =
  | { kind: "json"; data: Record<string, unknown> }
  | { kind: "binary"; data: Uint8Array };
export interface MaintenanceInfo {
  databaseBytes: number;
  backupBytes: number;
  sources: {
    source: Source;
    activities: number;
    ready: number;
    pending: number;
    failed: number;
    unavailable: number;
    messages: number;
    segments: number;
  }[];
}
export interface CycleLabAPI {
  maintenance(): Promise<MaintenanceInfo>;
  stopSync(action: "pause" | "cancel"): Promise<void>;
  deleteLocal(source: Source, scope: "messages" | "all"): Promise<boolean>;
  exportDiagnostic(): Promise<string | null>;
  exportBackup(): Promise<string | null>;
  restoreBackup(): Promise<string | null>;
  mapResource(path: string): Promise<MapResource>;
  getState(): Promise<AppState>;
  getSegmentResults(
    source: Source,
    id: string,
    retry?: boolean,
  ): Promise<SegmentResults>;
  saveSegment(
    source: Source,
    activityId: string,
    name: string,
    i0: number,
    i1: number,
  ): Promise<Segment>;
  updateSegment(
    source: Source,
    id: string,
    changes: Partial<Pick<Segment, "name" | "isClimb" | "favorite">>,
  ): Promise<void>;
  setAttemptExcluded(
    source: Source,
    id: string,
    attemptId: string,
    reason: string | null,
  ): Promise<void>;
  deleteSegment(source: Source, id: string): Promise<void>;
  getActivity(source: Source, id: string): Promise<ActivityDetail>;
  saveSettings(
    settings: Pick<Settings, "theme" | "source" | "model" | "athlete">,
  ): Promise<AppState>;
  saveCredential(
    provider: "garmin" | "openrouter" | "maptiler",
    key: string,
  ): Promise<AppState>;
  disconnect(provider: "garmin" | "openrouter" | "maptiler"): Promise<AppState>;
  listModels(): Promise<Model[]>;
  sync(): Promise<void>;
  retryDownloads(ids: string[]): Promise<void>;
  reclassifyActivities(): Promise<number>;
  sendMessage(text: string, context: CoachContext): Promise<void>;
  onChange(callback: () => void): () => void;
}
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
