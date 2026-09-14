import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import type {} from "./fixtures/destination-beacon-scene";
import { openScenePage } from "./scene-page";
import { WEBGPU_TEST_OPTIONS } from "./browser-options";

test.use(WEBGPU_TEST_OPTIONS);
test.setTimeout(90_000);
let bundle: string;
test.beforeAll(async () => {
  bundle = (await build({ entryPoints: ["tests/browser/fixtures/destination-beacon-scene.ts"], bundle: true,
    write: false, platform: "browser", format: "iife", logLevel: "silent" })).outputFiles[0].text;
});

async function addedRedPixels(page: Page, before: Buffer, after: Buffer) {
  return page.evaluate(async ([before, after]) => {
    const pixels = async (data: string) => {
      const image = new Image(); image.src = `data:image/png;base64,${data}`; await image.decode();
      const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext("2d")!; context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, canvas.width, canvas.height).data;
    };
    const [a, b] = await Promise.all([pixels(before), pixels(after)]);
    let count = 0;
    for (let i = 0; i < a.length; i += 4) if (b[i] > a[i] + 15 && b[i] > b[i + 1] + 15 && b[i] > b[i + 2] + 15) count++;
    return count;
  }, [before.toString("base64"), after.toString("base64")]);
}

for (const backend of ["WebGPU", "WebGL", "software"] as const) {
  test(`${backend}: destination beams survive distant clipping and sky blending, with foreground occlusion`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    await page.setViewportSize({ width: 1000, height: 720 });
    if (backend === "software") await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...args: unknown[]) {
        if (kind === "webgl2") return null;
        return original.apply(this, [kind, ...args] as Parameters<typeof original>);
      } as typeof original;
    });
    await openScenePage(page, bundle);
    await page.evaluate(backend => window.destinationBeacon.mount(backend === "WebGPU" ? "WebGPU" : "Canvas 2D"), backend);
    // High Chase aims below the horizon; keep its destination inside that view.
    for (const [mode, distance] of [["fixed", 20], ["chase-high", 80], ["chase-low", 100000], ["cab", 7000]] as const) {
      await page.evaluate(([mode, distance]) => window.destinationBeacon.render(mode, distance, false), [mode, distance] as const);
      const before = await page.locator("canvas").screenshot();
      await page.evaluate(([mode, distance]) => window.destinationBeacon.render(mode, distance, true), [mode, distance] as const);
      const after = await page.locator("canvas").screenshot({ path: info.outputPath(`${mode}-${distance}.png`) });
      expect(await addedRedPixels(page, before, after), `${mode}: visible red pixels at ${distance} m`).toBeGreaterThan(100);
    }
    for (const occluded of [false, true]) {
      await page.evaluate(occluded => window.destinationBeacon.render("cab", 7000, false, occluded, false, !occluded), occluded);
      const before = await page.locator("canvas").screenshot();
      await page.evaluate(occluded => window.destinationBeacon.render("cab", 7000, true, occluded, false, !occluded), occluded);
      const after = await page.locator("canvas").screenshot();
      expect(await addedRedPixels(page, before, after), occluded ? "foreground wall hides the beam" : "beam behind the camera stays clipped").toBe(0);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.destinationBeacon.render("chase-low", 7000, false, false, true));
    const before = await page.locator("canvas").screenshot();
    await page.evaluate(() => window.destinationBeacon.render("chase-low", 7000, true, false, true));
    const after = await page.locator("canvas").screenshot({ path: info.outputPath("phone-beacon.png") });
    expect(await addedRedPixels(page, before, after)).toBeGreaterThan(100);
    if (backend !== "WebGPU") await expect(page.locator("canvas")).toHaveAttribute("data-renderer", backend === "WebGL" ? "webgl2" : "software3d");
    expect(errors).toEqual([]);
  });
}
