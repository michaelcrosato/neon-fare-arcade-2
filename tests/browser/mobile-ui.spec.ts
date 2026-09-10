import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import { openScenePage } from "./scene-page";
import type {} from "./fixtures/mobile-hud-scene";

test.use({ contextOptions: { hasTouch: true, isMobile: true, reducedMotion: "reduce" } });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined }));
});

async function startFreeRun(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Start Free Run with arcade/ }).click();
  await page.getByRole("button", { name: /Choose STREET ACE/ }).click();
  await expect(page.getByRole("button", { name: "Pause game" })).toBeEnabled();
}

for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }, { width: 1280, height: 800 }]) {
  test.describe(`${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport });
    test("driving keeps the map off screen and thumb controls inside the viewport", async ({ page }) => {
      await startFreeRun(page);
      await expect(page.locator(".gps-panel")).toHaveCount(0);
      await expect(page.getByRole("button", { name: /Open regional map/ })).toBeVisible();
      const stage = await page.getByRole("region", { name: "Neon Fare arcade game" }).boundingBox();
      expect(stage!.y).toBe(0);
      expect(stage!.height).toBe(viewport.height);
      for (const name of ["Steer left", "Steer right", "Accelerate", "Boost", "Pause game"]) {
        const button = page.getByRole("button", { name, exact: true });
        const box = await button.boundingBox();
        expect(box, name).not.toBeNull();
        expect(box!.width, name).toBeGreaterThanOrEqual(44);
        expect(box!.height, name).toBeGreaterThanOrEqual(44);
        expect(box!.x, name).toBeGreaterThanOrEqual(0);
        expect(box!.y, name).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width, name).toBeLessThanOrEqual(viewport.width);
        expect(box!.y + box!.height, name).toBeLessThanOrEqual(viewport.height);
        await button.click({ trial: true });
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
    });

    test("the route planner keeps a tappable map and confirmation in view", async ({ page }) => {
      await startFreeRun(page);
      await page.getByRole("button", { name: /Open regional map/ }).click();
      const map = page.getByRole("img", { name: /Interactive Neon Fare regional GPS/ });
      const box = await map.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(180);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
      await map.tap({ position: { x: box!.width * .6, y: box!.height * .5 } });
      await expect(page.getByRole("status", { name: "GPS pin status" })).toContainText("PIN READY");
      const confirm = page.getByRole("button", { name: "SET GPS ROUTE" });
      const confirmBox = await confirm.boundingBox();
      expect(confirmBox!.y + confirmBox!.height).toBeLessThanOrEqual(viewport.height);
      await confirm.click();
      await expect(page.getByRole("button", { name: /Open regional map/ })).toContainText("CUSTOM DESTINATION");
      await expect(page.getByRole("button", { name: "Accelerate", exact: true })).toBeVisible();
    });
  });
}

test.describe("mobile session tools", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("camera, sound, fare history and walking are available without extra driving panels", async ({ page }) => {
    await startFreeRun(page);
    await page.getByRole("button", { name: "Pause game" }).click();
    const paused = page.getByRole("region", { name: "Game paused" });
    const cab = paused.getByRole("button", { name: "CAB", exact: true });
    await cab.click();
    await expect(cab).toHaveAttribute("aria-pressed", "true");
    await paused.getByRole("button", { name: "AUDIO ON", exact: true }).click();
    await expect(paused.getByRole("button", { name: "AUDIO OFF", exact: true })).toBeVisible();
    await paused.locator(".pause-fares > summary").click();
    await expect(paused.locator(".pause-fares")).toHaveAttribute("open", "");
    await paused.getByRole("button", { name: "RESUME FREE RUN" }).click();
    await expect(page.locator(".game-stage")).toHaveClass(/camera-cab/);
    await page.getByRole("button", { name: /EXIT TAXI/ }).click();
    await expect(page.getByLabel("Touch walking controls")).toBeVisible();
    for (const name of ["Walk forward", "Walk backward", "Turn left", "Turn right", "Run", "Jump", "Crouch"]) {
      const button = page.getByRole("button", { name, exact: true });
      const box = await button.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.y + box!.height).toBeLessThanOrEqual(844);
      await button.click({ trial: true });
    }
    await page.getByRole("button", { name: /ENTER TAXI/ }).click();
    await expect(page.getByRole("button", { name: "Accelerate", exact: true })).toBeVisible();
    await expect(page.locator(".gps-panel, .fare-card-stack, .combo-sticker, .camera-panel")).toHaveCount(0);
    await page.getByRole("button", { name: "Pause game" }).click();
    await page.getByRole("button", { name: /END FREE RUN/ }).click();
    await page.getByRole("button", { name: "RETURN TO MENU", exact: true }).click();
    await expect(page.getByRole("group", { name: "Choose game mode" })).toBeVisible();
  });

  test("steering and gas accept simultaneous touches and cancellation releases both", async ({ page, context }) => {
    await startFreeRun(page);
    const gas = page.getByRole("button", { name: "Accelerate", exact: true });
    const left = page.getByRole("button", { name: "Steer left", exact: true });
    const boxes = await Promise.all([gas.boundingBox(), left.boundingBox()]);
    const points = boxes.map((box, id) => ({ x: box!.x + box!.width / 2, y: box!.y + box!.height / 2, id, radiusX: 3, radiusY: 3, force: 1 }));
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: points });
    try {
      await expect(gas).toHaveAttribute("data-held", "");
      await expect(left).toHaveAttribute("data-held", "");
      await expect.poll(async () => Number(await page.locator(".mobile-speed > strong").textContent())).toBeGreaterThan(0);
    } finally {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
    }
    await expect(page.locator("[data-held]")).toHaveCount(0);
    await page.getByRole("button", { name: "Pause game" }).click();
    await page.getByRole("button", { name: "RESUME FREE RUN" }).click();
    await expect(page.locator("[data-held]")).toHaveCount(0);
  });
});

test.describe("mobile notification and meter states", () => {
  test.use({ viewport: { width: 320, height: 568 } });
  test("timed, courier, fare and simulation states fit without covering controls", async ({ page }, info) => {
    const bundle = (await build({ entryPoints: ["tests/browser/fixtures/mobile-hud-scene.tsx"], bundle: true, write: false, format: "iife", platform: "browser", target: "es2022", tsconfig: "tsconfig.json" })).outputFiles[0].text;
    await openScenePage(page, bundle);
    for (const scenario of ["meter", "fare", "courier", "simulation"] as const) {
      await page.evaluate(scenario => window.mobileHudFixture.render(scenario), scenario);
      const meter = await page.locator(".mobile-meter").boundingBox();
      const earnings = await page.locator(".mobile-earnings").boundingBox();
      const menu = await page.getByRole("button", { name: "Pause game" }).boundingBox();
      expect(meter!.x + meter!.width).toBeLessThanOrEqual(earnings!.x);
      expect(earnings!.x + earnings!.width).toBeLessThanOrEqual(menu!.x);
      expect(menu!.x + menu!.width).toBeLessThanOrEqual(320);
      await page.getByRole("button", { name: "Pause game" }).click({ trial: true });
      if (scenario === "fare" || scenario === "courier") {
        const notice = await page.locator(".mobile-notice").boundingBox();
        const controls = await page.locator(".mobile-controls").boundingBox();
        expect(notice!.y + notice!.height).toBeLessThan(controls!.y);
        await expect(page.locator(".fare-impact, .courier-impact")).toHaveCount(0);
      }
      if (scenario === "simulation") {
        await expect(page.getByRole("button", { name: "Parking brake", exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Boost", exact: true })).toHaveCount(0);
      }
      await page.screenshot({ path: info.outputPath(`${scenario}.png`) });
    }
  });

  test("help, driver choices, services and run history fit the phone and remain scrollable", async ({ page }, info) => {
    const bundle = (await build({ entryPoints: ["tests/browser/fixtures/mobile-hud-scene.tsx"], bundle: true, write: false, format: "iife", platform: "browser", target: "es2022", tsconfig: "tsconfig.json" })).outputFiles[0].text;
    await openScenePage(page, bundle);
    for (const modal of ["home", "gas", "courier", "how", "traits", "scores"] as const) {
      await page.evaluate(modal => window.mobileHudFixture.renderModal(modal), modal);
      const dialog = page.getByRole("dialog");
      const dimensions = await dialog.evaluate(element => ({ width: element.clientWidth, scrollWidth: element.scrollWidth, height: element.clientHeight }));
      expect(dimensions.width).toBe(320);
      expect(dimensions.height).toBe(568);
      expect(dimensions.scrollWidth, modal).toBeLessThanOrEqual(dimensions.width);
      const close = page.getByRole("button", { name: modal === "traits" ? "Back without starting" : "Close dialog" });
      await close.click({ trial: true });
      const lastButton = dialog.getByRole("button").last();
      await lastButton.scrollIntoViewIfNeeded();
      await lastButton.click({ trial: true });
      await close.click({ trial: true });
      await dialog.evaluate(element => { element.scrollTop = 0; });
      await page.screenshot({ path: info.outputPath(`${modal}.png`) });
    }
    await page.evaluate(() => window.mobileHudFixture.renderEnd());
    expect(await page.locator(".end-paper").evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.getByRole("button", { name: "RETURN TO MENU", exact: true }).click({ trial: true });
    await page.screenshot({ path: info.outputPath("results.png") });
  });
});
