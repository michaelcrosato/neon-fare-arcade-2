import { expect, test, type Page } from "@playwright/test";
import { confirmVehicle, lockSteeringIfPrompted } from "./start-helpers";
import { WEBGPU_TEST_OPTIONS } from "./browser-options";

test.use({ ...WEBGPU_TEST_OPTIONS, actionTimeout: 15_000 });
test.setTimeout(90_000);
async function start(page: Page) {
  await page.getByRole("button", { name: /Start Free Run with arcade/ }).click();
  await confirmVehicle(page);
  await page.getByRole("button", { name: /Choose STREET ACE/ }).click();
  await lockSteeringIfPrompted(page);
  await page.clock.fastForward(3600); await page.clock.runFor(100);
  await expect(page.locator(".arcade-shell.mode-playing")).toBeVisible();
}
async function mapSettings(page: Page) {
  await page.getByRole("button", { name: "Pause game", exact: true }).click();
  await page.getByRole("button", { name: /^GAME OPTIONS/ }).click();
}
async function resume(page: Page) {
  await page.getByRole("button", { name: "CLOSE OPTIONS", exact: true }).click();
  await page.getByRole("button", { name: "RESUME FREE RUN", exact: true }).click();
}
const scale = (page: Page) => page.locator('.gps-panel .gps-svg g[transform^="matrix"]').first().getAttribute("transform");

test("map panel size and geographic zoom work independently, persist and fit compact desktop screens", async ({ page }, info) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.clock.install(); await page.goto("/"); await start(page);
  const map = page.locator(".gps-panel");
  const original = (await map.boundingBox())!, originalScale = await scale(page);
  await mapSettings(page);
  const size = page.getByRole("combobox", { name: "Mini-map size", exact: true });
  const zoom = page.getByRole("combobox", { name: "Mini-map zoom", exact: true });
  await expect(size).toHaveValue("1"); await expect(zoom).toHaveValue("1");
  await size.selectOption("1.5"); await resume(page);
  expect((await map.boundingBox())!.width / original.width).toBeCloseTo(1.5, 1);
  expect(await scale(page)).toBe(originalScale);
  const enlarged = (await map.boundingBox())!;
  await mapSettings(page); await zoom.selectOption("0.5"); await resume(page);
  expect((await map.boundingBox())!.width).toBeCloseTo(enlarged.width, 1);
  const zoomed = await scale(page);
  expect(zoomed).not.toBe(originalScale);
  const matrix = (text: string | null) => text!.slice(7, -1).split(" ").map(Number);
  matrix(zoomed).forEach((value, index) => expect(value).toBeCloseTo(matrix(originalScale)[index] / 2, 4));
  await page.screenshot({ path: info.outputPath("larger-map-wider-area.png") });
  await mapSettings(page); await size.selectOption("2"); await resume(page);
  for (const viewport of [{ width: 1920, height: 1080 }, { width: 1024, height: 720 }, { width: 821, height: 600 }]) {
    await page.setViewportSize(viewport);
    const mapBox = (await map.boundingBox())!, camera = (await page.locator(".navigation-rail .camera-panel").boundingBox())!;
    const score = (await page.locator(".score-card").boundingBox())!;
    expect(mapBox.x).toBeGreaterThanOrEqual(0); expect(mapBox.x + mapBox.width).toBeLessThan(score.x);
    expect(camera.y).toBeGreaterThan(mapBox.y + mapBox.height);
    expect(camera.y + camera.height).toBeLessThan(viewport.height - 100);
    await page.screenshot({ path: info.outputPath(`map-max-${viewport.width}.png`) });
  }
  await page.setViewportSize({ width: 1440, height: 960 });
  await map.click();
  const regional = page.getByRole("img", { name: /^Interactive Neon Fare regional GPS/ });
  await expect(regional).toBeVisible();
  await page.getByRole("button", { name: "ALL 9 REGIONS", exact: true }).click();
  const regionalView = await regional.getAttribute("viewBox");
  await page.reload();
  await page.getByRole("button", { name: "OPTIONS", exact: true }).click();
  await page.getByRole("button", { name: /^GAME OPTIONS/ }).click();
  await expect(size).toHaveValue("2"); await expect(zoom).toHaveValue("0.5");
  await size.selectOption("0.75"); await zoom.selectOption("2");
  await page.getByRole("button", { name: "CLOSE OPTIONS", exact: true }).click();
  await page.getByRole("button", { name: "BACK TO MENU", exact: true }).click();
  await start(page);
  expect((await map.boundingBox())!.width / original.width).toBeCloseTo(.75, 1);
  await map.click(); await page.getByRole("button", { name: "ALL 9 REGIONS", exact: true }).click();
  expect(await regional.getAttribute("viewBox")).toBe(regionalView);
  expect(errors).toEqual([]);
});

test.describe("phone map preferences", () => {
  test.use({ viewport: { width: 390, height: 844 }, contextOptions: { hasTouch: true, isMobile: true } });
  test("settings remain accessible without adding a map over the driving controls", async ({ page }, info) => {
    await page.addInitScript(() => Object.defineProperty(navigator, "gpu", { value: undefined }));
    await page.clock.install(); await page.goto("/");
    await page.getByRole("button", { name: "OPTIONS", exact: true }).click();
    await page.getByRole("button", { name: /^GAME OPTIONS/ }).click();
    const group = page.getByRole("group", { name: "MINI-MAP", exact: true });
    await group.scrollIntoViewIfNeeded();
    await expect(group).toContainText("desktop mini-map");
    for (const select of await group.getByRole("combobox").all()) {
      const box = (await select.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44); expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390); await select.selectOption("2");
    }
    await page.screenshot({ path: info.outputPath("phone-map-options.png") });
    await page.getByRole("button", { name: "CLOSE OPTIONS", exact: true }).click();
    await page.getByRole("button", { name: "BACK TO MENU", exact: true }).click();
    await start(page); await expect(page.locator(".gps-panel")).not.toBeVisible();
    await page.getByRole("button", { name: "Pause game", exact: true }).click();
    await page.getByRole("button", { name: "MAP", exact: true }).click();
    await expect(page.getByRole("img", { name: /^Interactive Neon Fare regional GPS/ })).toBeVisible();
  });
});
