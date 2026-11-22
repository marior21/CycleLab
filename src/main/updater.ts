import { app } from "electron";
import { createRequire } from "node:module";
import { join } from "node:path";
import { autoUpdater } from "electron-updater";
import type { UpdateState } from "../shared/models";

const SIX_HOURS = 6 * 60 * 60 * 1000;
let update: UpdateState = { status: "disabled", current: app.getVersion() };

let checkSparkle: (() => void) | undefined;

export const updateState = () => update;

/** Sparkle owns the Mac update session. Windows uses electron-updater. */
export function startUpdater(changed: () => void) {
  // Dev, e2e and unpacked builds have no app-update.yml to read.
  if (!app.isPackaged) return;
  const set = (patch: Partial<UpdateState>) => {
    update = { ...update, ...patch };
    changed();
  };
  if (process.platform === "darwin") {
    try {
      // Loading the bridge starts Sparkle's scheduler and native update dialog.
      checkSparkle = createRequire(__filename)(
        join(process.resourcesPath, "sparkle.node"),
      );
      set({ status: "idle" });
    } catch {
      set({ status: "error", message: "No se pudo iniciar Sparkle." });
    }
    return;
  }
  set({ status: "idle" });
  autoUpdater.logger = null;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("checking-for-update", () =>
    set({ status: "checking", next: undefined, message: undefined }),
  );
  autoUpdater.on("update-not-available", () => set({ status: "idle" }));
  autoUpdater.on("update-available", (info) =>
    set({ status: "downloading", next: info.version, percent: 0 }),
  );
  autoUpdater.on("download-progress", (p) =>
    set({ status: "downloading", percent: Math.round(p.percent) }),
  );
  autoUpdater.on("update-downloaded", (info) =>
    set({ status: "ready", next: info.version }),
  );
  autoUpdater.on("error", () =>
    set({
      status: "error",
      message: update.next
        ? "No se pudo completar la actualización automática."
        : "No se pudo buscar la actualización.",
    }),
  );
  void check();
  setInterval(() => void check(), SIX_HOURS).unref();
}

export async function check() {
  if (update.status !== "idle" && update.status !== "error") return;
  if (process.platform === "darwin") {
    if (!checkSparkle) throw new Error("No se pudo iniciar Sparkle.");
    return checkSparkle();
  }
  // The "error" listener already records the failure.
  await autoUpdater.checkForUpdates().catch(() => {});
}

export function install() {
  if (update.status === "ready") autoUpdater.quitAndInstall();
}
