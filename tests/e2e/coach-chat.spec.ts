import { test, expect, _electron as electron } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { quit } from "./quit";

test("conversations, cancellation and navigable references in the coach", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cyclelab-chat-"));
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
    await page.keyboard.press("Meta+6");
    const input = page.getByRole("textbox", {
      name: "Mensaje para el entrenador",
    });
    await input.fill("Resume mis actividades recientes");
    await input.press("Enter");
    const refs = page.getByRole("group", { name: "Datos utilizados" });
    await expect(refs).toBeVisible();
    await expect(page.locator(".chat-log")).toContainText("He consultado");

    await page.getByRole("button", { name: "Nueva", exact: true }).click();
    await expect(refs).toHaveCount(0);
    await input.fill("Analiza mi curva de potencia");
    await input.press("Enter");
    await page.getByRole("button", { name: "Detener" }).click();
    await expect(page.getByText("Respuesta cancelada")).toBeVisible();
    await expect(input).toHaveValue("Analiza mi curva de potencia");
    await expect(input).toBeEnabled();

    const conversations = page.locator(".coach-side .conversation");
    await expect(conversations).toHaveCount(2);
    await page
      .getByRole("searchbox", { name: "Buscar conversaciones" })
      .fill("consultado");
    await expect(conversations).toHaveCount(1);
    await expect(conversations).toContainText("Resume mis actividades");
    await page
      .getByRole("searchbox", { name: "Buscar conversaciones" })
      .fill("");

    await page.getByRole("button", { name: "Renombrar" }).click();
    await page
      .getByRole("textbox", { name: "Título de la conversación" })
      .fill("Curva cancelada");
    await page.keyboard.press("Enter");
    await expect(conversations.first()).toContainText("Curva cancelada");

    for (const theme of ["dark", "light"]) {
      if (theme === "light")
        await page.getByRole("button", { name: "Cambiar tema" }).click();
      await page.screenshot({ path: `test-results/coach-chat-${theme}.png` });
    }

    await page.getByRole("button", { name: "Borrar", exact: true }).click();
    await page.getByRole("button", { name: "Confirmar borrado" }).click();
    await expect(conversations).toHaveCount(1);
    await expect(refs).toBeVisible();

    const state = await page.evaluate(() => window.cyclelab.getState());
    expect(state.conversations).toHaveLength(1);
    expect(
      state.messages.every(
        (m) => m.conversationId === state.conversations[0].id,
      ),
    ).toBe(true);

    await refs.getByRole("button").first().click();
    await expect(
      page.getByRole("heading", { name: "Actividades" }),
    ).toBeVisible();
    expect(errors).toEqual([]);

    await quit(app);
    app = await launch();
    page = await app.firstWindow();
    await page.getByRole("button", { name: "Ajustes", exact: true }).waitFor();
    const restarted = await page.evaluate(() => window.cyclelab.getState());
    expect(restarted.conversations.map((c) => c.title)).toEqual([
      "Resume mis actividades recientes",
    ]);
  } finally {
    await quit(app);
  }
});
