import { expect, type Locator, type Page } from "@playwright/test";
import { SCENE_START_TIMEOUT } from "./browser-options";

/** Present real fixed-step frames until a timed UI event appears. */
export async function presentUntilVisible(page: Page, target: Locator, maxMilliseconds = 5000) {
  for (let elapsed = 0; elapsed < maxMilliseconds && !(await target.isVisible()); elapsed += 100) {
    await page.clock.runFor(100);
  }
  await expect(target).toBeVisible();
}

/** Every run starts with its own garage screen, including repeat runs. */
export async function confirmVehicle(page: Page) {
  const garage = page.getByRole("dialog", { name: "SELECT YOUR VEHICLE", exact: true });
  await expect(garage).toBeVisible();
  await garage.getByRole("button", { name: /^Continue to (Edge|Steering) selection$/ }).click();
}

/** Both desktop and mobile lock steering after Arcade's Edge or Simulation's Vehicle. */
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
