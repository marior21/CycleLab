import { app } from "electron";
import { autoUpdater } from "electron-updater";
import type { UpdateState } from "../shared/models";

const SIX_HOURS = 6 * 60 * 60 * 1000;
let update: UpdateState = { status: "disabled", current: app.getVersion() };

export const updateState = () => update;

/** Checks GitHub releases at start and every six hours; installs on quit. */
export function startUpdater(changed: () => void) {
  // Dev, e2e and unpacked builds have no app-update.yml to read.
  if (!app.isPackaged) return;
  const set = (patch: Partial<UpdateState>) => {
    update = { ...update, ...patch };
    changed();
  };
  set({ status: "idle" });
  autoUpdater.logger = null;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("checking-for-update", () =>
    set({ status: "checking", message: undefined }),
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
      message: "No se pudo buscar o descargar la actualización.",
    }),
  );
  void check();
  setInterval(() => void check(), SIX_HOURS).unref();
}

export async function check() {
  if (update.status !== "idle" && update.status !== "error") return;
  // The "error" listener already records the failure.
  await autoUpdater.checkForUpdates().catch(() => {});
}

export function install() {
  if (update.status === "ready") autoUpdater.quitAndInstall();
}
