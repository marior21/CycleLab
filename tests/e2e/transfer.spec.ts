import { test, expect, _electron as electron } from "@playwright/test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  Encoder,
  Profile,
  type FileIdMesg,
  type RecordMesg,
  type SessionMesg,
} from "@garmin/fitsdk";
import { quit } from "./quit";

function ride(start: Date) {
  const encoder = new Encoder();
  encoder.onMesg(Profile.MesgNum.FILE_ID, {
    manufacturer: "development",
    serialNumber: 77,
    timeCreated: start,
    type: "activity",
  } as FileIdMesg);
  for (let i = 0; i < 600; i++)
    encoder.onMesg(Profile.MesgNum.RECORD, {
      timestamp: new Date(+start + i * 1000),
      distance: i * 9,
      power: 240 + (i % 7),
      heartRate: 148,
      cadence: 88,
    } as RecordMesg);
  encoder.onMesg(Profile.MesgNum.SESSION, {
    startTime: start,
    timestamp: new Date(+start + 599000),
    sport: "cycling",
    subSport: "road",
  } as SessionMesg);
  return encoder.close();
}

test("imports local FIT files without duplicates and exports CSV and reports", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cyclelab-transfer-"));
  const fit = join(dir, "Vuelta al embalse.fit"),
    copy = join(dir, "copia.fit"),
    broken = join(dir, "roto.fit");
  writeFileSync(fit, ride(new Date("2026-10-20T08:00:00Z")));
  writeFileSync(copy, readFileSync(fit));
  writeFileSync(broken, "no es un FIT");
  const app = await electron.launch({
    args: ["out/main/index.js"],
    env: { ...process.env, CYCLELAB_USER_DATA: join(dir, "profile") },
  });
  try {
    const page = await app.firstWindow();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.getByRole("button", { name: "Ajustes", exact: true }).waitFor();
    // The demo never accepts real files.
    await expect(
      page.getByRole("button", { name: "Importar FIT" }),
    ).toHaveCount(0);
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
    await app.evaluate(
      ({ dialog }, paths) => {
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: paths,
        });
      },
      [fit, copy, broken, join(dir, "borrado.fit")],
    );
    await page.getByRole("button", { name: "Importar FIT" }).click();
    await expect(
      page.getByText(
        "1 actividad importada · copia.fit: Ya estaba importado. · roto.fit: No es un archivo FIT válido. · borrado.fit: No se pudo leer el archivo.",
      ),
    ).toBeVisible();
    await expect(page.locator(".detail-heading")).toHaveText(
      "Vuelta al embalse",
    );
    await expect(
      page.getByText(/Importada de Vuelta al embalse\.fit · development/),
    ).toBeVisible();
    await expect(page.getByText(/IF\/TSS del archivo FIT/)).toBeVisible();
    const imported = (await page.evaluate(() => window.cyclelab.getState()))
      .dataset.activities;
    expect(imported).toHaveLength(1);
    expect(imported[0]).toMatchObject({
      avgP: expect.any(Number),
      detailStatus: "ready",
      provenance: { kind: "fit", file: "Vuelta al embalse.fit" },
    });
    // Same start, different file: still a duplicate.
    const shifted = join(dir, "otra.fit");
    writeFileSync(shifted, ride(new Date("2026-10-20T08:00:30Z")));
    await app.evaluate(
      ({ dialog }, paths) => {
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: paths,
        });
      },
      [shifted],
    );
    await page.getByRole("button", { name: "Importar FIT" }).click();
    await expect(
      page.getByText(
        "0 actividades importadas · otra.fit: Duplicado de «Vuelta al embalse», que ya está en tu histórico.",
      ),
    ).toBeVisible();

    const csv = join(dir, "actividades.csv"),
      report = join(dir, "informe.html");
    await app.evaluate(({ dialog }, path) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: path });
    }, csv);
    await page.getByRole("button", { name: "Exportar CSV" }).click();
    await expect(
      page.getByText(`1 actividad exportada a ${csv}`),
    ).toBeVisible();
    const rows = readFileSync(csv, "utf8").trim().split("\r\n");
    expect(rows).toHaveLength(2);
    expect(rows[1]).toContain("Vuelta al embalse");
    expect(rows[1]).toContain("Archivo FIT · Vuelta al embalse.fit");
    await app.evaluate(
      ({ dialog }, path) => {
        dialog.showSaveDialog = async () => ({
          canceled: false,
          filePath: path,
        });
      },
      report.replace(/\.html$/, ""),
    );
    await page.getByRole("button", { name: "Exportar informe" }).click();
    await expect
      .poll(() => {
        try {
          return readFileSync(report, "utf8");
        } catch {
          return "";
        }
      })
      .toContain("<h1>Vuelta al embalse</h1>");
    expect(readFileSync(report, "utf8")).not.toContain("<script");
    expect(errors).toEqual([]);
  } finally {
    await quit(app);
  }
});
