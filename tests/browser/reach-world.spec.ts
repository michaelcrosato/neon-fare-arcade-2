import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";
import type { CameraMode } from "../../game/model";
import type {} from "./fixtures/reach-scene";
import { SCENE_TEST_TIMEOUT, WEBGPU_TEST_OPTIONS } from "./browser-options";
import { openScenePage } from "./scene-page";

test.use(WEBGPU_TEST_OPTIONS);
test.setTimeout(SCENE_TEST_TIMEOUT);
let bundle: string;
test.beforeAll(async () => {
  const result = await build({ entryPoints: [path.resolve("tests/browser/fixtures/reach-scene.ts")],
    bundle: true, write: false, platform: "browser", format: "iife", logLevel: "silent" });
  bundle = result.outputFiles[0].text;
});

const tours = [
  { name: "districts", mobile: false, scenes: ["calle", "bay", "ribbon", "moonwater", "cape", "lighthouse"] },
  { name: "destinations", mobile: false, scenes: ["causeway", "stadium", "flamingo", "studios", "inn"] },
  { name: "peninsula drive", mobile: true, scenes: ["ribbon", "southbound", "ocean", "cape"] },
] as const;
for (const tour of tours) for (const kind of ["WebGPU", "Canvas 2D"] as const) {
  test(`${kind} renders Palm Reach ${tour.name} in all cameras at ${tour.mobile ? "mobile" : "desktop"} size`, async ({ page }, testInfo) => {
    if (tour.mobile) await page.setViewportSize({ width: 390, height: 844 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await openScenePage(page, bundle);
    expect(await page.evaluate((renderer) => window.reachScene.mount(renderer), kind)).toBe(kind);
    for (const scene of tour.scenes) for (const mode of ["fixed", "chase-high", "chase-low", "cab"] as CameraMode[]) {
      const state = await page.evaluate(({ scene, mode }) => window.reachScene.render(scene, mode), { scene, mode });
      expect(state.boxes).toBeGreaterThan(20);
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      await page.locator("#reach-fixture").screenshot({ path: testInfo.outputPath(`${scene}-${mode}.png`) });
    }
    expect(errors).toEqual([]);
  });
}

for (const full of [false, true]) test(`Palm Reach ${full ? "regional" : "compact"} GPS shows the new road network`, async ({ page }, testInfo) => {
  await openScenePage(page, bundle);
  await page.evaluate(async (full) => {
    await window.reachScene.mount("Canvas 2D");
    window.reachScene.render("cape", "fixed");
    window.reachScene.map(full);
  }, full);
  await expect(page.locator("#reach-map-fixture svg")).toBeVisible();
  await expect(page.locator('#reach-map-fixture [data-map-layer="reach-peninsula"]')).toHaveCount(1);
  if (full) {
    await expect(page.getByText("REGION VIEW", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "CENTER · CITY", exact: true }).click();
    await page.getByRole("button", { name: "SE · PALM", exact: true }).click();
    await expect(page.getByText("REGION VIEW", { exact: true })).toBeVisible();
  }
  await page.locator("#reach-map-fixture").screenshot({ path: testInfo.outputPath("gps.png") });
});
