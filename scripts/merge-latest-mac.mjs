// Each Mac architecture builds on its own runner and writes its own
// latest-mac.yml; electron-updater needs one file listing both, and picks the
// arm64 entries by name. Usage: node merge-latest-mac.mjs arm64.yml x64.yml out.yml
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";

export function merge(base, extra) {
  const files = (text) => text.match(/^files:\n((?: {2}.*\n)+)/m);
  const a = files(base),
    b = files(extra);
  assert(a && b, "latest-mac.yml sin lista de ficheros");
  assert.equal(
    base.match(/^version: .*$/m)?.[0],
    extra.match(/^version: .*$/m)?.[0],
    "Las versiones de latest-mac.yml no coinciden",
  );
  return base.replace(a[0], a[0] + b[1]);
}

if (process.argv.length === 5) {
  const [arm, x64, out] = process.argv.slice(2);
  writeFileSync(
    out,
    merge(readFileSync(arm, "utf8"), readFileSync(x64, "utf8")),
  );
} else {
  const yml = (arch) =>
    `version: 1.0.0\nfiles:\n  - url: CycleLab-1.0.0-mac-${arch}.zip\n    sha512: ${arch}\n    size: 1\npath: CycleLab-1.0.0-mac-${arch}.zip\nsha512: ${arch}\nreleaseDate: '2026-11-02T00:00:00.000Z'\n`;
  const merged = merge(yml("arm64"), yml("x64"));
  assert.equal(merged.match(/- url:/g).length, 2);
  assert.match(
    merged,
    /files:\n {2}- url: \S+arm64\.zip\n(?: {4}.*\n)+ {2}- url: \S+x64\.zip/,
  );
  assert.match(merged, /^path: CycleLab-1\.0\.0-mac-arm64\.zip$/m);
  console.log("merge-latest-mac: ok");
}
