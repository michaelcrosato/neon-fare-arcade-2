import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import type {} from "./fixtures/vehicle-service-scene";
import { openScenePage } from "./scene-page";
import { WEBGPU_TEST_OPTIONS } from "./browser-options";

test.use(WEBGPU_TEST_OPTIONS);
test.setTimeout(90_000);
let bundle: string;
test.beforeAll(async () => { bundle = (await build({ entryPoints: ["tests/browser/fixtures/vehicle-service-scene.tsx"], bundle: true,
  write: false, platform: "browser", format: "iife", logLevel: "silent" })).outputFiles[0].text; });

for (const backend of ["WebGPU", "Canvas 2D"] as const) for (const viewport of [
  { width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 568, height: 320 },
]) test.describe(`${backend} ${viewport.width}x${viewport.height}`, () => {
  const mobile = viewport.width < 1000;
  test.use({ viewport, contextOptions: { hasTouch: mobile, isMobile: mobile, reducedMotion: "reduce" } });
  test("damage quips scatter near center and the passenger-door action clears driving controls", async ({ page }, info) => {
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await openScenePage(page, bundle);
    await page.evaluate(backend => window.vehicleServiceScene.mount(backend), backend);
    for (const vehicle of ["crown-cab", "accord-v6", "gtr-r35"] as const) for (const mode of ["chase-low", "chase-high", "fixed", "cab"] as const) {
      await page.evaluate(({ vehicle, mode }) => window.vehicleServiceScene.presentation(vehicle, vehicle === "gtr-r35" ? "simulation" : "arcade", mode), { vehicle, mode });
      const exit = page.getByRole("button", { name: /^E · EXIT TAXI/ });
      await expect(exit).toBeInViewport({ ratio: 1 });
      await exit.click({ trial: true });
      const box = (await exit.boundingBox())!;
      if (mode !== "fixed") expect(box.x + box.width / 2).toBeGreaterThan(viewport.width / 2);
      if (mobile) for (const pedal of await page.locator(".mobile-pedal").all()) {
        const other = (await pedal.boundingBox())!;
        expect(box.x + box.width <= other.x || box.x >= other.x + other.width || box.y + box.height <= other.y || box.y >= other.y + other.height).toBe(true);
      }
      if (vehicle === "gtr-r35") await page.screenshot({ path: info.outputPath(`passenger-door-${mode}.png`) });
    }
    // The left thumb stays free, and the deliberately selected exit target still responds.
    if (mobile) {
      await page.touchscreen.tap(65, viewport.height * .65);
      expect((await page.evaluate(() => window.vehicleServiceScene.redraw())).exitRequests).toBe(0);
      await page.getByRole("button", { name: /^E · EXIT TAXI/ }).tap();
      expect((await page.evaluate(() => window.vehicleServiceScene.redraw())).exitRequests).toBe(1);
    }
    await page.evaluate(() => window.vehicleServiceScene.presentation("crown-cab", "arcade", "chase-low"));
    const poses = new Set<string>(), tilts = new Set<string>();
    let tilted = 0;
    for (let hit = 0; hit < 12; hit++) {
      const state = await page.evaluate(() => window.vehicleServiceScene.hit());
      const quip = page.locator(".damage-callout");
      await expect(quip).toHaveCount(1);
      await expect(quip).toHaveText(state.damage.line);
      await expect(quip).toBeInViewport({ ratio: 1 });
      await expect(quip).toHaveCSS("pointer-events", "none");
      const box = (await quip.boundingBox())!;
      expect((box.x + box.width / 2) / viewport.width).toBeGreaterThan(.35);
      expect((box.x + box.width / 2) / viewport.width).toBeLessThan(.65);
      expect((box.y + box.height / 2) / viewport.height).toBeGreaterThan(.35);
      expect((box.y + box.height / 2) / viewport.height).toBeLessThan(.65);
      const pose = await quip.evaluate(element => ({ left: element.style.left, top: element.style.top, tilt: element.style.getPropertyValue("--damage-tilt") }));
      expect(Math.abs(parseFloat(pose.tilt))).toBeLessThanOrEqual(5.5);
      if (parseFloat(pose.tilt) !== 0) tilted++;
      poses.add(`${pose.left},${pose.top}`); tilts.add(pose.tilt);
      const css = await quip.getAttribute("style");
      await page.evaluate(() => window.vehicleServiceScene.redraw());
      await expect(quip).toHaveAttribute("style", css!);
      if (hit === 5) await page.screenshot({ path: info.outputPath("damage-quip.png") });
    }
    expect(poses.size).toBeGreaterThan(8); expect(tilts.size).toBeGreaterThan(3); expect(tilted).toBeGreaterThan(6);
    await page.evaluate(() => window.vehicleServiceScene.expire());
    await expect(page.locator(".damage-callout")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
