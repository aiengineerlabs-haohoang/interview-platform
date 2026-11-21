import { expect, test } from "@playwright/test";
import { answerAndSubmit, openHome } from "./helpers";

test("a visitor walks in, picks a floor, answers, and sees the verdict, the trap and the senior answer", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await openHome(page);
  await expect(page).toHaveTitle(/Interview Tower/);
  await page.getByRole("button", { name: "Enter the tower" }).click();

  const floors = page.getByRole("list", { name: "Floors" }).getByRole("button");
  await expect(floors).toHaveCount(5);

  await page.locator("[data-room=agents]").click();
  await expect(page.getByRole("textbox", { name: "Your answer" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Submit answer" })).toBeDisabled();

  await answerAndSubmit(page);
  const score = Number(await page.getByTestId("score").textContent());
  expect(score).toBeGreaterThanOrEqual(60);
  await expect(page.getByText("The trap", { exact: true })).toBeVisible();
  await expect(page.getByText("The answer that gets you hired")).toBeVisible();

  await page.getByRole("button", { name: "Next question" }).click();
  await expect(page.getByRole("textbox", { name: "Your answer" })).toHaveValue("");
  expect(errors).toEqual([]);
});

test("progress and the streak survive a reload, with no account", async ({ page }) => {
  await openHome(page);
  await page.getByRole("button", { name: "Enter the tower" }).click();
  await page.locator("[data-room=ml-fundamentals]").click();
  await expect(page.getByRole("textbox", { name: "Your answer" })).toBeVisible({ timeout: 15_000 });
  await answerAndSubmit(page, "Unsupervised describes the objective and the loss, not the dataset, so labelled data can still be used with an unsupervised objective. A label is often one join away.");
  await expect(page.getByTestId("streak")).toHaveText(/1-day streak/);
  await page.reload();
  // The address still names the question, so a reload puts the visitor back in the same room.
  await expect(page.getByRole("textbox", { name: "Your answer" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("streak")).toHaveText(/1-day streak/);
  await page.getByRole("button", { name: "Back to the lobby" }).click();
  await expect(page.locator("[data-room=ml-fundamentals]")).toContainText("1/4 tried");
});

test("a shared link opens that exact question", async ({ page }) => {
  await page.goto("/?q=kv-cache-memory");
  await expect(page.getByText("runs out of GPU memory", { exact: false }).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("textbox", { name: "Your answer" })).toBeVisible();
});

test("an unknown shared link falls back to the front door instead of breaking", async ({ page }) => {
  await page.goto("/?q=no-such-question");
  await expect(page.getByRole("button", { name: "Enter the tower" })).toBeVisible();
});

test("today's question is one click from the front door", async ({ page }) => {
  await openHome(page);
  await page.getByRole("button", { name: "Today's question" }).click();
  await expect(page.getByRole("textbox", { name: "Your answer" })).toBeVisible({ timeout: 15_000 });
});

test("giving up shows the answer and does not count as an attempt", async ({ page }) => {
  await page.goto("/?q=prompt-cache-prefix");
  await page.getByRole("button", { name: "Show me the answer" }).click();
  await expect(page.getByText("prefix match").first()).toBeVisible();
  await expect(page.getByTestId("score")).toHaveCount(0);
  await expect(page.getByTestId("streak")).toHaveCount(0);
});
