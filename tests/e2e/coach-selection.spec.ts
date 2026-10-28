import { test, expect, _electron as electron } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("four intervals, comparison and selected segment reach the coach and link back", async () => {
  const app = await electron.launch({
    args: ["out/main/index.js"],
    env: {
      ...process.env,
      CYCLELAB_USER_DATA: mkdtempSync(join(tmpdir(), "cyclelab-selection-")),
    },
  });
  try {
    const page = await app.firstWindow();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.getByRole("button", { name: "Ajustes", exact: true }).waitFor();
    await page
      .getByRole("option", { name: /4×8.*umbral/ })
      .first()
      .click();
    const checks = page.getByRole("checkbox", {
      name: "Seleccionar intervalo para analizar",
    });
    await expect(checks.first()).toBeVisible();
    for (let i = 1; i <= 4; i++) await checks.nth(i).check();
    await expect(page.getByText("4 intervalos seleccionados")).toBeVisible();
    await page
      .getByRole("button", { name: "Analizar este tramo", exact: true })
      .last()
      .click();
    await expect(
      page.getByText("Selección actual · 4 tramos", { exact: true }),
    ).toBeVisible();
    const selected = await page.evaluate(
      async () => (await window.cyclelab.getState()).messages.at(-1)!.tools[0],
    );
    expect(selected.rows).toHaveLength(4);
    expect(selected.rows.map((r) => r.tramo)).toEqual([
      "Serie 1",
      "Serie 2",
      "Serie 3",
      "Serie 4",
    ]);
    for (const theme of ["dark", "light"]) {
      if (theme === "light")
        await page.getByRole("button", { name: "Cambiar tema" }).click();
      await expect(page.getByLabel("Contexto del entrenador")).toContainText(
        "4 tramos seleccionados",
      );
      await page.screenshot({
        path: `test-results/coach-selection-${theme}.png`,
      });
    }
    await page
      .locator(".chat-log")
      .getByRole("button", {
        name: String(selected.rows[2].actividad),
        exact: true,
      })
      .nth(2)
      .click();
    await expect(page.locator(".sel-bar")).toBeVisible();
    await expect(page.getByLabel("Contexto del entrenador")).toContainText(
      "1 tramo seleccionado",
    );
    await page.getByRole("button", { name: "Cerrar panel IA" }).click();
    const activityChecks = page.locator(".activity-list").getByRole("checkbox");
    await activityChecks.nth(0).check();
    await activityChecks.nth(1).check();
    await page.getByRole("button", { name: "Comparar", exact: true }).click();
    await page
      .getByRole("button", { name: "Explicar esta comparación" })
      .click();
    await expect(
      page.getByText("Comparación seleccionada", { exact: true }),
    ).toBeVisible();
    const comparison = await page.evaluate(
      async () => (await window.cyclelab.getState()).messages.at(-1)!.tools[0],
    );
    expect(comparison.rows).toHaveLength(2);
    expect(comparison.rows[0].activityId).not.toBe(
      comparison.rows[1].activityId,
    );
    await page.getByRole("button", { name: "Cerrar panel IA" }).click();
    await page.evaluate(async () => {
      const { dataset } = await window.cyclelab.getState();
      await window.cyclelab.saveSegment(
        "demo",
        dataset.activities[0].id,
        "Tramo elegido",
        10,
        30,
      );
      await window.cyclelab.saveSegment(
        "demo",
        dataset.activities[1].id,
        "Otro tramo",
        0,
        20,
      );
    });
    await page
      .getByRole("button", { name: "Segmentos", exact: false })
      .first()
      .click();
    await page
      .getByRole("option", { name: "Tramo elegido", exact: false })
      .click();
    await page
      .getByRole("button", { name: "Analizar este tramo", exact: true })
      .click();
    await expect(
      page.getByText("Selección actual · Tramo elegido · 1 tramo", {
        exact: true,
      }),
    ).toBeVisible();
    const segment = await page.evaluate(
      async () => (await window.cyclelab.getState()).messages.at(-1)!.tools[0],
    );
    expect(segment.rows[0]).toMatchObject({ i0: 10, i1: 30 });
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});
