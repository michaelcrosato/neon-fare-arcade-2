import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { WEBGPU_TEST_OPTIONS } from "./browser-options";
import { openScenePage } from "./scene-page";
import { confirmVehicle, lockSteeringIfPrompted } from "./start-helpers";
import type {} from "./fixtures/navigation-lab-scene";

test.use(WEBGPU_TEST_OPTIONS);
test.setTimeout(90_000);

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
  test(`navigation controls persist, copy and reset independently of Dev Mode at ${viewport.width}px`, async ({ page }, info) => {
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize(viewport);
    await page.addInitScript(() => Object.defineProperty(navigator, "gpu", { value: undefined, configurable: true }));
    await page.clock.install(); await page.goto("/");
    const open = async () => {
      await page.getByRole("button", { name: "OPTIONS", exact: true }).click();
      await page.getByRole("button", { name: /^GAME OPTIONS/ }).click();
      await page.getByRole("tab", { name: "NAVIGATION LAB", exact: true }).click();
    };
    await open();
    const lab = page.getByRole("tabpanel", { name: "Navigation Lab" });
    await lab.getByRole("button", { name: /^RED DESTINATION/ }).click();
    await expect(lab.getByLabel("Show cab arrow", { exact: true })).toHaveValue("destination");
    await expect(lab.getByLabel("Arrow points toward", { exact: true })).toHaveValue("destination");
    await expect(lab.getByLabel("Ground route style", { exact: true })).toHaveValue("both");
    await lab.getByLabel("Recalculate the GPS route", { exact: true }).selectOption("locked");
    await lab.getByLabel("Reroute distance (m)", { exact: true }).fill("500");
    await lab.getByLabel("Column opacity", { exact: true }).focus();
    await lab.getByLabel("Column opacity", { exact: true }).press("ArrowRight");
    await lab.getByLabel("Show live navigation diagnostics", { exact: true }).check();
    for (const control of await lab.locator("select, input").all()) {
      await control.scrollIntoViewIfNeeded();
      const bounds = (await control.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    }
    await lab.getByRole("button", { name: "COPY TEST SETUP" }).click();
    await expect(lab.getByRole("status")).toContainText("Setup copied");
    const copied = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
    expect(copied.settings).toMatchObject({ arrowVisibility: "destination", arrowTarget: "destination", corridorOpacity: .13, rerouteMode: "locked" });
    await page.getByRole("tab", { name: "DEV TOOLS" }).click();
    await expect(page.getByRole("checkbox", { name: /DEV MODE/ })).not.toBeChecked();
    await page.reload(); await open();
    await expect(lab.getByLabel("Reroute distance (m)", { exact: true })).toHaveValue("500");
    await expect(lab.getByLabel("Show cab arrow", { exact: true })).toHaveValue("destination");
    await lab.getByLabel("Show cab arrow", { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("navigation-controls.png") });
    await lab.getByRole("button", { name: "CLOSE OPTIONS", exact: true }).click();
    await page.getByRole("button", { name: "BACK TO MENU", exact: true }).click();
    await page.getByRole("button", { name: /Start Free Run with arcade/ }).click(); await confirmVehicle(page);
    await page.getByRole("button", { name: /Choose STREET ACE/ }).click(); await lockSteeringIfPrompted(page);
    await page.clock.fastForward(3600); await page.clock.runFor(100);
    await expect(page.getByLabel("Live GPS diagnostics")).toContainText("HOLD ROUTE");
    await expect(page.getByLabel("Live GPS diagnostics")).toContainText("Reroute > 500 m");
    await expect(page.locator(".development-playtest-badge")).toHaveCount(0);
    await page.getByRole("button", { name: "Pause game", exact: true }).click();
    await page.getByRole("button", { name: /^GAME OPTIONS/ }).click();
    await page.getByRole("tab", { name: "NAVIGATION LAB" }).click();
    await lab.getByRole("button", { name: "RESET NAVIGATION" }).click();
    await expect(lab.getByLabel("Show cab arrow", { exact: true })).toHaveValue("contextual");
    await expect(lab.getByLabel("Ground route style", { exact: true })).toHaveValue("dashes");
    await expect(lab.getByLabel("Show live navigation diagnostics", { exact: true })).not.toBeChecked();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "OPTIONS", exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

for (const renderer of ["WebGPU", "Canvas 2D"] as const) for (const mobile of [false, true]) {
  test(`${renderer} renders vertical red dashes and destination bearing in all cameras at ${mobile ? "mobile" : "desktop"} size`, async ({ page }, info) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 });
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    const bundle = await build({ entryPoints: ["tests/browser/fixtures/navigation-lab-scene.ts"], bundle: true, write: false, platform: "browser", format: "iife", logLevel: "silent" });
    await openScenePage(page, bundle.outputFiles[0].text);
    expect(await page.evaluate(renderer => window.navigationLabScene.mount(renderer), renderer)).toBe(renderer);
    for (const mode of ["fixed", "chase-high", "chase-low", "cab"] as const) {
      const result = await page.evaluate(mode => window.navigationLabScene.draw(mode), mode);
      expect(result.columns).toBeGreaterThan(0); expect(result.total).toBeLessThanOrEqual(120);
      expect(result.offRoute).toBe(true); expect(result.arrow).toBe(13); expect(result.yaw).toBeCloseTo(result.expectedYaw, 8);
      await page.screenshot({ path: info.outputPath(`vertical-dots-${mode}.png`) });
      expect((await page.evaluate(mode => window.navigationLabScene.draw(mode, {}, false), mode)).columns).toBe(0);
      expect((await page.evaluate(mode => window.navigationLabScene.draw(mode, { arrowVisibility: "off", routeStyle: "off" }), mode)).total).toBe(0);
    }
    expect(errors).toEqual([]);
  });
}
