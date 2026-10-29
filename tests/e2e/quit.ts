import type { ElectronApplication } from "@playwright/test";

/**
 * Quits like ⌘Q and waits for the process to exit. Playwright's own close tears
 * the window down first and can stall for minutes on macOS; the app itself
 * exits in well under a second this way.
 */
export async function quit(app: ElectronApplication) {
  const proc = app.process();
  if (proc.exitCode !== null || proc.signalCode !== null) return;
  const exited = new Promise((r) => proc.once("exit", r));
  await app
    .evaluate(({ app }) => setTimeout(() => app.quit(), 0))
    .catch(() => {});
  await exited;
}
