import { expect, test } from "@playwright/test";
import { confirmVehicle, lockSteeringIfPrompted } from "./start-helpers";
import { WEBGPU_TEST_OPTIONS } from "./browser-options";

test.use(WEBGPU_TEST_OPTIONS);
test.setTimeout(90_000);

for (const mobile of [false, true]) test.describe(mobile ? "phone setup" : "desktop setup", () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 960 },
    contextOptions: { hasTouch: mobile, isMobile: mobile, reducedMotion: "reduce" } });
  for (const kind of ["shift", "free", "simulation"] as const) test(`${kind}: separate screens retain choices and start only after steering`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.clock.install({ time: new Date("2026-09-13T00:00:00Z") });
    await page.addInitScript(() => Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined }));
    await page.goto("/?diagnostics=1");
    const trigger = page.getByRole("button", { name: kind === "shift" ? /Start an Arcade Shift/ : kind === "free" ? /Start Free Run with arcade/ : /^Start Simulation Free Run\. Drive/ });
    await trigger.click();
    await page.clock.pauseAt(new Date("2026-09-13T01:00:00Z"));
    const garage = page.getByRole("dialog", { name: "SELECT YOUR VEHICLE", exact: true });
    await expect(garage).toBeVisible();
    await expect(page.locator(".driver-traits, .steering-options, .countdown")).toHaveCount(0);
    await expect(garage.locator(".run-setup-progress li")).toHaveCount(kind === "simulation" ? 2 : 3);
    await page.getByRole("button", { name: "Select 2015 Honda Accord Coupe V6", exact: true }).click();
    await expect(page.getByRole("radio", { name: "Automatic", exact: true })).toBeChecked();
    await page.getByRole("radio", { name: "Manual", exact: true }).check();
    const accordCard = garage.locator(".vehicle-card.is-selected");
    await expect(accordCard.locator(":scope > p")).toHaveText("Secret special edition. Same streets. Just goes faster.");
    await expect(accordCard.locator(":scope > ul")).toHaveCount(0);
    await expect(accordCard.getByRole("button", { name: /^READ THE ACCORD/ })).toBeVisible();
    await expect(garage.getByRole("button", { name: /^Lock in / })).toHaveCount(2);
    await expect(accordCard.getByRole("button", { name: "Lock in ACCORD V6" })).toHaveClass("driver-trait__pick");
    if (kind === "free") {
      await accordCard.getByRole("button", { name: /^READ THE ACCORD/ }).click();
      const story = page.getByRole("dialog", { name: "SECRET SPECIAL EDITION", exact: true });
      await expect(story).toBeVisible();
      await expect(story).toContainText("It sticks sometimes.");
      await expect(story).not.toContainText("%");
      await expect.poll(() => story.locator("img").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1536);
      await page.keyboard.press("Escape");
      await expect(story).toHaveCount(0);
    }
    await page.screenshot({ path: info.outputPath("vehicle.png") });
    await confirmVehicle(page);
    if (kind !== "simulation") {
      await expect(page.getByRole("dialog", { name: "PICK YOUR EDGE" })).toBeVisible();
      await expect(page.locator(".vehicle-garage, .steering-options, .countdown")).toHaveCount(0);
      await page.getByRole("button", { name: /Choose REDLINE RUSH/ }).click();
    }
    const steering = page.getByRole("dialog", { name: "STEERING SYSTEM" });
    await expect(steering).toBeVisible();
    await expect(page.locator(".vehicle-garage, .driver-traits:not(.steering-options), .countdown")).toHaveCount(0);
    await expect(steering.locator('[aria-current="step"]')).toContainText("STEERING");
    await page.screenshot({ path: info.outputPath("steering.png") });
    await page.keyboard.press("Escape");
    if (kind !== "simulation") {
      await expect(page.getByRole("dialog", { name: "PICK YOUR EDGE" })).toBeVisible();
      await page.keyboard.press("Escape");
    }
    await expect(garage).toBeVisible();
    await expect(page.getByRole("button", { name: "Select 2015 Honda Accord Coupe V6", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("radio", { name: "Manual", exact: true })).toBeChecked();
    // A card's lock button commits that vehicle even if the other card was highlighted.
    await garage.getByRole("button", { name: "Lock in CROWN CAB", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(garage.getByRole("button", { name: /^Select Crown Cab/ })).toHaveAttribute("aria-pressed", "true");
    await garage.getByRole("button", { name: "Select 2015 Honda Accord Coupe V6", exact: true }).click();
    if (mobile) {
      await page.setViewportSize({ width: 844, height: 390 });
      await page.getByRole("radio", { name: "Automatic", exact: true }).check();
      await page.getByRole("radio", { name: "Manual", exact: true }).check();
      const lock = page.getByRole("button", { name: "Lock in ACCORD V6" });
      await lock.scrollIntoViewIfNeeded();
      // Rotated layouts can round the last fraction of a CSS pixel at the viewport edge.
      await expect(lock).toBeInViewport({ ratio: .999 });
      await page.screenshot({ path: info.outputPath("vehicle-landscape.png") });
    }
    await confirmVehicle(page);
    if (kind !== "simulation") await page.getByRole("button", { name: /Choose REDLINE RUSH/ }).click();
    await lockSteeringIfPrompted(page);
    await expect(page.locator(".countdown")).toBeVisible();
    await page.clock.fastForward(3500);
    await page.clock.runFor(100);
    await expect(page.locator(".arcade-shell.mode-playing")).toBeVisible();
    await page.getByRole("button", { name: "Pause game", exact: true }).click();
    await page.getByRole("button", { name: "COPY DIAGNOSTICS", exact: true }).click();
    await expect(page.getByText("DIAGNOSTICS COPIED", { exact: true })).toBeVisible();
    const report = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
    expect(report.currentGame.vehicleId).toBe("accord-v6");
    expect(report.currentGame.transmissionMode).toBe("manual");
    expect(report.currentGame.drivingModel).toBe(kind === "simulation" ? "simulation" : "arcade");
    expect(report.currentGame.drivingTraitId).toBe(kind === "simulation" ? "street-ace" : "redline-rush");
    expect(report.currentGame.runKind).toBe(kind === "shift" ? "timed" : "free-run");
    expect(report.recentErrors).toEqual([]);
    expect(errors).toEqual([]);
  });
});
