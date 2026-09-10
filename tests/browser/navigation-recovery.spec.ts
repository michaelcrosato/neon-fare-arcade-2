import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import type { CameraMode } from "../../game/model";
import type {} from "./fixtures/guidance-scene";
import { SCENE_TEST_TIMEOUT, WEBGPU_TEST_OPTIONS } from "./browser-options";
import { openScenePage } from "./scene-page";

test.use(WEBGPU_TEST_OPTIONS);
test.setTimeout(SCENE_TEST_TIMEOUT);
let bundle: string;
test.beforeAll(async () => {
  const result = await build({ entryPoints: ["tests/browser/fixtures/guidance-scene.tsx"], bundle: true,
    write: false, platform: "browser", format: "iife", logLevel: "silent" });
  bundle = result.outputFiles[0].text;
});

for (const renderer of ["WebGPU", "Canvas 2D"] as const) for (const mobile of [false, true]) {
  test(`${renderer} shows distance badges, right-lane guidance and a paid tow at ${mobile ? "mobile" : "desktop"} size`, async ({ page }, info) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    await openScenePage(page, bundle);
    expect(await page.evaluate(renderer => window.guidanceScene.mount(renderer), renderer)).toBe(renderer);
    const modes: CameraMode[] = ["fixed", "chase-high", "chase-low", "cab"];
    for (const kind of ["turn", "uturn"] as const) for (const mode of modes) {
      await page.evaluate(({ kind, mode }) => window.guidanceScene.draw(kind, mode), { kind, mode });
      const badge = page.locator(".navigation-distance");
      await expect(badge).toBeVisible();
      await expect(badge).toBeInViewport({ ratio: 1 });
      await expect(badge.locator("strong")).toHaveText("868m");
      await expect(badge.locator("small")).toHaveText("TO DESTINATION");
      const meters = page.locator(mobile ? ".mobile-speed" : ".hud-top");
      const labelBounds = (await badge.boundingBox())!, meterBounds = (await meters.boundingBox())!;
      expect(labelBounds.y).toBeGreaterThan(meterBounds.y + meterBounds.height);
      await page.locator("#guidance-fixture").screenshot({ path: info.outputPath(`${kind}-${mode}.png`) });
    }
    const rescue = await page.evaluate(() => window.guidanceScene.rescue());
    expect(rescue.cost).toBe(100); expect(rescue.z).toBeGreaterThan(30);
    for (const mode of modes) {
      const state = await page.evaluate(mode => window.guidanceScene.draw("tow", mode, .2), mode);
      expect(state.fare).toBe(150); expect(state.truck).not.toBeNull();
      await expect(page.locator(".tow-receipt")).toBeInViewport({ ratio: 1 });
      await expect(page.locator(".tow-receipt")).toContainText("−$100");
      await page.locator("#guidance-fixture").screenshot({ path: info.outputPath(`tow-${mode}.png`) });
    }
    const start = await page.evaluate(() => window.guidanceScene.draw("tow", "chase-high", .2));
    const later = await page.evaluate(() => window.guidanceScene.draw("tow", "chase-high", 2));
    expect(Math.hypot(later.truck!.x - start.truck!.x, later.truck!.y - start.truck!.y)).toBeGreaterThan(10);
    await page.locator("#guidance-fixture").screenshot({ path: info.outputPath("tow-departing.png") });
    expect((await page.evaluate(() => window.guidanceScene.draw("tow", "chase-high", 4))).truck).toBeNull();
    await expect(page.locator(".tow-receipt")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

for (const viewport of [{ width: 320, height: 568 }, { width: 1280, height: 800 }]) {
  test(`pause-menu rescue resumes the actual game and records a free tow at ${viewport.width}px`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined }));
    await page.goto("/?diagnostics=1");
    await page.getByRole("button", { name: /Start Free Run with arcade/ }).click();
    await page.getByRole("button", { name: /Choose STREET ACE/ }).click();
    await expect(page.getByRole("button", { name: "Pause game" })).toBeEnabled();
    await page.getByRole("button", { name: "Pause game" }).click();
    const button = page.getByRole("button", { name: /Get unstuck/ });
    await button.scrollIntoViewIfNeeded();
    await expect(button).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: info.outputPath("pause-rescue.png") });
    await button.click();
    await expect(page.getByRole("region", { name: "Game paused" })).toHaveCount(0);
    await expect(page.locator(".tow-receipt")).toContainText("ON THE HOUSE");
    await page.screenshot({ path: info.outputPath("free-rescue.png") });
    await page.getByRole("button", { name: "Pause game" }).click();
    await page.getByRole("button", { name: "COPY DIAGNOSTICS" }).click();
    await expect(page.getByRole("status")).toContainText("DIAGNOSTICS COPIED");
    const report = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
    expect(report.currentGame.towRecovery.cost).toBe(0);
    expect(report.currentGame.player.kind).toBe("driving");
    expect(report.currentGame.roadMotion.grounded).toBe(true);
    expect(report.currentGame.fareJobs).toHaveLength(6);
    expect(report.recentErrors).toEqual([]);
  });
}
