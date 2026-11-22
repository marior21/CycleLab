import { EventEmitter } from "node:events";
import { expect, it, vi } from "vitest";
import { autoUpdater } from "electron-updater";
import {
  check,
  install,
  startUpdater,
  updateState,
} from "../../src/main/updater";

vi.mock("electron", () => ({
  app: { isPackaged: true, getVersion: () => "0.1.6" },
}));
vi.mock("electron-updater", () => ({
  autoUpdater: Object.assign(new EventEmitter(), {
    quitAndInstall: vi.fn(),
    checkForUpdates: vi.fn().mockResolvedValue(null),
  }),
}));

it("keeps the manual download available after failure and clears it on a fresh check", async () => {
  vi.stubGlobal("process", { ...process, platform: "win32" });
  vi.useFakeTimers();
  try {
    startUpdater(() => {});
    const release = {
      version: "0.1.7",
      files: [],
      path: "update.zip",
      sha512: "",
      releaseDate: "2026-11-22",
    };
    autoUpdater.emit("update-available", release);
    install();
    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();
    autoUpdater.emit("update-downloaded", {
      ...release,
      downloadedFile: release.path,
    });
    install();
    expect(autoUpdater.quitAndInstall).toHaveBeenCalledOnce();
    autoUpdater.emit("error", new Error("Install failed"));
    expect(updateState()).toMatchObject({ status: "error", next: "0.1.7" });
    await check();
    autoUpdater.emit("checking-for-update");
    autoUpdater.emit("update-not-available", { ...release, version: "0.1.6" });
    expect(updateState().next).toBeUndefined();
  } finally {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});
