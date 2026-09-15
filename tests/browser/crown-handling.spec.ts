import { expect, test, type Page } from "@playwright/test";
import { WEBGPU_TEST_OPTIONS } from "./browser-options";
import { confirmVehicle, lockSteeringIfPrompted } from "./start-helpers";
import type { DiagnosticsSnapshot } from "../../app/runtime/diagnostics";

test.use(WEBGPU_TEST_OPTIONS);
test.setTimeout(120_000);

async function advance(page: Page, milliseconds: number) {
  for (let elapsed = 0; elapsed < milliseconds; elapsed += 50) await page.clock.fastForward(50);
}

for (const mobile of [false, true]) test.describe(mobile ? "touch Crown handling" : "keyboard Crown handling", () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 960 },
    contextOptions: { hasTouch: mobile, isMobile: mobile, reducedMotion: "reduce" } });
  for (const renderer of ["WebGPU", "Canvas 2D"] as const) {
    for (const kind of mobile ? ["free-run"] as const : ["timed", "free-run"] as const) {
      test(`${renderer} ${kind}: straight acceleration, brake turn and settled stop`, async ({ page, context }, info) => {
        const errors: string[] = [];
        page.on("pageerror", error => errors.push(error.message));
        page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
        await page.clock.install({ time: new Date("2026-09-14T00:00:00Z") });
        await page.addInitScript(renderer => {
          if (renderer === "Canvas 2D") Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined });
          const original = crypto.getRandomValues.bind(crypto);
          Object.defineProperty(crypto, "getRandomValues", { value: (array: Uint32Array) => {
            const result = original(array);
            if (array instanceof Uint32Array && array.length === 1) array[0] = 12;
            return result;
          } });
        }, renderer);
        await page.goto("/?diagnostics=1");
        await expect(page.locator(".game-canvas").nth(renderer === "WebGPU" ? 1 : 0)).toHaveClass(/is-active/, { timeout: 30_000 });
        await page.getByRole("button", { name: kind === "timed" ? /Start an Arcade Shift/ : /Start Free Run with arcade/ }).click();
        await page.clock.pauseAt(new Date("2026-09-14T01:00:00Z"));
        await expect(page.getByRole("button", { name: "Select Crown Cab ’96", exact: true })).toHaveAttribute("aria-pressed", "true");
        await confirmVehicle(page);
        await page.getByRole("button", { name: /Choose STREET ACE/ }).click();
        await lockSteeringIfPrompted(page);
        await page.clock.fastForward(3500); await page.clock.runFor(100);
        await expect(page.locator(".arcade-shell.mode-playing")).toBeVisible();
        const cdp = await context.newCDPSession(page);
        const speed = page.locator(mobile ? ".mobile-speed > strong" : ".speedometer strong");
        if (mobile) {
          const gas = (await page.getByRole("button", { name: "Accelerate", exact: true }).boundingBox())!;
          await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: gas.x + gas.width / 2, y: gas.y + gas.height / 2, id: 1 }] });
        } else await page.keyboard.down("w");
        await advance(page, 2000);
        if (mobile) await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        else await page.keyboard.up("w");
        await advance(page, 400);
        expect(Number(await speed.textContent())).toBeGreaterThan(90);
        expect(Number(await speed.textContent())).toBeLessThan(130);

        if (mobile) {
          const brake = (await page.getByRole("button", { name: "Brake or reverse", exact: true }).boundingBox())!;
          const thumb = { x: 85, y: 240, id: 2 };
          await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [thumb] });
          thumb.x += 62;
          await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [thumb] });
          await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [thumb,
            { x: brake.x + brake.width / 2, y: brake.y + brake.height / 2, id: 3 }] });
        } else {
          await page.keyboard.down("d"); await page.keyboard.down("s");
        }
        await advance(page, 400);
        await page.screenshot({ path: info.outputPath("braking-slide.png") });
        await advance(page, 500);
        if (mobile) await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        else { await page.keyboard.up("s"); await page.keyboard.up("d"); }
        await advance(page, 400);
        await page.getByRole("button", { name: "Pause game", exact: true }).click();
        await page.getByRole("button", { name: "COPY DIAGNOSTICS", exact: true }).click();
        const report: DiagnosticsSnapshot = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
        await info.attach("driving-diagnostics", { body: JSON.stringify(report), contentType: "application/json" });
        const game = report.currentGame;
        const ticks = report.trace.segments.flatMap(segment => segment.ticks);
        expect(report.runtime.renderer).toBe(renderer);
        expect(report.recentErrors).toEqual([]);
        expect(game.vehicleId).toBe("crown-cab");
        expect(game.runKind).toBe(kind);
        expect(ticks.flatMap(tick => tick.events).filter(event => event.type === "brake-drift-kick")).toHaveLength(1);
        expect(ticks.some(tick => (tick.inputMask & 2) !== 0 && (mobile ? tick.steer === 1 : (tick.inputMask & 8) !== 0))).toBe(true);
        expect(game.stunts.drift.totalMeters).toBeGreaterThan(10);
        expect(game.stunts.drift.score + game.stunts.drift.lastScore).toBeGreaterThan(0);
        expect(game.speed * 3.1).toBeLessThan(10);
        expect(Math.abs(game.arcadeVehicle.yawRate)).toBeLessThan(0.1);
        await page.screenshot({ path: info.outputPath("stopped.png") });
        expect(errors).toEqual([]);
      });
    }
  }
});
