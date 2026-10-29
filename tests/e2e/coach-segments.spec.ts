import { test, expect, _electron as electron } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("coach shares persisted climb attempts, counts and activity navigation in both themes", async () => {
  const app = await electron.launch({
    args: ["out/main/index.js"],
    env: {
      ...process.env,
      CYCLELAB_USER_DATA: mkdtempSync(
        join(tmpdir(), "cyclelab-coach-segments-"),
      ),
    },
  });
  try {
    const page = await app.firstWindow();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.getByRole("button", { name: "Ajustes", exact: true }).waitFor();
    const segment = await page.evaluate(async () => {
      const state = await window.cyclelab.getState();
      const activity = state.dataset.activities[0];
      const detail = await window.cyclelab.getActivity("demo", activity.id);
      const segment = await window.cyclelab.saveSegment(
        "demo",
        activity.id,
        "Puerto de prueba",
        0,
        Math.min(50, detail.rows.length - 1),
      );
      await window.cyclelab.updateSegment("demo", segment.id, {
        isClimb: true,
      });
      return segment;
    });
    await expect
      .poll(async () =>
        page.evaluate(
          async (id) =>
            (await window.cyclelab.getSegmentResults("demo", id)).status,
          segment.id,
        ),
      )
      .toBe("done");
    const report = await page.evaluate(
      (id) => window.cyclelab.getSegmentResults("demo", id),
      segment.id,
    );
    expect(report.attempts.length).toBeGreaterThan(0);
    await page
      .getByRole("button", { name: "Puertos", exact: false })
      .first()
      .click();
    await expect(
      page.getByText(
        `Búsqueda completada: ${report.scanned} de ${report.total} actividades.`,
        { exact: false },
      ),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Entrenador IA", exact: false })
      .first()
      .click();
    await page
      .getByRole("textbox", { name: "Mensaje para el entrenador" })
      .fill("Compara mis dos últimas subidas a este puerto");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect(
      page.getByText("Intentos en Puerto de prueba", { exact: true }),
    ).toBeVisible();
    const message = await page.evaluate(async () =>
      (await window.cyclelab.getState()).messages.at(-1),
    );
    const expected = [...report.attempts]
      .sort((a, b) => b.date - a.date || b.i0 - a.i0)
      .slice(0, 2);
    expect(message?.tools[0].rows.map((r) => r.id)).toEqual(
      expected.map((a) => a.id),
    );
    for (const theme of ["dark", "light"] as const) {
      if (theme === "light")
        await page.getByRole("button", { name: "Cambiar tema" }).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(
        page.getByText(`${report.attempts.length} ascensiones identificadas`, {
          exact: false,
        }),
      ).toBeVisible();
      await expect(
        page.getByText("Coincidencias y tiempos aproximados", { exact: false }),
      ).toBeVisible();
      await page.screenshot({
        path: `test-results/coach-segments-${theme}.png`,
      });
    }
    await page
      .locator(".chat-log")
      .getByRole("button", { name: expected[0].activityName, exact: true })
      .first()
      .click();
    await expect(
      page
        .locator(".detail")
        .getByText(expected[0].activityName, { exact: true })
        .first(),
    ).toBeVisible();
    await page.evaluate(
      (id) => window.cyclelab.updateSegment("demo", id, { isClimb: false }),
      segment.id,
    );
    expect(
      await page.evaluate(
        async () => (await window.cyclelab.getState()).ascents.count,
      ),
    ).toBe(0);
    await page.evaluate(async () => {
      const { settings } = await window.cyclelab.getState();
      await window.cyclelab.saveSettings({
        theme: settings.theme,
        model: settings.model,
        athlete: settings.athlete,
        source: "garmin",
      });
    });
    expect(
      await page.evaluate(
        async () => (await window.cyclelab.getState()).ascents,
      ),
    ).toEqual({ count: 0, incomplete: false });
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});
