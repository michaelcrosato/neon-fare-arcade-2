import { expect, type Page } from "@playwright/test";

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
