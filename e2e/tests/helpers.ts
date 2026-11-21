import { expect, type Page } from "@playwright/test";

export const STRONG_ANSWER =
  "Make the tool error specific and actionable so the model gets real feedback, add a retry budget with a hard stop, detect an identical repeated call, and escalate to a human with a partial result instead of looping. Tool calls should be idempotent too.";

export async function openHome(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Enter the tower" })).toBeVisible();
}

export async function answerAndSubmit(page: Page, text = STRONG_ANSWER) {
  const box = page.getByRole("textbox", { name: "Your answer" });
  await box.fill(text);
  await page.getByRole("button", { name: "Submit answer" }).click();
  await expect(page.getByTestId("score")).toBeVisible();
}
