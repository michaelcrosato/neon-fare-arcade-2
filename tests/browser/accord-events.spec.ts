import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import type {} from "./fixtures/accord-events-scene";
import { openScenePage } from "./scene-page";
import { WEBGPU_TEST_OPTIONS } from "./browser-options";

test.use(WEBGPU_TEST_OPTIONS);
test.setTimeout(90_000);
let bundle: string;
test.beforeAll(async () => { bundle = (await build({ entryPoints: ["tests/browser/fixtures/accord-events-scene.tsx"], bundle: true, write: false,
  platform: "browser", format: "iife", logLevel: "silent" })).outputFiles[0].text; });

for (const backend of ["WebGPU", "Canvas"] as const) for (const shape of ["desktop", "portrait", "landscape"] as const) {
  test(`${backend} ${shape}: story pauses all trip time, accepts fresh input, and tow fits`, async ({ page }, info) => {
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize(shape === "desktop" ? { width: 1280, height: 900 } : shape === "portrait" ? { width: 390, height: 844 } : { width: 844, height: 390 });
    if (backend === "Canvas") await page.addInitScript(() => Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined }));
    await openScenePage(page, bundle);
    await expect(page.locator("canvas.is-active")).toBeVisible();
    await page.evaluate(() => window.accordEventsScene.start("quantum"));
    const card = page.getByRole("dialog");
    await expect(card).toBeVisible();
    expect(await card.evaluate(e => e.scrollTop)).toBe(0);
    const before = await page.evaluate(() => window.accordEventsScene.state());
    expect(before.mode).toBe("paused");
    await page.clock.install();
    await page.clock.runFor(5000);
    expect(await page.evaluate(() => window.accordEventsScene.state())).toEqual(before);
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "w", repeat: true, bubbles: true })));
    await expect(card).toBeVisible();
    const box = (await card.boundingBox())!, viewport = page.viewportSize()!;
    expect(box.width * box.height).toBeLessThan(viewport.width * viewport.height * .85);
    expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThan(2);
    expect(Math.abs(box.y + box.height / 2 - viewport.height / 2)).toBeLessThan(2);
    expect(await card.evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: info.outputPath("quantum.png") });
    if (shape === "desktop") await page.keyboard.press("q");
    else await card.getByRole("button").click();
    await expect(card).toHaveCount(0);
    await page.clock.runFor(500);
    const after = await page.evaluate(() => window.accordEventsScene.state());
    expect(after.mode).toBe("playing"); expect(after.elapsed).toBeGreaterThan(before.elapsed);
    expect(after.stories.filter(kind => kind === "quantum")).toHaveLength(1);
    const longest = await page.evaluate(() => window.accordEventsScene.longestContent());
    await page.clock.runFor(100);
    await expect(card).toContainText(longest.title);
    await expect(card).toContainText(longest.response);
    expect(await card.evaluate(e => e.scrollTop)).toBe(0);
    await expect(card.locator(".story-card__portrait")).toBeVisible();
    expect(await card.evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
    const longestBox = (await card.boundingBox())!;
    expect(longestBox.height).toBeLessThanOrEqual(viewport.height * .82 + 1);
    await card.evaluate(e => { e.scrollTop = 0; });
    await page.screenshot({ path: info.outputPath("quantum-longest-lesson.png") });
    await card.getByRole("button").scrollIntoViewIfNeeded();
    await expect(card.getByRole("button")).toBeInViewport({ ratio: .99 });
    await page.screenshot({ path: info.outputPath("quantum-longest-reply.png") });
    await card.getByRole("button").click();
    await expect(card).toHaveCount(0);
    await page.evaluate(() => window.accordEventsScene.start("tires-paid"));
    await page.clock.runFor(100);
    await expect(card).toContainText("THOSE TIRES ARE YOURS!");
    await page.screenshot({ path: info.outputPath("tires-paid.png") });
    await page.keyboard.press("Enter");
    await page.clock.runFor(100);
    await expect(card).toHaveCount(0);
    for (const paid of [false, true]) {
      await page.evaluate(paid => window.accordEventsScene.start("tow", paid), paid);
      await page.clock.runFor(100);
      const tow = page.locator(".tow-receipt");
      await expect(tow).toBeInViewport({ ratio: 1 });
      await expect(tow).toContainText(paid ? "−$100" : "ON THE HOUSE");
      await page.screenshot({ path: info.outputPath(`tow-${paid ? "paid" : "free"}.png`) });
    }
    expect(errors).toEqual([]);
  });
}
