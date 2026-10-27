import { readFileSync, writeFileSync } from "node:fs";
const t = JSON.parse(readFileSync("design/tokens.json", "utf8"));
const value = (v) => String(v).replace(/\{([^}]+)\}/g, "var(--$1)");
let css = "/* Generated from design/tokens.json. Run npm run tokens. */\n";
for (const theme of ["dark", "light"]) {
  const entries = [...t.color.tokens, ...t.shadow.tokens].map(
    (x) => `--${x.name}:${value(x.value[theme])};`,
  );
  css += `${theme === "dark" ? ":root, " : ""}[data-theme="${theme}"]{${entries.join("")}}\n`;
}
css +=
  ":root{" +
  ["spacing", "radius", "size"]
    .flatMap((k) => t[k].tokens.map((x) => `--${x.name}:${x.value};`))
    .join("");
css += Object.entries(t.type.families)
  .map(([k, v]) => `--font-${k}:${v};`)
  .join("");
for (const group of t.type.groups)
  for (const s of group.styles) {
    css += `--${s.name}:${s.fontWeight} ${s.fontSize}/${s.lineHeight} var(--font-${group.family});`;
  }
css += "}\n";
writeFileSync("src/renderer/styles/tokens.css", css);
