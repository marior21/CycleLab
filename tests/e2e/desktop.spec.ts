import { test, expect, _electron as electron } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { quit } from "./quit";

test("first steps, kept filters and both window sizes in both themes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cyclelab-desktop-"));
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
    await page.getByRole("button", { name: "Ajustes", exact: true }).waitFor();

    const guide = page.locator(".first-run");
    await expect(guide).toContainText("Primeros pasos");
    await expect(guide.getByRole("listitem")).toHaveCount(4);
    await expect(guide.getByRole("listitem").first()).toContainText("(hecho)");
    await expect(
      guide.getByRole("button", { name: "Sincronizar ahora" }),
    ).toBeDisabled();
    await guide.getByRole("button", { name: "Abrir Ajustes" }).click();
    await expect(page.getByRole("heading", { name: "Ajustes" })).toBeVisible();
    await expect(guide).toHaveCount(0);
    await page.keyboard.press("Meta+2");

    // Filters and selection survive a trip to another screen.
    await page
      .getByRole("group", { name: "Fechas" })
      .getByRole("button", { name: "Todo" })
      .click();
    await page.getByLabel("Buscar actividad").fill("umbral");
    const list = page.getByRole("listbox", { name: "Actividades" });
    const option = list.getByRole("option").nth(1);
    await option.click();
    await page.keyboard.press("Meta+3");
    await expect(
      page.getByRole("heading", { name: "Rendimiento" }),
    ).toBeVisible();
    await page.keyboard.press("Meta+2");
    await expect(page.getByLabel("Buscar actividad")).toHaveValue("umbral");
    await expect(
      page
        .getByRole("group", { name: "Fechas" })
        .getByRole("button", { name: "Todo" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(list.getByRole("option").nth(1)).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.getByLabel("Buscar actividad").fill("");

    await page.evaluate(() => document.fonts.ready);
    for (const [width, height] of [
      [1200, 760],
      [1440, 900],
    ]) {
      await app.evaluate(
        ({ BrowserWindow }, [width, height]) =>
          BrowserWindow.getAllWindows()[0].setContentSize(width, height),
        [width, height],
      );
      for (const theme of ["dark", "light"]) {
        if ((await page.locator("html").getAttribute("data-theme")) !== theme)
          await page.getByRole("button", { name: "Cambiar tema" }).click();
        for (const [key, screen] of [
          ["1", "dashboard"],
          ["2", "activities"],
          ["3", "performance"],
          ["4", "segments"],
          ["6", "coach"],
        ]) {
          await page.keyboard.press(`Meta+${key}`);
          await page.waitForTimeout(300);
          // No screen may scroll sideways at the minimum window size.
          expect(
            await page.evaluate(
              () =>
                document.documentElement.scrollWidth <= window.innerWidth &&
                [...document.querySelectorAll<HTMLElement>(".scroll")].every(
                  (e) => e.scrollWidth <= e.clientWidth + 1,
                ),
            ),
            `${screen} ${width}×${height} ${theme}`,
          ).toBe(true);
          await page.screenshot({
            path: `test-results/review-${width}-${theme}-${screen}.png`,
          });
        }
      }
    }

    await page.keyboard.press("Meta+2");
    await guide.getByRole("button", { name: "Ocultar" }).click();
    await expect(guide).toHaveCount(0);
    await quit(app);
    app = await launch();
    page = await app.firstWindow();
    await page.getByRole("button", { name: "Ajustes", exact: true }).waitFor();
    await expect(page.getByLabel("Buscar actividad")).toBeVisible();
    await expect(page.locator(".first-run")).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await quit(app);
  }
});
