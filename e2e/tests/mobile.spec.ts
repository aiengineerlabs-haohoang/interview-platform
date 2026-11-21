import { expect, test } from "@playwright/test";
import { answerAndSubmit, openHome } from "./helpers";

test("on a phone nothing scrolls sideways and the whole flow is reachable", async ({ page }) => {
  await openHome(page);
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(await overflow()).toBeLessThanOrEqual(0);

  await page.getByRole("button", { name: "Enter the tower" }).click();
  await expect(page.getByRole("list", { name: "Floors" })).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);

  await page.locator("[data-room=agents]").click();
  await expect(page.getByRole("textbox", { name: "Your answer" })).toBeVisible({ timeout: 15_000 });
  expect(await overflow()).toBeLessThanOrEqual(0);
  await answerAndSubmit(page);
  await expect(page.getByRole("button", { name: "Next question" })).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
});

test("the answer box is not hidden behind the header on a phone", async ({ page }) => {
  await page.goto("/?q=prompt-cache-prefix");
  const box = page.getByRole("textbox", { name: "Your answer" });
  await expect(box).toBeVisible({ timeout: 15_000 });
  const b = await box.boundingBox();
  const vp = page.viewportSize()!;
  expect(b!.y).toBeGreaterThan(80);
  expect(b!.x).toBeGreaterThanOrEqual(0);
  expect(b!.x + b!.width).toBeLessThanOrEqual(vp.width);
});
