import { test, expect, _electron as electron } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { Activity } from "../../src/shared/models";

const launch = (dir: string) =>
  electron.launch({
    args: ["out/main/index.js"],
    env: { ...process.env, CYCLELAB_USER_DATA: dir },
  });
const effort = (t: number, p: number | null, i0 = 0) => ({
  t,
  l: t < 60 ? `${t} s` : `${t / 60} min`,
  p,
  i0,
  i1: i0 + t - 1,
});

test("new power records appear once, open their range and stay dismissed", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cyclelab-records-"));
  let app = await launch(dir);
  try {
    let page = await app.firstWindow();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.getByRole("button", { name: "Ajustes", exact: true }).waitFor();
    const state = await page.evaluate(() => window.cyclelab.getState());
    const now = Date.now(),
      day = 86400000;
    const seed = (activities: (Partial<Activity> & { best: unknown[] })[]) =>
      app.evaluate(
        (_electron, { dir, modulePath, template, activities }) => {
          const DB = process
            .getBuiltinModule("module")
            .createRequire(modulePath)(modulePath);
          const db = new DB(dir + "/cyclelab.db");
          try {
            for (const { best, ...a } of activities) {
              const summary = { ...template, ...a, detailStatus: "ready" };
              const rows = Array.from({ length: 400 }, (_, x) => ({
                x,
                km: null,
                p: 250,
                ps: 250,
                hr: 140,
                cad: null,
                elev: null,
                v: null,
                lat: null,
                lon: null,
              }));
              db.prepare(
                "INSERT INTO activities(source,id,date,summary,detail,best) VALUES (?,?,?,?,?,?)",
              ).run(
                "garmin",
                a.id,
                a.date,
                JSON.stringify(summary),
                JSON.stringify({
                  rows,
                  points: [],
                  laps: [],
                  features: [],
                  markers: [],
                  best,
                }),
                JSON.stringify(best),
              );
            }
          } finally {
            db.close();
          }
        },
        {
          dir,
          modulePath: resolve("node_modules/better-sqlite3"),
          template: state.dataset.activities[0],
          activities,
        },
      );
    // The first history already contains a record over an older ride: it is not news.
    await seed([
      {
        id: "201",
        name: "Salida antigua",
        date: now - 30 * day,
        best: [effort(60, 420), effort(300, 300)],
      },
      {
        id: "202",
        name: "Marca anterior",
        date: now - 20 * day,
        best: [effort(60, 400), effort(300, 310, 20)],
      },
    ]);
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
    await page.getByRole("button", { name: /^Dashboard/ }).click();
    await expect(
      page.getByText("Tu entrenamiento, en perspectiva"),
    ).toBeVisible();
    await expect(page.getByText("Nuevas marcas de potencia")).toHaveCount(0);
    expect(
      (await page.evaluate(() => window.cyclelab.getState())).recordsSince,
    ).toBe(now - 20 * day);

    await seed([
      {
        id: "203",
        name: "Nueva marca",
        date: now - 1 * day,
        best: [effort(60, 410), effort(300, 330, 40), effort(5, 900)],
      },
      {
        id: "204",
        name: "Sin potencia",
        date: now - 2 * day,
        best: [effort(60, null), effort(300, null)],
      },
    ]);
    await app.close();
    app = await launch(dir);
    page = await app.firstWindow();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.getByRole("button", { name: /^Dashboard/ }).click();
    const panel = page.locator(".cl-panel", {
      hasText: "Nuevas marcas de potencia",
    });
    await expect(panel).toBeVisible();
    // Only 5 min beats the history; 1 min does not, 5 s has no earlier effort.
    await expect(panel.getByRole("row")).toHaveCount(2);
    await expect(panel.getByRole("row").nth(1)).toHaveText(
      /5 min\s*330 W\s*310 W\s*\+20 W \(\+6,5 %\)\s*Nueva marca\s*Marca anterior/,
    );
    for (const theme of ["dark", "light"]) {
      if (theme === "light")
        await page.getByRole("button", { name: "Cambiar tema" }).click();
      await panel.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `test-results/records-${theme}.png` });
    }
    await panel.getByRole("button", { name: "Nueva marca" }).click();
    await expect(
      page.getByRole("heading", { name: "Actividades", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Analizar este tramo" }),
    ).toBeVisible();

    await page.getByRole("button", { name: /^Dashboard/ }).click();
    await panel.getByRole("button", { name: "Entendido" }).click();
    await expect(panel).toHaveCount(0);
    await app.close();
    app = await launch(dir);
    page = await app.firstWindow();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.getByRole("button", { name: /^Dashboard/ }).click();
    await expect(
      page.getByText("Tu entrenamiento, en perspectiva"),
    ).toBeVisible();
    await expect(page.getByText("Nuevas marcas de potencia")).toHaveCount(0);

    // Demo keeps its own mark and never sees the Garmin records.
    const after = await page.evaluate(() => window.cyclelab.getState());
    expect(after.recordsSince).toBe(now - 1 * day);
    const demo = await page.evaluate(
      (settings) =>
        window.cyclelab.saveSettings({
          theme: settings.theme,
          model: settings.model,
          source: "demo",
          athlete: settings.athlete,
        }),
      after.settings,
    );
    expect(demo.recordsSince).not.toBe(now - 1 * day);
    await expect(page.getByText("Nuevas marcas de potencia")).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});
