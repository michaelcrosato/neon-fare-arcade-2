import { expect, type Locator, type Page } from "@playwright/test";

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
  try {
    await page.clock.runFor(100);
  } catch {
    // Clock is only installed in countdown-controlled tests.
  }
  await expect(steering.or(countdown)).toBeVisible();
  if (await steering.isVisible()) {
    await page.getByRole("button", { name: lockName }).click();
  }
}
