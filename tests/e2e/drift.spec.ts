import { test, expect, _electron as electron } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("cardiac drift is shown for steady laps and explained when insufficient", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cyclelab-drift-"));
  const app = await electron.launch({
    args: ["out/main/index.js"],
    env: { ...process.env, CYCLELAB_USER_DATA: dir },
  });
  try {
    const page = await app.firstWindow();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.getByRole("button", { name: "Ajustes", exact: true }).waitFor();
    const state = await page.evaluate(() => window.cyclelab.getState());
    await app.evaluate(
      (_electron, { dir, modulePath, template }) => {
        const DB = process.getBuiltinModule("module").createRequire(modulePath)(
          modulePath,
        );
        const db = new DB(dir + "/cyclelab.db");
        try {
          // 45 min steady at 200 W with heart rate 140 → 150, then 15 min easy.
          const rows = Array.from({ length: 3601 }, (_, x) => ({
            x,
            km: x * 0.008,
            p: x < 2700 ? 200 : 120,
            ps: x < 2700 ? 200 : 120,
            hr: x < 1350 ? 140 : x < 2700 ? 150 : 120,
            cad: 90,
            elev: null,
            v: 29,
            lat: null,
            lon: null,
          }));
          const lap = (id: string, label: string, i0: number, i1: number) => ({
            id,
            label,
            kind: "lap",
            i0,
            i1,
            dur: i1 - i0,
            avgP: 200,
            np: 200,
            hr: 145,
            cad: 90,
            max: 200,
            gain: 0,
            dist: (i1 - i0) * 0.008,
          });
          const summary = {
            ...template,
            id: "301",
            name: "Rodaje estable",
            date: Date.now() - 86400000,
            dur: 3600,
            detailStatus: "ready",
          };
          db.prepare(
            "INSERT INTO activities(source,id,date,summary,detail,best) VALUES (?,?,?,?,?,?)",
          ).run(
            "garmin",
            "301",
            summary.date,
            JSON.stringify(summary),
            JSON.stringify({
              rows,
              laps: [
                lap("l1", "Vuelta 1", 0, 2700),
                lap("l2", "Vuelta 2", 2700, 3600),
              ],
              points: [],
              features: [],
              markers: [],
              best: [],
            }),
            "[]",
          );
        } finally {
          db.close();
        }
      },
      {
        dir,
        modulePath: resolve("node_modules/better-sqlite3"),
        template: state.dataset.activities[0],
      },
    );
    await page.evaluate(
      (settings) =>
        window.cyclelab.saveSettings({
          theme: settings.theme,
          model: settings.model,
          source: "garmin",
          athlete: { ftp: 250, lthr: 170, weight: 70 },
        }),
      state.settings,
    );
    await page.getByRole("button", { name: /^Actividades/ }).click();
    await page.getByRole("option", { name: /Rodaje estable/ }).click();
    await expect(page.locator(".chart-label").first()).toBeVisible();
    const drift = page.locator(".cl-metric", { hasText: "Deriva Pa:FC" });
    const note = page.locator(".drift-note");

    await page.keyboard.press("ArrowRight");
    await expect(page.locator(".sel-bar")).toContainText("Vuelta 1");
    // (1 − 140/150) × 100 = 6,7 %
    await expect(drift).toContainText("6,7");
    await expect(note).toContainText("1,43 W/ppm en la primera mitad");
    await expect(note).toContainText("1,33 W/ppm en la segunda");
    for (const theme of ["dark", "light"]) {
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await page.getByRole("button", { name: "Cambiar tema" }).click();
      await page.locator(".sel-bar").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `test-results/drift-${theme}.png` });
    }

    await page.keyboard.press("ArrowRight");
    await expect(page.locator(".sel-bar")).toContainText("Vuelta 2");
    await expect(drift).toContainText("Insuficiente");
    await expect(note).toContainText("al menos 20 min");
    await expect(note).toContainText("dura 15 min");

    await page.keyboard.press("Escape");
    await expect(drift).toHaveCount(0);
    await expect(note).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});
