import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";
import type { CameraMode } from "../../game/model";
import type {} from "./fixtures/mountain-scene";
import { SCENE_TEST_TIMEOUT, WEBGPU_TEST_OPTIONS } from "./browser-options";
import { openScenePage } from "./scene-page";

test.use(WEBGPU_TEST_OPTIONS);
test.setTimeout(SCENE_TEST_TIMEOUT);
let bundle: string;
test.beforeAll(async () => {
  const result = await build({ entryPoints: [path.resolve("tests/browser/fixtures/mountain-scene.ts")],
    bundle: true, write: false, platform: "browser", format: "iife", logLevel: "silent" });
  bundle = result.outputFiles[0].text;
});

for (const mobile of [false, true]) for (const kind of ["WebGPU", "Canvas 2D"] as const) {
  test(`${kind} renders the Northstar climb in all cameras at ${mobile ? "mobile" : "desktop"} size`, async ({ page }, testInfo) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await openScenePage(page, bundle);
    expect(await page.evaluate((renderer) => window.mountainScene.mount(renderer), kind)).toBe(kind);
    const scenes = mobile ? ["gateway", "summit", "gondola"] as const
      : ["gateway", "gallery", "gorge", "village", "lake", "waterfall", "resort", "gondola", "summit"] as const;
    for (const scene of scenes) {
      for (const mode of ["fixed", "chase-high", "chase-low", "cab"] as CameraMode[]) {
        const state = await page.evaluate(({ scene, mode }) => window.mountainScene.render(scene, mode), { scene, mode });
        expect(state.z).toBeGreaterThan(4);
        expect(state.surfaces).toBeGreaterThan(256);
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        await page.locator("#mountain-fixture").screenshot({ path: testInfo.outputPath(`${scene}-${mode}.png`) });
      }
    }
    expect(errors, "production renderer frame errors").toEqual([]);
  });
}

for (const mobile of [false, true]) test(`mountain GPS shows terrain and altitude at ${mobile ? "mobile" : "desktop"} size`, async ({ page }, testInfo) => {
  if (mobile) await page.setViewportSize({ width: 390, height: 844 });
  await openScenePage(page, bundle);
  await page.evaluate(async () => {
    await window.mountainScene.mount("Canvas 2D");
    window.mountainScene.render("resort", "fixed");
    window.mountainScene.map(true);
  });
  const map = page.locator("#mountain-map-fixture");
  await expect(map.getByLabel("Altitude")).toContainText("ELEV 2,316 m");
  await expect(map.locator('[data-map-layer="northstar-terrain"]')).toBeVisible();
  await map.getByRole("button", { name: "N · RANGE", exact: true }).click();
  await map.screenshot({ path: testInfo.outputPath("northstar-full-map.png") });
  await page.evaluate(() => {
    document.getElementById("mountain-map-fixture")!.remove();
    window.mountainScene.map(false);
  });
  await expect(page.locator('#mountain-map-fixture [data-map-layer="northstar-terrain"]')).toBeVisible();
  await page.locator("#mountain-map-fixture").screenshot({ path: testInfo.outputPath("northstar-mini-map.png") });
});
