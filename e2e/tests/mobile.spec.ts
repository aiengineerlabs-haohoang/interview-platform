import { expect, test } from "@playwright/test";
import { answerAndSubmit, openHome, playerAt, startExploring } from "./helpers";

test("on a phone nothing scrolls sideways and the whole flow is reachable", async ({ page }) => {
  await openHome(page);
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(await overflow()).toBeLessThanOrEqual(0);

  await page.getByRole("button", { name: "Start exploring" }).click();
  await page.getByRole("button", { name: "All towers" }).click();
  await expect(page.getByRole("list", { name: "Towers" })).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);

  await page.locator("[data-room=agents]").click();
  await expect(page.getByRole("textbox", { name: "Your answer" })).toBeVisible({ timeout: 20_000 });
  expect(await overflow()).toBeLessThanOrEqual(0);
  await answerAndSubmit(page);
  await expect(page.getByRole("button", { name: "Next question" })).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
});

test("the on-screen stick walks the avatar", async ({ page }) => {
  await startExploring(page);
  await expect.poll(async () => (await playerAt(page))[0], { timeout: 20_000 }).not.toBeNaN();
  const [, z0] = await playerAt(page);
  const stick = page.getByRole("group", { name: "Walking stick" });
  await expect(stick).toBeVisible();
  const b = (await stick.boundingBox())!;
  const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy - 45, { steps: 4 });
  await expect.poll(async () => (await playerAt(page))[1], { timeout: 15_000 }).toBeLessThan(z0 - 3);
  await page.mouse.up();
});

test("the answer box is not hidden behind the header on a phone", async ({ page }) => {
  await page.goto("/?q=prompt-cache-prefix");
  const box = page.getByRole("textbox", { name: "Your answer" });
  await expect(box).toBeVisible({ timeout: 20_000 });
  const b = await box.boundingBox();
  const vp = page.viewportSize()!;
  expect(b!.y).toBeGreaterThan(80);
  expect(b!.x).toBeGreaterThanOrEqual(0);
  expect(b!.x + b!.width).toBeLessThanOrEqual(vp.width);
});
