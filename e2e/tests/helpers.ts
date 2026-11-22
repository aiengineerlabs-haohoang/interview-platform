import { expect, type Page } from "@playwright/test";

export const STRONG_ANSWER =
  "Make the tool error specific and actionable so the model gets real feedback, add a retry budget with a hard stop, detect an identical repeated call, and escalate to a human with a partial result instead of looping. Tool calls should be idempotent too.";

/** The campus, with the welcome card dismissed so the HUD is in its everyday shape. */
export async function openHome(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Start exploring" })).toBeVisible();
}

export async function startExploring(page: Page) {
  await openHome(page);
  await page.getByRole("button", { name: "Start exploring" }).click();
}

export async function answerAndSubmit(page: Page, text = STRONG_ANSWER) {
  const box = page.getByRole("textbox", { name: "Your answer" });
  await box.fill(text);
  await page.getByRole("button", { name: "Submit answer" }).click();
  await expect(page.getByTestId("score")).toBeVisible();
}

export async function playerAt(page: Page): Promise<[number, number]> {
  const raw = await page.locator("canvas[data-stage=ready]").getAttribute("data-player");
  if (!raw) return [Number.NaN, Number.NaN];
  const [x, z] = raw.split(",").map(Number) as [number, number];
  return [x, z];
}

/**
 * Walks the avatar with the real arrow keys, steering by where it actually is (the software renderer in CI runs at a
 * few frames a second, so a fixed key-hold time would be a coin toss). Camera yaw is 0, so Up is -z and Right is +x.
 */
export async function walkTo(page: Page, x: number, z: number, within = 1.0) {
  let running = false;
  const setRun = async (on: boolean) => {
    if (on === running) return;
    running = on;
    await (on ? page.keyboard.down("Shift") : page.keyboard.up("Shift"));
  };
  try {
    for (let i = 0; i < 400; i++) {
      const [px, pz] = await playerAt(page);
      if (Number.isNaN(px)) {
        await page.waitForTimeout(150);
        continue;
      }
      const dx = x - px, dz = z - pz;
      const dist = Math.hypot(dx, dz);
      // A slow frame (software rendering) covers several metres, so near the mark walk instead of run and accept a wider miss.
      if (dist < Math.max(within, 2.2)) return;
      await setRun(dist > 10);
      const keys = [Math.abs(dx) > 0.5 ? (dx > 0 ? "ArrowRight" : "ArrowLeft") : "", Math.abs(dz) > 0.5 ? (dz > 0 ? "ArrowDown" : "ArrowUp") : ""].filter(Boolean);
      for (const k of keys) await page.keyboard.down(k);
      await page.waitForTimeout(140);
      for (const k of keys) await page.keyboard.up(k);
      // Let it coast to a stop before judging where it is: at a few frames a second the glide is several metres.
      for (let j = 0; j < 12; j++) {
        const [ax, az] = await playerAt(page);
        await page.waitForTimeout(450);
        const [bx, bz] = await playerAt(page);
        if (Math.hypot(bx - ax, bz - az) < 0.05) break;
      }
    }
    throw new Error(`never reached ${x},${z}; ended at ${(await playerAt(page)).join(",")}`);
  } finally {
    await setRun(false);
  }
}

/** Start (0,17) to the Machine Learning Fundamentals door, around the fountain on its right. */
export async function walkToMlFundamentals(page: Page) {
  await walkTo(page, 6.5, 12, 1.5);
  await walkTo(page, 6.5, -20, 1.5);
  await walkTo(page, 0, -22.9, 1.0);
}
