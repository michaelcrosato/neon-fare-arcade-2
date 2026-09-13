import { expect, test, type Page } from "@playwright/test";
import { SCENE_START_TIMEOUT, SCENE_TEST_TIMEOUT, WEBGPU_TEST_OPTIONS } from "./browser-options";
import { confirmVehicle, lockSteeringIfPrompted } from "./start-helpers";
import type { Game } from "../../game/model";

test.use(WEBGPU_TEST_OPTIONS);
test.setTimeout(Math.max(120_000, SCENE_TEST_TIMEOUT * 4));

async function advance(page: Page, ms: number) {
  for (let t = 0; t < ms; t += 50) await page.clock.fastForward(50);
}

test.describe("two-finger manual controls", () => {
  test.use({ viewport: { width: 844, height: 390 }, contextOptions: { hasTouch: true, isMobile: true, reducedMotion: "reduce" } });
  for (const [renderer, model] of [["WebGPU", "arcade"], ["Canvas", "simulation"]]) {
    test(`${renderer} ${model}: clutch and shifter keep independent touch ownership`, async ({ page, context }) => {
      await start(page, renderer, model, true);
      const cdp = await context.newCDPSession(page);
      const clutch = page.getByRole("button", { name: /^Clutch\. Hold Shift/ });
      const shift = page.getByRole("button", { name: /Shift up\. X key/ });
      const clutchBox = (await clutch.boundingBox())!, shiftBox = (await shift.boundingBox())!;
      const thumb = { x: clutchBox.x + clutchBox.width / 2, y: clutchBox.y + clutchBox.height / 2, id: 1 };
      const finger = { x: shiftBox.x + shiftBox.width / 2, y: shiftBox.y + shiftBox.height / 2, id: 2 };
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [thumb] });
      await advance(page, 100);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [thumb, finger] });
      await advance(page, 100);
      await expect(page.locator(".transmission-controls__status > b")).toHaveText("2");
      // CDP touchEnd lists the contacts being released, not the survivors.
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [finger] });
      await advance(page, 100);
      await expect(page.locator(".transmission-controls__status")).toContainText("CLUTCH DOWN");
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await advance(page, 100);
      await expect(page.locator(".transmission-controls__status")).toContainText("CLUTCH STUCK · 3 PUMPS");
      await expect(page.locator(".mobile-pedal--brake")).toContainText("SERVICE");
      await page.screenshot({ path: test.info().outputPath("manual-landscape.png") });
      const game = await currentGame(page);
      expect(game.transmission.gear).toBe(2);
      expect(game.steering).toBe(0);
    });
  }
});

