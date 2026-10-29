import { test, expect, _electron as electron } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { quit } from "./quit";

const launch = (dir: string) =>
  electron.launch({
    args: ["out/main/index.js"],
    env: { ...process.env, CYCLELAB_USER_DATA: dir },
  });

test("work blocks are proposed on power, corrected by hand and kept across sync and relabeling", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cyclelab-blocks-")),
    modulePath = resolve("node_modules/better-sqlite3");
  let app = await launch(dir);
  try {
    let page = await app.firstWindow();
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
        const steps = (list: [number, number][]) =>
          list.flatMap(([seconds, watts]) =>
            Array.from({ length: seconds }, () => watts),
          );
        const seed = (id: string, name: string, watts: number[]) => {
          const rows = watts.map((p, x) => ({
            x,
            km: x * 0.008,
            p,
            ps: p,
            hr: 110 + p / 5,
            cad: 90,
            elev: null,
            v: 29,
            lat: null,
            lon: null,
          }));
          const summary = {
            ...template,
            id,
            name,
            date: Date.now() - (id === "401" ? 1 : 2) * 86400000,
            dur: rows.length,
            detailStatus: "ready",
          };
          db.prepare(
            "INSERT INTO activities(source,id,date,summary,detail,best) VALUES (?,?,?,?,?,?)",
          ).run(
            "garmin",
            id,
            summary.date,
            JSON.stringify(summary),
            JSON.stringify({
              rows,
              laps: [
                {
                  id: "l1",
                  label: "Vuelta 1",
                  kind: "lap",
                  i0: 0,
                  i1: rows.length - 1,
                  dur: rows.length - 1,
                  avgP: 180,
                  np: 200,
                  hr: 140,
                  cad: 90,
                  max: 275,
                  gain: 0,
                  dist: rows.length * 0.008,
                },
              ],
              points: [],
              features: [],
              markers: [],
              best: [],
            }),
            "[]",
          );
        };
        try {
          const warm: [number, number] = [600, 150],
            rep: [number, number][] = [
              [240, 275],
              [240, 125],
            ];
          seed(
            "401",
            "Series sin vueltas",
            steps([warm, ...rep, ...rep, ...rep, ...rep, warm]),
          );
          seed("402", "Rodaje suave", steps([[3600, 175]]));
        } finally {
          db.close();
        }
      },
      { dir, modulePath, template: state.dataset.activities[0] },
    );
    await page.evaluate(
      (settings) =>
        window.cyclelab.saveSettings({
          theme: settings.theme,
          model: settings.model,
          source: "garmin",
          athlete: {
            ftp: 250,
            lthr: 170,
            weight: 70,
            history: [
              {
                date: "2020-01-01",
                metric: "ftp",
                value: 250,
                origin: "manual",
              },
            ],
          },
        }),
      state.settings,
    );
    const open = async (name: string) => {
      await page.getByRole("button", { name: /^Actividades/ }).click();
      await page.getByRole("option", { name: new RegExp(name) }).click();
    };
    const panel = () =>
      page.locator(".cl-panel", { hasText: "Bloques de trabajo" });
    const blockRows = () => panel().locator("tbody tr");

    await open("Rodaje suave");
    await expect(panel()).toContainText("Sin bloques de trabajo");

    await open("Series sin vueltas");
    await expect(blockRows()).toHaveCount(4);
    await expect(panel()).toContainText("Propuestos sobre la potencia");
    await expect(panel()).toContainText(/Patrón: 4 × 0:0[34]:\d\d a 27\d W/);
    await expect(blockRows().nth(0)).toContainText(/0:10:0\d/);
    for (const theme of ["dark", "light"]) {
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await page.getByRole("button", { name: "Cambiar tema" }).click();
      await panel().scrollIntoViewIfNeeded();
      await page.screenshot({ path: `test-results/blocks-${theme}.png` });
    }

    // Selecting a block drives the shared selection bar.
    await blockRows().nth(1).getByRole("cell").first().click();
    await expect(blockRows().nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".sel-bar")).toContainText(/0:0[34]:\d\d/);

    await blockRows()
      .nth(0)
      .getByRole("button", { name: /^Descartar/ })
      .click();
    await expect(panel()).toContainText("Corregidos a mano");
    await expect(blockRows()).toHaveCount(3);

    // Add the whole lap as a block from the current selection.
    await page
      .locator(".cl-panel", { hasText: "Vueltas y tramos" })
      .getByRole("row")
      .filter({ hasText: "Vuelta 1" })
      .getByRole("cell")
      .nth(1)
      .click();
    await panel().getByRole("button", { name: "Añadir selección" }).click();
    await expect(blockRows()).toHaveCount(4);
    await expect(blockRows().nth(0)).toContainText(/^\s*0:00:00/);

    // Relabeling rewrites summaries, and a sync rewrites them too.
    await page.evaluate(() => window.cyclelab.reclassifyActivities());
    await app.evaluate(
      (_electron, { dir, modulePath }) => {
        const DB = process.getBuiltinModule("module").createRequire(modulePath)(
          modulePath,
        );
        const db = new DB(dir + "/cyclelab.db");
        db.prepare(
          "UPDATE activities SET summary=json_set(summary,'$.dur',2999) WHERE source='garmin' AND id='401'",
        ).run();
        db.close();
      },
      { dir, modulePath },
    );
    await quit(app);
    app = await launch(dir);
    page = await app.firstWindow();
    page.on("pageerror", (e) => errors.push(e.message));
    await open("Series sin vueltas");
    await expect(panel()).toContainText("Corregidos a mano");
    await expect(blockRows()).toHaveCount(4);

    await panel()
      .getByRole("button", { name: "Restablecer propuesta" })
      .click();
    await expect(panel()).toContainText("Propuestos sobre la potencia");
    await expect(blockRows()).toHaveCount(4);
    await expect(blockRows().nth(0)).toContainText(/0:10:0\d/);
    expect(errors).toEqual([]);
  } finally {
    await quit(app);
  }
});
