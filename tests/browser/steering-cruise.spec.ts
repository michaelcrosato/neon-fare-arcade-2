import { expect, test, type Page } from "@playwright/test";
import { SCENE_TEST_TIMEOUT, WEBGPU_TEST_OPTIONS } from "./browser-options";
import type { Game } from "../../game/model";

test.use(WEBGPU_TEST_OPTIONS);
test.setTimeout(Math.max(120_000, SCENE_TEST_TIMEOUT * 4));

async function begin(page: Page, renderer: string, model = "arcade", steering = "DEFAULT") {
  await page.clock.install({ time: new Date("2026-09-12T00:00:00Z") });
  if (renderer === "Canvas") await page.addInitScript(() => Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined }));
  await page.goto("/?diagnostics=1");
  await expect(page.locator(".game-canvas").nth(renderer === "WebGPU" ? 1 : 0)).toHaveClass(/is-active/, { timeout: 30_000 });
  await page.getByRole("button", { name: model === "simulation" ? /^Start Simulation Free Run\. Drive/ : /Start Free Run with arcade/ }).click();
  await page.clock.pauseAt(new Date("2026-09-12T01:00:00Z"));
  await page.getByRole("button", { name: model === "simulation" ? /Start Simulation Free Run in the Crown/ : /Choose STREET ACE/ }).click();
  if (await page.getByRole("dialog", { name: "STEERING SYSTEM" }).isVisible()) {
    if (steering === "WHEEL") await page.getByLabel("Wheel rotation range").selectOption("180");
    await page.getByRole("button", { name: new RegExp(`Select ${steering}`) }).click();
  }
  await page.clock.fastForward(3500);
  await page.clock.runFor(100);
  await expect(page.locator(".arcade-shell.mode-playing")).toBeVisible();
}

async function advance(page: Page, milliseconds: number) {
  // Present at 20 Hz; each frame still uses the game's ordinary fixed 60 Hz steps.
  for (let elapsed = 0; elapsed < milliseconds; elapsed += 50) await page.clock.fastForward(50);
}

async function diagnostics(page: Page): Promise<Game> {
  await page.getByRole("button", { name: "Pause game" }).click();
  await page.getByRole("button", { name: "COPY DIAGNOSTICS", exact: true }).click();
  await expect(page.getByText("DIAGNOSTICS COPIED", { exact: true })).toBeVisible();
  const report = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
  expect(report.recentErrors).toEqual([]);
  return report.currentGame;
}

test.describe("floating steering", () => {
  test.use({ viewport: { width: 390, height: 844 }, contextOptions: { hasTouch: true, isMobile: true, reducedMotion: "reduce" } });
  for (const renderer of ["WebGPU", "Canvas"]) for (const mode of ["JOYSTICK", "WHEEL"]) {
    test(`${renderer} ${mode} starts at any thumb position and retains independent controls`, async ({ page, context }, info) => {
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      await begin(page, renderer, "arcade", mode);
      const control = page.getByLabel(mode === "JOYSTICK" ? /Virtual joystick/ : /Virtual steering wheel/);
      await expect(control).toHaveCount(0);
      const cdp = await context.newCDPSession(page);
      for (const [x, y] of [[80, 240], [280, 350], [640, 160]]) {
        if (x > 390) { await page.setViewportSize({ width: 844, height: 390 }); await page.clock.runFor(200); }
        const thumb = { id: 1, x, y };
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [thumb] });
        await expect(control).toBeVisible();
        const box = (await control.boundingBox())!;
        expect(box.x + box.width / 2).toBeCloseTo(x, 0);
        expect(box.y + box.height / 2).toBeCloseTo(y + (mode === "WHEEL" ? 68 : 0), 0);
        const origin = { ...thumb };
        thumb.x += 40;
        if (mode === "JOYSTICK") thumb.y -= 30;
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [thumb] });
        const points = [thumb];
        if (mode === "WHEEL") {
          const gas = (await page.getByRole("button", { name: "Accelerate", exact: true }).boundingBox())!;
          points.push({ id: 2, x: gas.x + gas.width / 2, y: gas.y + gas.height / 2 });
          await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: points });
          await expect(page.getByRole("button", { name: "Accelerate", exact: true })).toHaveAttribute("data-held", "");
          expect((await control.boundingBox())!.x + box.width / 2).toBeCloseTo(origin.x, 0);
        }
        await page.clock.runFor(400);
        await expect(page.locator(".mobile-steer-guide")).toHaveAttribute("data-steering", "");
        expect(Number(await page.locator(".speedometer > strong").textContent())).toBeGreaterThan(1);
        await page.screenshot({ path: info.outputPath(`${mode.toLowerCase()}-${x}.png`) });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await page.clock.runFor(600);
        await expect(control).toHaveCount(0);
      }
      if (mode === "WHEEL") {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ id: 1, x: 26, y: 376 }] });
        await expect(control).toBeInViewport({ ratio: 1 });
        const edge = (await control.boundingBox())!;
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ id: 1, x: edge.x + edge.width - 10, y: edge.y + edge.height / 2 }] });
        await expect(page.locator(".mobile-steer-guide")).toHaveAttribute("data-steering", "");
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await page.clock.runFor(600);
      }
      const game = await diagnostics(page);
      expect(game.heading).not.toBe(-Math.PI / 2);
      if (mode === "WHEEL") {
        await page.getByRole("button", { name: "OPTIONS · DEV MODE", exact: true }).click();
        await page.getByRole("tab", { name: "GAME SETTINGS" }).click();
        await expect(page.getByLabel("Wheel rotation range")).toHaveValue("180");
        await page.getByLabel("Wheel rotation range").selectOption("90");
        await page.clock.resume();
        await page.reload();
        await page.getByRole("button", { name: /Start Free Run with arcade/ }).click();
        await page.getByRole("button", { name: /Choose STREET ACE/ }).click();
        await expect(page.getByLabel("Wheel rotation range")).toHaveValue("90");
        await page.getByLabel("Wheel rotation range").scrollIntoViewIfNeeded();
        await page.screenshot({ path: info.outputPath("wheel-range.png") });
        await page.clock.pauseAt(new Date("2026-09-12T02:00:00Z"));
        await page.getByRole("button", { name: /Select WHEEL/ }).click();
        await page.clock.fastForward(3500);
        await page.clock.runFor(100);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ id: 1, x: 240, y: 150 }] });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ id: 1, x: 308, y: 218 }] });
        await expect(page.locator(".mobile-wheel-readout strong")).toHaveText("45°");
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      }
      expect(errors).toEqual([]);
    });
  }
});

