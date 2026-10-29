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
  maintenance: () => call("maintenance"),
  periodZones: (source, from, to) => call("period-zones", source, from, to),
  stopSync: (action) => call("sync-stop", action),
  deleteLocal: (source, scope) => call("local-delete", source, scope),
  exportDiagnostic: () => call("diagnostic-export"),
  exportBackup: () => call("backup-export"),
  restoreBackup: () => call("backup-restore"),
  getState: () => call("state"),
  mapResource: (path) => call("map-resource", path),
  getSegmentResults: (source, id, retry) =>
    call("segment-results", source, id, retry),
  saveSegment: (source, activityId, name, i0, i1) =>
    call("segment-save", source, activityId, name, i0, i1),
  updateSegment: (source, id, changes) =>
    call("segment-update", source, id, changes),
  setAttemptExcluded: (source, id, attemptId, reason) =>
    call("segment-exclude", source, id, attemptId, reason),
  deleteSegment: (source, id) => call("segment-delete", source, id),
  getActivity: (source, id) => call("activity", source, id),
  saveSettings: (s) => call("settings", s),
  saveCredential: (p, k) => call("credential", p, k),
  disconnect: (p) => call("disconnect", p),
  listModels: () => call("models"),
  sync: () => call("sync"),
  retryDownloads: (ids) => call("retry-downloads", ids),
  reclassifyActivities: () => call("reclassify"),
  saveGoal: (source, goal) => call("goal-save", source, goal),
  saveActivityFeel: (source, id, feel) =>
    call("activity-feel", source, id, feel),
  sendMessage: (text, ctx, conversationId) =>
    call("message", text, ctx, conversationId),
  cancelMessage: () => call("message-cancel"),
  renameConversation: (id, title) => call("conversation-rename", id, title),
  deleteConversation: (id) => call("conversation-delete", id),
  onChange: (callback) => {
    ipcRenderer.on("cyclelab:changed", callback);
    return () => ipcRenderer.removeListener("cyclelab:changed", callback);
  },
};
contextBridge.exposeInMainWorld("cyclelab", api);
