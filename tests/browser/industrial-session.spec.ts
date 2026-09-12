import { expect, test } from "@playwright/test";
import type { Game } from "../../game/model";
import { WEBGPU_TEST_OPTIONS } from "./browser-options";
import { lockSteeringIfPrompted, presentUntilVisible } from "./start-helpers";

test.use(WEBGPU_TEST_OPTIONS);
test.setTimeout(180_000);

for (const renderer of ["WebGPU", "Canvas"] as const) {
  test(`${renderer} real run reaches Ironwake, displays its new cards and completes a harbor fare`, async ({ page }, info) => {
    await page.setViewportSize(renderer === "Canvas" ? { width: 390, height: 844 } : { width: 1280, height: 800 });
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
    await page.clock.install({ time: new Date("2026-09-12T00:00:00Z") });
    if (renderer === "Canvas") await page.addInitScript(() => Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined }));
    await page.goto("/?diagnostics=1");
    await expect(page.locator(".game-canvas").nth(renderer === "WebGPU" ? 1 : 0)).toHaveClass(/is-active/, { timeout: 30_000 });
    await page.getByRole("button", { name: /Start Free Run with arcade/ }).click();
    await page.getByRole("button", { name: /Choose STREET ACE/ }).click();
    await lockSteeringIfPrompted(page);
    await expect(page.getByRole("button", { name: "Pause game" })).toBeEnabled({ timeout: 30_000 });
    await page.clock.pauseAt(new Date("2026-09-12T01:00:00Z"));
    await page.getByRole("button", { name: "Pause game" }).click();
    await page.getByRole("button", { name: "OPTIONS · DEV MODE", exact: true }).click();
    const options = page.getByRole("dialog", { name: "OPTIONS", exact: true });
    await options.getByRole("checkbox", { name: /DEV MODE/ }).check();
    await options.getByLabel("Freeze the shift clock").check();
    await options.getByRole("button", { name: "CLEAR ACTIVE TRAFFIC" }).click();
    for (const landmark of ["vulcan-foundry", "blackline-refinery", "ironwake-container-port", "leviathan-drydock", "magnet-salvage", "shift-change-diner"]) {
      await options.getByRole("combobox", { name: "Landmark", exact: true }).selectOption(landmark);
      await expect(options.locator(".development-art")).toHaveCSS("background-image", /fare-destinations-17.webp/);
      await options.getByRole("button", { name: "TELEPORT HERE", exact: true }).click();
      await page.clock.runFor(100);
      await expect(options.getByRole("status")).toContainText("Arrived beside");
    }
    expect(await page.evaluate(async () => {
      const images = ["/fare-destinations-17.webp", "/fare-passengers-29.webp"].map(src => {
        const image = new Image(); image.src = src;
        return image.decode().then(() => [image.naturalWidth, image.naturalHeight]);
      });
      return Promise.all(images);
    })).toEqual([[1536, 1024], [1536, 1024]]);
    await options.getByRole("combobox", { name: "Landmark", exact: true }).selectOption("ironwake-container-port");
    await options.getByRole("button", { name: "LOAD TEST FARE", exact: true }).click();
    await options.getByRole("button", { name: "JUMP TO DROPOFF", exact: true }).click();
    await page.clock.runFor(100);
    await page.screenshot({ path: info.outputPath("ironwake-destination-card.png") });
    await page.getByRole("button", { name: "CLOSE OPTIONS", exact: true }).click();
    await page.getByRole("button", { name: "RESUME FREE RUN", exact: true }).click();
    await presentUntilVisible(page, page.locator(".fare-impact--dropoff .fare-card-occasion"));
    await page.screenshot({ path: info.outputPath("ironwake-harbor-arrival.png") });
    await page.getByRole("button", { name: "Pause game" }).click();
    await page.getByRole("button", { name: "COPY DIAGNOSTICS", exact: true }).click();
    await expect(page.getByText("DIAGNOSTICS COPIED", { exact: true })).toBeVisible();
    const report = JSON.parse(await page.evaluate(() => navigator.clipboard.readText())) as { currentGame: Game; recentErrors: unknown[] };
    expect(report.currentGame.deliveries).toBe(1);
    expect(report.currentGame.x).toBeLessThan(-792);
    expect(report.currentGame.y).toBeGreaterThan(792);
    expect(report.currentGame.fareJobs).toHaveLength(6);
    expect(report.recentErrors).toEqual([]);
    expect(errors).toEqual([]);
  });
}
