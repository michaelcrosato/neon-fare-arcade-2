import { expect, test } from "@playwright/test";
import { SCENE_START_TIMEOUT, SCENE_TEST_TIMEOUT, WEBGPU_TEST_OPTIONS } from "./browser-options";
import { confirmVehicle, lockSteeringIfPrompted } from "./start-helpers";

test.use(WEBGPU_TEST_OPTIONS);
test.setTimeout(Math.max(120_000, SCENE_TEST_TIMEOUT * 5));

for (const renderer of ["WebGPU", "Canvas 2D"] as const) test(`${renderer} updates the horizon throughout an actual regional playtest`, async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  if (renderer === "Canvas 2D") await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install({ time: new Date("2026-09-12T00:00:00Z") });
  await page.addInitScript(fallback => {
    localStorage.setItem("neon-fare-camera-v1", "chase-low");
    if (fallback) Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined });
  }, renderer === "Canvas 2D");
  await page.goto("/?diagnostics=1");
  const canvas = page.locator(".game-canvas").nth(renderer === "WebGPU" ? 1 : 0);
  await expect(canvas).toHaveClass(/is-active/, { timeout: SCENE_START_TIMEOUT });
  await page.getByRole("button", { name: /Start Free Run with arcade/ }).click();
  await confirmVehicle(page);
  await page.clock.pauseAt(new Date("2026-09-12T01:00:00Z"));
  await page.getByRole("button", { name: /Choose STREET ACE/ }).click();
  await lockSteeringIfPrompted(page);
  await page.clock.fastForward(3500); await page.clock.runFor(100);
  await expect(canvas).toHaveAttribute("data-horizon-region", "city-center");
  for (const [landmark, region] of [["maple-commons", "cedar-vale"], ["northstar-village-square", "northstar-range"],
    ["sundown-gate", "copper-mesa"], ["gulfwatch-station", "cypress-reach"], ["solana-pier", "solana-coast"],
    ["ironwake-gate", "ironwake-works"], ["pulse-stadium", "city-center"]]) {
    await page.getByRole("button", { name: "Pause game" }).click();
    await page.getByRole("button", { name: "OPTIONS · DEV MODE", exact: true }).click();
    await page.getByRole("checkbox", { name: /DEV MODE/ }).check();
    await page.getByRole("button", { name: "CLEAR ACTIVE TRAFFIC", exact: true }).click();
    await page.getByRole("combobox", { name: "Landmark", exact: true }).selectOption(landmark);
    await page.getByRole("button", { name: "LOAD TEST FARE", exact: true }).click();
    await page.getByRole("button", { name: "JUMP TO DROPOFF", exact: true }).click();
    await page.getByRole("button", { name: "CLOSE OPTIONS", exact: true }).click();
    await page.getByRole("button", { name: "RESUME FREE RUN", exact: true }).click();
    await page.clock.fastForward(3500); await page.clock.runFor(100);
    await expect(canvas).toHaveAttribute("data-horizon-region", region);
    await expect(canvas).toHaveClass(/is-active/);
    await page.screenshot({ path: info.outputPath(`${region}.png`) });
  }
  expect(errors).toEqual([]);
});
