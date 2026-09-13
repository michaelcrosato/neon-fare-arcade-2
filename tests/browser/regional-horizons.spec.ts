import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { resolve } from "node:path";
import { ACTIVE_WORLD_REGIONS } from "../../game/regions";
import { SCENE_TEST_TIMEOUT, WEBGPU_TEST_OPTIONS } from "./browser-options";
import { openScenePage } from "./scene-page";
import type {} from "./fixtures/regional-horizon-scene";

test.use({ ...WEBGPU_TEST_OPTIONS, viewport: { width: 1280, height: 720 } });
test.setTimeout(Math.max(90_000, SCENE_TEST_TIMEOUT * 3));
let bundle: string;
test.beforeAll(async () => {
  bundle = (await build({ entryPoints: [resolve("tests/browser/fixtures/regional-horizon-scene.ts")], bundle: true,
    write: false, platform: "browser", format: "iife", logLevel: "silent" })).outputFiles[0].text;
});
const directions = [["north", -Math.PI / 2], ["northeast", -Math.PI / 4], ["east", 0], ["southeast", Math.PI / 4],
  ["south", Math.PI / 2], ["southwest", Math.PI * 3 / 4], ["west", Math.PI], ["northwest", -Math.PI * 3 / 4]] as const;

for (const renderer of ["WebGPU", "Canvas 2D"] as const) test(`${renderer} blends a region change and honors reduced motion`, async ({ page }, info) => {
  await openScenePage(page, bundle);
  expect(await page.evaluate(kind => window.regionalHorizon.mount(kind), renderer)).toBe(renderer);
  const capture = async (region: "cedar-vale" | "city-center", seconds: number, name: string) => {
    await page.evaluate(view => window.regionalHorizon.render(view), { region, heading: 0, seconds, skyOnly: true });
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    return page.locator("#horizon-fixture").screenshot({ path: info.outputPath(`${name}.png`) });
  };
  const before = await capture("cedar-vale", 40, "before");
  const start = await capture("city-center", 41, "start");
  const middle = await capture("city-center", 41.2, "middle");
  const after = await capture("city-center", 41.5, "after");
  expect(start.equals(before)).toBe(true);
  expect(middle.equals(before)).toBe(false); expect(middle.equals(after)).toBe(false);
  expect(after.equals(before)).toBe(false);
  const reduced = await capture("cedar-vale", 0, "reduced-motion");
  expect(reduced.equals(before)).toBe(true);
});

for (const renderer of ["WebGPU", "Canvas 2D"] as const) for (const region of ACTIVE_WORLD_REGIONS) {
  test(`${renderer} ${region.id} horizon follows the surrounding geography`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    await openScenePage(page, bundle);
    expect(await page.evaluate(kind => window.regionalHorizon.mount(kind), renderer)).toBe(renderer);
    for (const [direction, heading] of directions) {
      const state = await page.evaluate(view => window.regionalHorizon.render(view), { region: region.id, heading, mode: "chase-low" as const });
      expect(state.region).toBe(region.id); expect(state.boxes).toBeGreaterThan(100);
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      await page.locator("#horizon-fixture").screenshot({ path: info.outputPath(`${direction}-world.png`) });
      await page.evaluate(view => window.regionalHorizon.render(view), { region: region.id, heading, skyOnly: true });
      await page.locator("#horizon-fixture").screenshot({ path: info.outputPath(`${direction}-sky.png`) });
    }
    const art = await page.evaluate(region => window.regionalHorizon.panorama(region), region.id);
    expect(art).toEqual({ opaque: true, continuousBase: true, region: region.id, width: 2048, height: 1024 });
    await page.locator("#panorama-art").screenshot({ path: info.outputPath("panorama.png") });
    if (renderer === "Canvas 2D") await expect(page.locator("#horizon-fixture")).toHaveAttribute("data-renderer", "webgl2");
    expect(errors).toEqual([]);
  });
}

for (const software of [false, true]) test(`${software ? "software" : "WebGPU"} horizon stays aligned in mobile cameras`, async ({ page }, info) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await openScenePage(page, bundle);
  if (software) await page.evaluate(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type.startsWith("webgl")) return null;
      return Reflect.apply(getContext, this, [type, ...args]);
    } as typeof getContext;
  });
  const renderer = software ? "Canvas 2D" as const : "WebGPU" as const;
  expect(await page.evaluate(kind => window.regionalHorizon.mount(kind), renderer)).toBe(renderer);
  for (const mode of ["fixed", "chase-high", "chase-low", "cab"] as const) {
    await page.evaluate(view => window.regionalHorizon.render(view), { region: "cedar-vale" as const, heading: Math.PI, mode, mobile: true });
    await page.locator("#horizon-fixture").screenshot({ path: info.outputPath(`${mode}.png`) });
  }
  if (software) await expect(page.locator("#horizon-fixture")).toHaveAttribute("data-renderer", "software3d");
  expect(errors).toEqual([]);
});
