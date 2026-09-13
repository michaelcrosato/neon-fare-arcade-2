import { expect, test, type Page } from "@playwright/test";
import { confirmVehicle, lockSteeringIfPrompted } from "./start-helpers";
import type { Game } from "../../game/model";

test.setTimeout(90_000);

async function advance(page: Page, milliseconds: number) {
  for (let elapsed = 0; elapsed < milliseconds; elapsed += 50) await page.clock.fastForward(50);
}

for (const model of ["arcade", "simulation"] as const) test(`${model}: driven distance reaches the live HUD, pause and completed run`, async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.clock.install({ time: new Date("2026-09-13T00:00:00Z") });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined });
    const original = crypto.getRandomValues.bind(crypto);
    Object.defineProperty(crypto, "getRandomValues", { value: (array: Uint32Array) => {
      const result = original(array);
      if (array instanceof Uint32Array && array.length === 1) array[0] = 12;
      return result;
    } });
  });
  await page.goto("/?diagnostics=1");
  await page.getByRole("button", { name: model === "simulation" ? /^Start Simulation Free Run\. Drive/ : /Start Free Run with arcade/ }).click();
  await page.clock.pauseAt(new Date("2026-09-13T01:00:00Z"));
  await confirmVehicle(page);
  if (model === "arcade") await page.getByRole("button", { name: /Choose STREET ACE/ }).click();
  await lockSteeringIfPrompted(page);
  await page.clock.fastForward(3500); await page.clock.runFor(100);
  await expect(page.locator(".arcade-shell.mode-playing")).toBeVisible();
  // Simulation needs road speed before the parking brake can break rear grip.
  await page.keyboard.down("w"); await advance(page, model === "simulation" ? 8000 : 2000);
  await page.keyboard.down("d");
  if (model === "simulation") await page.keyboard.down("Space");
  await advance(page, model === "simulation" ? 1000 : 600);
  await page.keyboard.up("d"); await page.keyboard.up("w"); await page.keyboard.up("Space");
  await expect(page.locator(".driving-stunt--drift")).toBeVisible();
  await page.screenshot({ path: info.outputPath("live-drift.png") });
  await page.getByRole("button", { name: "Pause game", exact: true }).click();
  await page.getByRole("button", { name: "COPY DIAGNOSTICS", exact: true }).click();
  await expect(page.getByText("DIAGNOSTICS COPIED", { exact: true })).toBeVisible();
  const report = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
  const game = report.currentGame as Game;
  expect(report.recentErrors).toEqual([]);
  expect(game.stunts.drift.totalMeters).toBeGreaterThan(1);
  expect(game.transmissionMode).toBe("automatic");
  const meters = `${Math.round(game.stunts.drift.totalMeters * 10) / 10} m`;
  await expect(page.getByLabel("Run driving distances")).toContainText(meters);
  await page.getByRole("button", { name: "END FREE RUN · BANK FARE", exact: true }).click();
  await expect(page.locator(".arcade-shell.mode-ended")).toBeVisible();
  await expect(page.getByLabel("Run driving distances")).toContainText(meters);
  await page.screenshot({ path: info.outputPath("recorded-distances.png") });
});
