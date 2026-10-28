import { contextBridge, ipcRenderer } from "electron";
import type { CycleLabAPI, Result } from "../shared/models";
async function call<T>(name: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(
    "cyclelab:" + name,
    ...args,
  )) as Result<T>;
  if (!result.ok) throw new Error(result.error);
  return result.value;
}
const api: CycleLabAPI = {
  exportBackup: () => call("backup-export"),
  restoreBackup: () => call("backup-restore"),
  getState: () => call("state"),
  mapResource: (path) => call("map-resource", path),
  getSegmentResults: (source, id, retry) =>
    call("segment-results", source, id, retry),
  saveSegment: (source, activityId, name, i0, i1) =>
    call("segment-save", source, activityId, name, i0, i1),
  setSegmentClimb: (source, id, isClimb) =>
    call("segment-climb", source, id, isClimb),
  deleteSegment: (source, id) => call("segment-delete", source, id),
  getActivity: (source, id) => call("activity", source, id),
  saveSettings: (s) => call("settings", s),
  saveCredential: (p, k) => call("credential", p, k),
  disconnect: (p) => call("disconnect", p),
  listModels: () => call("models"),
  sync: () => call("sync"),
  reclassifyActivities: () => call("reclassify"),
  sendMessage: (text, ctx) => call("message", text, ctx),
  onChange: (callback) => {
    ipcRenderer.on("cyclelab:changed", callback);
    return () => ipcRenderer.removeListener("cyclelab:changed", callback);
  },
};
contextBridge.exposeInMainWorld("cyclelab", api);
