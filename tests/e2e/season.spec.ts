import { test, expect, _electron as electron } from "@playwright/test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { quit } from "./quit";

test("season report lists its activities, favourite segments and the demo mark", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cyclelab-season-"));
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
    const year = new Date(state.dataset.today).getUTCFullYear();
    const inSeason = state.dataset.activities.filter(
      (a) => new Date(a.date).getUTCFullYear() === year,
    );
    // A favourite segment from the newest demo ride.
    const segment = await page.evaluate(async (id) => {
      const s = await window.cyclelab.saveSegment(
        "demo",
        id,
        "Repecho <favorito>",
        100,
        400,
      );
      await window.cyclelab.updateSegment("demo", s.id, { favorite: true });
      return s;
    }, state.dataset.activities[0].id);
    await expect
      .poll(
        async () =>
          (
            await page.evaluate(
              (id) => window.cyclelab.getSegmentResults("demo", id),
              segment.id,
            )
          ).status,
        { timeout: 20000 },
      )
      .toBe("done");

    const file = join(dir, "temporada.html");
    await app.evaluate(({ dialog }, path) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: path });
    }, file);
    await page.getByRole("button", { name: /^Actividades/ }).click();
    await page.getByRole("button", { name: `Informe ${year}` }).click();
    await expect(
      page.getByText(`Informe de la temporada ${year} guardado en ${file}`),
    ).toBeVisible();
    const html = readFileSync(file, "utf8");
    expect(html).toContain("Datos de demostración");
    expect(html).toContain(`<h1>Temporada ${year}</h1>`);
    expect(html).toContain("Temporada en curso");
    expect(html).toContain("Repecho &lt;favorito&gt;");
    expect(html).not.toContain("<script");
    // The last table is the activity list every total comes from.
    const annex = html.slice(html.lastIndexOf("<table>"));
    expect(annex.match(/<tr>/g)).toHaveLength(inSeason.length + 1);
    expect(html).toContain(`<td>Sesiones</td><td>${inSeason.length}</td>`);

    // The year filter chooses the season.
    const years = [
      ...new Set(
        state.dataset.activities.map((a) => new Date(a.date).getUTCFullYear()),
      ),
    ].filter((y) => y !== year);
    if (years.length) {
      await page
        .getByLabel("Año de las actividades")
        .selectOption(String(years[0]));
      await expect(
        page.getByRole("button", { name: `Informe ${years[0]}` }),
      ).toBeVisible();
    }
    expect(errors).toEqual([]);
  } finally {
    await quit(app);
  }
});
