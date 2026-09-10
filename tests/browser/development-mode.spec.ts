import { expect, test, type Page } from "@playwright/test";
import type { Game } from "../../game/model";
import { SCENE_START_TIMEOUT, SCENE_TEST_TIMEOUT, WEBGPU_TEST_OPTIONS } from "./browser-options";

test.use(WEBGPU_TEST_OPTIONS);
test.setTimeout(Math.max(120_000, SCENE_TEST_TIMEOUT * 3));
const gameplayTimeout = Math.max(15_000, SCENE_START_TIMEOUT);

async function startRun(page: Page) {
  await page.getByRole("button", { name: /Start Free Run with arcade/ }).click();
  await page.getByRole("button", { name: /Choose STREET ACE/ }).click();
  await expect(page.getByRole("button", { name: "Pause game" })).toBeEnabled({ timeout: gameplayTimeout });
}

async function openOptions(page: Page) {
  await page.getByRole("button", { name: "Pause game" }).click();
  await page.getByRole("button", { name: "OPTIONS · DEV MODE", exact: true }).click();
  return page.getByRole("dialog", { name: "OPTIONS", exact: true });
}

async function resume(page: Page) {
  await page.getByRole("button", { name: "CLOSE OPTIONS", exact: true }).click();
  await page.getByRole("button", { name: "RESUME FREE RUN", exact: true }).click();
}

for (const renderer of ["WebGPU", "Canvas"] as const) for (const mobile of [false, true]) {
  test(`${renderer} Dev Mode controls, landmark cards, GPS settings and playtest persistence at ${mobile ? "mobile" : "desktop"} size`, async ({ page }, info) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    if (renderer === "Canvas") await page.addInitScript(() => Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined }));
    await page.goto("/?diagnostics=1");
    await expect(page.locator(".game-canvas").nth(renderer === "WebGPU" ? 1 : 0)).toHaveClass(/is-active/, { timeout: gameplayTimeout });
    await startRun(page);
    const options = await openOptions(page);
    await options.getByRole("checkbox", { name: /DEV MODE/ }).check();
    await options.getByLabel("Reroute distance (m)").fill("600");
    await options.getByLabel("U-turn savings (m)").fill("1500");
    await options.getByLabel("Show live GPS diagnostics").check();
    await options.getByLabel("Freeze the shift clock").check();
    await options.getByLabel("Unlimited arcade boost").check();
    await options.getByRole("button", { name: "STEP ONE FRAME" }).click();
    await expect(options.getByRole("status")).toContainText("Advanced one fixed frame");
    await options.getByLabel("Game speed").selectOption("0.5");
    await options.getByLabel("Run seed").fill("12345");
    await options.getByRole("button", { name: "RESTART WITH SEED" }).click();
    await expect(options.getByRole("status")).toContainText("seed 12345");
    await options.getByLabel("Game speed").selectOption("1");
    await options.getByRole("button", { name: "REFILL BOOST" }).click();
    await expect(options.getByRole("status")).toContainText("Boost refilled");
    await options.getByRole("button", { name: "CLEAR ACTIVE TRAFFIC" }).click();
    await options.getByRole("button", { name: "RESET / UPRIGHT TAXI" }).click();
    await options.getByRole("combobox", { name: "Landmark", exact: true }).selectOption("pulse-stadium");
    await options.getByRole("combobox", { name: "Occasion", exact: true }).selectOption("1");
    await expect(options.getByRole("img", { name: /STADIUM CONCERT/ })).toHaveCSS("background-image", /fare-destinations-7.webp/);
    await options.getByRole("button", { name: "ROUTE HERE", exact: true }).click();
    await expect(options.getByRole("status")).toContainText("GPS set to");
    await options.getByRole("button", { name: "LOAD TEST FARE" }).click();
    await expect(options.getByRole("status")).toContainText("STADIUM CONCERT");
    await page.screenshot({ path: info.outputPath("destination-options.png") });
    await resume(page);
    await expect(page.getByLabel("Live GPS diagnostics")).toContainText("Reroute > 600 m · U-turn saves ≥ 1500 m");
    await expect(page.getByLabel("Live GPS diagnostics")).toContainText("PLAYTEST");
    await expect(page.locator(".navigation-distance small")).toHaveText("TO DESTINATION");
    await page.screenshot({ path: info.outputPath("gps-readout.png") });
    await openOptions(page);
    await options.getByRole("button", { name: "JUMP TO DROPOFF" }).click();
    await resume(page);
    const arrival = mobile ? page.locator(".mobile-notice.is-event").filter({ hasText: "Fare complete" }) : page.locator(".fare-impact--dropoff");
    // Software WebGPU needs enough presented frames for the normal arrival dwell.
    // Check content and visibility together before a mobile notice expires.
    await expect(arrival.locator(".fare-card-occasion").filter({ hasText: /^STADIUM CONCERT$/ })).toBeVisible({ timeout: gameplayTimeout });
    await page.screenshot({ path: info.outputPath("stadium-arrival.png") });
    await page.getByRole("button", { name: "Pause game" }).click();
    await page.getByRole("button", { name: "COPY DIAGNOSTICS", exact: true }).click();
    await expect(page.getByText("DIAGNOSTICS COPIED", { exact: true })).toBeVisible();
    const report = JSON.parse(await page.evaluate(() => navigator.clipboard.readText())) as { currentGame: Game; recentErrors: unknown[] };
    expect(report.currentGame.runSeed).toBe(12345);
    expect(report.currentGame.fareJobs).toHaveLength(6);
    expect(report.currentGame.playtest).toBe(true);
    expect(report.currentGame.deliveries).toBe(1);
    expect(report.currentGame.development?.navigation).toEqual({ rerouteDistanceMeters: 600, uTurnSavingsMeters: 1500 });
    expect(report.recentErrors).toEqual([]);

    // Inspect a real waterfront landmark from both rendering paths.
    await page.getByRole("button", { name: "OPTIONS · DEV MODE", exact: true }).click();
    await options.getByRole("combobox", { name: "Landmark", exact: true }).selectOption("mirror-lake");
    await options.getByRole("button", { name: "TELEPORT HERE", exact: true }).click();
    await expect(options.getByRole("status")).toContainText("Arrived beside");
    await resume(page);
    await page.screenshot({ path: info.outputPath("mirror-lake-world.png") });
    await page.getByRole("button", { name: "Pause game" }).click();
    await page.getByRole("button", { name: "END PLAYTEST", exact: true }).click();
    await expect(page.getByRole("heading", { name: "PLAYTEST COMPLETE!" })).toBeVisible();
    const stored = await page.evaluate(() => ({ career: JSON.parse(localStorage.getItem("neon-fare-career-v1") ?? "null"), scores: localStorage.getItem("neon-fare-runs") }));
    expect(stored.scores).toBeNull();
    expect(stored.career.bank).toBe(0);
    await page.reload();
    await startRun(page);
    await openOptions(page);
    await expect(options.getByRole("checkbox", { name: /DEV MODE/ })).toBeChecked();
    await expect(options.getByLabel("Reroute distance (m)")).toHaveValue("600");
    await expect(options.getByLabel("U-turn savings (m)")).toHaveValue("1500");
    await options.getByRole("button", { name: "RESET GPS TO 1,000 m" }).click();
    await expect(options.getByLabel("Reroute distance (m)")).toHaveValue("1000");
    await options.getByRole("checkbox", { name: /DEV MODE/ }).uncheck();
    await expect(options.getByLabel("Reroute distance (m)")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
