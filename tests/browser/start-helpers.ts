import { expect, type Locator, type Page } from "@playwright/test";
import { SCENE_START_TIMEOUT } from "./browser-options";

/** Present real fixed-step frames until a timed UI event appears. */
export async function presentUntilVisible(page: Page, target: Locator, maxMilliseconds = 5000) {
  for (let elapsed = 0; elapsed < maxMilliseconds && !(await target.isVisible()); elapsed += 100) {
    await page.clock.runFor(100);
  }
  await expect(target).toBeVisible();
}

/**
 * Mobile start goes PICK YOUR EDGE → STEERING SYSTEM. Desktop skips the second
 * modal. Existing helpers that wait for Pause after STREET ACE must lock a
 * system when the steering dialog appears so they are not stuck there.
 */
export async function lockSteeringIfPrompted(page: Page, lockName = /Select DEFAULT/) {
  const steering = page.getByRole("dialog", { name: "STEERING SYSTEM" });
  const countdown = page.locator(".countdown");
  const playing = page.locator(".arcade-shell.mode-playing");
  try {
    await page.clock.runFor(100);
  } catch {
    // Clock is only installed in countdown-controlled tests.
  }
  // On a slow renderer the click can finish after the countdown has ended.
  await expect(steering.or(countdown).or(playing)).toBeVisible({ timeout: SCENE_START_TIMEOUT });
  if (await steering.isVisible()) {
    await page.getByRole("button", { name: lockName }).click();
  }
}
