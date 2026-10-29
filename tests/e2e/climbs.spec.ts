import { test, expect, _electron as electron } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { quit } from "./quit";

test("suggested climbs are saved only after confirmation and then searched like manual segments", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cyclelab-climbs-"));
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
        // 2 km flat, 2 km at 6 %, 2 km flat, 2 km down; one sample per 10 m.
        const grade = (km: number) =>
          km < 2 ? 0 : km < 4 ? 6 : km < 6 ? 0 : -6;
        try {
          for (const [id, name, days] of [
            ["501", "Subida de prueba", 1],
            ["502", "Misma subida otro día", 3],
          ] as [string, string, number][]) {
            let elev = 50;
            const rows = Array.from({ length: 801 }, (_, k) => {
              if (k) elev += grade((k - 1) / 100) / 10;
              return {
                x: k * 2,
                km: k / 100,
                lat: 43.4,
                lon: -3.8 + (k * 10) / 80900,
                p: 220,
                ps: 220,
                hr: 150,
                cad: 85,
                // ±2 m of barometric noise.
                elev: elev + ((k * 7919) % 5) - 2,
                v: 18,
              };
            });
            const summary = {
              ...template,
              id,
              name,
              date: Date.now() - days * 86400000,
              dur: 1600,
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
                laps: [],
                points: rows.map((r) => [r.lon * 1000, r.lat * 1000]),
                pointIndices: rows.map((_, i) => i),
                features: [],
                markers: [],
                best: [],
              }),
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
      },
    );
    await page.evaluate(
      (settings) =>
        window.cyclelab.saveSettings({
          theme: settings.theme,
          model: settings.model,
          source: "garmin",
          athlete: settings.athlete,
        }),
      state.settings,
    );
    const open = async (name: string) => {
      await page.getByRole("button", { name: /^Actividades/ }).click();
      await page.getByRole("option", { name: new RegExp(name) }).click();
    };
    const panel = page.locator(".cl-panel", {
      hasText: "Puertos del recorrido",
    });
    const segments = async () =>
      (await page.evaluate(() => window.cyclelab.getState())).segments;

    await open("Subida de prueba");
    await expect(panel.locator("tbody tr")).toHaveCount(1);
    await expect(panel.locator("tbody tr")).toContainText(
      /2,0–4,0\s*(1,9|2,0) km\s*1[12]\d m\s*(5,9|6,0) %/,
    );
    for (const theme of ["dark", "light"]) {
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await page.getByRole("button", { name: "Cambiar tema" }).click();
      await panel.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `test-results/climbs-${theme}.png` });
    }
    // Selecting the climb drives the shared selection.
    await panel.locator("tbody tr").getByRole("cell").first().click();
    await expect(page.locator(".sel-bar")).toContainText(/Distancia1,9\s*km/);

    // Opening the creator saves nothing; cancelling keeps it that way.
    await panel.getByRole("button", { name: /^Guardar como puerto/ }).click();
    await expect(
      page.getByRole("heading", { name: "Selecciona tu segmento" }),
    ).toBeVisible();
    expect(await segments()).toEqual([]);
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    expect(await segments()).toEqual([]);

    await panel.getByRole("button", { name: /^Guardar como puerto/ }).click();
    await page.getByRole("button", { name: "Siguiente", exact: true }).click();
    await expect(page.getByLabel("Marcar como puerto")).toBeChecked();
    await page.getByLabel("Nombre del segmento").fill("Puerto sugerido");
    await page
      .getByRole("button", { name: "Guardar segmento", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Puertos", exact: true }),
    ).toBeVisible();
    const [saved] = await segments();
    expect(saved).toMatchObject({ name: "Puerto sugerido", isClimb: true });

    // The historical search finds both rides, as for a manual segment.
    await expect
      .poll(
        async () =>
          (
            await page.evaluate(
              (id) => window.cyclelab.getSegmentResults("garmin", id),
              saved.id,
            )
          ).status,
        { timeout: 20000 },
      )
      .toBe("done");
    const report = await page.evaluate(
      (id) => window.cyclelab.getSegmentResults("garmin", id),
      saved.id,
    );
    expect(report.attempts.map((a) => a.activityId).sort()).toEqual([
      "501",
      "502",
    ]);

    for (const name of ["Subida de prueba", "Misma subida otro día"]) {
      await open(name);
      await expect(panel).toContainText("Ya guardado · Puerto sugerido");
      await expect(
        panel.getByRole("button", { name: /^Guardar como puerto/ }),
      ).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  } finally {
    await quit(app);
  }
});
