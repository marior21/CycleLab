import {
  test,
  expect,
  _electron as electron,
  chromium,
} from "@playwright/test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

test("maintenance isolates deletion, exports only counters and gates the first real message", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cyclelab-maintenance-"));
  const path = join(dir, "diagnostic.json");
  const app = await electron.launch({
    args: ["out/main/index.js"],
    env: { ...process.env, CYCLELAB_USER_DATA: dir },
  });
  const browser = await chromium.launch();
  try {
    const page = await app.firstWindow();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.getByRole("button", { name: "Ajustes", exact: true }).click();
    await expect(
      page.getByText("Mantenimiento y privacidad", { exact: true }),
    ).toBeVisible();
    const reference = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    await reference.goto(pathToFileURL(resolve("design/prototype.html")).href);
    await reference.locator(".cl-nav-item").first().waitFor();
    for (const theme of ["dark", "light"]) {
      await page.evaluate(async (theme) => {
        const { settings } = await window.cyclelab.getState();
        await window.cyclelab.saveSettings({
          source: settings.source,
          model: settings.model,
          athlete: settings.athlete,
          theme: theme as "dark" | "light",
        });
      }, theme);
      await reference.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      await page
        .locator(".settings-page")
        .screenshot({ path: `test-results/maintenance-${theme}.png` });
      await reference.screenshot({
        path: `test-results/maintenance-reference-${theme}.png`,
      });
    }
    await page.evaluate(() =>
      window.cyclelab.sendMessage("PRIVATE-TEXT", { screen: "coach" }),
    );
    await app.evaluate(({ dialog }, path) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: path });
      dialog.showMessageBox = async () => ({
        response: 0,
        checkboxChecked: false,
      });
    }, path);
    expect(
      await page.evaluate(() => window.cyclelab.deleteLocal("demo", "all")),
    ).toBe(false);
    const before = await page.evaluate(() => window.cyclelab.getState());
    expect(before.messages.length).toBe(2);
    await page.evaluate(() => window.cyclelab.exportDiagnostic());
    const report = JSON.parse(readFileSync(path, "utf8"));
    expect(report.storage.sources[0].messages).toBe(2);
    expect(Object.keys(report)).toEqual([
      "format",
      "version",
      "appVersion",
      "platform",
      "arch",
      "schemaVersion",
      "storage",
    ]);
    for (const secret of [
      "PRIVATE-TEXT",
      dir,
      before.dataset.activities[0].name,
    ])
      expect(JSON.stringify(report)).not.toContain(secret);
    await page.evaluate(async () => {
      const { settings } = await window.cyclelab.getState();
      await window.cyclelab.saveSettings({
        theme: settings.theme,
        model: settings.model,
        athlete: settings.athlete,
        source: "garmin",
      });
    });
    const canceled = await page.evaluate(() =>
      window.cyclelab
        .sendMessage("PRIVATE-TEXT", { screen: "coach" })
        .catch((e) => e.message),
    );
    expect(canceled).toContain("Envío cancelado");
    expect(
      (await page.evaluate(() => window.cyclelab.getState())).messages,
    ).toHaveLength(0);
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({
        response: 1,
        checkboxChecked: false,
      });
    });
    await page.evaluate(() =>
      window.cyclelab.sendMessage("PRIVATE-TEXT", { screen: "coach" }),
    );
    expect(
      (await page.evaluate(() => window.cyclelab.getState())).messages,
    ).toHaveLength(2);
    await app.evaluate(
      (_electron, { dir, modulePath }) => {
        const DB = process.getBuiltinModule("module").createRequire(modulePath)(
          modulePath,
        );
        const db = new DB(dir + "/cyclelab.db");
        db.exec(
          "INSERT INTO activities SELECT 'garmin',id,date,summary,detail,best FROM activities WHERE source='demo';",
        );
        db.prepare("INSERT INTO secrets VALUES (?,?)").run(
          "maptiler",
          Buffer.from("SECRET-SENTINEL"),
        );
        db.close();
      },
      { dir, modulePath: resolve("node_modules/better-sqlite3") },
    );
    const counts = await page.evaluate(() => window.cyclelab.maintenance());
    expect(counts.sources[0].ready).toBe(before.dataset.activities.length);
    await app.evaluate(
      ({ dialog }, path) => {
        dialog.showSaveDialog = async () => ({
          canceled: false,
          filePath: path,
        });
      },
      join(dir, "diagnostic-with-secrets.json"),
    );
    await page.evaluate(() => window.cyclelab.exportDiagnostic());
    expect(
      readFileSync(join(dir, "diagnostic-with-secrets.json"), "utf8"),
    ).not.toContain("SECRET-SENTINEL");
    await page.evaluate(() => window.cyclelab.deleteLocal("demo", "messages"));
    expect(
      (await page.evaluate(() => window.cyclelab.getState())).messages,
    ).toHaveLength(2);
    expect(
      (await page.evaluate(() => window.cyclelab.maintenance())).sources[0]
        .activities,
    ).toBe(before.dataset.activities.length);
    await page.evaluate(() => window.cyclelab.deleteLocal("demo", "all"));
    expect(
      (await page.evaluate(() => window.cyclelab.maintenance())).sources[0],
    ).toMatchObject({ activities: 0, messages: 0, segments: 0 });
    expect(
      (await page.evaluate(() => window.cyclelab.maintenance())).sources[1]
        .activities,
    ).toBe(before.dataset.activities.length);
    await page.evaluate(() => window.cyclelab.deleteLocal("garmin", "all"));
    expect(
      (await page.evaluate(() => window.cyclelab.getState())).settings
        .maptilerConfigured,
    ).toBe(true);
    expect(
      (await page.evaluate(() => window.cyclelab.getState())).messages,
    ).toHaveLength(0);
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
    await app.close();
  }
  const reopened = await electron.launch({
    args: ["out/main/index.js"],
    env: { ...process.env, CYCLELAB_USER_DATA: dir },
  });
  try {
    const page = await reopened.firstWindow();
    await page.getByRole("button", { name: "Ajustes", exact: true }).waitFor();
    expect(
      (await page.evaluate(() => window.cyclelab.maintenance())).sources.every(
        (s) => s.activities === 0 && s.messages === 0,
      ),
    ).toBe(true);
  } finally {
    await reopened.close();
  }
});
