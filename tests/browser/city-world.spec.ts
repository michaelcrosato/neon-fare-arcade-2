import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";
import type { CameraMode } from "../../game/model";
import type {} from "./fixtures/city-scene";
import { SCENE_TEST_TIMEOUT, WEBGPU_TEST_OPTIONS } from "./browser-options";
import { openScenePage } from "./scene-page";

test.use(WEBGPU_TEST_OPTIONS);
test.setTimeout(SCENE_TEST_TIMEOUT);
let bundle: string;
test.beforeAll(async () => {
  const result = await build({ entryPoints: [path.resolve("tests/browser/fixtures/city-scene.ts")],
    bundle: true, write: false, platform: "browser", format: "iife", logLevel: "silent" });
  bundle = result.outputFiles[0].text;
});

const tours = [
  { name: "hill districts", mobile: false, scenes: ["core", "starfall", "market", "redline", "titan"] },
  { name: "landmark grounds", mobile: false, scenes: ["university", "commons", "skyline", "harbor", "stadium"] },
  { name: "city drive", mobile: true, scenes: ["core", "starfall", "redline"] },
] as const;
for (const tour of tours) for (const kind of ["WebGPU", "Canvas 2D"] as const) {
  test(`${kind} renders Neon City ${tour.name} in all cameras at ${tour.mobile ? "mobile" : "desktop"} size`, async ({ page }, testInfo) => {
    if (tour.mobile) await page.setViewportSize({ width: 390, height: 844 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await openScenePage(page, bundle);
    expect(await page.evaluate((renderer) => window.cityScene.mount(renderer), kind)).toBe(kind);
    for (const scene of tour.scenes) for (const mode of ["fixed", "chase-high", "chase-low", "cab"] as CameraMode[]) {
      const state = await page.evaluate(({ scene, mode }) => window.cityScene.render(scene, mode), { scene, mode });
      expect(state.boxes).toBeGreaterThan(100);
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      await page.locator("#city-fixture").screenshot({ path: testInfo.outputPath(`${scene}-${mode}.png`) });
    }
    expect(errors).toEqual([]);
  });
}

for (const full of [false, true]) test(`City ${full ? "regional" : "compact"} GPS shows the new road network`, async ({ page }, testInfo) => {
  await openScenePage(page, bundle);
  await page.evaluate(async (full) => {
    await window.cityScene.mount("Canvas 2D");
    window.cityScene.render("starfall", "fixed");
    window.cityScene.map(full);
  }, full);
  await expect(page.locator("#city-map-fixture svg")).toBeVisible();
  await expect(page.locator('[data-map-layer="city-terrain"]')).toBeVisible();
  if (full) await expect(page.getByLabel("Altitude")).toContainText("ELEV");
  await page.locator("#city-map-fixture").screenshot({ path: testInfo.outputPath("gps.png") });
});