async function start(page: Page, renderer: string, model: string, manual: boolean) {
  await page.clock.install({ time: new Date("2026-09-13T00:00:00Z") });
  await page.addInitScript(({ renderer }) => {
    if (renderer === "Canvas") Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined });
    // Seed 12 sticks on the first clutch engagement, then follows normal RNG.
    const original = crypto.getRandomValues.bind(crypto);
    Object.defineProperty(crypto, "getRandomValues", { value: (array: Uint32Array) => {
      const result = original(array);
      if (array instanceof Uint32Array && array.length === 1) array[0] = 12;
      return result;
    } });
  }, { renderer });
  await page.goto("/?diagnostics=1");
  await expect(page.locator(".game-canvas").nth(renderer === "WebGPU" ? 1 : 0)).toHaveClass(/is-active/, { timeout: 30_000 });
  await page.getByRole("button", { name: model === "simulation" ? /^Start Simulation Free Run\. Drive/ : /Start Free Run with arcade/ }).click();
  await page.clock.pauseAt(new Date("2026-09-13T01:00:00Z"));
  await expect(page.locator(".vehicle-card")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Select Crown Cab ’96", exact: true })).toHaveAttribute("aria-pressed", "true");
  const empty = page.getByRole("article", { name: "Vehicle slot 3. Empty." });
  await expect(empty.locator("button, input")).toHaveCount(0);
  await page.getByRole("button", { name: "Select 2015 Honda Accord Coupe V6", exact: true }).click();
  await expect(page.getByRole("radio", { name: "Automatic", exact: true })).toBeChecked();
  if (manual) await page.getByRole("radio", { name: "Manual", exact: true }).check();
  await expect(page.getByRole("button", { name: "Select 2015 Honda Accord Coupe V6", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: test.info().outputPath("garage.png") });
  await confirmVehicle(page);
  if (model === "arcade") await page.getByRole("button", { name: /Choose STREET ACE/ }).click();
  await lockSteeringIfPrompted(page);
  await page.clock.fastForward(3500);
  await page.clock.runFor(100);
  await expect(page.locator(".arcade-shell.mode-playing")).toBeVisible({ timeout: SCENE_START_TIMEOUT });
  await expect(page.getByLabel("Accord transmission", { exact: true })).toBeVisible();
}

async function currentGame(page: Page): Promise<Game> {
  await page.getByRole("button", { name: "Pause game", exact: true }).click();
  await page.getByRole("button", { name: "COPY DIAGNOSTICS", exact: true }).click();
  await expect(page.getByText("DIAGNOSTICS COPIED", { exact: true })).toBeVisible();
  const report = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
  expect(report.recentErrors).toEqual([]);
  return report.currentGame;
}

for (const renderer of ["WebGPU", "Canvas"]) for (const model of ["arcade", "simulation"]) {
  test(`${renderer} ${model}: keyboard manual selection, six gears and clutch recovery`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await start(page, renderer, model, true);
    const status = page.locator(".transmission-controls__status");
    const transmissionBox = (await page.locator(".transmission-controls").boundingBox())!;
    const exitBox = (await page.getByRole("button", { name: /EXIT TAXI.*Explore on foot/i }).boundingBox())!;
    expect(transmissionBox.x + transmissionBox.width).toBeLessThan(exitBox.x);
    await page.keyboard.down("x"); await advance(page, 100); await page.keyboard.up("x"); await advance(page, 50);
    await expect(status.locator(":scope > b")).toHaveText("1");
    await page.keyboard.down("Shift"); await advance(page, 100);
    for (let gear = 2; gear <= 6; gear++) {
      await page.keyboard.down("x"); await advance(page, 100);
      await expect(status.locator(":scope > b")).toHaveText(String(gear));
      await page.keyboard.up("x"); await advance(page, 50);
    }
    await page.keyboard.up("Shift"); await advance(page, 100);
    await expect(status).toContainText("CLUTCH STUCK · 3 PUMPS");
    for (let tap = 0; tap < 3; tap++) {
      await page.keyboard.down("w"); await advance(page, 100);
      await page.keyboard.up("w"); await advance(page, 100);
    }
    await expect(status).toContainText("CLUTCH STUCK · 3 PUMPS");
    for (let left = 2; left >= 0; left--) {
      await page.keyboard.down("Shift"); await advance(page, 100);
      await expect(status).toContainText(`CLUTCH STUCK · ${left + 1} PUMPS`);
      await page.keyboard.up("Shift"); await advance(page, 100);
      if (left) await expect(status).toContainText(`CLUTCH STUCK · ${left} PUMPS`);
    }
    await expect(status).toContainText("ACCORD V6");
    await page.keyboard.down("w"); await advance(page, 500); await page.keyboard.up("w");
    await page.screenshot({ path: test.info().outputPath("accord-driving.png") });
    const game = await currentGame(page);
    expect(game.vehicleId).toBe("accord-v6");
    expect(game.transmissionMode).toBe("manual");
    expect(game.transmission.gear).toBe(6);
    expect(game.transmission.stuck).toBe(false);
    expect(game.speed).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test.describe(`${renderer} ${model} phone`, () => {
    test.use({ viewport: { width: 390, height: 844 }, contextOptions: { hasTouch: true, isMobile: true, reducedMotion: "reduce" } });
    test("automatic default, three touch gas taps recover the clutch and survive rotation", async ({ page, context }) => {
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      await start(page, renderer, model, false);
      const cdp = await context.newCDPSession(page);
      const clutch = page.getByRole("button", { name: /^Clutch\. Hold Shift/ });
      const status = page.locator(".transmission-controls__status");
      async function pump(gas = false) {
        const box = (await (gas ? page.getByRole("button", { name: "Accelerate", exact: true }) : clutch).boundingBox())!;
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }] });
        await advance(page, 100);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await advance(page, 100);
      }
      await expect(status).toContainText("AUTO SHIFT");
      await expect(page.getByRole("button", { name: /Shift up\. X key/ })).toHaveCount(0);
      await pump();
      await expect(status).toContainText("CLUTCH STUCK · 3 PUMPS");
      await page.screenshot({ path: test.info().outputPath("clutch-stuck.png") });
      for (let left = 2; left >= 0; left--) {
        await pump(true);
        if (left) await expect(status).toContainText(`CLUTCH STUCK · ${left} PUMPS`);
      }
      await expect(status).toContainText("ACCORD V6");
      await page.setViewportSize({ width: 844, height: 390 });
      await advance(page, 150);
      await expect(clutch).toBeInViewport({ ratio: 1 });
      const clutchBox = (await clutch.boundingBox())!, pedals = (await page.locator(".mobile-pedals").boundingBox())!;
      expect(clutchBox.x + clutchBox.width).toBeLessThan(pedals.x);
      await page.screenshot({ path: test.info().outputPath("accord-landscape.png") });
      const game = await currentGame(page);
      expect(game.vehicleId).toBe("accord-v6");
      expect(game.transmissionMode).toBe("automatic");
      expect(game.transmission.stuck).toBe(false);
      expect(game.transmission.clutchHeld).toBe(false);
      expect(errors).toEqual([]);
    });
  });

  test(`${renderer} ${model}: automatic keyboard gas taps recover only on complete releases`, async ({ page }) => {
    await start(page, renderer, model, false);
    const status = page.locator(".transmission-controls__status");
    await page.keyboard.down("Shift"); await advance(page, 100);
    await page.keyboard.up("Shift"); await advance(page, 100);
    await expect(status).toContainText("CLUTCH STUCK · 3 PUMPS");
    for (let left = 2; left >= 0; left--) {
      await page.keyboard.down("w"); await advance(page, 350);
      await page.keyboard.down("w"); await advance(page, 100);
      await expect(status).toContainText(`CLUTCH STUCK · ${left + 1} PUMPS`);
      await page.keyboard.up("w"); await advance(page, 100);
      if (left) await expect(status).toContainText(`CLUTCH STUCK · ${left} PUMPS`);
    }
    await expect(status).toContainText("ACCORD V6");
    await page.keyboard.down("w"); await advance(page, 500); await page.keyboard.up("w");
    const game = await currentGame(page);
    expect(game.transmissionMode).toBe("automatic");
    expect(game.transmission.stuck).toBe(false);
    expect(game.transmission.engagements).toBe(1);
    expect(game.speed).toBeGreaterThan(0);
  });
}
