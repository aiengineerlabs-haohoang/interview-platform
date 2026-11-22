import { expect, test } from "@playwright/test";
import { answerAndSubmit, openHome, playerAt, startExploring, walkTo } from "./helpers";

test("the 3D campus actually draws something, outside and in the interview room", async ({ page }) => {
  await openHome(page);
  await expect(page.locator("canvas[data-stage=ready]")).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(2500);
  // A blank or one-colour frame compresses to almost nothing; a lit campus with five towers does not.
  expect((await page.locator("canvas").screenshot()).length).toBeGreaterThan(60_000);

  await page.getByRole("button", { name: "Today's question" }).click();
  await expect(page.getByRole("textbox", { name: "Your answer" })).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(3000);
  expect((await page.locator("canvas").screenshot()).length).toBeGreaterThan(60_000);
});

test("the avatar walks under the arrow keys and stops when they are released", async ({ page }) => {
  test.slow(); // software rendering draws a few frames a second; walking is as slow as the frames
  await startExploring(page);
  await expect.poll(async () => (await playerAt(page))[0], { timeout: 20_000 }).not.toBeNaN();
  const [x0, z0] = await playerAt(page);
  await page.keyboard.down("ArrowUp");
  await expect.poll(async () => (await playerAt(page))[1], { timeout: 15_000 }).toBeLessThan(z0 - 3);
  await page.keyboard.up("ArrowUp");
  await page.waitForTimeout(700);
  const [, z1] = await playerAt(page);
  await page.waitForTimeout(700);
  expect((await playerAt(page))[1]).toBeCloseTo(z1, 0);
  expect(Math.abs((await playerAt(page))[0] - x0)).toBeLessThan(1);
});

test("a tower wall stops you instead of letting you walk through it", async ({ page }) => {
  test.slow(); // software rendering draws a few frames a second; walking is as slow as the frames
  await startExploring(page);
  // Straight at the ML Fundamentals tower, past the porch: the wall is 6.5m from its centre.
  await walkTo(page, 6.5, 12, 1.5);
  await walkTo(page, 6.5, -20, 1.5);
  await walkTo(page, 0, -20, 3.5); // a slow frame covers several metres, so be generous
  await page.keyboard.down("Shift");
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(6000);
  await page.keyboard.up("ArrowUp");
  await page.keyboard.up("Shift");
  const [, z] = await playerAt(page);
  expect(z).toBeGreaterThan(-26); // the ML tower's front face is at z = -25.5
});

test("two visitors see each other on campus", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await openHome(a);
  // Wait until the first visitor is registered, so the second one's first heartbeat is guaranteed to include them.
  await expect(a.getByTestId("online")).toHaveText(/\d+ (person|people) on campus/, { timeout: 20_000 });
  await openHome(b);
  await expect(b.getByTestId("online")).toHaveText(/\d+ people on campus/, { timeout: 20_000 });
  const n = Number(((await b.getByTestId("online").textContent()) ?? "").match(/\d+/)?.[0]);
  expect(n).toBeGreaterThanOrEqual(2);
  await a.context().close();
  await b.context().close();
});

test("presence follows a visitor into a room", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  await a.goto("/?q=speculative-decoding");
  await expect(a.getByRole("textbox", { name: "Your answer" })).toBeVisible({ timeout: 20_000 });
  const b = await (await browser.newContext()).newPage();
  await startExploring(b);
  await b.getByRole("button", { name: "All towers" }).click();
  await expect(b.locator("[data-room=llm-inference]")).toContainText("inside", { timeout: 20_000 });
  await a.context().close();
  await b.context().close();
});

test("without WebGL the whole product still works from the list of towers", async ({ browser }) => {
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
  await expect(page.getByRole("list", { name: "Towers" })).toBeVisible();
  await page.locator("[data-room=agents]").click();
  await expect(page.getByRole("textbox", { name: "Your answer" })).toBeVisible({ timeout: 20_000 });
  await answerAndSubmit(page);
  await ctx.close();
});

test("the product still works when the API is unreachable", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.route("**/api/**", (r) => r.abort());
  await page.goto("/?q=tool-failure-loop");
  await answerAndSubmit(page);
  await expect(page.getByTestId("online")).toHaveText("Quiet right now");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await ctx.close();
});

test("prefers-reduced-motion still renders and plays", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await startExploring(page);
  await page.getByRole("button", { name: "All towers" }).click();
  await page.locator("[data-room=reinforcement-learning]").click();
  await expect(page.getByRole("textbox", { name: "Your answer" })).toBeVisible({ timeout: 20_000 });
  await ctx.close();
});

test("the browser raises no security-policy violations while the campus loads and a room opens", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /content security policy|refused to/i.test(m.text())) problems.push(m.text());
  });
  page.on("pageerror", (e) => problems.push(e.message));
  await openHome(page);
  await expect(page.locator("canvas[data-stage=ready]")).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(6000);
  await page.getByRole("button", { name: "Today's question" }).click();
  await expect(page.getByRole("textbox", { name: "Your answer" })).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(6000);
  expect(problems).toEqual([]);
});
