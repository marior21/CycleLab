import { test, expect, _electron as electron } from "@playwright/test";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const modulePath = resolve("node_modules/better-sqlite3");
const launch = (dir: string) =>
  electron.launch({
    args: ["out/main/index.js"],
    env: { ...process.env, CYCLELAB_USER_DATA: dir },
  });

test("backup export, clean-profile recovery, invalid files, cancellation and rollback", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cyclelab-backup-"));
  const path = join(dir, "export.cyclelab-backup.json");
  const clean = mkdtempSync(join(tmpdir(), "cyclelab-recovery-"));
  let app = await launch(dir);
  try {
    let page = await app.firstWindow();
    await page.getByRole("button", { name: "Ajustes", exact: true }).waitFor();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const state = await page.evaluate(() => window.cyclelab.getState());
    const id = state.dataset.activities[0].id;
    const detail = await page.evaluate(
      (id) => window.cyclelab.getActivity("demo", id),
      id,
    );
    const end = Math.min(detail.rows.length - 1, 30);
    const segment = await page.evaluate(
      ({ id, end }) =>
        window.cyclelab.saveSegment(
          "demo",
          id,
          "Mi segmento de respaldo",
          0,
          end,
        ),
      { id, end },
    );
    const busyError = await page.evaluate(async () => {
      const response = window.cyclelab.sendMessage(
        "¿Cómo va mi carga?",
        { screen: "coach" },
        crypto.randomUUID(),
      );
      const error = await window.cyclelab
        .restoreBackup()
        .catch((e) => e.message);
      await response;
      return error;
    });
    expect(busyError).toContain("Espera a que terminen");
    await page.evaluate(() =>
      window.cyclelab.saveSettings({
        theme: "light",
        source: "demo",
        model: "modelo-de-prueba",
        athlete: {
          ftp: 280,
          weight: 73,
          lthr: 175,
          history: [
            { metric: "ftp", value: 280, date: "2024-01-01", origin: "manual" },
          ],
        },
      }),
    );
    await app.evaluate(({ dialog }, path) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: path });
    }, path);
    // Seed an encrypted-looking sentinel directly; exports must not include it.
    await app.evaluate(
      (_electron, { dir, modulePath }) => {
        const DB = process.getBuiltinModule("module").createRequire(modulePath)(
          modulePath,
        );
        const db = new DB(dir + "/cyclelab.db");
        db.prepare("INSERT INTO secrets VALUES (?,?)").run(
          "garmin",
          Buffer.from("PRIVATE-SENTINEL"),
        );
        db.close();
      },
      { dir, modulePath },
    );
    await page.getByRole("button", { name: "Ajustes", exact: true }).click();
    await page
      .getByRole("button", { name: "Exportar copia", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("Copia guardada");
    const text = readFileSync(path, "utf8");
    expect(text).not.toContain("PRIVATE-SENTINEL");
    expect(JSON.parse(JSON.parse(text).data)).not.toHaveProperty("secrets");
    await page
      .locator(".settings-page")
      .screenshot({ path: "test-results/backup-light.png" });
    await page.getByRole("button", { name: "Cambiar tema" }).click();
    await page
      .locator(".settings-page")
      .screenshot({ path: "test-results/backup-dark.png" });
    expect(errors).toEqual([]);
    await app.close();
    app = await launch(clean);
    page = await app.firstWindow();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.getByRole("button", { name: "Ajustes", exact: true }).click();
    await app.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [path],
      });
      dialog.showMessageBox = async () => ({
        response: 0,
        checkboxChecked: false,
      });
    }, path);
    expect(
      await page.evaluate(() => window.cyclelab.restoreBackup()),
    ).toBeNull();
    expect(
      (await page.evaluate(() => window.cyclelab.getState())).segments,
    ).toEqual([]);
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({
        response: 1,
        checkboxChecked: false,
      });
    });
    await page
      .getByRole("button", { name: "Restaurar copia", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("Copia restaurada");
    const restored = await page.evaluate(() => window.cyclelab.getState());
    expect(restored.segments).toContainEqual(segment);
    expect(restored.messages).toHaveLength(2);
    expect(restored.settings).toMatchObject({
      theme: "light",
      model: "modelo-de-prueba",
      athlete: {
        ftp: 280,
        weight: 73,
        lthr: 175,
        history: [
          { metric: "ftp", value: 280, date: "2024-01-01", origin: "manual" },
        ],
      },
      garminConfigured: false,
      openrouterConfigured: false,
      maptilerConfigured: false,
    });
    expect(
      await page.evaluate((id) => window.cyclelab.getActivity("demo", id), id),
    ).toEqual(detail);
    expect(readdirSync(join(clean, "backups"))).toHaveLength(1);
    const previous = await page.evaluate(() => window.cyclelab.getState());
    for (const contents of [
      "broken",
      JSON.stringify({ ...JSON.parse(text), schemaVersion: 99 }),
    ]) {
      writeFileSync(path, contents);
      const error = await page.evaluate(() =>
        window.cyclelab.restoreBackup().catch((e) => e.message),
      );
      expect(error).toContain("dañada o es incompatible");
      expect(await page.evaluate(() => window.cyclelab.getState())).toEqual(
        previous,
      );
    }
    writeFileSync(path, text);
    await app.evaluate(
      (_electron, { dir, modulePath }) => {
        const DB = process.getBuiltinModule("module").createRequire(modulePath)(
          modulePath,
        );
        const db = new DB(dir + "/cyclelab.db");
        db.prepare("INSERT INTO secrets VALUES (?,?)").run(
          "maptiler",
          Buffer.from("LOCAL-SECRET"),
        );
        db.exec(
          "CREATE TRIGGER fail_restore BEFORE INSERT ON messages BEGIN SELECT RAISE(ABORT, 'disk failure simulated'); END;",
        );
        db.close();
      },
      { dir: clean, modulePath },
    );
    expect(
      await page.evaluate(() =>
        window.cyclelab.restoreBackup().catch((e) => e.message),
      ),
    ).toContain("disk failure simulated");
    expect(
      (await page.evaluate(() => window.cyclelab.getState())).messages,
    ).toEqual(previous.messages);
    await app.evaluate(
      (_electron, { dir, modulePath }) => {
        const DB = process.getBuiltinModule("module").createRequire(modulePath)(
          modulePath,
        );
        const db = new DB(dir + "/cyclelab.db");
        db.exec("DROP TRIGGER fail_restore");
        db.close();
      },
      { dir: clean, modulePath },
    );
    await page.evaluate(() => window.cyclelab.restoreBackup());
    expect(
      (await page.evaluate(() => window.cyclelab.getState())).settings
        .maptilerConfigured,
    ).toBe(true);
    expect(errors).toEqual([]);
    await app.close();
    app = await launch(clean);
    page = await app.firstWindow();
    await page.getByRole("button", { name: "Ajustes", exact: true }).waitFor();
    expect(
      (await page.evaluate(() => window.cyclelab.getState())).segments,
    ).toContainEqual(segment);
  } finally {
    await app.close();
  }
});

