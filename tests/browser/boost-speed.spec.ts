import { expect, test } from "@playwright/test";
import { SCENE_START_TIMEOUT, SCENE_TEST_TIMEOUT, WEBGPU_TEST_OPTIONS } from "./browser-options";
import { lockSteeringIfPrompted } from "./start-helpers";

test.use(WEBGPU_TEST_OPTIONS);
test.setTimeout(Math.max(90_000, SCENE_TEST_TIMEOUT * 2));

for (const renderer of ["WebGPU", "Canvas"] as const) {
  for (const trait of [{ name: "STREET ACE", normal: 160 }, { name: "REDLINE RUSH", normal: 165 }]) {
    test(`${renderer} ${trait.name} reaches double cruising speed with real boost input`, async ({ page }, info) => {
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
      await page.clock.install({ time: new Date("2026-09-12T00:00:00Z") });
      if (renderer === "Canvas") await page.addInitScript(() => Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined }));
      await page.goto("/?diagnostics=1");
      await expect(page.locator(".game-canvas").nth(renderer === "WebGPU" ? 1 : 0)).toHaveClass(/is-active/, { timeout: 30_000 });
      await page.getByRole("button", { name: /Start Free Run with arcade/ }).click();
      await page.getByRole("button", { name: new RegExp(`Choose ${trait.name}`) }).click();
      await lockSteeringIfPrompted(page);
      await expect(page.getByRole("button", { name: "Pause game" })).toBeEnabled({ timeout: Math.max(20_000, SCENE_START_TIMEOUT) });

      // Clear traffic through the supported playtest UI; leave boost reserve finite.
      // Hold rendered frames during setup so software WebGPU does not starve
      // the options controls. Resume the clock for the real driving input.
      await page.clock.pauseAt(new Date("2026-09-12T01:00:00Z"));
      await page.getByRole("button", { name: "Pause game" }).click();
      await page.getByRole("button", { name: "OPTIONS · DEV MODE", exact: true }).click();
      const options = page.getByRole("dialog", { name: "OPTIONS", exact: true });
      await options.getByRole("checkbox", { name: /DEV MODE/ }).check();
      await expect(options.getByLabel("Unlimited arcade boost")).not.toBeChecked();
      await options.getByRole("button", { name: "CLEAR ACTIVE TRAFFIC" }).click();
      await page.getByRole("button", { name: "CLOSE OPTIONS", exact: true }).click();
      await page.getByRole("button", { name: "RESUME FREE RUN", exact: true }).click();
      await page.clock.resume();
      const speed = page.locator(".speedometer > strong");
      await page.keyboard.down("w");
      try {
        await expect(speed).toHaveText(String(trait.normal), { timeout: Math.max(25_000, SCENE_START_TIMEOUT) });
        await page.keyboard.down("Space");
        // The finite starter tank holds top speed briefly. Observe every
        // presented frame instead of missing it between locator retry delays.
        await page.waitForFunction(expected =>
          document.querySelector(".speedometer > strong")?.textContent === String(expected)
            && document.querySelector(".game-stage")?.classList.contains("is-boosting"),
        trait.normal * 2, { timeout: Math.max(20_000, SCENE_START_TIMEOUT), polling: "raf" });
        await page.screenshot({ path: info.outputPath("double-speed-boost.png") });
      } finally {
        await page.keyboard.up("Space");
        await page.keyboard.up("w");
      }
      await expect.poll(async () => Number(await speed.textContent())).toBeLessThanOrEqual(trait.normal);
      expect(errors).toEqual([]);
    });
  }
}
