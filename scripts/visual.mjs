/* global document */
import { _electron as electron, chromium } from "@playwright/test";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
const dir = resolve("artifacts/visual");
mkdirSync(dir, { recursive: true });
const app = await electron.launch({
  args: ["out/main/index.js"],
  env: {
    ...process.env,
    CYCLELAB_USER_DATA: mkdtempSync(join(tmpdir(), "cyclelab-visual-")),
  },
});
const browser = await chromium.launch();
try {
  const actual = await app.firstWindow(),
    reference = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
  await reference.goto(pathToFileURL(resolve("design/prototype.html")).href);
  await reference.locator(".cl-nav-item").first().waitFor();
  await actual.locator(".cl-nav-item").first().waitFor();
  const report = [];
  async function shot(name) {
    await Promise.all(
      [actual, reference].map(async (p) => {
        await p.evaluate(() => document.fonts.ready);
        await p.mouse.move(0, 0);
        await p.waitForTimeout(400);
      }),
    );
    const a = join(dir, name + "-app.png"),
      b = join(dir, name + "-reference.png");
    await actual.screenshot({ path: a });
    await reference.screenshot({ path: b });
    const ap = PNG.sync.read(readFileSync(a)),
      bp = PNG.sync.read(readFileSync(b));
    const diff = new PNG({ width: ap.width, height: ap.height });
    const pixels = pixelmatch(
      ap.data,
      bp.data,
      diff.data,
      ap.width,
      ap.height,
      { threshold: 0.15 },
    );
    writeFileSync(join(dir, name + "-diff.png"), PNG.sync.write(diff));
    report.push({
      name,
      differentPercent: Number(
        ((pixels / (ap.width * ap.height)) * 100).toFixed(2),
      ),
    });
  }
  for (const theme of ["dark", "light"]) {
    if (theme === "light")
      await Promise.all(
        [actual, reference].map((p) =>
          p.getByRole("button", { name: "Cambiar tema" }).click(),
        ),
      );
    for (const [index, name] of [
      "dashboard",
      "activities",
      "performance",
      "climbs",
      "coach",
    ].entries()) {
      await Promise.all(
        [actual, reference].map((p) =>
          p
            .locator(".cl-nav-item")
            .nth(index + (p === actual && index >= 3 ? 1 : 0))
            .click(),
        ),
      );
      if (name === "activities")
        await actual.locator(".chart-label").first().waitFor();
      await shot(name + "-" + theme);
      if (name !== "coach") {
        await Promise.all(
          [actual, reference].map((p) =>
            p
              .locator(
                name === "activities" || (name === "climbs" && p === reference)
                  ? ".detail"
                  : ".scroll",
              )
              .evaluate((el) => {
                el.scrollTop = el.scrollHeight;
              })
              .catch(() =>
                p.locator(".page").evaluate((el) => {
                  el.parentElement.scrollTop = el.parentElement.scrollHeight;
                }),
              ),
          ),
        );
        await shot(name + "-" + theme + "-bottom");
      }
    }
    await Promise.all(
      [actual, reference].map((p) => p.locator(".cl-nav-item").nth(1).click()),
    );
    await actual.locator(".chart-label").first().waitFor();
    await Promise.all(
      [actual, reference].map((p) => p.keyboard.press("Meta+j")),
    );
    await shot("drawer-" + theme);
    await Promise.all(
      [actual, reference].map((p) => p.keyboard.press("Meta+j")),
    );
  }
  await Promise.all(
    [actual, reference].map((p) => p.locator(".cl-nav-item").nth(1).click()),
  );
  await Promise.all(
    [actual, reference].map((p) => p.keyboard.press("ArrowRight")),
  );
  await Promise.all(
    [actual, reference].map((p) =>
      p.locator(".sel-bar").scrollIntoViewIfNeeded(),
    ),
  );
  await shot("selection-light");
  await Promise.all([actual, reference].map((p) => p.keyboard.press("Escape")));
  await Promise.all(
    [actual, reference].map((p) =>
      p.getByPlaceholder("Buscar actividad").fill("zzzzzz"),
    ),
  );
  await shot("empty-filter-light");
  await Promise.all(
    [actual, reference].map((p) =>
      p.getByPlaceholder("Buscar actividad").fill(""),
    ),
  );
  for (const p of [actual, reference]) {
    await p.getByRole("checkbox").nth(0).click();
    await p.getByRole("checkbox").nth(1).click();
    await p.getByRole("button", { name: "Comparar", exact: true }).click();
  }
  await shot("comparison-light");
  await Promise.all(
    [actual, reference].map((p) =>
      p.locator(".detail").evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      }),
    ),
  );
  await shot("comparison-light-bottom");
  await Promise.all(
    [actual, reference].map((p) => p.locator(".cl-sync").click()),
  );
  await shot("sync-loading-light");
  await actual.waitForTimeout(1900);
  await Promise.all(
    [actual, reference].map((p) => p.locator(".cl-sync").click()),
  );
  await actual.waitForTimeout(1900);
  await shot("sync-error-light");
  await actual.getByRole("button", { name: "Ajustes", exact: true }).click();
  await actual.screenshot({ path: join(dir, "settings-light-app.png") });
  writeFileSync(join(dir, "comparison.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await app.close();
}
