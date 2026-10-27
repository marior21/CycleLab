import type { CycleLabAPI } from "./models";
declare global {
  interface Window {
    cyclelab: CycleLabAPI;
  }
}
