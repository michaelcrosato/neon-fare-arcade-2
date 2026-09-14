import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import type {} from "./fixtures/cab-view-scene";
import { openScenePage } from "./scene-page";
import { WEBGPU_TEST_OPTIONS } from "./browser-options";
import { confirmVehicle, lockSteeringIfPrompted } from "./start-helpers";

test.use({ ...WEBGPU_TEST_OPTIONS, actionTimeout: 15_000 });
test.setTimeout(90_000);
let bundle: string;
test.beforeAll(async () => {
  bundle = (await build({ entryPoints: ["tests/browser/fixtures/cab-view-scene.ts"], bundle: true,
    write: false, platform: "browser", format: "iife", logLevel: "silent" })).outputFiles[0].text;
});

for (const backend of ["WebGPU", "WebGL", "software"] as const) test(`${backend}: Cab View has no foreground car geometry`, async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.setViewportSize({ width: 800, height: 600 });
  if (backend === "software") await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...args: unknown[]) {
      if (kind === "webgl2") return null;
      return original.apply(this, [kind, ...args] as Parameters<typeof original>);
    } as typeof original;
  });
  await openScenePage(page, bundle);
  await page.evaluate(backend => window.cabViewScene.mount(backend === "WebGPU" ? "WebGPU" : "Canvas 2D"), backend);
  for (const vehicle of ["crown-cab", "accord-v6"] as const) for (const model of ["arcade", "simulation"] as const) {
    for (const detail of ["classic", "detailed"] as const) {
      await page.evaluate(([vehicle, model, detail]) => window.cabViewScene.draw(vehicle, model, detail), [vehicle, model, detail] as const);
      const screenshot = await page.locator("canvas").screenshot();
      const clearFraction = await page.evaluate(async data => {
        const image = new Image(); image.src = `data:image/png;base64,${data}`; await image.decode();
        const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
        const context = canvas.getContext("2d")!; context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let visible = 0;
        for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 1] > 75 && pixels[i + 1] > pixels[i] * 1.5) visible++;
        return visible / (pixels.length / 4);
      }, screenshot.toString("base64"));
      expect(clearFraction, `${vehicle}/${model}/${detail}: wall visible across the whole frame`).toBeGreaterThan(.995);
    }
  }
  await page.locator("canvas").screenshot({ path: info.outputPath("clear-first-person.png") });
  if (backend !== "WebGPU") await expect(page.locator("canvas")).toHaveAttribute("data-renderer", backend === "WebGL" ? "webgl2" : "software3d");
  expect(errors).toEqual([]);
});

for (const mobile of [false, true]) test.describe(mobile ? "phone Simulation cab" : "desktop Arcade cab", () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 960 },
    contextOptions: { hasTouch: mobile, isMobile: mobile, reducedMotion: "reduce" } });
  test("first person keeps the normal HUD and camera switching without cabin overlays", async ({ page }, info) => {
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(mobile => {
      localStorage.setItem("neon-fare-camera-v1", "cab");
      if (mobile) Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined });
    }, mobile);
    await page.clock.install(); await page.goto("/");
    await page.getByRole("button", { name: mobile ? /Start Simulation Free Run/ : /Start Free Run with arcade/ }).click();
    if (mobile) await page.getByRole("button", { name: "Select 2015 Honda Accord Coupe V6", exact: true }).click();
    await confirmVehicle(page);
    if (!mobile) await page.getByRole("button", { name: /Choose STREET ACE/ }).click();
    await lockSteeringIfPrompted(page); await page.clock.fastForward(3600); await page.clock.runFor(100);
    await expect(page.locator(".game-stage.camera-cab.player-driving")).toBeVisible();
    await expect(page.locator(".cab-frame, .cab-dashboard, .cab-wheel, .cab-mirror, .cab-pillars")).toHaveCount(0);
    await expect(page.getByRole("complementary", { name: "Vehicle fuel", exact: true })).toBeVisible();
    await expect(page.locator(".game-canvas.is-active")).toBeVisible();
    await page.clock.runFor(3300); // Let the launch message finish.
    await page.screenshot({ path: info.outputPath("cab-with-normal-hud.png") });
    for (const camera of ["HIGH", "CAB"]) {
      await page.getByRole("button", { name: "Pause game", exact: true }).click();
      await page.getByRole("group", { name: "Camera view", exact: true }).getByRole("button", { name: camera, exact: true }).click();
      await page.getByRole("button", { name: "RESUME FREE RUN", exact: true }).click();
      await page.clock.runFor(100);
      await expect(page.locator(`.game-stage.camera-${camera === "CAB" ? "cab" : "chase-high"}`)).toBeVisible();
    }
    await expect(page.locator(".cab-frame")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
