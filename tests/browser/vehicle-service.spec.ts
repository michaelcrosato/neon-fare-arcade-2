import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import type {} from "./fixtures/vehicle-service-scene";
import { openScenePage } from "./scene-page";
import { WEBGPU_TEST_OPTIONS } from "./browser-options";
import { confirmVehicle, lockSteeringIfPrompted } from "./start-helpers";

test.use(WEBGPU_TEST_OPTIONS);
test.setTimeout(90_000);
let bundle: string;
test.beforeAll(async () => {
  const result = await build({ entryPoints: ["tests/browser/fixtures/vehicle-service-scene.tsx"], bundle: true,
    write: false, platform: "browser", format: "iife", logLevel: "silent" });
  bundle = result.outputFiles[0].text;
});

for (const backend of ["WebGPU", "WebGL", "software"] as const) {
  test(`${backend}: both sculpted cars render from front and rear, with a working classic switch`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    await page.setViewportSize({ width: 1200, height: 800 });
    if (backend === "software") await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...args: unknown[]) {
        if (kind === "webgl2") return null;
        return original.apply(this, [kind, ...args] as Parameters<typeof original>);
      } as typeof original;
    });
    await openScenePage(page, bundle);
    await page.evaluate(backend => window.vehicleServiceScene.mount(backend === "WebGPU" ? "WebGPU" : "Canvas 2D"), backend);
    for (const id of ["accord-v6", "crown-cab"] as const) {
      await page.evaluate(id => window.vehicleServiceScene.model(id, "classic"), id);
      const classic = await page.locator("canvas").screenshot();
      await page.evaluate(id => window.vehicleServiceScene.model(id, "detailed"), id);
      await expect(page.locator("canvas")).toHaveAttribute("data-vehicle-detail", "detailed");
      const detailed = await page.locator("canvas").screenshot({ path: info.outputPath(`${id}-front.png`) });
      expect(detailed.equals(classic)).toBe(false);
      await page.evaluate(id => window.vehicleServiceScene.model(id, "detailed", Math.PI), id);
      await page.locator("canvas").screenshot({ path: info.outputPath(`${id}-rear.png`) });
    }
    if (backend !== "WebGPU") await expect(page.locator("canvas")).toHaveAttribute("data-renderer", backend === "WebGL" ? "webgl2" : "software3d");
    expect(errors).toEqual([]);
  });
}

for (const mobile of [false, true]) test.describe(mobile ? "touch repairs" : "keyboard repairs", () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 960 },
    contextOptions: { hasTouch: mobile, isMobile: mobile, reducedMotion: "reduce" } });
  test("stop, decline, re-enter and pay; insufficient funds and the indoor option stay usable", async ({ page }, info) => {
    await openScenePage(page, bundle);
    await page.evaluate(() => window.vehicleServiceScene.mount("Canvas 2D"));
    await page.evaluate(() => window.vehicleServiceScene.damage());
    const offer = page.getByRole("region", { name: "Vehicle repairs", exact: true });
    await expect(offer).toBeVisible();
    await expect(offer).toContainText("Restore 3 km/h");
    const buttons = offer.getByRole("button");
    for (const button of await buttons.all()) {
      const box = (await button.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(0); expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    }
    await page.screenshot({ path: info.outputPath("repair-offer.png") });
    if (mobile) {
      await page.setViewportSize({ width: 844, height: 390 });
      const badge = (await page.locator(".vehicle-damage-status").boundingBox())!;
      const quip = (await page.locator(".mobile-notice").boundingBox())!;
      expect(badge.y).toBeGreaterThanOrEqual(quip.y + quip.height);
      await page.screenshot({ path: info.outputPath("repair-landscape.png") });
      await page.setViewportSize({ width: 390, height: 844 });
    }
    if (mobile) await offer.getByRole("button", { name: /NOT NOW/ }).tap(); else await page.keyboard.press("n");
    await expect(offer).toHaveCount(0);
    await page.evaluate(() => window.vehicleServiceScene.returnToLot());
    await expect(offer).toHaveCount(0);
    await page.evaluate(() => window.vehicleServiceScene.leave());
    await page.evaluate(() => window.vehicleServiceScene.returnToLot());
    await expect(offer).toBeVisible();
    if (mobile) await offer.getByRole("button", { name: /REPAIR VEHICLE/ }).tap(); else await page.keyboard.press("r");
    await expect(offer).toHaveCount(0);
    expect(await page.evaluate(() => window.vehicleServiceScene.state())).toMatchObject({ damage: { lossKmh: 0 }, fare: 70, message: "ALL FIXED! $30 PAID." });
    await page.evaluate(() => window.vehicleServiceScene.damage(29));
    await expect(offer.getByRole("button", { name: /NEED \$1 MORE/ })).toBeDisabled();
    await page.keyboard.press("r");
    expect((await page.evaluate(() => window.vehicleServiceScene.state())).fare).toBe(29);
    await page.evaluate(() => window.vehicleServiceScene.damage());
    await offer.getByRole("button", { name: /NOT NOW/ }).click();
    await page.evaluate(() => window.vehicleServiceScene.inside());
    await expect(offer).toBeVisible();
    await offer.getByRole("button", { name: /REPAIR VEHICLE/ }).click();
    expect((await page.evaluate(() => window.vehicleServiceScene.state())).fare).toBe(70);
  });
});