for (const model of ["arcade", "simulation"]) {
  test.describe(`${model} cruise`, () => {
    const mobile = model === "arcade";
    test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 },
      contextOptions: { hasTouch: mobile, isMobile: mobile, reducedMotion: "reduce" } });
    test("sets speed, holds it, permits acceleration, resumes and cancels on the brake", async ({ page, context }, info) => {
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      await begin(page, mobile ? "Canvas" : "WebGPU", model);
      await page.getByRole("button", { name: "Pause game" }).click();
      await page.getByRole("button", { name: "OPTIONS · DEV MODE", exact: true }).click();
      await page.getByRole("checkbox", { name: /DEV MODE/ }).check();
      await page.getByRole("button", { name: "CLEAR ACTIVE TRAFFIC", exact: true }).click();
      await page.getByRole("button", { name: "CLOSE OPTIONS", exact: true }).click();
      await page.getByRole("button", { name: "RESUME FREE RUN", exact: true }).click();
      await page.clock.runFor(100);
      const cruise = page.getByRole("button", { name: /^Cruise control/ });
      const speed = page.locator(".speedometer > strong");
      const speedInput = page.getByLabel("Set speed (km/h)");
      await expect(cruise).toBeInViewport({ ratio: 1 });
      await cruise.click();
      await speedInput.focus();
      await page.keyboard.down("ArrowUp");
      await advance(page, 200);
      await page.keyboard.up("ArrowUp");
      await expect(speed).toHaveText("0");
      await speedInput.fill("9");
      await expect(page.getByRole("button", { name: "SET CRUISE", exact: true })).toBeDisabled();
      await speedInput.fill("20");
      await page.getByRole("button", { name: "SET CRUISE", exact: true }).click();
      await expect(cruise).toContainText("20");
      await advance(page, 8000);
      expect(Math.abs(Number(await speed.textContent()) - 20)).toBeLessThanOrEqual(1);
      await advance(page, 1500);
      expect(Math.abs(Number(await speed.textContent()) - 20)).toBeLessThanOrEqual(1);
      const cdp = await context.newCDPSession(page);
      const gas = mobile ? (await page.getByRole("button", { name: "Accelerate", exact: true }).boundingBox())! : null;
      if (gas) await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ id: 1, x: gas.x + gas.width / 2, y: gas.y + gas.height / 2 }] });
      else await page.keyboard.down("w");
      await advance(page, 1000);
      expect(Number(await speed.textContent())).toBeGreaterThan(22);
      await expect(cruise).toContainText("20");
      if (gas) await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      else await page.keyboard.up("w");
      await advance(page, 8000);
      expect(Math.abs(Number(await speed.textContent()) - 20)).toBeLessThanOrEqual(1);
      await expect(cruise).toContainText("20");
      await cruise.click();
      await page.screenshot({ path: info.outputPath("cruise-settings.png") });
      await page.getByRole("button", { name: "USE CURRENT", exact: true }).click();
      await expect(speedInput).toHaveValue((await speed.textContent())!);
      await page.getByRole("button", { name: "CANCEL CRUISE", exact: true }).click();
      await expect(cruise).toContainText("OFF");
      await cruise.click();
      await speedInput.press("Escape");
      await expect(page.getByRole("form", { name: "Cruise control settings" })).toHaveCount(0);
      await expect(page.locator(".arcade-shell.mode-playing")).toBeVisible();
      await expect(cruise).toBeFocused();
      await cruise.click();
      await speedInput.fill("20");
      await page.getByRole("button", { name: "SET CRUISE", exact: true }).click();
      if (mobile) {
        const brake = (await page.getByRole("button", { name: "Brake or reverse", exact: true }).boundingBox())!;
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ id: 2, x: brake.x + brake.width / 2, y: brake.y + brake.height / 2 }] });
        await advance(page, 200);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      } else {
        await page.keyboard.down("s");
        await advance(page, 200);
        await page.keyboard.up("s");
      }
      await expect(cruise).toContainText("OFF");
      expect((await diagnostics(page)).cruiseControl).toBeNull();
      expect(errors).toEqual([]);
    });
  });
}
