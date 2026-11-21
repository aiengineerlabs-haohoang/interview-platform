/**
 * Drives the local production-shaped server and writes screenshots of every scene at desktop and phone size.
 *   BASE_URL=http://127.0.0.1:8788 node scripts/screenshot.mjs
 * Look at them: tests cannot see an ugly frame. Output goes to .screenshots/ (gitignored).
 */
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(new URL("../e2e/", import.meta.url));
const { chromium } = require("@playwright/test");

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:8788";
mkdirSync(".screenshots", { recursive: true });
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const sizes = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };

for (const [name, viewport] of Object.entries(sizes)) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: name === "phone" ? 2 : 1, hasTouch: name === "phone" });
  const page = await ctx.newPage();
  page.on("console", (m) => ["error", "warning"].includes(m.type()) && console.log(`[${name}] console ${m.type()}: ${m.text()}`));
  page.on("pageerror", (e) => console.log(`[${name}] pageerror: ${e.message}`));
  await page.goto(BASE);
  await page.waitForSelector("canvas[data-stage=ready]", { timeout: 15000 });
  await page.waitForTimeout(2800);
  await page.screenshot({ path: `.screenshots/${name}-1-outside.png` });
  await page.getByRole("button", { name: "Enter the tower" }).click();
  await page.waitForTimeout(3200);
  await page.screenshot({ path: `.screenshots/${name}-2-lobby.png` });
  await page.locator("[data-room=agents]").click();
  await page.waitForSelector("textarea", { timeout: 15000 });
  await page.waitForTimeout(2800);
  await page.screenshot({ path: `.screenshots/${name}-3-room.png` });
  await page.getByRole("textbox", { name: "Your answer" }).fill(
    "A cheap fix is to make the tool error specific and actionable, so the model gets real feedback, and then add a retry budget with a hard stop. I would also detect an identical repeated call and escalate to a human with a partial result.",
  );
  await page.getByRole("button", { name: "Submit answer" }).click();
  await page.waitForSelector("[data-testid=score]");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `.screenshots/${name}-4-revealed.png` });
  await ctx.close();
}
await browser.close();
console.log("done");
