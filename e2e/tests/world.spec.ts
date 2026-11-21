import { expect, test } from "@playwright/test";
import { answerAndSubmit, openHome } from "./helpers";

test("the 3D stage actually draws something, in every scene", async ({ page }) => {
  await openHome(page);
  await expect(page.locator("canvas[data-stage=ready]")).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1500);
  // A blank or one-colour frame compresses to almost nothing; a lit scene with a building does not.
  const outside = await page.locator("canvas").screenshot();
  expect(outside.length).toBeGreaterThan(40_000);

  await page.getByRole("button", { name: "Enter the tower" }).click();
  await page.waitForTimeout(2500);
  expect((await page.locator("canvas").screenshot()).length).toBeGreaterThan(40_000);

  await page.locator("[data-room=llm-inference]").click();
  await expect(page.getByRole("textbox", { name: "Your answer" })).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1500);
  expect((await page.locator("canvas").screenshot()).length).toBeGreaterThan(40_000);
});

test("two visitors see each other inside", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await openHome(a);
  await openHome(b);
  // The second visitor's first heartbeat returns a count that includes the first.
  await expect(b.getByTestId("online")).toHaveText(/\d+ people inside/, { timeout: 15_000 });
  const n = Number(((await b.getByTestId("online").textContent()) ?? "").match(/\d+/)?.[0]);
  expect(n).toBeGreaterThanOrEqual(2);
  await a.context().close();
  await b.context().close();
});

test("presence follows a visitor into a room", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  await a.goto("/?q=speculative-decoding");
  await expect(a.getByRole("textbox", { name: "Your answer" })).toBeVisible({ timeout: 15_000 });
  const b = await (await browser.newContext()).newPage();
  await openHome(b);
  await b.getByRole("button", { name: "Enter the tower" }).click();
  await expect(b.locator("[data-room=llm-inference]")).toContainText("inside", { timeout: 15_000 });
  await a.context().close();
  await b.context().close();
});

test("without WebGL the whole product still works, with the interviewer as a picture", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type.startsWith("webgl") || type === "experimental-webgl") return null;
      return (orig as (...a: unknown[]) => unknown).call(this, type, ...rest);
    } as typeof orig;
  });
  await page.goto("/");
  await expect(page.locator("[data-stage=off]")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.getByRole("button", { name: "Enter the tower" }).click();
  await page.locator("[data-room=agents]").click();
  await expect(page.getByRole("textbox", { name: "Your answer" })).toBeVisible({ timeout: 15_000 });
  await answerAndSubmit(page);
  await expect(page.locator("img[src^='/characters/interviewer/']")).toBeVisible();
  await ctx.close();
});

test("the product still works when the API is unreachable", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.route("**/api/**", (r) => r.abort());
  await page.goto("/?q=tool-failure-loop");
  await answerAndSubmit(page);
  await expect(page.getByTestId("online")).toHaveText("Quiet right now");
  await ctx.close();
});

test("prefers-reduced-motion still renders and plays", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await openHome(page);
  await page.getByRole("button", { name: "Enter the tower" }).click();
  await page.locator("[data-room=reinforcement-learning]").click();
  await expect(page.getByRole("textbox", { name: "Your answer" })).toBeVisible({ timeout: 15_000 });
  await ctx.close();
});
