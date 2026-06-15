// Logo A (360° Orbit) → app ikon PNG-ləri (sharp ilə SVG→PNG render).
// İşlət: node scripts/gen-app-icons.mjs
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (f) => join(root, "public/brand", f);
const out = (f) => join(root, "mobile/assets", f);

// SVG-ni yüksək density ilə render et (kəskin kənar)
async function render(svgFile, outFile, size) {
  const buf = readFileSync(src(svgFile));
  await sharp(buf, { density: 384 }).resize(size, size).png().toFile(outFile);
  console.log("✓", outFile.split("/").slice(-2).join("/"), `${size}px`);
}

const jobs = [
  ["app-icon-full.svg", out("icon.png"), 1024],
  ["app-icon-full.svg", out("splash-icon.png"), 1024],
  ["app-icon-full.svg", out("favicon.png"), 48],
  ["app-adaptive-fg.svg", out("android-icon-foreground.png"), 1024],
  ["app-adaptive-bg.svg", out("android-icon-background.png"), 1024],
  ["app-adaptive-mono.svg", out("android-icon-monochrome.png"), 1024],
];

for (const [s, o, sz] of jobs) await render(s, o, sz);
console.log("Bitdi — bütün app ikonları yeniləndi.");
