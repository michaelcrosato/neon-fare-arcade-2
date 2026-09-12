import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";
import type { CameraMode } from "../../game/model";
import type {} from "./fixtures/industrial-scene";
import { WEBGPU_TEST_OPTIONS } from "./browser-options";
import { openScenePage } from "./scene-page";

test.use(WEBGPU_TEST_OPTIONS);
test.setTimeout(120_000);
let bundle: string;
test.beforeAll(async () => {
  const result = await build({ entryPoints: [path.resolve("tests/browser/fixtures/industrial-scene.ts")],
    bundle: true, write: false, platform: "browser", format: "iife", logLevel: "silent" });
  bundle = result.outputFiles[0].text;
});

const tours = [
  { name: "heavy industry", scenes: ["foundry", "refinery", "salvage"] },
  { name: "working waterfront", scenes: ["port", "shipyard", "breakwater"] },
  { name: "connected freight roads", scenes: ["coast-seam", "copper-seam", "gate", "freight"] },
] as const;
for (const tour of tours) for (const kind of ["WebGPU", "Canvas 2D"] as const) {
  test(`${kind} renders Ironwake ${tour.name} in every driving camera`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await openScenePage(page, bundle);
    expect(await page.evaluate(kind => window.industrialScene.mount(kind), kind)).toBe(kind);
    for (const scene of tour.scenes) for (const mode of ["fixed", "chase-high", "chase-low", "cab"] as CameraMode[]) {
      const state = await page.evaluate(({ scene, mode }) => window.industrialScene.render(scene, mode), { scene, mode });
      expect(state.failed).toBe(false);
      expect(state.boxes).toBeGreaterThan(1000);
      expect(state.surfaces).toBeLessThanOrEqual(65536);
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      await page.locator("#industrial-fixture").screenshot({ path: info.outputPath(`${scene}-${mode}.png`) });
    }
    expect(errors).toEqual([]);
  });
}

test.describe("touch devices", () => {
test.use({ isMobile: true, hasTouch: true });
for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) for (const kind of ["WebGPU", "Canvas 2D"] as const) {
  test(`${kind} industrial mobile cameras and walking at ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await openScenePage(page, bundle);
    expect(await page.evaluate(kind => window.industrialScene.mount(kind), kind)).toBe(kind);
    for (const scene of ["foundry", "refinery", "shipyard"] as const) for (const mode of ["fixed", "chase-high", "chase-low", "cab"] as CameraMode[]) {
      expect((await page.evaluate(({ scene, mode }) => window.industrialScene.render(scene, mode), { scene, mode })).failed).toBe(false);
      await page.locator("#industrial-fixture").screenshot({ path: info.outputPath(`${scene}-${mode}.png`) });
    }
    for (const mode of ["chase-low", "cab"] as CameraMode[]) {
      await page.evaluate(mode => window.industrialScene.render("shipyard", mode, true), mode);
      await page.locator("#industrial-fixture").screenshot({ path: info.outputPath(`shipyard-walking-${mode}.png`) });
    }
  });
}
});

test("regional and compact GPS share the industrial harbor and all ten landmark footprints", async ({ page }, info) => {
  await openScenePage(page, bundle);
  await page.evaluate(async () => {
    await window.industrialScene.mount("Canvas 2D");
    window.industrialScene.render("refinery", "fixed");
    window.industrialScene.map(true);
  });
  const map = page.locator("#industrial-map-fixture");
  await expect(map.locator('[data-map-layer="ironwake-harbor"]')).toBeVisible();
  await map.getByRole("button", { name: "SW · WORKS", exact: true }).click();
  await expect(map.locator(".gps-landmark--industrial")).toHaveCount(10);
  await map.screenshot({ path: info.outputPath("ironwake-regional-gps.png") });
  await page.evaluate(() => {
    window.industrialScene.render("shipyard", "fixed");
    window.industrialScene.map(false);
  });
  await expect(page.locator('#industrial-map-fixture [data-map-layer="ironwake-harbor"]')).toBeVisible();
  await page.locator("#industrial-map-fixture").screenshot({ path: info.outputPath("ironwake-compact-gps.png") });
});
