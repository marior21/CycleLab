/* global window */
import { _electron as electron } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
const userData = mkdtempSync(join(tmpdir(), "cyclelab-package-"));
const launch = () =>
  electron.launch({
    executablePath: resolve(
      process.argv[2] ??
        (process.platform === "win32"
          ? "dist/win-unpacked/CycleLab.exe"
          : `dist/${process.arch === "arm64" ? "mac-arm64" : "mac"}/CycleLab.app/Contents/MacOS/CycleLab`),
    ),
    env: { ...process.env, CYCLELAB_USER_DATA: userData },
  });
let app = await launch();
try {
  let page = await app.firstWindow();
  await page
    .getByRole("heading", { name: "Actividades", exact: true })
    .waitFor();
  const state = await page.evaluate(() => window.cyclelab.getState());
  assert.equal(state.dataset.activities.length, 84);
  const encryption = await app.evaluate(({ safeStorage }) => {
    if (!safeStorage.isEncryptionAvailable()) return false;
    const test = "cyclelab-test-only";
    const bytes = safeStorage.encryptString(test);
    return !bytes.includes(test) && safeStorage.decryptString(bytes) === test;
  });
  assert.equal(encryption, true);
  await page.evaluate(() =>
    window.cyclelab.saveSettings({
      theme: "light",
      source: "garmin",
      model: "test/model",
      athlete: { ftp: 290, lthr: 175, weight: 77 },
    }),
  );
  await app.close();
  app = await launch();
  page = await app.firstWindow();
  await page
    .getByRole("heading", { name: "Actividades", exact: true })
    .waitFor();
  const saved = await page.evaluate(() => window.cyclelab.getState());
  assert.equal(saved.settings.model, "test/model");
  assert.equal(saved.settings.athlete.ftp, 290);
  assert.equal(saved.dataset.activities.length, 0);
  console.log(
    "Packaged app: SQLite, local fonts/UI, Keychain encryption and restart persistence OK.",
  );
} finally {
  await app.close();
}
