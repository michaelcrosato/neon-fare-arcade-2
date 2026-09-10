import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";
import type { CameraMode } from "../../game/model";
import type {} from "./fixtures/elevated-scene";
import { SCENE_TEST_TIMEOUT, WEBGPU_TEST_OPTIONS } from "./browser-options";
import { openScenePage } from "./scene-page";

test.use(WEBGPU_TEST_OPTIONS);
test.setTimeout(SCENE_TEST_TIMEOUT);
let bundle: string;
test.beforeAll(async () => {
  const result = await build({ entryPoints: [path.resolve("tests/browser/fixtures/elevated-scene.ts")],
    bundle: true, write: false, platform: "browser", format: "iife", logLevel: "silent" });
  bundle = result.outputFiles[0].text;
});

for (const kind of ["WebGPU", "Canvas 2D"] as const) {
  test(`${kind} draws bridge approaches, decks and the water beneath them in all cameras`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await openScenePage(page, bundle);
    expect(await page.evaluate((renderer) => window.roadScene.mount(renderer), kind)).toBe(kind);
    for (const scene of ["ramp", "bridge", "underpass"] as const) {
      for (const mode of ["fixed", "chase-high", "chase-low", "cab"] as CameraMode[]) {
        const state = await page.evaluate(({ scene, mode }) => window.roadScene.render(scene, mode), { scene, mode });
        if (scene === "ramp") {
          expect(state.z).toBeGreaterThan(1);
          expect(state.z).toBeLessThan(8.64);
        } else expect(state.z).toBeCloseTo(state.expectedZ, 1);
        expect(state.surfaces).toBeGreaterThan(100);
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        await page.locator("#elevation-fixture").screenshot({ path: testInfo.outputPath(`${scene}-${mode}.png`) });
      }
    }
    expect(errors, "actual renderer initialization and frame errors").toEqual([]);
  });
}
