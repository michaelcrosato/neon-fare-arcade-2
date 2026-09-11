import { expect, test } from "@playwright/test";
import { SCENE_START_TIMEOUT, SCENE_TEST_TIMEOUT, WEBGPU_TEST_OPTIONS } from "./browser-options";
import { lockSteeringIfPrompted } from "./start-helpers";
import type { DiagnosticsSnapshot } from "../../app/runtime/diagnostics";

test.use({ ...WEBGPU_TEST_OPTIONS, viewport: { width: 390, height: 844 },
  contextOptions: { hasTouch: true, isMobile: true, reducedMotion: "reduce" } });

for (const renderer of ["WebGPU", "Canvas 2D"] as const) {
  test(`${renderer}: countdown teaches both thumbs and keeps their input locked until GO`, async ({ page, context }, info) => {
    test.setTimeout(Math.max(60000, SCENE_TEST_TIMEOUT));
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    page.on("response", response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
    if (renderer === "Canvas 2D") await page.addInitScript(() => Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined }));
    await page.goto("/?diagnostics=1");
    await expect(page.locator(".game-canvas").nth(renderer === "WebGPU" ? 1 : 0)).toHaveClass(/is-active/, { timeout: SCENE_START_TIMEOUT });
    await page.getByRole("button", { name: /Start Free Run with arcade/ }).click();
    // Pause before starting: software-GPU screenshots can outlast the three-second countdown.
    await page.clock.pauseAt(new Date("2026-01-01T01:00:00Z"));
    await page.getByRole("button", { name: /Choose STREET ACE/ }).click();
    await lockSteeringIfPrompted(page);
    await page.clock.runFor(100);
    const guide = page.locator(".mobile-steer-guide");
    const gas = page.getByRole("button", { name: "Accelerate", exact: true });
    const brake = page.getByRole("button", { name: "Brake or reverse", exact: true });
    const exit = page.getByRole("button", { name: /EXIT TAXI/ });
    await expect(page.locator(".countdown")).toBeVisible();
    await expect(guide).toHaveCSS("opacity", "1");
    await expect(gas).toBeDisabled();
    await expect(brake).toBeDisabled();
    await expect(gas).toContainText("GAS");
    await expect(brake).toContainText("BRAKE");
    await page.screenshot({ path: info.outputPath("countdown.png") });

    const cdp = await context.newCDPSession(page);
    const gasBox = (await gas.boundingBox())!;
    const pedal = { x: gasBox.x + gasBox.width / 2, y: gasBox.y + gasBox.height / 2, id: 1 };
    const thumb = { x: 85, y: 240, id: 2 };
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [thumb, pedal] });
    thumb.x += 56;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [thumb, pedal] });
    await expect(page.locator("[data-held], .mobile-thumbstick")).toHaveCount(0);
    await page.clock.fastForward(3500);
    await expect(gas).toBeEnabled();
    await page.clock.runFor(100);
    await expect(page.locator("[data-held], .mobile-thumbstick")).toHaveCount(0);
    await expect(page.locator(".mobile-speed > strong")).toHaveText("0");
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(exit).toBeVisible();
    expect(errors).toEqual([]);
  });

  test(`${renderer}: steering fades its guide and the door action follows the cab`, async ({ page, context }, info) => {
    test.setTimeout(Math.max(60000, SCENE_TEST_TIMEOUT));
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    page.on("response", response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    // Keep live driving and WebGPU captures on native animation frames;
    // countdown clock control belongs to the isolated test above.
    if (renderer === "Canvas 2D") await page.addInitScript(() => Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined }));
    await page.goto("/?diagnostics=1");
    await expect(page.locator(".game-canvas").nth(renderer === "WebGPU" ? 1 : 0)).toHaveClass(/is-active/, { timeout: SCENE_START_TIMEOUT });
    await page.getByRole("button", { name: /Start Free Run with arcade/ }).click();
    await page.getByRole("button", { name: /Choose STREET ACE/ }).click();
    await lockSteeringIfPrompted(page);
    const guide = page.locator(".mobile-steer-guide");
    const gas = page.getByRole("button", { name: "Accelerate", exact: true });
    const brake = page.getByRole("button", { name: "Brake or reverse", exact: true });
    const exit = page.getByRole("button", { name: /EXIT TAXI/ });
    await expect(gas).toBeEnabled({ timeout: SCENE_START_TIMEOUT });
    await expect(exit).toBeVisible();
    await page.screenshot({ path: info.outputPath("ready.png") });

    const cdp = await context.newCDPSession(page);
    const gasBox = (await gas.boundingBox())!;
    const pedal = { x: gasBox.x + gasBox.width / 2, y: gasBox.y + gasBox.height / 2, id: 1 };
    const thumb = { x: 85, y: 240, id: 2 };
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [thumb] });
    await expect(page.locator(".mobile-thumbstick")).toHaveCSS("left", "85px");
    await expect(guide).toHaveCSS("opacity", "1");
    thumb.x += 31;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [thumb] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [thumb, pedal] });
    await expect(guide).toHaveCSS("opacity", "0.24");
    await expect(guide).toBeVisible();
    await expect.poll(async () => Number(await page.locator(".mobile-speed > strong").textContent())).toBeGreaterThan(12);
    await expect(exit).toHaveCount(0);
    await page.screenshot({ path: info.outputPath("steering.png") });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [thumb] });
    await expect(gas).toHaveAttribute("data-held", "");
    await expect(page.locator(".mobile-thumbstick")).toHaveCount(0);
    await expect(guide).toHaveCSS("opacity", "1");
    await page.waitForTimeout(120);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.keyboard.down("s");
    await expect(exit).toBeVisible();
    await page.keyboard.up("s");
    await expect.poll(async () => Number(await page.locator(".mobile-speed > strong").textContent())).toBeLessThan(10);

    // Camera changes checkpoint the bounded recorder, so verify driving before cycling them.
    await page.getByRole("button", { name: "Pause game" }).click();
    await page.getByRole("button", { name: "COPY DIAGNOSTICS" }).click();
    const trace: DiagnosticsSnapshot = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
    expect(trace.runtime.renderer).toBe(renderer);
    const ticks = trace.trace.segments.flatMap(segment => segment.ticks);
    expect(ticks.some(tick => tick.steer === .5 && (tick.inputMask & 1) !== 0)).toBe(true);
    expect(ticks.some(tick => tick.steer === 0 && (tick.inputMask & 1) !== 0)).toBe(true);
    expect(ticks.at(-1)!.steer).toBe(0);
    expect(trace.recentErrors).toEqual([]);
    await page.getByRole("button", { name: "RESUME FREE RUN" }).click();

    const positions = [];
    for (const camera of ["HIGH", "LOW", "FIXED", "CAB"]) {
      await page.getByRole("button", { name: "Pause game" }).click();
      await page.getByRole("group", { name: "Camera view" }).getByRole("button", { name: camera, exact: true }).click();
      await page.getByRole("button", { name: "RESUME FREE RUN" }).click();
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      await expect(exit).toBeInViewport({ ratio: 1 });
      await exit.click({ trial: true });
      const box = (await exit.boundingBox())!;
      positions.push({ x: Math.round(box.x), y: Math.round(box.y) });
      await page.screenshot({ path: info.outputPath(`door-${camera.toLowerCase()}.png`) });
    }
    expect(new Set(positions.map(position => JSON.stringify(position))).size).toBeGreaterThan(2);
    await page.setViewportSize({ width: 844, height: 390 });
    for (const button of [gas, brake, exit, page.getByRole("button", { name: "Pause game" })]) await expect(button).toBeInViewport({ ratio: 1 });
    for (const button of [gas, brake]) expect((await button.boundingBox())!.x).toBeGreaterThan(422);
    await expect(guide).toBeVisible();
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await page.screenshot({ path: info.outputPath("landscape.png") });
    await exit.click();
    await expect(page.getByLabel("Touch walking controls")).toBeVisible();
    await expect(guide).toHaveCount(0);
    await page.getByRole("button", { name: /ENTER TAXI/ }).click();
    await expect(guide).toHaveCSS("opacity", "1");
    await page.getByRole("button", { name: "Pause game" }).click();
    await page.getByRole("button", { name: "COPY DIAGNOSTICS" }).click();
    const finalTrace: DiagnosticsSnapshot = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
    expect(finalTrace.trace.segments.flatMap(segment => segment.ticks).at(-1)!.steer).toBe(0);
    expect(finalTrace.recentErrors).toEqual([]);
    expect(errors).toEqual([]);
  });
}
