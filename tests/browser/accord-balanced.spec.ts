import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { openScenePage } from "./scene-page";
import { WEBGPU_TEST_OPTIONS } from "./browser-options";
import type {} from "./fixtures/accord-balanced-scene";

test.use({ ...WEBGPU_TEST_OPTIONS, viewport: { width: 800, height: 600 } });
test.setTimeout(90_000);
let bundle: string;
test.beforeAll(async () => {
  bundle = (await build({ entryPoints: ["tests/browser/fixtures/accord-balanced-scene.ts"], bundle: true,
    write: false, platform: "browser", format: "iife", logLevel: "silent" })).outputFiles[0].text;
});

for (const backend of ["WebGPU", "WebGL", "software"] as const) test(`${backend}: Balanced Accord is identical in both detail settings`, async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  if (backend === "software") await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...args: unknown[]) {
      if (kind === "webgl2") return null;
      return original.apply(this, [kind, ...args] as Parameters<typeof original>);
    } as typeof original;
  });
  await openScenePage(page, bundle);
  await page.evaluate(backend => window.accordBalancedScene.mount(backend === "WebGPU" ? "WebGPU" : "Canvas 2D"), backend);
  for (const model of ["arcade", "simulation"] as const) for (const heading of [0, Math.PI]) {
    await page.evaluate(([model, heading]) => window.accordBalancedScene.draw("classic", model, heading), [model, heading] as const);
    const classic = await page.locator("canvas").screenshot({ path: info.outputPath(`${model}-${heading === 0 ? "front" : "rear"}.png`) });
    await page.evaluate(([model, heading]) => window.accordBalancedScene.draw("detailed", model, heading), [model, heading] as const);
    expect(await page.locator("canvas").screenshot()).toEqual(classic);
  }
  await page.evaluate(() => window.accordBalancedScene.draw("classic", "simulation", 0, .8, .3));
  await page.locator("canvas").screenshot({ path: info.outputPath("steering-and-roll.png") });
  if (backend !== "WebGPU") await expect(page.locator("canvas")).toHaveAttribute("data-renderer", backend === "WebGL" ? "webgl2" : "software3d");
  expect(errors).toEqual([]);
});
