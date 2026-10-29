import { test, expect, _electron as electron } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("navigation, analysis, settings, chat and persistence", async () => {
  const userData = mkdtempSync(join(tmpdir(), "cyclelab-e2e-"));
  const launch = () =>
    electron.launch({
      args: ["out/main/index.js"],
      env: { ...process.env, CYCLELAB_USER_DATA: userData },
      timeout: 45000,
    });
  let app = await launch();
  let page = await app.firstWindow();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await expect(
    page.getByRole("heading", { name: "Actividades", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".chart-label").first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: "test-results/activities-dark.png" });
  await page.getByRole("button", { name: "Cambiar tema" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.screenshot({ path: "test-results/activities-light.png" });
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".sel-bar")).toBeVisible();
  const before = await page.locator(".sel-bar").innerText();
  await page.getByRole("button", { name: "Distancia", exact: true }).click();
  await expect(page.locator(".sel-bar")).toHaveText(before, {
    useInnerText: true,
  });
  await page.keyboard.press("Escape");
  await expect(page.locator(".sel-bar")).toHaveCount(0);
  await page.getByRole("textbox", { name: "Buscar actividad" }).fill("zzzzzz");
  await expect(
    page
      .getByRole("listbox", { name: "Actividades" })
      .getByText("Sin actividades", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Restablecer filtros" }).click();
  const checks = page.getByRole("checkbox");
  await checks.nth(0).check();
  await checks.nth(1).check();
  await page.getByRole("button", { name: "Comparar", exact: true }).click();
  await expect(
    page.getByText("Potencia superpuesta", { exact: true }),
  ).toBeVisible();
  for (const name of [
    "Dashboard",
    "Rendimiento",
    "Segmentos",
    "Puertos",
    "Entrenador IA",
  ]) {
    await page
      .getByRole("navigation")
      .getByRole("button", { name, exact: false })
      .click();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: `test-results/${name}-light.png` });
  }
  await page
    .getByRole("textbox", { name: "Mensaje para el entrenador" })
    .fill("¿Cómo va mi carga?");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByText(/Tu fitness \(CTL\) está/)).toBeVisible();
  await page.getByRole("button", { name: "Ajustes", exact: true }).click();
  await expect(page.getByLabel("API key de Garmin")).toHaveAttribute(
    "type",
    "password",
  );
  await expect(page.getByLabel("API key de OpenRouter")).toHaveAttribute(
    "type",
    "password",
  );
  await page.screenshot({ path: "test-results/settings-light.png" });
  await page.getByRole("button", { name: "Mis datos", exact: true }).click();
  await expect(
    page.getByText("Mis datos · Garmin", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Actividades" })
    .click();
  await expect(page.getByText("Tu histórico está vacío")).toBeVisible();
  await page.getByRole("button", { name: "Ajustes", exact: true }).click();
  await page.getByRole("button", { name: "Demostración", exact: true }).click();
  expect(errors).toEqual([]);
  await app.close();
  app = await launch();
  page = await app.firstWindow();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Entrenador IA" })
    .click();
  await expect(page.getByText(/Tu fitness \(CTL\) está/)).toBeVisible();
  await app.close();
});

test("IPC validation, sandbox, offline profile and source isolation", async () => {
  const userData = mkdtempSync(join(tmpdir(), "cyclelab-contract-"));
  const app = await electron.launch({
    args: ["out/main/index.js"],
    env: { ...process.env, CYCLELAB_USER_DATA: userData },
  });
  try {
    const page = await app.firstWindow();
    await expect(
      page.getByRole("heading", { name: "Actividades", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => ({
        node: typeof (window as unknown as { require: unknown }).require,
        process: typeof (window as unknown as { process: unknown }).process,
      })),
    ).toEqual({ node: "undefined", process: "undefined" });
    const preferences = await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0];
      return {
        preferences: (
          w.webContents as unknown as {
            getLastWebPreferences: () => {
              sandbox: boolean;
              contextIsolation: boolean;
              nodeIntegration: boolean;
            };
          }
        ).getLastWebPreferences(),
        size: w.getMinimumSize(),
      };
    });
    expect(preferences.preferences).toMatchObject({
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    });
    expect(preferences.size).toEqual([1200, 760]);
    const invalid = await page.evaluate(async () => {
      try {
        await window.cyclelab.saveSettings({ theme: "invalid" } as never);
        return "accepted";
      } catch (e) {
        return (e as Error).message;
      }
    });
    expect(invalid).toContain("no son válidos");
    await page.context().setOffline(true);
    await page.evaluate(async () => {
      await window.cyclelab.saveSettings({
        theme: "light",
        source: "garmin",
        model: "chosen/model",
        athlete: { ftp: 300, lthr: 175, weight: 75 },
      });
    });
    await expect(page.getByText("Tu histórico está vacío")).toBeVisible();
    const state = await page.evaluate(() => window.cyclelab.getState());
    expect(state.settings.model).toBe("chosen/model");
    expect(state.dataset.athlete).toEqual({
      ftp: 300,
      lthr: 175,
      weight: 75,
      history: [],
    });
    expect(state.messages).toEqual([]);
    expect(state.dataset.goals).toEqual([]);
    await page.evaluate(async () => {
      const s = (await window.cyclelab.getState()).settings;
      await window.cyclelab.saveSettings({
        theme: s.theme,
        model: s.model,
        athlete: s.athlete,
        source: "demo",
      });
    });
    await expect(page.locator(".chart-label").first()).toBeVisible();
    await page.locator(".act-item").nth(1).click();
    await expect(page.locator(".page[aria-busy=true]")).toBeVisible();
    await expect(page.locator(".chart-label").first()).toBeVisible();
    await page.keyboard.press("Meta+6");
    await page
      .getByRole("textbox", { name: "Mensaje para el entrenador" })
      .fill("Simular un error");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect(
      page.getByText("La herramienta falló", { exact: true }),
    ).toBeVisible();
  } finally {
    await app.close();
  }
});

