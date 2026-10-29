/* global window, performance, requestAnimationFrame */
// Measures a large synthetic Garmin history: startup, state, search, memory and
// segment search. Usage: npm run build && node scripts/measure.mjs [activities]
import { _electron as electron } from "@playwright/test";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const count = Number(process.argv[2] ?? 1000);
const dir = mkdtempSync(join(tmpdir(), "cyclelab-measure-"));
const env = { ...process.env, CYCLELAB_USER_DATA: dir };
const launch = () => electron.launch({ args: ["out/main/index.js"], env });
const median = (v) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];
const result = { activities: count };

try {
  let app = await launch();
  let page = await app.firstWindow();
  await page.getByRole("button", { name: "Ajustes", exact: true }).waitFor();
  const demo = await page.evaluate(async () => {
    const s = await window.cyclelab.getState();
    const a = s.dataset.activities[0];
    return {
      template: a,
      best: (await window.cyclelab.getActivity("demo", a.id)).best,
    };
  });
  await page.evaluate(() =>
    window.cyclelab.saveSettings({
      theme: "dark",
      source: "garmin",
      model: null,
      athlete: { ftp: 260, lthr: 172, weight: 72 },
    }),
  );
  await app.evaluate(
    (_e, { dir, modulePath, count, template, best }) => {
      const DB = process.getBuiltinModule("module").createRequire(modulePath)(
        modulePath,
      );
      // A 2 h ride at 1 Hz on a 31 km loop: about the size of a real detail.
      const rows = [];
      for (let x = 0; x < 7200; x++) {
        const angle = (x / 3700) * 2 * Math.PI;
        rows.push({
          x,
          km: Math.round(x * 8.6) / 1000,
          p: 180 + Math.round(60 * Math.sin(x / 90)),
          ps: 190,
          hr: 140 + (x % 20),
          cad: 88,
          elev: 50 + Math.round(40 * Math.sin(angle)),
          v: 31,
          lat: 43.4 + 0.045 * Math.sin(angle),
          lon: -3.8 + 0.062 * Math.cos(angle),
        });
      }
      const detail = JSON.stringify({
        rows,
        laps: [],
        points: [],
        features: [],
        markers: [],
        best,
      });
      const db = new DB(dir + "/cyclelab.db");
      const insert = db.prepare(
        "INSERT INTO activities(source,id,date,summary,detail,best) VALUES ('garmin',?,?,?,?,?)",
      );
      db.transaction(() => {
        for (let i = 0; i < count; i++) {
          const id = String(900000 + i);
          const date = Date.now() - (i * 3.9 + 0.3) * 86400000;
          const summary = {
            ...template,
            id,
            date,
            name: `Medición ${String(i).padStart(4, "0")}`,
            dur: 7200,
            dist: 61.9,
            tss: 80 + (i % 40),
            np: 200 + (i % 30),
            detailStatus: "ready",
          };
          insert.run(
            id,
            date,
            JSON.stringify(summary),
            detail,
            JSON.stringify(best),
          );
        }
      })();
      db.prepare(
        "INSERT INTO settings VALUES ('classificationVersion','2') ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      ).run();
      db.close();
    },
    {
      dir,
      modulePath: resolve("node_modules/better-sqlite3"),
      count,
      template: demo.template,
      best: demo.best,
    },
  );
  await app.evaluate(({ app }) => setTimeout(() => app.quit(), 0));
  await new Promise((r) => app.process().once("exit", r));
  result.databaseMB = Math.round(statSync(join(dir, "cyclelab.db")).size / 1e6);

  let start = performance.now();
  app = await launch();
  app
    .process()
    .stdout.on(
      "data",
      (d) => process.env.MEASURE_LOG && process.stdout.write(d),
    );
  page = await app.firstWindow();
  await page.getByText("Medición 0000").first().waitFor({ timeout: 120000 });
  result.startupToListMs = Math.round(performance.now() - start);

  result.getStateMs = median(
    await page.evaluate(async () => {
      const times = [];
      for (let i = 0; i < 5; i++) {
        const t = performance.now();
        await window.cyclelab.getState();
        times.push(Math.round(performance.now() - t));
      }
      return times;
    }),
  );

  const search = page.getByLabel("Buscar actividad");
  const listbox = page.getByRole("listbox", { name: "Actividades" });
  const searches = [];
  const target = String(Math.floor(count * 0.77)).padStart(4, "0"),
    last = `Medición ${String(count - 1).padStart(4, "0")}`;
  for (const text of [target, "Medición 0", ""]) {
    start = performance.now();
    await search.fill(text);
    if (text === "0777") await listbox.getByText("Medición 0777").waitFor();
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => r(null))),
    );
    searches.push(Math.round(performance.now() - start));
  }
  result.searchMs = searches;
  start = performance.now();
  await search.pressSequentially(last);
  await listbox.getByText(last).waitFor();
  result.typingPerKeyMs = Math.round((performance.now() - start) / last.length);
  await search.fill("");

  for (const [key, name, n] of [
    ["dashboardMs", "Dashboard", 1],
    ["performanceMs", "Rendimiento", 3],
    ["activitiesMs", "Actividades", 2],
  ]) {
    start = performance.now();
    await page.keyboard.press(`Meta+${n}`);
    await page.locator(".topbar").getByText(name).first().waitFor();
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => r(null))),
    );
    result[key] = Math.round(performance.now() - start);
  }

  const memory = await app.evaluate(({ app }) => ({
    main: Math.round(process.memoryUsage().rss / 1e6),
    all: Math.round(
      app.getAppMetrics().reduce((s, m) => s + m.memory.workingSetSize, 0) /
        1e3,
    ),
  }));
  result.memoryMainMB = memory.main;
  result.memoryAllMB = memory.all;

  // MEASURE_QUICK=1 skips the slow segment search.
  if (!process.env.MEASURE_QUICK) {
    start = performance.now();
    const segment = await page.evaluate(() =>
      window.cyclelab.saveSegment("garmin", "900000", "Medición", 1000, 1300),
    );
    // The app must stay responsive while it searches.
    const during = [];
    let segmentResults;
    do {
      await page.waitForTimeout(200);
      const t = performance.now();
      await page.evaluate(() => window.cyclelab.getState());
      during.push(Math.round(performance.now() - t));
      segmentResults = await page.evaluate(
        (id) => window.cyclelab.getSegmentResults("garmin", id),
        segment.id,
      );
    } while (segmentResults.status === "running");
    result.segmentSearchMs = Math.round(performance.now() - start);
    result.segmentAttempts = segmentResults.attempts.length;
    result.getStateDuringSearchMs = [median(during), Math.max(...during)];
  }

  await app.evaluate(({ app }) => setTimeout(() => app.quit(), 0));
  await new Promise((r) => app.process().once("exit", r));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
mkdirSync("artifacts/measure", { recursive: true });
writeFileSync(
  `artifacts/measure/${count}.json`,
  JSON.stringify(result, null, 2) + "\n",
);
console.table(result);
