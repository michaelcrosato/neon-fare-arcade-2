import { expect, test } from "@playwright/test";
import { SCENE_START_TIMEOUT, SCENE_TEST_TIMEOUT, WEBGPU_TEST_OPTIONS } from "./browser-options";
import { lockSteeringIfPrompted } from "./start-helpers";

// Chromium's headless GPU adapter is opt-in. This compiles and executes the
// actual WGSL pipeline; a failed GPU activation must fail this test.
test.use(WEBGPU_TEST_OPTIONS);
test.setTimeout(SCENE_TEST_TIMEOUT);

for (const renderer of ["WebGPU", "Canvas 2D"] as const) {
  test.describe(renderer, () => {
    test("swept roads render in every driving camera and preserve walking", async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
      page.on("response", (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
      await page.addInitScript((fallback) => {
        localStorage.setItem("neon-fare-camera-v1", "fixed");
        if (fallback) Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined });
      }, renderer === "Canvas 2D");
      await page.goto("/");
      await expect(page.getByText(renderer === "WebGPU" ? "WEBGPU ACTIVE" : "CANVAS FALLBACK", { exact: true })).toBeVisible({ timeout: SCENE_START_TIMEOUT });
      await page.getByRole("button", { name: /Start Free Run with arcade/i }).click();
      await page.getByRole("button", { name: /Choose STREET ACE/i }).click();
      await lockSteeringIfPrompted(page);
      await expect(page.getByRole("button", { name: "Pause game" })).toBeVisible({ timeout: SCENE_START_TIMEOUT });
      const canvas = page.locator(".game-canvas").nth(renderer === "WebGPU" ? 1 : 0);
      for (const mode of ["FIXED ISO", "CHASE HIGH", "CHASE LOW", "CAB VIEW"]) {
        await expect(page.getByRole("button", { name: `Camera: ${mode}. Activate to switch camera.` })).toBeVisible();
        await expect(canvas).toHaveAttribute("aria-hidden", "false");
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        await page.screenshot({ path: testInfo.outputPath(`${mode.toLowerCase().replaceAll(" ", "-")}.png`) });
        if (mode !== "CAB VIEW") await page.keyboard.press("c");
      }
      await page.getByRole("button", { name: /EXIT TAXI/i }).click();
      await expect(page.getByLabel("On-foot controls")).toBeVisible();
      await expect(canvas).toHaveAttribute("aria-hidden", "false");
      expect(errors, "renderer activation, WGSL, resource and frame errors").toEqual([]);
    });
  });
}
