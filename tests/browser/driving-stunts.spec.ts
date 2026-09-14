import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import type {} from "./fixtures/driving-stunt-scene";
import { openScenePage } from "./scene-page";
import { WEBGPU_TEST_OPTIONS } from "./browser-options";

test.use(WEBGPU_TEST_OPTIONS);
test.setTimeout(90_000);
let bundle: string;
test.beforeAll(async () => {
  const result = await build({ entryPoints: ["tests/browser/fixtures/driving-stunt-scene.tsx"], bundle: true,
    write: false, platform: "browser", format: "iife", logLevel: "silent" });
  bundle = result.outputFiles[0].text;
});

for (const mobile of [false, true]) test.describe(mobile ? "phone stunt feedback" : "desktop stunt feedback", () => {
test.use({ contextOptions: { hasTouch: mobile, isMobile: mobile, reducedMotion: "reduce" } });
for (const renderer of ["WebGPU", "Canvas 2D"] as const) for (const model of ["arcade", "simulation"] as const) {
  test(`${renderer} ${model}: physical drift and flight show distance, results and run statistics`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 960 });
    await openScenePage(page, bundle);
    expect(await page.evaluate(({ renderer, model }) => window.drivingStuntScene.mount(renderer, model), { renderer, model })).toBe(renderer);
    const shortDrift = await page.evaluate(() => window.drivingStuntScene.shortDrift());
    expect(shortDrift.drift.meters).toBeGreaterThan(0);
    expect(shortDrift.drift.meters).toBeLessThanOrEqual(10);
    await expect(page.locator(".driving-stunt--drift")).toHaveCount(0);
    const drift = await page.evaluate(() => window.drivingStuntScene.drift());
    expect(drift.drift.active).toBe(true);
    expect(drift.drift.meters).toBeGreaterThan(10);
    expect(drift.drift.score).toBeGreaterThan(0);
    await expect(page.locator(".driving-stunt--drift")).toContainText("DRIFTING!");
    await expect(page.locator(".driving-stunt--drift strong")).toHaveText(`${Math.round(drift.drift.meters * 10) / 10} m`);
    await expect(page.getByLabel(`Drift score ${drift.drift.score} points`, { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath("drifting.png") });
    const banked = await page.evaluate(() => window.drivingStuntScene.finishDrift());
    expect(banked.drift.active).toBe(false);
    expect(banked.drift.totalMeters).toBeGreaterThanOrEqual(drift.drift.meters);
    await expect(page.locator(".driving-stunt--drift")).toContainText("DRIFT BANKED");
    expect(banked.drift.lastScore).toBeGreaterThanOrEqual(drift.drift.score);
    await expect(page.getByLabel(`Drift score ${banked.drift.lastScore} points`, { exact: true })).toBeVisible();
    const air = await page.evaluate(() => window.drivingStuntScene.takeoff());
    expect(air.air.active).toBe(true);
    await expect(page.locator(".driving-stunt--air")).toContainText("AIR!");
    await page.screenshot({ path: info.outputPath("airborne.png") });
    const landed = await page.evaluate(() => window.drivingStuntScene.land());
    expect(landed.air.active).toBe(false);
    expect(landed.air.lastMeters).toBeGreaterThan(5);
    await expect(page.locator(".driving-stunt--air")).toContainText("LANDED!");
    for (const viewport of mobile ? [{ width: 390, height: 844 }, { width: 844, height: 390 }] : [{ width: 1440, height: 960 }]) {
      await page.setViewportSize(viewport);
      await expect(page.locator(".driving-stunt--air")).toBeInViewport({ ratio: 1 });
      if (mobile) {
        const feedback = (await page.locator(".driving-stunts").boundingBox())!;
        const gas = (await page.getByRole("button", { name: "Accelerate", exact: true }).boundingBox())!;
        expect(feedback.y + feedback.height).toBeLessThan(gas.y);
      }
      await page.screenshot({ path: info.outputPath(`landed-${viewport.width}.png`) });
    }
    for (const mode of ["paused", "ended"] as const) {
      const recorded = await page.evaluate(mode => window.drivingStuntScene.summary(mode), mode);
      expect(recorded).toEqual(landed);
      const stats = page.getByRole("definition");
      const distances = page.getByLabel("Run driving distances");
      await expect(distances).toContainText("DRIFT DISTANCE");
      await expect(distances).toContainText(`${Math.round(landed.air.totalMeters * 10) / 10} m`);
      await expect(stats).toHaveCount(2);
      await page.screenshot({ path: info.outputPath(`${mode}.png`) });
    }
    expect(errors).toEqual([]);
  });
}
});
