import { expect, test } from "@playwright/test";
import { WEBGPU_TEST_OPTIONS } from "./browser-options";

test.use({ ...WEBGPU_TEST_OPTIONS, viewport: { width: 1440, height: 960 } });
test.setTimeout(90_000);
declare global { interface Window { testPadButtons: number[]; testPadAxis: number; fullscreenRequests: number } }

test("desktop choices, GT-R automatic, controller pause/resume and fullscreen re-entry", async ({ page }, info) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    window.testPadButtons = []; window.testPadAxis = 0; window.fullscreenRequests = 0;
    Object.defineProperty(navigator, "getGamepads", { configurable: true, value: () => [{ connected: true, mapping: "standard", axes: [window.testPadAxis, 0],
      buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: window.testPadButtons.includes(i), value: window.testPadButtons.includes(i) ? 1 : 0 })) }] });
    const enterFullscreen = HTMLElement.prototype.requestFullscreen;
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", { configurable: true, value: async function(this: HTMLElement, options?: FullscreenOptions) {
      window.fullscreenRequests++;
      await enterFullscreen.call(this, options);
    } });
  });
  await page.goto("/?diagnostics=1");
  await page.getByRole("button", { name: /^Start Simulation Free Run/ }).click();
  await page.getByRole("radio", { name: "Manual", exact: true }).check();
  await page.getByRole("button", { name: "Lock in GT-R", exact: true }).click();
  const steering = page.getByRole("dialog", { name: "STEERING SYSTEM" });
  await expect(steering).toContainText("KEYBOARD & MOUSE");
  await expect(steering).toContainText("PS5-style");
  await expect(steering.getByRole("button", { name: "SUPPORT COMING LATER" })).toBeDisabled();
  await page.screenshot({ path: info.outputPath("desktop-controls.png") });
  await steering.getByRole("button", { name: "Select gamepad controls", exact: true }).click();
  await expect(page.locator(".mode-playing")).toBeVisible({ timeout: 20_000 });
  await page.clock.install();
  await page.clock.runFor(100);
  await page.evaluate(() => { window.testPadButtons = [7]; window.testPadAxis = .3; });
  await page.clock.runFor(900);
  await page.evaluate(() => { window.testPadButtons = [9]; window.testPadAxis = 0; });
  await page.clock.runFor(100);
  await expect(page.getByRole("heading", { name: "FREE RUN PAUSED!" })).toBeVisible();
  await page.getByRole("button", { name: "COPY DIAGNOSTICS", exact: true }).click();
  const report = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
  expect(report.currentGame.vehicleId).toBe("gtr-r35");
  expect(report.currentGame.transmissionMode).toBe("automatic");
  expect(report.currentGame.speed).toBeGreaterThan(1);
  expect(report.currentGame.steering).toBeGreaterThan(0);
  expect(report.recentErrors).toEqual([]);
  await page.getByRole("button", { name: /ENTER FULLSCREEN/ }).click();
  await expect(page.getByRole("button", { name: /FULLSCREEN IS ON/ })).toBeDisabled();
  expect(await page.evaluate(() => window.fullscreenRequests)).toBe(1);
  await page.evaluate(() => document.exitFullscreen());
  await page.getByRole("button", { name: /ENTER FULLSCREEN/ }).click();
  expect(await page.evaluate(() => window.fullscreenRequests)).toBe(2);
  await page.evaluate(() => { window.testPadButtons = []; });
  await page.clock.runFor(100);
  await page.evaluate(() => { window.testPadButtons = [0]; });
  await page.clock.runFor(100);
  await expect(page.locator(".mode-playing")).toBeVisible();
  expect(errors).toEqual([]);
});
