import { expect, test } from "@playwright/test";
import { startExploring } from "./helpers";

test("a visitor creates an account in the page, stays signed in after a reload, signs out and signs back in", async ({ page }) => {
  const username = `ui_${Date.now().toString(36)}`.slice(0, 20);
  const password = "ui-password-123";
  await startExploring(page);

  await page.getByRole("button", { name: "Sign in" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("tab", { name: "Create account" }).click();
  await dialog.getByLabel("Username").fill(username);
  await dialog.getByLabel("Password", { exact: false }).first().fill(password);
  await dialog.getByRole("button", { name: /create account|join/i }).last().click();
  await expect(page.getByTestId("who")).toHaveText(username, { timeout: 15_000 });

  await page.reload();
  await expect(page.getByTestId("who")).toHaveText(username, { timeout: 15_000 });

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();

  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("dialog").getByLabel("Username").fill(username);
  await page.getByRole("dialog").getByLabel("Password", { exact: false }).first().fill(password);
  await page.getByRole("dialog").getByRole("button", { name: /^sign in$/i }).last().click();
  await expect(page.getByTestId("who")).toHaveText(username, { timeout: 15_000 });
});

test("a wrong password says so and keeps the dialog open", async ({ page }) => {
  test.slow();
  await startExploring(page);
  await page.getByRole("button", { name: "Sign in" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Username").fill("nobody_here");
  await dialog.getByLabel("Password", { exact: false }).first().fill("not-the-password");
  await dialog.getByRole("button", { name: /^sign in$/i }).last().click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog).toBeVisible();
});
