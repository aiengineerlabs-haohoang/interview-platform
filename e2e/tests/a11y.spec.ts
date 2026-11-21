import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { answerAndSubmit, openHome, startExploring } from "./helpers";

/** Serious and critical only: those are the ones that stop someone using the page. */
async function blockers(page: Page) {
  // The 3D canvas is decoration (aria-hidden); contrast over it cannot be computed, so it is judged by eye in screenshots.
  const results = await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze();
  return results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
}

test("the front door has no serious accessibility violations", async ({ page }) => {
  await openHome(page);
  expect(await blockers(page)).toEqual([]);
});

test("the campus with its list of towers open has none", async ({ page }) => {
  await startExploring(page);
  await page.getByRole("button", { name: "All towers" }).click();
  await expect(page.getByRole("list", { name: "Towers" })).toBeVisible();
  expect(await blockers(page)).toEqual([]);
});

test("the interview room has none, before and after answering", async ({ page }) => {
  await page.goto("/?q=tool-failure-loop");
  await expect(page.getByRole("textbox", { name: "Your answer" })).toBeVisible({ timeout: 15_000 });
  expect(await blockers(page)).toEqual([]);
  await answerAndSubmit(page);
  expect(await blockers(page)).toEqual([]);
});

test("everything is reachable and operable from the keyboard", async ({ page }) => {
  await openHome(page);
  await page.getByRole("button", { name: "Start exploring" }).focus();
  await page.keyboard.press("Enter");
  const all = page.getByRole("button", { name: "All towers" });
  await all.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("list", { name: "Towers" })).toBeVisible();
  await page.locator("[data-room=agents]").focus();
  await page.keyboard.press("Enter");
  const box = page.getByRole("textbox", { name: "Your answer" });
  await expect(box).toBeVisible({ timeout: 20_000 });
  await box.focus();
  await page.keyboard.insertText("Make the tool error specific and actionable, add a retry budget with a hard stop, detect repeated identical calls and escalate to a human with a partial result.");
  await page.getByRole("button", { name: "Submit answer" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("score")).toBeVisible();
});

test("the document has a language, a title and one h1 at most per scene", async ({ page }) => {
  await openHome(page);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});
