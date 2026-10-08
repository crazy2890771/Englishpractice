// Renders public/icons/icon.svg to the PNG sizes used by the PWA manifest and iOS.
// Usage: node scripts/generate-icons.mjs (optionally CHROMIUM_PATH=/path/to/chrome)
import { chromium } from "@playwright/test";
import { readFileSync } from "fs";
const svg = readFileSync("public/icons/icon.svg", "utf8");
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH }).catch(() => chromium.launch());
for (const s of [192, 512, 180]) {
  const p = await b.newPage({ viewport: { width: s, height: s } });
  await p.setContent(`<html><body style="margin:0">${svg.replace("<svg ", `<svg width="${s}" height="${s}" `)}</body></html>`);
  await p.screenshot({ path: `public/icons/${s === 180 ? "apple-touch-icon" : "icon-" + s}.png`, omitBackground: false });
}
await b.close();