for (const mobile of [false, true]) test.describe(mobile ? "phone garage" : "desktop garage", () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 960 },
    contextOptions: { hasTouch: mobile, isMobile: mobile, reducedMotion: "reduce" } });
  test("original Accord story is readable and keyboard-safe; graphics choices persist and apply to the selected car", async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    if (mobile) await page.addInitScript(() => Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined }));
    await page.goto("/");
    await page.getByRole("button", { name: /Start Free Run with arcade/ }).click();
    await page.getByRole("button", { name: "Select 2015 Honda Accord Coupe V6", exact: true }).click();
    await page.getByRole("button", { name: /READ THE ACCORD'S STORY/ }).click();
    const story = page.getByRole("dialog", { name: "SECRET SPECIAL EDITION", exact: true });
    await expect(story).toBeVisible();
    await expect(story.getByRole("img")).toHaveJSProperty("naturalWidth", 1536);
    await expect(story).toContainText("154,298 KM AND COUNTING");
    await page.screenshot({ path: info.outputPath("accord-story.png") });
    await page.keyboard.press("Escape");
    await expect(story).toHaveCount(0);
    await expect(page.getByRole("button", { name: /READ THE ACCORD'S STORY/ })).toBeFocused();
    await expect(page.getByRole("heading", { name: "SELECT YOUR VEHICLE" })).toBeVisible();
    await confirmVehicle(page);
    await page.getByRole("button", { name: /Choose STREET ACE/ }).click();
    await lockSteeringIfPrompted(page);
    await expect(page.locator(".arcade-shell.mode-playing")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Pause game", exact: true }).click();
    await page.getByRole("button", { name: /^GAME OPTIONS/ }).click();
    const accord = page.getByRole("combobox", { name: "ACCORD V6 model quality" });
    const crown = page.getByRole("combobox", { name: "CROWN CAB model quality" });
    await accord.selectOption("detailed");
    await expect(crown).toHaveValue("classic");
    await expect(page.locator(".game-canvas.is-active")).toHaveAttribute("data-vehicle-detail", "detailed");
    await expect(page.locator(".game-canvas").nth(mobile ? 0 : 1)).toHaveClass(/is-active/);
    await crown.selectOption("detailed");
    await accord.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("graphics-options.png") });
    await page.reload();
    await page.getByRole("button", { name: "OPTIONS", exact: true }).first().click();
    await page.getByRole("button", { name: /^GAME OPTIONS/ }).click();
    await expect(accord).toHaveValue("detailed");
    await expect(crown).toHaveValue("detailed");
    expect(errors).toEqual([]);
  });
});
