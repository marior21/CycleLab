import { withProfileEntries } from "../domain/athlete";
import { MapTilerSource } from "./maptiler";
import { app, BrowserWindow, ipcMain, shell, dialog } from "electron";
import { join } from "node:path";
import { maintenance, deleteLocal, diagnostic } from "./maintenance";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { settingsSchema } from "../shared/settings";
import { writeBackup, restoreBackup } from "./backup";
import { createSegment } from "../domain/segments";
import { SegmentResults } from "./segmentResults";
import { Store } from "./store";
import { Credentials } from "./credentials";
import { GarminPersonalSource, GarminSync, emptyDetail } from "./garmin";
import {
  AnalysisTools,
  DemoCoachProvider,
  OpenRouterCoachProvider,
} from "./coach";
import type {
  ChatMessage,
  CoachContext,
  Result,
  Source,
  SyncState,
} from "../shared/models";
let win: BrowserWindow | null = null,
  store: Store;
let demoSyncCount = 0;
const busy = new Set<Source>();
let restoring = false;
const sourceSchema = z.enum(["demo", "garmin"]),
  providerSchema = z.enum(["garmin", "openrouter", "maptiler"]);
function changed() {
  if (win && !win.isDestroyed()) win.webContents.send("cyclelab:changed");
}
function state() {
  const settings = store.settings();
  return {
    settings,
    segments: store.segments(settings.source),
    dataset: store.dataset(settings.source),
    messages: store.messages(settings.source),
    sync:
      settings.source === "demo"
        ? store.get<SyncState>("demoSync", {
            state: "synced",
            phase: "Última: hoy 09:12",
            completed: 0,
            total: null,
            lastSync: null,
          })
        : store.get<SyncState>("sync", {
            state: "offline",
            phase: "Configura Garmin y sincroniza tus actividades.",
            completed: 0,
            total: null,
            lastSync: null,
          }),
  };
}
function register(name: string, fn: (...args: unknown[]) => unknown) {
  ipcMain.handle(
    "cyclelab:" + name,
    async (event, ...args): Promise<Result<unknown>> => {
      if (
        !win ||
        event.sender !== win.webContents ||
        event.senderFrame !== win.webContents.mainFrame
      )
        return { ok: false, error: "Origen IPC no autorizado." };
      try {
        if (restoring && name !== "state" && name !== "map-resource")
          throw new Error("Espera a que termine la restauración.");
        return { ok: true, value: await fn(...args) };
      } catch (e) {
        return {
          ok: false,
          error:
            e instanceof z.ZodError
              ? "Los datos recibidos no son válidos."
              : e instanceof Error
                ? e.message
                : "No se pudo completar la operación.",
        };
      }
    },
  );
}
async function boot() {
  const dir = process.env.CYCLELAB_USER_DATA ?? app.getPath("userData");
  mkdirSync(dir, { recursive: true });
  store = new Store(join(dir, "cyclelab.db"));
  await store.seed();
  let segmentResults = new SegmentResults(store, changed);
  app.on("before-quit", () => segmentResults.stop());
  const credentials = new Credentials(store),
    garmin = new GarminPersonalSource(() => credentials.get("garmin")),
    sync = new GarminSync(store, garmin, changed, () =>
      segmentResults.scheduleAll("garmin"),
    );
  const maptiler = new MapTilerSource(() => credentials.get("maptiler"));
  register("map-resource", (path) =>
    maptiler.resource(z.string().min(1).max(4096).parse(path)),
  );
  const openrouter = (key?: string) =>
    new OpenRouterCoachProvider(
      () => key ?? credentials.get("openrouter"),
      store.settings().model,
      new AnalysisTools(store, store.settings().source),
    );
  segmentResults.scheduleAll("demo");
  segmentResults.scheduleAll("garmin");
  register("segment-results", (rawSource, rawId, rawRetry) =>
    segmentResults.get(
      sourceSchema.parse(rawSource),
      z.string().uuid().parse(rawId),
      z.boolean().optional().parse(rawRetry),
    ),
  );
  register("state", () => state());
  register("maintenance", () => maintenance(store));
  register("sync-stop", async (action) => {
    await sync.stop(z.enum(["pause", "cancel"]).parse(action));
  });
  register("diagnostic-export", async () => {
    const { canceled, filePath } = await dialog.showSaveDialog(win!, {
      title: "Exportar diagnóstico sin contenido privado",
      defaultPath: "CycleLab-diagnostic.json",
      filters: [{ name: "Diagnóstico JSON", extensions: ["json"] }],
    });
    if (canceled || !filePath) return null;
    writeFileSync(
      filePath,
      JSON.stringify(diagnostic(store, app.getVersion()), null, 2),
      { flag: "wx", mode: 0o600 },
    );
    return filePath;
  });
  register("local-delete", async (rawSource, rawScope) => {
    const source = sourceSchema.parse(rawSource);
    const scope = z.enum(["messages", "all"]).parse(rawScope);
    const ensureIdle = () => {
      if (
        busy.size ||
        store.get<SyncState | null>("sync", null)?.state === "syncing" ||
        store.get<SyncState | null>("demoSync", null)?.state === "syncing"
      )
        throw new Error(
          "Espera a que terminen la importación y las respuestas antes de borrar.",
        );
    };
    ensureIdle();
    restoring = true;
    try {
      const { response } = await dialog.showMessageBox(win!, {
        type: "warning",
        title: "Borrar datos locales",
        message: `Borrar ${scope === "messages" ? "conversaciones" : "todos los datos"} de ${source === "demo" ? "Demostración" : "Garmin"}`,
        detail:
          (scope === "messages"
            ? "Se eliminarán todas las preguntas y respuestas de este origen."
            : "Se eliminarán actividades, muestras, segmentos, resultados y conversaciones de este origen." +
              (source === "garmin"
                ? " También el perfil del atleta. Se desactiva la importación automática hasta que pulses Sincronizar ahora."
                : " La demo no se regenerará al reiniciar.")) +
          " No afecta al otro origen, las claves, los ajustes generales, las copias de seguridad ni los datos en Garmin. No se crea una copia automática de lo borrado. Esta acción no se puede deshacer.",
        buttons: ["Cancelar", "Borrar"],
        defaultId: 0,
        cancelId: 0,
      });
      if (response !== 1) return false;
      ensureIdle();
      deleteLocal(store, source, scope);
      changed();
      return true;
    } finally {
      restoring = false;
    }
  });
  register("backup-export", async () => {
    const { canceled, filePath } = await dialog.showSaveDialog(win!, {
      title: "Exportar copia de seguridad",
      defaultPath: `CycleLab-${new Date().toISOString().slice(0, 10)}.cyclelab-backup.json`,
      filters: [{ name: "Copia de CycleLab", extensions: ["json"] }],
    });
    if (canceled || !filePath) return null;
    if (!filePath.endsWith(".cyclelab-backup.json"))
      throw new Error("El nombre debe terminar en .cyclelab-backup.json.");
    writeBackup(filePath, store.db);
    return filePath;
  });
  register("backup-restore", async () => {
    const ensureIdle = () => {
      if (
        busy.size ||
        store.get<SyncState | null>("sync", null)?.state === "syncing" ||
        store.get<SyncState | null>("demoSync", null)?.state === "syncing"
      )
        throw new Error(
          "Espera a que terminen la sincronización y las respuestas del entrenador antes de restaurar.",
        );
    };
    ensureIdle();
    restoring = true;
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
        title: "Restaurar copia de seguridad",
        properties: ["openFile"],
        filters: [{ name: "Copia de CycleLab", extensions: ["json"] }],
      });
      if (canceled || !filePaths[0]) return null;
      const { response } = await dialog.showMessageBox(win!, {
        type: "warning",
        title: "Restaurar copia de seguridad",
        message: "Se sustituirán tus datos locales por los de la copia.",
        detail:
          "Incluye actividades, segmentos, conversaciones y ajustes de ambos orígenes. Guardaremos una copia previa en la carpeta backups del perfil. Las claves de este Mac se conservan; en otro Mac tendrás que configurarlas de nuevo.",
        buttons: ["Cancelar", "Restaurar copia"],
        defaultId: 0,
        cancelId: 0,
      });
      if (response !== 1) return null;
      ensureIdle();
      const previous = restoreBackup(store.db, filePaths[0], () =>
        store.recover(),
      );
      segmentResults.stop();
      segmentResults = new SegmentResults(store, changed);
      garmin.reset();
      maptiler.clear();
      segmentResults.scheduleAll("demo");
      segmentResults.scheduleAll("garmin");
      changed();
      return previous;
    } finally {
      restoring = false;
    }
  });
  register(
    "activity",
    (s, id) =>
      store.detail(
        sourceSchema.parse(s),
        z.string().min(1).max(100).parse(id),
      ) ?? emptyDetail(),
  );
  register(
    "segment-save",
    (rawSource, rawActivity, rawName, rawStart, rawEnd) => {
      const source = sourceSchema.parse(rawSource);
      const activityId = z.string().min(1).max(100).parse(rawActivity);
      const name = z.string().trim().min(1).max(100).parse(rawName);
      const i0 = z.number().int().nonnegative().parse(rawStart);
      const i1 = z.number().int().nonnegative().parse(rawEnd);
      const detail = store.detail(source, activityId);
      if (!detail)
        throw new Error("Los datos de esta actividad no están disponibles.");
      const segment = createSegment(
        randomUUID(),
        activityId,
        name,
        detail.rows,
        i0,
        i1,
      );
      store.saveSegment(source, segment);
      segmentResults.get(source, segment.id);
      changed();
      return segment;
    },
  );
  register("segment-climb", (rawSource, rawId, rawClimb) => {
    store.setSegmentClimb(
      sourceSchema.parse(rawSource),
      z.string().uuid().parse(rawId),
      z.boolean().parse(rawClimb),
    );
    changed();
  });
  register("segment-delete", (rawSource, rawId) => {
    store.deleteSegment(
      sourceSchema.parse(rawSource),
      z.string().uuid().parse(rawId),
    );
    changed();
  });
  register("settings", async (raw) => {
    const value = settingsSchema.parse(raw),
      before = store.settings();
    if (value.source !== before.source && busy.size)
      throw new Error(
        "Espera a que termine la respuesta antes de cambiar de origen.",
      );
    store.set("settings", {
      ...value,
      athlete: withProfileEntries(value.athlete, []),
    });
    changed();
    if (
      value.source === "garmin" &&
      before.source !== "garmin" &&
      store.hasSecret("garmin") &&
      store.get("garminAutoSync", true)
    )
      void sync.run();
    return state();
  });
  register("credential", async (p, k) => {
    const provider = providerSchema.parse(p),
      key = z.string().trim().min(8).max(4096).parse(k);
    if (
      provider === "garmin" &&
      store.get<SyncState | null>("sync", null)?.state === "syncing"
    )
      throw new Error(
        "Espera a que termine la sincronización antes de cambiar la clave.",
      );
    if (provider === "openrouter" && busy.has("garmin"))
      throw new Error(
        "Espera a que termine la respuesta antes de cambiar la clave.",
      );
    if (provider === "garmin") {
      const candidate = new GarminPersonalSource(() => key);
      await candidate.authenticate();
    } else if (provider === "maptiler")
      await new MapTilerSource(() => key).validate();
    else await openrouter(key).validate();
    credentials.save(provider, key);
    if (provider === "garmin") garmin.reset();
    if (provider === "maptiler") maptiler.clear();
    changed();
    return state();
  });
  register("disconnect", (p) => {
    const provider = providerSchema.parse(p);
    if (
      provider === "garmin" &&
      store.get<SyncState | null>("sync", null)?.state === "syncing"
    )
      throw new Error(
        "Espera a que termine la sincronización antes de desconectar.",
      );
    if (provider === "openrouter" && busy.has("garmin"))
      throw new Error(
        "Espera a que termine la respuesta antes de desconectar.",
      );
    store.deleteSecret(provider);
    if (provider === "garmin") garmin.reset();
    if (provider === "maptiler") maptiler.clear();
    changed();
    return state();
  });
  register("reclassify", () => {
    if (store.get<SyncState | null>("sync", null)?.state === "syncing")
      throw new Error(
        "Espera a que termine la sincronización antes de volver a etiquetar.",
      );
    const count = store.reclassifyActivities();
    changed();
    return count;
  });
  register("models", () => openrouter().models());
  register("retry-downloads", async (rawIds) => {
    const ids = z
      .array(z.string().regex(/^\d+$/))
      .min(1)
      .max(10000)
      .parse(rawIds);
    if (
      store.settings().source !== "garmin" ||
      !store.settings().garminConfigured
    )
      throw new Error("Configura Garmin para reintentar las descargas.");
    await sync.run(ids);
  });
  register("sync", async () => {
    if (store.settings().source === "garmin") {
      await sync.run();
      return;
    }
    if (store.get<SyncState | null>("demoSync", null)?.state === "syncing")
      return;
    store.set("demoSync", {
      state: "syncing",
      phase: "Descargando actividades…",
      completed: 0,
      total: null,
      lastSync: null,
    });
    changed();
    await new Promise((r) => setTimeout(r, 1800));
    const fail = ++demoSyncCount % 2 === 0;
    store.set("demoSync", {
      state: fail ? "error" : "synced",
      phase: fail
        ? "Último intento fallido · reintentar"
        : "Sincronización completada",
      completed: 84,
      total: 84,
      lastSync: Date.now(),
      error: fail
        ? "Garmin Connect no responde (429). Reintenta en unos minutos."
        : undefined,
    });
    changed();
  });
  register("message", async (text, ctx) => {
    const value = z.string().trim().min(1).max(8000).parse(text),
      context = z
        .object({
          screen: z.enum([
            "dashboard",
            "activities",
            "performance",
            "segments",
            "climbs",
            "coach",
            "settings",
          ]),
          activityId: z.string().max(100).optional(),
        })
        .strict()
        .parse(ctx) as CoachContext,
      source = store.settings().source;
    if (busy.has(source)) throw new Error("Ya hay una respuesta en curso.");
    busy.add(source);
    if (source === "garmin" && !store.get("coachPrivacyAccepted", false)) {
      try {
        const { response } = await dialog.showMessageBox(win!, {
          type: "info",
          title: "Antes de enviar a OpenRouter",
          message:
            "Tu pregunta y datos de entrenamiento se enviarán a OpenRouter y al proveedor del modelo elegido.",
          detail:
            "Se envían los últimos 20 mensajes (hasta 12 000 caracteres por mensaje), la pantalla y el identificador de actividad, cobertura y procedencia, y resultados limitados de herramientas: nombres, fechas, métricas, intervalos, curvas y carga. No se adjuntan coordenadas GPS, archivos FIT ni claves guardadas como contexto; la clave de OpenRouter se usa solo para autenticar la conexión. Lo que escribas sí se envía: no incluyas secretos ni ubicaciones privadas. El proveedor aplica sus políticas de tratamiento de datos y la consulta puede tener coste. La demo no realiza este envío.",
          buttons: ["Cancelar", "Aceptar y enviar"],
          defaultId: 0,
          cancelId: 0,
        });
        if (response !== 1)
          throw new Error("Envío cancelado. No se ha enviado la pregunta.");
        store.set("coachPrivacyAccepted", true);
      } catch (e) {
        busy.delete(source);
        throw e;
      }
    }
    const user: ChatMessage = {
        id: randomUUID(),
        role: "user",
        text: value,
        status: "done",
        tools: [],
        createdAt: Date.now(),
      },
      assistant: ChatMessage = {
        id: randomUUID(),
        role: "assistant",
        text: "",
        status: "running",
        tools: [],
        model:
          source === "demo"
            ? "simulado"
            : (store.settings().model ?? undefined),
        createdAt: Date.now() + 1,
      };
    store.message(source, user);
    store.message(source, assistant);
    changed();
    try {
      const tools = new AnalysisTools(store, source),
        provider =
          source === "demo" ? new DemoCoachProvider(tools) : openrouter();
      assistant.text = await provider.respond(
        store.messages(source).filter((m) => m.id !== assistant.id),
        context,
        (t) => {
          assistant.tools.push(t);
          store.message(source, assistant);
          changed();
        },
      );
      assistant.status = "done";
    } catch (e) {
      assistant.status = "error";
      assistant.text =
        e instanceof Error ? e.message : "No se pudo completar la respuesta.";
    } finally {
      store.message(source, assistant);
      busy.delete(source);
      changed();
    }
  });
  function createWindow() {
    win = new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 1200,
      minHeight: 760,
      title: "CycleLab",
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 16, y: 16 },
      backgroundColor: "#090b0e",
      webPreferences: {
        preload: join(__dirname, "../preload/index.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//i.test(url))
        void shell.openExternal(url).catch(() => {});
      return { action: "deny" };
    });
    win.webContents.on("will-navigate", (event) => event.preventDefault());
    if (process.env.ELECTRON_RENDERER_URL)
      void win.loadURL(process.env.ELECTRON_RENDERER_URL);
    else void win.loadFile(join(__dirname, "../renderer/index.html"));
    win.on("closed", () => (win = null));
  }
  createWindow();
  app.on("activate", () => {
    if (!win) createWindow();
  });
  if (
    store.settings().source === "garmin" &&
    store.hasSecret("garmin") &&
    store.get("garminAutoSync", true)
  )
    void sync.run();
}
app
  .whenReady()
  .then(boot)
  .catch((e) => {
    console.error(
      "CycleLab no pudo iniciar:",
      e instanceof Error ? e.message : "error",
    );
    app.quit();
  });
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", () => store?.close());
