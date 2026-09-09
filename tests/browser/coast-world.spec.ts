import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";
import type { CameraMode } from "../../game/model";
import type {} from "./fixtures/coast-scene";
import { SCENE_TEST_TIMEOUT, WEBGPU_TEST_OPTIONS } from "./browser-options";
import { openScenePage } from "./scene-page";

test.use(WEBGPU_TEST_OPTIONS);
test.setTimeout(SCENE_TEST_TIMEOUT);
let bundle: string;
test.beforeAll(async () => {
  const result = await build({ entryPoints: [path.resolve("tests/browser/fixtures/coast-scene.ts")],
    bundle: true, write: false, platform: "browser", format: "iife", logLevel: "silent" });
  bundle = result.outputFiles[0].text;
});

// Bound each desktop tour to twenty captures, including under software WebGPU.
const tours = [
  { name: "arrival roads", mobile: false, scenes: ["arrival", "side-street"] },
  { name: "waterfront", mobile: false, scenes: ["shore", "pier", "canals", "town", "aquarium"] },
  { name: "hills", mobile: false, scenes: ["gateway", "bluff", "canyon", "citrus", "viewpoint"] },
  { name: "landmarks", mobile: false, scenes: ["studio", "bowl", "club", "surf", "rescue"] },
  { name: "road trip", mobile: true, scenes: ["shore", "pier", "canyon"] },
] as const;
for (const tour of tours) for (const kind of ["WebGPU", "Canvas 2D"] as const) {
  const { mobile, scenes } = tour;
  test(`${kind} renders the Solana Coast ${tour.name} in all cameras at ${mobile ? "mobile" : "desktop"} size`, async ({ page }, testInfo) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await openScenePage(page, bundle);
    expect(await page.evaluate((renderer) => window.coastScene.mount(renderer), kind)).toBe(kind);
    for (const scene of scenes) {
      for (const mode of ["fixed", "chase-high", "chase-low", "cab"] as CameraMode[]) {
        const state = await page.evaluate(({ scene, mode }) => window.coastScene.render(scene, mode), { scene, mode });
        expect(state.z).toBeGreaterThanOrEqual(0);
        expect(state.surfaces).toBeGreaterThan(256);
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        await page.locator("#coast-fixture").screenshot({ path: testInfo.outputPath(`${scene}-${mode}.png`) });
      }
    }
    expect(errors, "production renderer frame errors").toEqual([]);
  });
}

for (const mobile of [false, true]) test(`coastal GPS shows terrain and altitude at ${mobile ? "mobile" : "desktop"} size`, async ({ page }, testInfo) => {
  if (mobile) await page.setViewportSize({ width: 390, height: 844 });
  await openScenePage(page, bundle);
  await page.evaluate(async () => {
    await window.coastScene.mount("Canvas 2D");
    window.coastScene.render("viewpoint", "fixed");
    window.coastScene.map(true);
  });
  const map = page.locator("#coast-map-fixture");
  // GPS tracks the parked taxi: the 72-unit terrace plus its 0.64-unit road surface.
  await expect(map.getByLabel("Altitude")).toContainText("ELEV 1,308 m");
  await expect(map.locator('[data-map-layer="coast-terrain"]')).toBeVisible();
  await map.getByRole("button", { name: "W · COAST", exact: true }).click();
  await expect(map.locator('[data-map-layer="coast-canals"]')).toBeVisible();
  await map.screenshot({ path: testInfo.outputPath("coast-full-map.png") });
  await page.evaluate(() => {
    document.getElementById("coast-map-fixture")!.remove();
    window.coastScene.map(false);
  });
  await expect(page.locator('#coast-map-fixture [data-map-layer="coast-terrain"]')).toBeVisible();
  await page.locator("#coast-map-fixture").screenshot({ path: testInfo.outputPath("coast-mini-map.png") });
});