test("performance compares rolling periods, traces records and shows zone coverage", async () => {
  const app = await electron.launch({
    args: ["out/main/index.js"],
    env: {
      ...process.env,
      CYCLELAB_USER_DATA: mkdtempSync(join(tmpdir(), "cyclelab-performance-")),
    },
  });
  try {
    const page = await app.firstWindow();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page
      .getByRole("navigation")
      .getByRole("button", { name: /Rendimiento/ })
      .click();
    await expect(page.getByText(/Modelo 5–20 min · R²/)).toBeVisible();
    await page.getByRole("button", { name: "42 días", exact: true }).click();
    await expect(
      page.getByText(
        "Últimos 42 días frente a 42 días anteriores · abre cada marca",
      ),
    ).toBeVisible();
    await expect(
      page.getByText(
        /de \d+ actividades con muestras de potencia y FTP de su fecha/,
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("img", { name: "Tiempo en zonas · Últimos 42 días" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Hace un año", exact: true })
      .click();
    await expect(
      page.getByText("Sin modelo en Mismos días hace un año"),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Periodo anterior", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Abrir la actividad de la marca de 20 min" })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { name: "Actividades", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Analizar este tramo" }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});

test("real goals can be created, edited, archived and survive a restart", async () => {
  const userData = mkdtempSync(join(tmpdir(), "cyclelab-goals-"));
  const launch = () =>
    electron.launch({
      args: ["out/main/index.js"],
      env: { ...process.env, CYCLELAB_USER_DATA: userData },
    });
  let app = await launch();
  try {
    let page = await app.firstWindow();
    await page.getByRole("button", { name: "Ajustes", exact: true }).waitFor();
    expect(
      await page.evaluate(async () => {
        try {
          await window.cyclelab.saveGoal("demo", {
            id: null,
            name: "Falso",
            date: "2027-01-01",
            kind: "",
            target: "",
            archived: false,
          });
          return "accepted";
        } catch (e) {
          return (e as Error).message;
        }
      }),
    ).toContain("demostración");
    await page.context().setOffline(true);
    await page.evaluate(async () => {
      const s = (await window.cyclelab.getState()).settings;
      await window.cyclelab.saveSettings({
        theme: s.theme,
        model: s.model,
        athlete: s.athlete,
        source: "garmin",
      });
    });
    await page.keyboard.press("Meta+1");
    const goals = page.locator(".goals-panel");
    await goals.getByRole("button", { name: "Nuevo objetivo" }).click();
    await goals.getByLabel("Nombre").fill("Quebrantahuesos");
    await goals.getByLabel("Fecha").fill("2027-06-19");
    await goals.getByLabel("Tipo de prueba").fill("Marcha de carretera");
    await goals.getByLabel("Objetivo personal").fill("Menos de 8 h");
    await goals.getByRole("button", { name: "Guardar" }).click();
    await expect(goals.getByText("Menos de 8 h")).toBeVisible();
    await goals.getByRole("button", { name: "Editar" }).click();
    await goals.getByLabel("Objetivo personal").fill("Menos de 7 h 30");
    await goals.getByRole("button", { name: "Guardar" }).click();
    await expect(goals.getByText("Menos de 7 h 30")).toBeVisible();
    await goals.getByRole("button", { name: "Archivar" }).click();
    await expect(goals.getByText("Archivados · 1")).toBeVisible();
    await expect(goals.getByText("Sin objetivos")).toBeVisible();
    await app.close();
    app = await launch();
    page = await app.firstWindow();
    await page.getByRole("button", { name: "Ajustes", exact: true }).waitFor();
    const state = await page.evaluate(() => window.cyclelab.getState());
    expect(state.dataset.goals).toMatchObject([
      {
        name: "Quebrantahuesos",
        date: Date.UTC(2027, 5, 19),
        kind: "Marcha de carretera",
        target: "Menos de 7 h 30",
        archived: true,
      },
    ]);
    await page.keyboard.press("Meta+1");
    await page.getByText("Archivados · 1").click();
    await page.getByRole("button", { name: "Restaurar" }).click();
    await expect(page.getByText("Menos de 7 h 30")).toBeVisible();
    await page.evaluate(async () => {
      const s = (await window.cyclelab.getState()).settings;
      await window.cyclelab.saveSettings({
        theme: s.theme,
        model: s.model,
        athlete: s.athlete,
        source: "demo",
      });
    });
    expect(
      (await page.evaluate(() => window.cyclelab.getState())).dataset.goals.map(
        (g) => g.name,
      ),
    ).toEqual(["Soplao BTT", "La Cantabrona 2027"]);
  } finally {
    await app.close();
  }
});

test("Garmin settings accepts the plain JWT token response", async () => {
  const app = await electron.launch({
    args: ["out/main/index.js"],
    env: {
      ...process.env,
      CYCLELAB_USER_DATA: mkdtempSync(join(tmpdir(), "cyclelab-garmin-auth-")),
    },
  });
  try {
    const page = await app.firstWindow();
    await page.getByRole("button", { name: "Ajustes", exact: true }).click();
    await app.evaluate(() => {
      globalThis.fetch = async () =>
        new Response(
          "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE5MDAwMDAwMDB9.test_signature",
          { headers: { "Content-Type": "text/plain" } },
        );
    });
    await page.getByLabel("API key de Garmin").fill("test-key-not-real");
    await page
      .getByRole("button", { name: "Guardar y comprobar", exact: true })
      .first()
      .click();
    await expect(
      page.getByText("Clave configurada", { exact: true }),
    ).toBeVisible();
    expect(
      (await page.evaluate(() => window.cyclelab.getState())).settings
        .garminConfigured,
    ).toBe(true);
    await page
      .getByRole("button", { name: "Cambiar clave", exact: true })
      .click();
    await expect(page.getByLabel("API key de Garmin")).toHaveValue("");
    await page
      .getByRole("button", { name: "Desconectar", exact: true })
      .click();
    expect(
      (await page.evaluate(() => window.cyclelab.getState())).settings
        .garminConfigured,
    ).toBe(false);
  } finally {
    // Playwright's close tears the window down first and can stall for minutes
    // after this flow; quitting like ⌘Q exits in well under a second.
    const exited = new Promise((r) => app.process().once("exit", r));
    await app.evaluate(({ app }) => setTimeout(() => app.quit(), 0));
    await exited;
  }
});

test("reclassifies saved Garmin activities on restart and exposes the new filters", async () => {
  const userData = mkdtempSync(join(tmpdir(), "cyclelab-classification-"));
  const launch = () =>
    electron.launch({
      args: ["out/main/index.js"],
      env: { ...process.env, CYCLELAB_USER_DATA: userData },
    });
  let app = await launch();
  try {
    let page = await app.firstWindow();
    await page.getByRole("button", { name: "Ajustes", exact: true }).waitFor();
    const template = (await page.evaluate(() => window.cyclelab.getState()))
      .dataset.activities[0];
    await app.evaluate(
      async (_electron, { userData, modulePath, template }) => {
        const Database = process
          .getBuiltinModule("module")
          .createRequire(modulePath)(modulePath);
        const db = new Database(userData + "/cyclelab.db");
        try {
          const insert = db.prepare(
            "INSERT INTO activities(source,id,date,summary) VALUES (?,?,?,?)",
          );
          for (const [i, patch] of [
            { name: "Sesión indoor", garminType: "indoor_cycling" },
            {
              name: "4x8 intervalos",
              garminType: "road_biking",
              date: Date.UTC(2021, 2, 15),
            },
            {
              name: "Morning ride",
              date: Date.UTC(2018, 4, 20),
              garminType: "road_biking",
              dist: null,
              elev: null,
              IF: null,
            },
          ].entries()) {
            const a = {
              ...template,
              ...patch,
              id: "saved-" + i,
              type: "endurance",
              structuredIntervals: undefined,
              classification: undefined,
            };
            insert.run("garmin", a.id, a.date, JSON.stringify(a));
          }
          db.prepare(
            "DELETE FROM settings WHERE key='classificationVersion'",
          ).run();
        } finally {
          db.close();
        }
      },
      {
        userData,
        modulePath: join(
          process.cwd(),
          "node_modules/better-sqlite3/lib/index.js",
        ),
        template,
      },
    );
    await page.evaluate(() =>
      window.cyclelab.saveSettings({
        theme: "dark",
        source: "garmin",
        model: null,
        athlete: { ftp: null, lthr: null, weight: null },
      }),
    );
    await app.close();
    app = await launch();
    page = await app.firstWindow();
    await page
      .getByRole("heading", { name: "Actividades", exact: true })
      .waitFor();
    const state = await page.evaluate(() => window.cyclelab.getState());
    expect(state.dataset.activities.map((a) => a.type).sort()).toEqual([
      "cycling",
      "indoor",
      "intervals",
    ]);
    await expect(page.locator(".act-item")).toHaveCount(3);
    await expect(
      page.getByRole("button", { name: "Todo", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "90 d", exact: true }).click();
    await expect(page.locator(".act-item")).toHaveCount(1);
    await page.getByRole("button", { name: "Todo", exact: true }).click();
    await expect(page.locator(".act-item")).toHaveCount(3);
    await page.getByLabel("Año de las actividades").selectOption("2021");
    await expect(page.locator(".act-item")).toHaveCount(1);
    await expect(page.locator(".act-item")).toContainText("4x8 intervalos");
    await page.getByLabel("Buscar actividad").fill("Morning");
    await expect(
      page
        .getByRole("listbox", { name: "Actividades" })
        .getByText("Sin actividades", { exact: true }),
    ).toBeVisible();
    await page.getByLabel("Buscar actividad").fill("");
    await page.getByLabel("Fecha desde").fill("2018-05-20");
    await page.getByLabel("Fecha hasta").fill("2018-05-20");
    await expect(page.getByLabel("Año de las actividades")).toHaveValue("");
    await expect(page.locator(".act-item")).toHaveCount(1);
    await expect(page.locator(".act-item")).toContainText("Morning ride");
    await page.screenshot({ path: "test-results/date-filters-dark.png" });
    await page.getByRole("button", { name: "Cambiar tema" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.screenshot({ path: "test-results/date-filters-light.png" });
    await page.getByRole("button", { name: "Cambiar tema" }).click();
    await page.getByLabel("Fecha desde").fill("2021-03-15");
    await expect(page.getByRole("alert")).toContainText("posterior");
    await page
      .getByRole("button", { name: "Restablecer filtros", exact: true })
      .click();
    await expect(page.getByLabel("Fecha desde")).toHaveValue("");
    await expect(page.getByLabel("Fecha hasta")).toHaveValue("");
    await expect(page.locator(".act-item")).toHaveCount(3);
    await page.getByRole("button", { name: "Indoor 1", exact: true }).click();
    await expect(page.locator(".act-item")).toHaveCount(2);
    await page.getByRole("button", { name: "Indoor 1", exact: true }).click();
    await expect(page.locator(".act-item")).toHaveCount(3);
    await page
      .locator(".act-item")
      .filter({ hasText: "4x8 intervalos" })
      .click();
    await expect(
      page.getByText(/Clasificación estimada · El nombre/),
    ).toBeVisible();
    await page.screenshot({ path: "test-results/classification-dark.png" });
    await page.getByRole("button", { name: "Cambiar tema" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.screenshot({ path: "test-results/classification-light.png" });
    await app.evaluate(
      (_electron, { userData, modulePath }) => {
        const Database = process
          .getBuiltinModule("module")
          .createRequire(modulePath)(modulePath);
        const db = new Database(userData + "/cyclelab.db");
        try {
          db.prepare(
            "UPDATE activities SET summary=json_set(summary,'$.type','endurance') WHERE source='garmin' AND id='saved-1'",
          ).run();
        } finally {
          db.close();
        }
      },
      {
        userData,
        modulePath: join(
          process.cwd(),
          "node_modules/better-sqlite3/lib/index.js",
        ),
      },
    );
    await page.getByRole("button", { name: "Ajustes", exact: true }).click();
    await page
      .getByRole("button", { name: "Volver a etiquetar todo", exact: true })
      .click();
    await expect(
      page.getByText(
        "Se han vuelto a etiquetar 3 actividades de todo el histórico.",
        { exact: true },
      ),
    ).toBeVisible();
    expect(
      (
        await page.evaluate(() => window.cyclelab.getState())
      ).dataset.activities.find((a) => a.id === "saved-1")?.type,
    ).toBe("intervals");
    await page.evaluate(() =>
      window.cyclelab.saveActivityFeel("garmin", "saved-1", {
        rpe: 8,
        fatigue: "tired",
        notes: "Piernas pesadas",
        type: "climb",
      }),
    );
    expect(
      await page.evaluate(() => window.cyclelab.reclassifyActivities()),
    ).toBe(3);
    const relabelled = (
      await page.evaluate(() => window.cyclelab.getState())
    ).dataset.activities.find((a) => a.id === "saved-1");
    expect(relabelled).toMatchObject({
      type: "climb",
      automaticType: "intervals",
      feel: { rpe: 8, fatigue: "tired", notes: "Piernas pesadas" },
    });
    expect(relabelled?.classification?.reason).toBeTruthy();
    await page.screenshot({ path: "test-results/history-settings-light.png" });
  } finally {
    await app.close();
  }
});

test("upgrades stored unlabelled power intervals and explains the detection", async () => {
  const userData = mkdtempSync(join(tmpdir(), "cyclelab-power-pattern-"));
  const launch = () =>
    electron.launch({
      args: ["out/main/index.js"],
      env: { ...process.env, CYCLELAB_USER_DATA: userData },
    });
  let app = await launch();
  try {
    let page = await app.firstWindow();
    await page.getByRole("button", { name: "Ajustes", exact: true }).waitFor();
    const template = (await page.evaluate(() => window.cyclelab.getState()))
      .dataset.activities[0];
    await app.evaluate(
      (_electron, { userData, modulePath, template }) => {
        const Database = process
          .getBuiltinModule("module")
          .createRequire(modulePath)(modulePath);
        const db = new Database(userData + "/cyclelab.db");
        try {
          const summary = {
            ...template,
            id: "power-pattern",
            name: "Ciclismo en ruta",
            type: "cycling",
            classification: undefined,
            structuredIntervals: false,
            intervalPattern: undefined,
            garminType: "road_biking",
          };
          const laps = [
            [1026, 151],
            [243, 313],
            [136, 41],
            [241, 313],
            [154, 35],
            [243, 311],
            [174, 49],
            [242, 309],
            [177, 28],
            [1686, 175],
          ].map(([dur, avgP], i) => ({
            id: "lap-" + i,
            label: "Vuelta " + (i + 1),
            kind: "lap",
            i0: 0,
            i1: 0,
            dur,
            avgP,
            np: null,
            hr: null,
            cad: null,
            max: null,
            gain: null,
            dist: null,
          }));
          const detail = {
            rows: [],
            laps,
            points: [],
            features: [],
            markers: [],
            best: [],
          };
          db.prepare(
            "INSERT INTO activities(source,id,date,summary,detail) VALUES (?,?,?,?,?)",
          ).run(
            "garmin",
            summary.id,
            summary.date,
            JSON.stringify(summary),
            JSON.stringify(detail),
          );
          db.prepare(
            "UPDATE settings SET value='1' WHERE key='classificationVersion'",
          ).run();
        } finally {
          db.close();
        }
      },
      {
        userData,
        modulePath: join(
          process.cwd(),
          "node_modules/better-sqlite3/lib/index.js",
        ),
        template,
      },
    );
    await page.evaluate(() =>
      window.cyclelab.saveSettings({
        theme: "dark",
        source: "garmin",
        model: null,
        athlete: { ftp: null, lthr: null, weight: null },
      }),
    );
    await app.close();
    app = await launch();
    page = await app.firstWindow();
    await expect(page.locator(".act-item .cl-badge")).toHaveText("Intervalos");
    await expect(page.getByText(/4 bloques de 4:02 a ≈312 W/)).toBeVisible();
    await page.screenshot({ path: "test-results/power-pattern-dark.png" });
    await page.getByRole("button", { name: "Cambiar tema" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.screenshot({ path: "test-results/power-pattern-light.png" });
    expect(
      await page.evaluate(() => window.cyclelab.reclassifyActivities()),
    ).toBe(1);
    expect(
      (await page.evaluate(() => window.cyclelab.getState())).dataset
        .activities[0].intervalPattern?.repetitions,
    ).toBe(4);
  } finally {
    await app.close();
  }
});

test("manual segments creation, isolation, restart and deletion", async () => {
  const userData = mkdtempSync(join(tmpdir(), "cyclelab-segments-"));
  const launch = () =>
    electron.launch({
      args: ["out/main/index.js"],
      env: { ...process.env, CYCLELAB_USER_DATA: userData },
    });
  let app = await launch();
  try {
    let page = await app.firstWindow();
    await expect(page.locator(".chart-label").first()).toBeVisible();
    await page.keyboard.press("ArrowRight");
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page
      .getByRole("button", { name: "Crear segmento", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Crear segmento", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Buscar actividad" }),
    ).toHaveCount(0);
    const initial = Number(
      await page.getByRole("slider", { name: "Inicio" }).inputValue(),
    );
    await page
      .getByRole("button", { name: "Adelantar inicio", exact: true })
      .click();
    await expect(page.getByRole("slider", { name: "Inicio" })).toHaveValue(
      String(initial + 1),
    );
    await page.getByRole("slider", { name: "Inicio" }).focus();
    await page.keyboard.press("End");
    expect(
      Number(await page.getByRole("slider", { name: "Inicio" }).inputValue()),
    ).toBe(
      Number(await page.getByRole("slider", { name: "Final" }).inputValue()) -
        1,
    );
    await page.keyboard.press("Escape");
    await expect(page.getByRole("slider", { name: "Inicio" })).toHaveValue("0");
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "Buscar actividad" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Crear segmento", exact: true })
      .click();
    await page.screenshot({ path: "test-results/segment-creator-dark.png" });
    await page.getByRole("button", { name: "Cambiar tema" }).click();
    await page.screenshot({ path: "test-results/segment-creator-light.png" });
    await page.getByRole("button", { name: "Cambiar tema" }).click();
    await page.getByRole("button", { name: "Siguiente", exact: true }).click();
    await expect(page.getByRole("slider", { name: "Inicio" })).toBeDisabled();
    await page.getByLabel("Nombre del segmento").fill("Subida de prueba");
    await page.getByRole("button", { name: "Atrás", exact: true }).click();
    await page.getByRole("button", { name: "Siguiente", exact: true }).click();
    await expect(page.getByLabel("Nombre del segmento")).toHaveValue(
      "Subida de prueba",
    );
    await page
      .getByRole("button", { name: "Guardar segmento", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Segmentos", exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Segmentos" })
      .click();
    await expect(page.locator(".detail-heading")).toHaveText(
      "Subida de prueba",
    );
    await page.screenshot({ path: "test-results/segments-dark.png" });
    await page.getByRole("button", { name: "Cambiar tema" }).click();
    await page.screenshot({ path: "test-results/segments-light.png" });
    await page.keyboard.press("Meta+5");
    await expect(
      page.getByText("Sin puertos marcados", { exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Meta+4");
    await page
      .getByRole("button", { name: "Marcar como puerto", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Quitar marca de puerto" }),
    ).toBeVisible();
    await page.keyboard.press("Meta+5");
    await expect(page.locator(".detail-heading")).toHaveText(
      "Subida de prueba",
    );
    await page.screenshot({ path: "test-results/puertos-marked-light.png" });
    const validation = await page
      .evaluate(async () => {
        const state = await window.cyclelab.getState();
        const a = state.dataset.activities[0];
        let rejected = false;
        try {
          await window.cyclelab.saveSegment(
            "demo",
            a.id,
            "Invalid",
            0,
            99999999,
          );
        } catch {
          rejected = true;
        }
        return { rejected };
      })
      .catch(() => ({ rejected: false }));
    expect(validation.rejected).toBe(true);
    await app.close();
    app = await launch();
    page = await app.firstWindow();
    await expect(
      page.getByRole("heading", { name: "Actividades", exact: true }),
    ).toBeVisible();
    const stored = await page.evaluate(
      async () => (await window.cyclelab.getState()).segments,
    );
    expect(stored).toHaveLength(1);
    expect(stored[0].isClimb).toBe(true);
    await page.evaluate(async () => {
      const s = await window.cyclelab.getState();
      await window.cyclelab.saveSettings({
        theme: s.settings.theme,
        source: "garmin",
        model: s.settings.model,
        athlete: s.settings.athlete,
      });
    });
    expect(
      await page.evaluate(
        async () => (await window.cyclelab.getState()).segments.length,
      ),
    ).toBe(0);
    await page.evaluate(async () => {
      const s = await window.cyclelab.getState();
      await window.cyclelab.saveSettings({
        theme: s.settings.theme,
        source: "demo",
        model: s.settings.model,
        athlete: s.settings.athlete,
      });
    });
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Segmentos" })
      .click();
    await page.keyboard.press("Meta+5");
    await page.getByRole("button", { name: "Quitar marca de puerto" }).click();
    await expect(
      page.getByText("Sin puertos marcados", { exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Meta+4");
    await expect(page.locator(".detail-heading")).toHaveText(
      "Subida de prueba",
    );
    expect(
      await page.evaluate(
        async () => (await window.cyclelab.getState()).segments[0].isClimb,
      ),
    ).toBe(false);
    await page
      .getByRole("button", { name: "Eliminar segmento", exact: true })
      .click();
    await page.getByRole("button", { name: "Confirmar eliminación" }).click();
    await expect(
      page.getByText("Sin segmentos guardados", { exact: true }),
    ).toBeVisible();
  } finally {
    await app.close();
  }
});

test("segment results cover all years, repeated passes, persistence and refreshed samples", async () => {
  const userData = mkdtempSync(join(tmpdir(), "cyclelab-matching-"));
  const launch = () =>
    electron.launch({
      args: ["out/main/index.js"],
      env: { ...process.env, CYCLELAB_USER_DATA: userData },
    });
  let app = await launch();
  try {
    let page = await app.firstWindow();
    await expect(page.locator(".chart-label").first()).toBeVisible();
    const template = await page.evaluate(
      async () => (await window.cyclelab.getState()).dataset.activities[0],
    );
    await app.evaluate(
      (_electron, { userData, modulePath, template }) => {
        const Database = process
          .getBuiltinModule("module")
          .createRequire(modulePath)(modulePath);
        const db = new Database(userData + "/cyclelab.db");
        const path = Array.from({ length: 51 }, (_, i) => i * 10);
        const make = (xs: number[]) =>
          xs.map((x, i) => ({
            x: i * 2,
            km: i / 100,
            lat: 0,
            lon: x / 111195,
            p: 200,
            ps: 200,
            hr: 145,
            cad: 85,
            elev: 10,
            v: 5,
          }));
        try {
          for (const [id, year, xs] of [
            ["origin", 2026, path],
            [
              "historic",
              2016,
              [...path, ...path.toReversed().slice(1), ...path.slice(1)],
            ],
            ["reverse", 2019, path.toReversed()],
            ["missing", 2018, []],
          ] as [string, number, number[]][]) {
            const a = {
              ...template,
              id,
              name: id,
              date: Date.UTC(year, 0, 1),
              detailStatus: "ready",
            };
            db.prepare(
              "INSERT INTO activities(source,id,date,summary,detail,best) VALUES (?,?,?,?,?,?)",
            ).run(
              "garmin",
              id,
              a.date,
              JSON.stringify(a),
              JSON.stringify({
                rows: make(xs),
                laps: [],
                points: [],
                markers: [],
                features: [],
                best: [],
              }),
              "[]",
            );
          }
          db.prepare(
            "INSERT INTO settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
          ).run(
            "settings",
            JSON.stringify({
              source: "garmin",
              theme: "dark",
              model: null,
              athlete: { ftp: null, lthr: null, weight: null },
            }),
          );
        } finally {
          db.close();
        }
      },
      {
        userData,
        modulePath: join(
          process.cwd(),
          "node_modules/better-sqlite3/lib/index.js",
        ),
        template,
      },
    );
    await app.close();
    app = await launch();
    page = await app.firstWindow();
    await expect(
      page.getByRole("heading", { name: "Actividades", exact: true }),
    ).toBeVisible();
    const segment = await page.evaluate(async () =>
      window.cyclelab.saveSegment("garmin", "origin", "Tramo histórico", 0, 50),
    );
    await expect
      .poll(async () =>
        app.evaluate(
          (_electron, { userData, modulePath, id }) => {
            const Database = process
              .getBuiltinModule("module")
              .createRequire(modulePath)(modulePath);
            const db = new Database(userData + "/cyclelab.db", {
              readonly: true,
            });
            try {
              return JSON.parse(
                db
                  .prepare(
                    "SELECT payload FROM segment_results WHERE source='garmin' AND id=?",
                  )
                  .get(id)?.payload ?? "{}",
              ).status;
            } finally {
              db.close();
            }
          },
          {
            userData,
            modulePath: join(
              process.cwd(),
              "node_modules/better-sqlite3/lib/index.js",
            ),
            id: segment.id,
          },
        ),
      )
      .toBe("done");
    const report = await page.evaluate(
      (id) => window.cyclelab.getSegmentResults("garmin", id),
      segment.id,
    );
    expect(report.total).toBe(4);
    expect(report.scanned).toBe(4);
    expect(report.skipped).toBe(1);
    expect(report.attempts.map((a) => a.activityId)).toEqual([
      "origin",
      "historic",
      "historic",
    ]);
    expect(report.attempts.map((a) => a.dur)).toEqual([100, 100, 100]);
    await page.keyboard.press("Meta+4");
    await expect(
      page.getByText("Resultados del segmento", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "historic", exact: true }),
    ).toHaveCount(2);
    await page
      .getByText("Resultados del segmento", { exact: true })
      .scrollIntoViewIfNeeded();
    const resultsTable = page.locator("table").filter({
      has: page.getByRole("button", { name: "Fecha", exact: true }),
    });
    const gradeMetric = page
      .locator(".cl-metric")
      .filter({ hasText: "Pendiente media" });
    await expect(gradeMetric).toContainText("0,0");
    await expect(gradeMetric).toContainText("%");
    const attemptRow = resultsTable
      .locator("tbody tr")
      .filter({ hasText: "historic" })
      .last();
    await attemptRow.getByRole("cell").nth(1).click();
    await expect(attemptRow).toHaveAttribute("aria-selected", "true");
    const profilePanel = page
      .locator(".cl-panel")
      .filter({ has: page.getByText("Perfil del segmento", { exact: true }) });
    await expect(
      profilePanel.getByText("Frecuencia cardíaca", { exact: true }),
    ).toBeVisible();
    await expect(profilePanel.locator(".chart-overlay")).toHaveCount(1);
    await expect(
      profilePanel.getByText("Velocidad", { exact: true }),
    ).toBeVisible();
    await profilePanel
      .locator(".chart-surface")
      .first()
      .hover({ position: { x: 150, y: 50 } });
    await expect(profilePanel.locator(".cl-tip")).toContainText("5,0 km/h");
    const chart = profilePanel.locator(".chart-surface").last();
    await chart.scrollIntoViewIfNeeded();
    await chart.hover({ position: { x: 150, y: 50 } });
    await expect(profilePanel.locator(".cl-tip")).toContainText("Pendiente");
    await expect(profilePanel.locator(".cl-tip")).toContainText("145 ppm");
    await expect(profilePanel.locator(".cl-tip")).toContainText("200 W");
    await page.screenshot({ path: "test-results/segment-profile-dark.png" });
    await page.getByRole("button", { name: "Cambiar tema" }).click();
    await chart.hover({ position: { x: 150, y: 50 } });
    await page.screenshot({ path: "test-results/segment-profile-light.png" });
    const dateHeader = resultsTable.getByRole("columnheader", {
      name: "Fecha",
      exact: true,
    });
    await expect(dateHeader).toHaveAttribute("aria-sort", "descending");
    await resultsTable
      .getByRole("button", { name: "Fecha", exact: true })
      .click();
    await expect(dateHeader).toHaveAttribute("aria-sort", "ascending");
    await expect(resultsTable.locator("tbody tr").first()).toContainText(
      "2016",
    );
    await resultsTable
      .getByRole("button", { name: "Fecha", exact: true })
      .press("Enter");
    await expect(dateHeader).toHaveAttribute("aria-sort", "descending");
    await expect(resultsTable.locator("tbody tr").first()).toContainText(
      "2026",
    );
    await resultsTable
      .getByRole("button", { name: "Actividad", exact: true })
      .click();
    await expect(resultsTable.locator("tbody tr").first()).toContainText(
      "historic",
    );
    await page.screenshot({ path: "test-results/segment-results-dark.png" });
    await page.getByRole("button", { name: "Cambiar tema" }).click();
    await page.screenshot({ path: "test-results/segment-results-light.png" });
    const rendererErrors: string[] = [];
    page.on("pageerror", (error) => rendererErrors.push(error.message));
    await expect(
      page.getByRole("button", { name: "Comparar intentos", exact: true }),
    ).toBeDisabled();
    await resultsTable.getByRole("checkbox").nth(0).check();
    await resultsTable.getByRole("checkbox").nth(1).check();
    await page
      .getByRole("button", { name: "Comparar intentos", exact: true })
      .click();
    const comparison = page.getByRole("region", {
      name: "Comparación de intentos",
    });
    await expect(comparison.locator(".chart-engine")).toHaveCount(4);
    await expect(comparison).toContainText("Tiempos aproximados");
    for (const theme of ["dark", "light"] as const) {
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await page.getByRole("button", { name: "Cambiar tema" }).click();
      await comparison
        .getByText("Comparar intentos", { exact: true })
        .scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `test-results/segment-comparison-${theme}.png`,
      });
      for (let i = 0; i < 4; i++) {
        const plot = comparison.locator(".cl-chart").nth(i);
        await plot.scrollIntoViewIfNeeded();
        await plot.screenshot({
          path: `test-results/segment-comparison-${theme}-${i}.png`,
        });
      }
    }
    const surface = comparison.locator(".chart-surface").first();
    await surface.scrollIntoViewIfNeeded();
    const bounds = (await surface.boundingBox())!;
    await page.mouse.move(bounds.x + 80, bounds.y + 40);
    await page.mouse.down();
    await page.mouse.move(bounds.x + 200, bounds.y + 40);
    await page.mouse.up();
    await expect(comparison.locator(".cl-sel")).toHaveCount(4);
    await comparison.focus();
    await page.keyboard.press("Escape");
    await expect(comparison.locator(".cl-sel")).toHaveCount(0);
    const sectors = comparison.locator("table").filter({
      has: page.getByRole("columnheader", { name: "A − B" }),
    });
    const sector = sectors.locator("tbody tr").first();
    await expect(sector).toContainText(/km/);
    await expect(comparison).toContainText("Total A − B");
    await expect(comparison).toContainText("Viento, tráfico");
    await sector.click();
    await expect(sector).toHaveAttribute("aria-selected", "true");
    await expect(comparison.locator(".cl-sel")).toHaveCount(4);
    await sector.press("Escape");
    await expect(comparison.locator(".cl-sel")).toHaveCount(0);
    for (const theme of ["light", "dark", "light"]) {
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await page.getByRole("button", { name: "Cambiar tema" }).click();
      await sectors.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `test-results/segment-sectors-${theme}.png`,
      });
    }
    await comparison.getByRole("button", { name: /^B ·/ }).click();
    await expect(
      page.getByRole("heading", { name: "Actividades", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".sel-bar")).toContainText("Selección");
    await page.keyboard.press("Meta+4");
    await resultsTable.getByRole("checkbox").nth(0).check();
    await resultsTable.getByRole("checkbox").nth(1).check();
    await resultsTable.getByRole("checkbox").nth(2).check();
    await expect(resultsTable.locator("input:checked")).toHaveCount(2);
    await page
      .getByRole("button", { name: "Comparar intentos", exact: true })
      .click();
    await expect(comparison.locator(".chart-engine")).toHaveCount(4);
    await comparison.getByRole("button", { name: /^A ·/ }).click();
    await expect(page.locator(".sel-bar")).toContainText("Selección");
    await page.keyboard.press("Meta+4");
    await expect(
      resultsTable.getByText("original", { exact: false }),
    ).toHaveCount(1);
    await expect(
      resultsTable.getByRole("button", { name: "Excluir", exact: true }),
    ).toHaveCount(2);
    await resultsTable
      .getByRole("button", { name: "Excluir", exact: true })
      .first()
      .click();
    await page.getByLabel("Motivo de la exclusión").fill("Camino paralelo");
    await page
      .getByRole("button", { name: "Excluir coincidencia", exact: true })
      .click();
    await expect(
      page.getByText("1 coincidencia excluida manualmente", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "Camino paralelo", exact: true }),
    ).toBeVisible();
    await expect(
      page.locator(".cl-metric").filter({ hasText: "Resultados" }),
    ).toContainText("2");
    await expect(
      page.locator(".cl-metric").filter({ hasText: "Último intento" }),
    ).toContainText("2026");
    await page.getByRole("button", { name: "Renombrar", exact: true }).click();
    await page.getByLabel("Nuevo nombre").fill("Tramo renombrado");
    await page
      .getByRole("button", { name: "Guardar nombre", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Marcar como favorito", exact: true })
      .click();
    await expect(
      page.getByRole("option", { name: /Tramo renombrado.*Favorito/ }),
    ).toBeVisible();
    await page.getByLabel("Buscar segmento").fill("zzz");
    await expect(page.getByText("Ningún segmento coincide.")).toBeVisible();
    await page.getByLabel("Buscar segmento").fill("RENOMBRADO");
    await expect(
      page.getByRole("option", { name: /Tramo renombrado/ }),
    ).toBeVisible();
    await page.screenshot({ path: "test-results/segment-review-dark.png" });
    await page.getByRole("button", { name: "Cambiar tema" }).click();
    await page.screenshot({ path: "test-results/segment-review-light.png" });
    expect(rendererErrors).toEqual([]);
    await app.close();
    app = await launch();
    page = await app.firstWindow();
    await expect(
      page.getByRole("heading", { name: "Actividades", exact: true }),
    ).toBeVisible();
    expect(
      (
        await page.evaluate(
          (id) => window.cyclelab.getSegmentResults("garmin", id),
          segment.id,
        )
      ).attempts,
    ).toEqual(report.attempts);
    await app.evaluate(
      (_electron, { userData, modulePath }) => {
        const Database = process
          .getBuiltinModule("module")
          .createRequire(modulePath)(modulePath);
        const db = new Database(userData + "/cyclelab.db");
        try {
          db.prepare(
            "UPDATE activities SET detail=(SELECT detail FROM activities WHERE source='garmin' AND id='origin') WHERE source='garmin' AND id='missing'",
          ).run();
          db.prepare(
            "INSERT INTO settings VALUES ('activityRevision:garmin','1') ON CONFLICT(key) DO UPDATE SET value=CAST(value AS INTEGER)+1",
          ).run();
        } finally {
          db.close();
        }
      },
      {
        userData,
        modulePath: join(
          process.cwd(),
          "node_modules/better-sqlite3/lib/index.js",
        ),
      },
    );
    await expect
      .poll(
        async () =>
          (
            await page.evaluate(
              (id) => window.cyclelab.getSegmentResults("garmin", id),
              segment.id,
            )
          ).attempts.length,
      )
      .toBe(4);
    const reviewed = (
      await page.evaluate(() => window.cyclelab.getState())
    ).segments.find((s) => s.id === segment.id)!;
    expect(reviewed).toMatchObject({
      name: "Tramo renombrado",
      favorite: true,
    });
    expect(Object.values(reviewed.excluded!)).toEqual(["Camino paralelo"]);
    expect(
      (
        await page.evaluate(
          (id) => window.cyclelab.getSegmentResults("garmin", id),
          segment.id,
        )
      ).attempts.map((a) => a.id),
    ).toContain(Object.keys(reviewed.excluded!)[0]);
    await page.keyboard.press("Meta+4");
    await page.getByRole("button", { name: "Restaurar", exact: true }).click();
    await expect(
      page.getByText("coincidencia excluida manualmente", { exact: false }),
    ).toHaveCount(0);
    expect(
      (await page.evaluate(() => window.cyclelab.getState())).segments[0]
        .excluded,
    ).toEqual({});
    const isolated = await page.evaluate(async (id) => {
      try {
        await window.cyclelab.getSegmentResults("demo", id);
        return false;
      } catch {
        return true;
      }
    }, segment.id);
    expect(isolated).toBe(true);
  } finally {
    await app.close();
  }
});

test("MapTiler credentials, isolated map resources, real GPS map and selection", async () => {
  const userData = mkdtempSync(join(tmpdir(), "cyclelab-map-"));
  const app = await electron.launch({
    args: ["out/main/index.js"],
    env: { ...process.env, CYCLELAB_USER_DATA: userData },
  });
  try {
    const page = await app.firstWindow();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await expect(page.locator(".chart-label").first()).toBeVisible();
    const template = await page.evaluate(
      async () => (await window.cyclelab.getState()).dataset.activities[0],
    );
    await app.evaluate(
      (_electron, { userData, modulePath, template }) => {
        const Database = process
          .getBuiltinModule("module")
          .createRequire(modulePath)(modulePath);
        const db = new Database(userData + "/cyclelab.db");
        try {
          const rows = Array.from({ length: 1001 }, (_, i) => ({
            x: i,
            km: i / 1000,
            p: 100 + i / 5,
            ps: 100 + i / 5,
            hr: 130,
            cad: 80,
            elev: 10 + i,
            v: 25,
            lat: 43.46,
            lon: -3.81 + i * 0.00001,
          }));
          const a = {
            ...template,
            id: "map-route",
            name: "Ruta GPS de prueba",
            detailStatus: "ready",
          };
          const detail = {
            rows,
            laps: [],
            points: rows.map((_, i) => [i * 8, 0]),
            pointIndices: rows.map((_, i) => i),
            features: [],
            markers: [],
            best: [],
          };
          db.prepare(
            "INSERT INTO activities(source,id,date,summary,detail,best) VALUES (?,?,?,?,?,?)",
          ).run(
            "garmin",
            a.id,
            a.date,
            JSON.stringify(a),
            JSON.stringify(detail),
            "[]",
          );
        } finally {
          db.close();
        }
        const original = globalThis.fetch;
        globalThis.fetch = async (input, init) => {
          const url = new URL(
            typeof input === "string"
              ? input
              : input instanceof URL
                ? input.href
                : input.url,
          );
          if (url.hostname !== "api.maptiler.com") return original(input, init);
          if (url.searchParams.get("key") !== "maptiler-test-key")
            return new Response("denied", { status: 403 });
          if (url.pathname.endsWith("style.json"))
            return new Response(
              JSON.stringify({
                version: 8,
                sources: {
                  base: {
                    type: "raster",
                    url: "https://api.maptiler.com/tiles/test/tiles.json?key=maptiler-test-key",
                  },
                },
                layers: [
                  {
                    id: "background",
                    type: "background",
                    paint: {
                      "background-color": url.pathname.includes("dark")
                        ? "#15202b"
                        : "#cddaca",
                    },
                  },
                  { id: "base", type: "raster", source: "base" },
                ],
              }),
              {
                headers: {
                  "content-type": "application/json",
                  "cache-control": "max-age=60",
                },
              },
            );
          if (url.pathname.endsWith("tiles.json"))
            return new Response(
              JSON.stringify({
                tilejson: "3.0.0",
                tiles: [
                  "https://api.maptiler.com/tiles/test/{z}/{x}/{y}.png?key=maptiler-test-key",
                ],
                tileSize: 256,
                minzoom: 0,
                maxzoom: 16,
              }),
              { headers: { "content-type": "application/json" } },
            );
          return new Response(
            Buffer.from(
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4AWM4fOnwfwAIDANYHYZPQQAAAABJRU5ErkJggg==",
              "base64",
            ),
            {
              headers: {
                "content-type": "image/png",
                "cache-control": "max-age=60",
              },
            },
          );
        };
      },
      {
        userData,
        modulePath: join(
          process.cwd(),
          "node_modules/better-sqlite3/lib/index.js",
        ),
        template,
      },
    );
    await page.getByRole("button", { name: "Ajustes", exact: true }).click();
    const panel = page
      .locator(".cl-panel")
      .filter({ has: page.getByText("MapTiler", { exact: true }) });
    await panel.getByLabel("API key de MapTiler").fill("maptiler-test-key");
    await panel.getByRole("button", { name: "Guardar y comprobar" }).click();
    await expect(panel.getByText("Clave configurada")).toBeVisible();
    expect(
      await page.evaluate(async () =>
        JSON.stringify(await window.cyclelab.getState()),
      ),
    ).not.toContain("maptiler-test-key");
    const resource = await page.evaluate(() =>
      window.cyclelab.mapResource("/maps/outdoor-v4/style.json"),
    );
    expect(JSON.stringify(resource)).not.toContain("maptiler-test-key");
    expect(JSON.stringify(resource)).toContain("cyclemap://");
    expect(
      await page.evaluate(async () => {
        try {
          await window.cyclelab.mapResource("https://example.com");
          return false;
        } catch {
          return true;
        }
      }),
    ).toBe(true);
    await page.evaluate(async () => {
      const s = (await window.cyclelab.getState()).settings;
      await window.cyclelab.saveSettings({
        source: "garmin",
        theme: s.theme,
        model: s.model,
        athlete: s.athlete,
      });
    });
    await page.keyboard.press("Meta+2");
    const map = page.locator(".geo-map");
    await expect(map.locator(".maplibregl-canvas")).toBeVisible();
    await expect(
      map.getByText("No se pudo cargar la cartografía", { exact: false }),
    ).toHaveCount(0);
    await expect(map.getByRole("button", { name: "Acercar" })).toBeVisible();
    await expect(map.locator(".geo-map-frame")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await map
      .locator(".maplibregl-canvas")
      .screenshot({ path: "test-results/route-initial.png" });
    await map.getByRole("button", { name: "Potencia", exact: true }).click();
    await expect(map.getByText(/Potencia absoluta/)).toBeVisible();
    await map.getByRole("button", { name: "FC", exact: true }).click();
    await expect(map.getByText(/Frecuencia cardíaca \(ppm\)/)).toBeVisible();
    await map.getByRole("button", { name: "Seleccionar tramo" }).click();
    const canvas = map.locator(".maplibregl-canvas");
    await canvas.scrollIntoViewIfNeeded();
    const bounds = await canvas.boundingBox();
    await canvas.click({
      position: { x: bounds!.width * 0.3, y: bounds!.height / 2 },
    });
    await expect(map.getByRole("status")).toHaveText(/Haz clic en el final/);
    await expect(map.locator(".map-readout")).toContainText(/\d+ ppm/);
    await canvas.click({
      position: { x: bounds!.width * 0.7, y: bounds!.height / 2 },
    });
    await expect(
      page.getByRole("button", { name: "Crear segmento", exact: true }),
    ).toBeEnabled();
    await page.screenshot({ path: "test-results/maptiler-dark.png" });
    await app.evaluate(() => {
      const g = globalThis as typeof globalThis & {
        workingMapFetch: typeof fetch;
        mapFailure: "tiles" | "offline" | null;
      };
      g.workingMapFetch = globalThis.fetch;
      g.mapFailure = null;
      globalThis.fetch = async (input, init) => {
        const url = String(input);
        if (g.mapFailure === "offline") throw new Error("offline");
        if (g.mapFailure === "tiles" && url.includes(".png"))
          return new Response("temporary tile failure", { status: 503 });
        return g.workingMapFetch(input, init);
      };
    });
    const fail = (mode: "tiles" | "offline" | null) =>
      app.evaluate((_electron, mode) => {
        (
          globalThis as typeof globalThis & { mapFailure: typeof mode }
        ).mapFailure = mode;
      }, mode);
    const frame = map.locator(".geo-map-frame");
    const schematic = map.getByRole("img", { name: "Recorrido", exact: true });
    const retry = map.getByRole("button", { name: "Reintentar mapa" });
    const recover = async () => {
      await fail(null);
      await retry.click();
      await expect(map.getByRole("alert")).toHaveCount(0);
      await expect(frame).toHaveAttribute("data-ready", "true");
      await expect(canvas).toBeVisible();
      await expect(schematic).toHaveCount(0);
    };
    for (const theme of ["dark", "light"]) {
      // New tiles fail after zoom: preserve the canvas and selection.
      await fail("tiles");
      await map.getByRole("button", { name: "Alejar", exact: true }).click();
      await expect(map.getByRole("alert")).toContainText(
        "No se pudo cargar parte",
      );
      await expect(canvas).toBeVisible();
      await expect(schematic).toHaveCount(0);
      await map.getByRole("button", { name: "Acercar", exact: true }).click();
      await expect(canvas).toBeVisible();
      await page.screenshot({ path: `test-results/map-partial-${theme}.png` });
      await recover();

      // A cached style can start offline even if its TileJSON cannot load.
      await page.evaluate(() =>
        Promise.all([
          window.cyclelab.mapResource("/maps/outdoor-v4/style.json"),
          window.cyclelab.mapResource("/maps/outdoor-v4-dark/style.json"),
        ]),
      );
      await fail("offline");
      await page.getByRole("button", { name: "Cambiar tema" }).click();
      await expect(map.getByRole("alert")).toContainText(
        "No se pudo cargar parte",
      );
      await expect(frame).toHaveAttribute("data-ready", "true");
      await expect(canvas).toBeVisible();
      await expect(schematic).toHaveCount(0);
      await page.screenshot({
        path: `test-results/map-cached-${theme === "dark" ? "light" : "dark"}.png`,
      });
      await recover();
      await page.getByRole("button", { name: "Cambiar tema" }).click();
      await expect(frame).toHaveAttribute("data-ready", "true");

      // Saving the test key clears the main-process resource cache.
      await page.evaluate(() =>
        window.cyclelab.saveCredential("maptiler", "maptiler-test-key"),
      );
      await fail("offline");
      // Remount with an uncached style: this is a genuine startup failure.
      await page.getByRole("button", { name: "Cambiar tema" }).click();
      await expect(map.getByRole("alert")).toContainText(
        "No se pudo cargar la cartografía",
      );
      await expect(schematic).toBeVisible();
      await expect(canvas).toBeHidden();
      await expect(
        page.getByRole("button", { name: "Crear segmento", exact: true }),
      ).toBeEnabled();
      await page.screenshot({
        path: `test-results/map-startup-${theme === "dark" ? "light" : "dark"}.png`,
      });
      await recover();
      await page.screenshot({
        path: `test-results/maptiler-${theme === "dark" ? "light" : "dark"}.png`,
      });
    }
    await page.getByRole("button", { name: "Ajustes", exact: true }).click();
    await panel.getByRole("button", { name: "Desconectar" }).click();
    await expect(panel.getByLabel("API key de MapTiler")).toHaveValue("");
    await page.keyboard.press("Meta+2");
    await expect(
      page.getByText("Configura MapTiler para ver la cartografía."),
    ).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});