test("migration preserves a credential-free snapshot before changing v1", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cyclelab-migration-"));
  let app = await launch(dir);
  try {
    await (
      await app.firstWindow()
    )
      .getByRole("button", { name: "Ajustes", exact: true })
      .waitFor();
    await app.evaluate(
      (_electron, { dir, modulePath }) => {
        const DB = process.getBuiltinModule("module").createRequire(modulePath)(
          modulePath,
        );
        const db = new DB(dir + "/cyclelab.db");
        db.exec(
          "ALTER TABLE activities DROP COLUMN best; DROP TABLE segments; DROP TABLE segment_results; PRAGMA user_version=1;",
        );
        db.close();
      },
      { dir, modulePath },
    );
    await app.close();
    app = await launch(dir);
    const page = await app.firstWindow();
    await page.getByRole("button", { name: "Ajustes", exact: true }).waitFor();
    const [file] = readdirSync(join(dir, "backups"));
    const backup = JSON.parse(readFileSync(join(dir, "backups", file), "utf8"));
    expect(backup.schemaVersion).toBe(1);
    expect(JSON.parse(backup.data).activities[0]).not.toHaveProperty("best");
    expect(
      (await page.evaluate(() => window.cyclelab.getState())).dataset.activities
        .length,
    ).toBeGreaterThan(0);
    await app.evaluate(
      ({ dialog }, path) => {
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [path],
        });
        dialog.showMessageBox = async () => ({
          response: 1,
          checkboxChecked: false,
        });
      },
      join(dir, "backups", file),
    );
    await page.evaluate(() => window.cyclelab.restoreBackup());
    expect(
      (await page.evaluate(() => window.cyclelab.getState())).dataset.activities
        .length,
    ).toBeGreaterThan(0);
  } finally {
    await app.close();
  }
});

test("large pre-migration backups do not materialize the whole archive", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cyclelab-large-backup-"));
  let app = await launch(dir);
  try {
    await (
      await app.firstWindow()
    )
      .getByRole("button", { name: "Ajustes", exact: true })
      .waitFor();
    await app.evaluate(
      (_electron, { dir, modulePath }) => {
        const DB = process.getBuiltinModule("module").createRequire(modulePath)(
          modulePath,
        );
        const db = new DB(dir + "/cyclelab.db");
        const text = "x".repeat(1024 * 1024);
        db.transaction(() => {
          const insert = db.prepare(
            "INSERT INTO messages VALUES ('garmin',?,?)",
          );
          for (let i = 0; i < 192; i++)
            insert.run(
              String(i),
              JSON.stringify({
                id: String(i),
                role: "user",
                text,
                status: "done",
                tools: [],
                createdAt: 0,
              }),
            );
          db.pragma("user_version = 4");
        })();
        db.close();
      },
      { dir, modulePath },
    );
    await app.close();
    app = await launch(dir);
    const page = await app.firstWindow();
    await page.getByRole("button", { name: "Ajustes", exact: true }).waitFor();
    const [file] = readdirSync(join(dir, "backups"));
    expect(file).toContain("antes-de-migrar-v4");
    expect(statSync(join(dir, "backups", file)).size).toBeGreaterThan(
      192 * 1024 * 1024,
    );
    const result = await app.evaluate(
      (_electron, { dir, modulePath }) => {
        const DB = process.getBuiltinModule("module").createRequire(modulePath)(
          modulePath,
        );
        const db = new DB(dir + "/cyclelab.db", { readonly: true });
        const version = db.pragma("user_version", { simple: true });
        const count = db
          .prepare("SELECT count(*) AS n FROM messages WHERE source='garmin'")
          .get().n;
        db.close();
        return { version, count };
      },
      { dir, modulePath },
    );
    expect(result).toEqual({ version: 7, count: 192 });
  } finally {
    await app.close();
  }
});
