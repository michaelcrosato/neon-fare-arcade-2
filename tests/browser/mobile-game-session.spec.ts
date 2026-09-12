import { expect, test } from "@playwright/test";
import { lockSteeringIfPrompted } from "./start-helpers";
import { WEBGPU_TEST_OPTIONS } from "./browser-options";

test.use({ ...WEBGPU_TEST_OPTIONS, viewport: { width: 390, height: 844 },
  contextOptions: { hasTouch: true, isMobile: true, reducedMotion: "reduce" } });
test.setTimeout(60_000);

test("mobile start enters fullscreen, protects gestures and keeps music looping through pauses", async ({ page, context }, info) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/");
  const audio = page.locator("#neon-fare-bgm");
  expect(await audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
  await page.getByRole("button", { name: /Start Free Run with arcade/ }).tap();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === document.documentElement)).toBe(true);
  await page.getByRole("button", { name: /Choose STREET ACE/ }).tap();
  await lockSteeringIfPrompted(page);
  await expect(page.locator(".arcade-shell")).toHaveClass(/mode-playing/);
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => !element.paused && element.currentTime > 0)).toBe(true);
  const originalTrack = await audio.getAttribute("src");
  const stage = page.locator(".game-stage");
  await expect(stage).toHaveCSS("touch-action", "none");
  expect((await stage.boundingBox())!.height).toBe(844);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 2, y: 230, id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 90, y: 370, id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  expect(await page.evaluate(() => [scrollX, scrollY])).toEqual([0, 0]);
  await page.getByRole("button", { name: "Pause game" }).tap();
  const pausedTime = await audio.evaluate((element: HTMLAudioElement) => element.currentTime);
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(pausedTime + .15);
  expect(await audio.getAttribute("src")).toBe(originalTrack);
  await page.getByRole("button", { name: "AUDIO ON", exact: true }).tap();
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.muted)).toBe(true);
  await page.getByRole("button", { name: "AUDIO OFF", exact: true }).tap();
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.muted)).toBe(false);
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => Number.isFinite(element.duration))).toBe(true);
  await audio.evaluate((element: HTMLAudioElement) => { element.currentTime = element.duration - .1; });
  await expect.poll(() => audio.getAttribute("src")).not.toBe(originalTrack);
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => !element.paused && element.currentTime > 0)).toBe(true);
  await page.getByRole("button", { name: "RESUME FREE RUN" }).tap();
  await expect(page.locator(".arcade-shell")).toHaveClass(/mode-playing/);
  await page.screenshot({ path: info.outputPath("mobile-running.png") });
  expect(errors).toEqual([]);
});
