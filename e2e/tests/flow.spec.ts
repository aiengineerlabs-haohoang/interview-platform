import { expect, test } from "@playwright/test";
import { answerAndSubmit, openHome, startExploring, walkToMlFundamentals } from "./helpers";

test("a visitor walks to a tower with the arrow keys, goes in, answers, and sees the verdict, the trap and the senior answer", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await startExploring(page);
  await expect(page).toHaveTitle(/Interview Tower/);

  // Nothing offers the door until you are standing at it.
  await expect(page.getByTestId("enter-prompt")).toHaveCount(0);
  await walkToMlFundamentals(page);
  await expect(page.getByTestId("enter-prompt")).toContainText("ML Fundamentals", { timeout: 10_000 });
  await page.keyboard.press("Enter");

  await expect(page.getByRole("textbox", { name: "Your answer" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Submit answer" })).toBeDisabled();
  await expect(page.getByText("ML Fundamentals", { exact: true })).toBeVisible();

  await answerAndSubmit(
    page,
    "Unsupervised describes the objective and the loss, not the dataset, so labelled data can still be used with an unsupervised objective. A label is often one join away.",
  );
  await expect(page.getByText("The trap", { exact: true })).toBeVisible();
  await expect(page.getByText("The answer that gets you hired")).toBeVisible();

  await page.getByRole("button", { name: "Next question" }).click();
  await expect(page.getByRole("textbox", { name: "Your answer" })).toHaveValue("");
  expect(errors).toEqual([]);
});

test("the list of towers is a way in for people who would rather not walk", async ({ page }) => {
  await startExploring(page);
  await page.getByRole("button", { name: "All towers" }).click();
  await expect(page.getByRole("list", { name: "Towers" }).getByRole("button")).toHaveCount(5);
  await page.locator("[data-room=agents]").click();
  await expect(page.getByRole("textbox", { name: "Your answer" })).toBeVisible({ timeout: 20_000 });
});

test("progress and the streak survive a reload, and leaving the room puts you back outside", async ({ page }) => {
  await page.goto("/?q=tool-failure-loop");
  await expect(page.getByRole("textbox", { name: "Your answer" })).toBeVisible({ timeout: 20_000 });
  await answerAndSubmit(page);
  await expect(page.getByTestId("streak")).toHaveText(/1-day streak/);
  await page.reload();
  // The address still names the question, so a reload puts the visitor back in the same room.
  await expect(page.getByRole("textbox", { name: "Your answer" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("streak")).toHaveText(/1-day streak/);
  await page.getByRole("region", { name: "Interview" }).getByRole("button", { name: "Leave the room" }).click();
  await expect(page.getByRole("button", { name: "All towers" })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "All towers" }).click();
  await expect(page.locator("[data-room=agents]")).toContainText(/1\/\d+ tried/);
});

test("a shared link opens that exact question", async ({ page }) => {
  await page.goto("/?q=kv-cache-memory");
  await expect(page.getByText("runs out of GPU memory", { exact: false }).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("textbox", { name: "Your answer" })).toBeVisible();
});

test("an unknown shared link falls back to the campus instead of breaking", async ({ page }) => {
  await page.goto("/?q=no-such-question");
  await expect(page.getByRole("button", { name: "Start exploring" })).toBeVisible();
});

test("today's question is one click from the front door", async ({ page }) => {
  await openHome(page);
  await page.getByRole("button", { name: "Today's question" }).click();
  await expect(page.getByRole("textbox", { name: "Your answer" })).toBeVisible({ timeout: 20_000 });
});

test("giving up shows the answer and does not count as an attempt", async ({ page }) => {
  await page.goto("/?q=prompt-cache-prefix");
  await page.getByRole("button", { name: "Show me the answer" }).click();
  await expect(page.getByText("prefix match").first()).toBeVisible();
  await expect(page.getByTestId("score")).toHaveCount(0);
  await expect(page.getByTestId("streak")).toHaveCount(0);
});

test("the typing box swallows the arrow keys, so you never walk away while answering", async ({ page }) => {
  await page.goto("/?q=tool-failure-loop");
  const box = page.getByRole("textbox", { name: "Your answer" });
  await expect(box).toBeVisible({ timeout: 20_000 });
  await box.click();
  await page.keyboard.type("abc");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.type("X");
  await expect(box).toHaveValue("abXc");
});
