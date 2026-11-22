// electron-builder runs this hook before signing and creating the ZIP and DMG.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { Arch } from "builder-util";

const version = "2.10.1";
const cache = resolve("node_modules/.cache/cyclelab-sparkle");
const sdk = join(cache, version);
function prepareSDK() {
  if (existsSync(sdk)) return;
  mkdirSync(cache, { recursive: true });
  const work = mkdtempSync(join(cache, "download-"));
  try {
    const archive = join(work, "Sparkle.tar.xz");
    execFileSync("curl", [
      "-fLsS",
      "--retry",
      "3",
      "-o",
      archive,
      `https://github.com/sparkle-project/Sparkle/releases/download/${version}/Sparkle-${version}.tar.xz`,
    ]);
    const digest = createHash("sha256")
      .update(readFileSync(archive))
      .digest("hex");
    if (
      digest !==
      "1a856d2a9edb8e628de88121d7be04cf0e2167f8641650b78fca00b14244cf27"
    )
      throw new Error(
        "La descarga de Sparkle no coincide con el SHA-256 esperado.",
      );
    const unpacked = join(work, "sdk");
    mkdirSync(unpacked);
    execFileSync("tar", ["-xf", archive, "-C", unpacked]);
    renameSync(unpacked, sdk);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

export default function afterPack({ electronPlatformName, appOutDir, arch }) {
  if (electronPlatformName !== "darwin") return;
  prepareSDK();
  const architecture = Arch[arch];
  const contents = join(appOutDir, "CycleLab.app/Contents");
  const plist = join(contents, "Info.plist");
  execFileSync("plutil", [
    "-insert",
    "SUFeedURL",
    "-string",
    `https://github.com/marior21/CycleLab/releases/latest/download/appcast-${architecture}.xml`,
    plist,
  ]);
  execFileSync("ditto", [
    join(sdk, "Sparkle.framework"),
    join(contents, "Frameworks/Sparkle.framework"),
  ]);
  execFileSync("ditto", [
    join(sdk, "LICENSE"),
    join(contents, "Resources/Sparkle-LICENSE"),
  ]);
  execFileSync(
    "xcrun",
    [
      "clang",
      "-arch",
      architecture === "x64" ? "x86_64" : architecture,
      "-mmacosx-version-min=12.0",
      "-fobjc-arc",
      "-bundle",
      "-undefined",
      "dynamic_lookup",
      "-I",
      resolve(dirname(realpathSync(process.execPath)), "../include/node"),
      "-F",
      sdk,
      "-framework",
      "Sparkle",
      "-framework",
      "Foundation",
      "-Wl,-rpath,@loader_path/../Frameworks",
      "native/sparkle/updater.m",
      "-o",
      join(contents, "Resources/sparkle.node"),
    ],
    { stdio: "inherit" },
  );
}
