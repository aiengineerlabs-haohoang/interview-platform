/**
 * Builds apps/web/public/og.png (1200x630) from a real frame of the campus.
 *   (local prod server running) BASE_URL=http://127.0.0.1:8788 node scripts/make-og.mjs
 * Run once; the PNG is committed.
 */
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import sharp from "sharp";
const require = createRequire(new URL("../e2e/", import.meta.url));
const { chromium } = require("@playwright/test");

const W = 1200, H = 630;
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:8788";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
await page.goto(BASE);
await page.waitForSelector("canvas[data-stage=ready]", { timeout: 60000 });
await page.waitForTimeout(14000);
await page.addStyleTag({ content: "[data-scene] > div.pointer-events-none { display: none !important }" });
await page.waitForTimeout(500);
const frame = await page.locator("canvas").screenshot();
await browser.close();

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#1b1510" stop-opacity="0.82"/><stop offset="0.62" stop-color="#1b1510" stop-opacity="0.35"/><stop offset="1" stop-color="#1b1510" stop-opacity="0"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <text x="64" y="130" font-family="Georgia, serif" font-size="28" font-weight="700" fill="#ffb27a" letter-spacing="4">INTERVIEW TOWER</text>
  <text x="64" y="235" font-family="Georgia, serif" font-size="74" font-weight="700" fill="#fff8ec">Walk in.</text>
  <text x="64" y="320" font-family="Georgia, serif" font-size="74" font-weight="700" fill="#fff8ec">Get asked.</text>
  <text x="64" y="405" font-family="Georgia, serif" font-size="74" font-weight="700" fill="#fff8ec">Find the trap.</text>
  <text x="64" y="480" font-family="Helvetica, Arial, sans-serif" font-size="28" fill="#f1e2cc">Five towers of AI interview rooms. Walk there with the arrow keys.</text>
</svg>`;
const out = await sharp(frame).resize(W, H, { fit: "cover" }).composite([{ input: Buffer.from(svg) }]).png({ compressionLevel: 9 }).toBuffer();
writeFileSync("apps/web/public/og.png", out);
console.log(`og.png ${out.length} bytes`);
