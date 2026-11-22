/** Rough frames-per-second of the campus. BASE_URL=... node scripts/fps.mjs */
import { createRequire } from "node:module";
const require = createRequire(new URL("../e2e/", import.meta.url));
const { chromium } = require("@playwright/test");
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto(process.env.BASE_URL ?? "http://localhost:8788");
await page.waitForSelector("canvas[data-stage=ready]", { timeout: 60000 });
await page.waitForTimeout(8000);
const fps = await page.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; performance.now() - t0 < 5000 ? requestAnimationFrame(f) : r(n / 5); }; requestAnimationFrame(f); }));
console.log("fps", fps.toFixed(2));
await browser.close();
