import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";
import type { CameraMode } from "../../game/model";
import type {} from "./fixtures/copper-scene";
import { SCENE_TEST_TIMEOUT, WEBGPU_TEST_OPTIONS } from "./browser-options";
import { openScenePage } from "./scene-page";

test.use(WEBGPU_TEST_OPTIONS);
test.setTimeout(SCENE_TEST_TIMEOUT);
let bundle: string;
test.beforeAll(async () => {
  const result = await build({ entryPoints: [path.resolve("tests/browser/fixtures/copper-scene.ts")],
    bundle: true, write: false, platform: "browser", format: "iife", logLevel: "silent" });
  bundle = result.outputFiles[0].text;
});

for (const mobile of [false, true]) for (const kind of ["WebGPU", "Canvas 2D"] as const) {
  test(`${kind} renders the Copper Mesa road trip in all cameras at ${mobile ? "mobile" : "desktop"} size`, async ({ page }, testInfo) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await openScenePage(page, bundle);
    expect(await page.evaluate((renderer) => window.copperScene.mount(renderer), kind)).toBe(kind);
    const scenes = mobile ? ["saguaro", "arch", "canyon"] as const
      : ["gateway", "saguaro", "arch", "town", "motel", "airpark", "mesa", "canyon", "salt", "visitor"] as const;
    for (const scene of scenes) {
      for (const mode of ["fixed", "chase-high", "chase-low", "cab"] as CameraMode[]) {
        const state = await page.evaluate(({ scene, mode }) => window.copperScene.render(scene, mode), { scene, mode });
        expect(state.z).toBeGreaterThan(4);
        expect(state.surfaces).toBeGreaterThan(256);
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        await page.locator("#copper-fixture").screenshot({ path: testInfo.outputPath(`${scene}-${mode}.png`) });
      }
    }
    expect(errors, "production renderer frame errors").toEqual([]);
  });
}

for (const mobile of [false, true]) test(`desert GPS shows terrain and altitude at ${mobile ? "mobile" : "desktop"} size`, async ({ page }, testInfo) => {
  if (mobile) await page.setViewportSize({ width: 390, height: 844 });
  await openScenePage(page, bundle);
  await page.evaluate(async () => {
    await window.copperScene.mount("Canvas 2D");
    window.copperScene.render("visitor", "fixed");
    window.copperScene.map(true);
  });
  const map = page.locator("#copper-map-fixture");
  await expect(map.getByLabel("Altitude")).toContainText("ELEV 75 m");
  await expect(map.locator('[data-map-layer="copper-terrain"]')).toBeVisible();
  await map.getByRole("button", { name: "S · MESA", exact: true }).click();
  await map.screenshot({ path: testInfo.outputPath("copper-full-map.png") });
  await page.evaluate(() => {
    document.getElementById("copper-map-fixture")!.remove();
    window.copperScene.map(false);
  });
  await expect(page.locator('#copper-map-fixture [data-map-layer="copper-terrain"]')).toBeVisible();
  await page.locator("#copper-map-fixture").screenshot({ path: testInfo.outputPath("copper-mini-map.png") });
});
