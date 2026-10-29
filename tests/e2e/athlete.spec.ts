import { test, expect, _electron as electron } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { quit } from "./quit";

test("profile history persists and exposes dated references in both themes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cyclelab-profile-"));
  const launch = () =>
    electron.launch({
      args: ["out/main/index.js"],
      env: { ...process.env, CYCLELAB_USER_DATA: dir },
    });
  let app = await launch();
  try {
    let page = await app.firstWindow();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.getByRole("button", { name: "Ajustes", exact: true }).click();
    const fill = async (
      date: string,
      ftp: string,
      weight: string,
      lthr: string,
    ) => {
      await page.getByLabel("Vigente desde", { exact: true }).fill(date);
      await page.getByLabel("FTP (W)", { exact: true }).fill(ftp);
      await page.getByLabel("Peso (kg)", { exact: true }).fill(weight);
      await page
        .getByLabel("Umbral cardíaco LTHR (ppm)", { exact: true })
        .fill(lthr);
      await page
        .getByRole("button", { name: "Guardar perfil", exact: true })
        .click();
      await expect(page.getByRole("status")).toContainText("Ajustes guardados");
    };
    await fill("2024-01-01", "240", "75", "170");
    await fill(new Date().toISOString().slice(0, 10), "300", "80", "180");
    const settings = (await page.evaluate(() => window.cyclelab.getState()))
      .settings;
    expect(settings.athlete.history).toHaveLength(6);
    expect(settings.athlete.ftp).toBe(300);
    for (const theme of ["dark", "light"]) {
      if (theme === "light")
        await page.getByRole("button", { name: "Cambiar tema" }).click();
      await page
        .getByText("Historial del perfil", { exact: true })
        .scrollIntoViewIfNeeded();
      await page.screenshot({ path: `test-results/profile-${theme}.png` });
    }
    // Demo remains isolated from the real profile.
    await page
      .getByRole("navigation")
      .getByRole("button", { name: /Actividades/ })
      .click();
    await expect(page.getByText(/FTP: 275 W.*demostración/)).toBeVisible();
    await page
      .getByRole("navigation")
      .getByRole("button", { name: /Rendimiento/ })
      .click();
    await page.getByRole("button", { name: "W/kg", exact: true }).click();
    await expect(
      page.getByRole("cell", { name: /80,0 kg/ }).first(),
    ).toBeVisible();
    const fixture = await page.evaluate(async () => {
      const state = await window.cyclelab.getState();
      const activity = {
        ...state.dataset.activities[0],
        id: "901",
        name: "Sesión histórica",
        date: Date.parse("2024-06-01"),
        detailStatus: "ready",
      };
      const detail = await window.cyclelab.getActivity(
        "demo",
        state.dataset.activities[0].id,
      );
      return { activity, detail };
    });
    await app.evaluate(
      (_electron, { dir, modulePath, fixture }) => {
        const DB = process.getBuiltinModule("module").createRequire(modulePath)(
          modulePath,
        );
        const db = new DB(dir + "/cyclelab.db");
        db.prepare("INSERT INTO activities VALUES (?,?,?,?,?,?)").run(
          "garmin",
          fixture.activity.id,
          fixture.activity.date,
          JSON.stringify(fixture.activity),
          JSON.stringify(fixture.detail),
          JSON.stringify(fixture.detail.best),
        );
        db.close();
      },
      { dir, modulePath: resolve("node_modules/better-sqlite3"), fixture },
    );
    await page.evaluate(
      (s) =>
        window.cyclelab.saveSettings({
          theme: s.theme,
          model: s.model,
          athlete: s.athlete,
          source: "garmin",
        }),
      settings,
    );
    await page
      .getByRole("navigation")
      .getByRole("button", { name: /Actividades/ })
      .click();
    await page.getByRole("button", { name: "Todo", exact: true }).click();
    await expect(
      page.getByText(/FTP: 240 W.*Peso: 75 kg.*LTHR: 170 ppm/),
    ).toBeVisible();
    for (const theme of ["dark", "light"]) {
      await page.evaluate(
        async (theme) => {
          const s = (await window.cyclelab.getState()).settings;
          await window.cyclelab.saveSettings({
            theme,
            model: s.model,
            athlete: s.athlete,
            source: s.source,
          });
        },
        theme as "dark" | "light",
      );
      await page.screenshot({
        path: `test-results/profile-activity-${theme}.png`,
      });
    }
    await page
      .getByRole("navigation")
      .getByRole("button", { name: /Rendimiento/ })
      .click();
    await page.getByRole("button", { name: "W/kg", exact: true }).click();
    await expect(
      page.getByRole("cell", { name: /75,0 kg/ }).first(),
    ).toBeVisible();
    expect(errors).toEqual([]);
    await quit(app);
    app = await launch();
    page = await app.firstWindow();
    await page.getByRole("button", { name: "Ajustes", exact: true }).waitFor();
    expect(
      (await page.evaluate(() => window.cyclelab.getState())).settings.athlete,
    ).toEqual(settings.athlete);
  } finally {
    await quit(app);
  }
});
