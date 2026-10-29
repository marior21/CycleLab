import { test, expect, _electron as electron } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { quit } from "./quit";

test("coverage follows periods, keeps unknown metrics and offers scoped retries", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cyclelab-coverage-"));
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
    const year = new Date().getUTCFullYear();
    await app.evaluate(
      (_electron, { dir, modulePath, template, year }) => {
        const DB = process.getBuiltinModule("module").createRequire(modulePath)(
          modulePath,
        );
        const db = new DB(dir + "/cyclelab.db");
        try {
          const now = Date.now();
          const activities = [
            {
              ...template,
              id: "101",
              name: "Sensores presentes",
              date: now - 4 * 86400000,
              avgP: 0,
              np: 0,
              hr: 130,
              tss: 0,
              detailStatus: "ready",
            },
            {
              ...template,
              id: "102",
              name: "Descarga fallida reciente",
              date: now - 2 * 86400000,
              avgP: null,
              np: null,
              hr: null,
              tss: null,
              detailStatus: "error",
            },
            {
              ...template,
              id: "103",
              name: "Sin sensores",
              date: now - 3 * 86400000,
              avgP: null,
              np: null,
              hr: null,
              tss: null,
              detailStatus: "ready",
            },
            {
              ...template,
              id: "104",
              name: "Descarga fallida antigua",
              date: Date.UTC(year - 2, 0, 2),
              avgP: null,
              np: null,
              hr: null,
              tss: null,
              detailStatus: "error",
            },
          ];
          for (const a of activities) {
            const ready = a.detailStatus === "ready";
            const d = ready
              ? {
                  rows: [
                    {
                      x: 0,
                      km: null,
                      p: a.avgP,
                      ps: a.avgP,
                      hr: a.hr,
                      cad: null,
                      elev: null,
                      v: null,
                      lat: a.id === "101" ? 43 : null,
                      lon: a.id === "101" ? -4 : null,
                    },
                  ],
                  points: [],
                  laps: [],
                  features: [],
                  markers: [],
                  best: [],
                }
              : null;
            db.prepare(
              "INSERT INTO activities(source,id,date,summary,detail,best) VALUES (?,?,?,?,?,?)",
            ).run(
              "garmin",
              a.id,
              a.date,
              JSON.stringify(a),
              d ? JSON.stringify(d) : null,
              "[]",
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
        year,
      },
    );
    await page.evaluate(
      (settings) =>
        window.cyclelab.saveSettings({
          theme: settings.theme,
          model: settings.model,
          source: "garmin",
          athlete: { ftp: null, lthr: 180, weight: 75 },
        }),
      state.settings,
    );
    const coverage = page.locator(".coverage");
    await expect(coverage).toContainText("4 actividades");
    await coverage.locator("summary").click();
    await expect(coverage).toContainText("Datos incompletos");
    await expect(
      coverage.getByRole("row").filter({ hasText: /^GPS/ }),
    ).toHaveText(/GPS\s*1\s*1\s*2/);
    await page.getByLabel("Año de las actividades").selectOption(String(year));
    await expect(coverage).toContainText("3 actividades");
    await expect(
      coverage.getByRole("row").filter({ hasText: /^TSS/ }),
    ).toHaveText(/TSS\s*1\s*2\s*0/);
    await expect(coverage).toContainText("1 fallidas");
    await coverage
      .getByRole("button", { name: "Reintentar descargas fallidas" })
      .click();
    await expect(coverage.getByRole("alert")).toContainText("Configura Garmin");
    await page.getByRole("option", { name: /Sin sensores/ }).click();
    await expect(
      page.getByText("Sin muestras para calcular zonas", { exact: true }),
    ).toBeVisible();
    for (const theme of ["dark", "light"]) {
      if (theme === "light")
        await page.getByRole("button", { name: "Cambiar tema" }).click();
      await expect(page.locator(".cl-skel")).toHaveCount(0);
      await coverage.evaluate((el) => {
        el.scrollTop = 0;
      });
      await page.screenshot({
        path: `test-results/coverage-activities-${theme}.png`,
      });
      await page
        .getByRole("navigation")
        .getByRole("button", { name: /Dashboard/ })
        .click();
      await expect(
        page.getByText("Carga de entrenamiento · estimación", { exact: true }),
      ).toBeVisible();
      await coverage.locator("summary").click();
      await expect(coverage).toContainText("3 actividades");
      await page.screenshot({
        path: `test-results/coverage-dashboard-${theme}.png`,
      });
      await page
        .getByRole("navigation")
        .getByRole("button", { name: /Rendimiento/ })
        .click();
      await coverage.locator("summary").click();
      await expect(coverage).toContainText("4 actividades");
      await expect(
        page.getByText("Sin datos de potencia", { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: String(year - 2), exact: true })
        .click();
      await expect(coverage).toContainText("3 actividades");
      await page.screenshot({
        path: `test-results/coverage-performance-${theme}.png`,
      });
      await page
        .getByRole("navigation")
        .getByRole("button", { name: /Actividades/ })
        .click();
      await coverage.locator("summary").click();
    }
    await page.getByLabel("Fecha desde").fill(`${year + 1}-01-01`);
    await expect(coverage).toContainText("0 actividades");
    await expect(coverage).toContainText("Sin actividades");
    const fresh = await page.evaluate(() => window.cyclelab.getState());
    expect(fresh.dataset.sampleCoverage["101"]).toEqual({
      samples: true,
      power: true,
      heart: true,
      gps: true,
    });
    expect(fresh.dataset.load.find((r) => r.tss === null)).toBeDefined();
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(1200, 760),
    );
    await coverage.locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(coverage).not.toHaveAttribute("open");
    await page.keyboard.press("Enter");
    await expect(coverage).toHaveAttribute("open");
    expect(
      await coverage
        .locator(".cl-table-wrap")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await page.screenshot({ path: "test-results/coverage-minimum-light.png" });
    expect(errors).toEqual([]);
  } finally {
    await quit(app);
  }
});
