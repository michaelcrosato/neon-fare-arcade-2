import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import type {} from "./fixtures/home-commerce-scene";
import { openScenePage } from "./scene-page";
import { WEBGPU_TEST_OPTIONS } from "./browser-options";
import { CAREER_STORAGE_KEY } from "../../game/career";

test.use(WEBGPU_TEST_OPTIONS);
test.setTimeout(120_000);
let bundle: string;
test.beforeAll(async () => { const result = await build({ entryPoints: ["tests/browser/fixtures/home-commerce-scene.tsx"], bundle: true, write: false, platform: "browser", format: "iife", logLevel: "silent" }); bundle = result.outputFiles[0].text; });

for (const kind of ["WebGPU", "Canvas 2D"] as const) test(`${kind}: actual branded stores, showroom counters and furnished apartment render`, async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await openScenePage(page, bundle); await page.evaluate(kind => window.homeCommerceScene.mount(kind), kind);
  await expect.poll(() => page.evaluate(() => window.homeCommerceScene.state().ready)).toBe(true);
  for (const id of ["best-byte", "cost-go", "wow-mart", "i-kit", "gas"] as const) {
    await page.evaluate(id => window.homeCommerceScene.scene(id, false), id);
    await page.screenshot({ path: info.outputPath(`${id}-outside.png`) });
    await page.evaluate(id => window.homeCommerceScene.scene(id), id);
    await page.screenshot({ path: info.outputPath(`${id}-inside.png`) });
  }
  await page.evaluate(() => window.homeCommerceScene.scene("home"));
  await page.screenshot({ path: info.outputPath("starter-apartment.png") });
  expect(errors).toEqual([]);
});

for (const mobile of [false, true]) test.describe(mobile ? "touch commerce" : "desktop commerce", () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 960 }, contextOptions: { hasTouch: mobile, isMobile: mobile, reducedMotion: "reduce" } });
  test("buy, deliver, store, place and reload; refuel, decline and pay with both wallets", async ({ page }, info) => {
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(key => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ bank: 4000, owned: [] })); }, CAREER_STORAGE_KEY);
    await openScenePage(page, bundle); await page.evaluate(() => window.homeCommerceScene.mount("Canvas 2D"));
    await expect.poll(() => page.evaluate(() => window.homeCommerceScene.state().ready)).toBe(true);
    for (const id of ["best-byte", "cost-go", "wow-mart", "i-kit"] as const) {
      await page.evaluate(id => window.homeCommerceScene.scene(id), id); await page.evaluate(() => window.homeCommerceScene.counter());
      await expect(page.getByRole("heading", { name: "GOOD STUFF. YOUR PLACE." })).toBeVisible();
      if (id === "best-byte") await page.screenshot({ path: info.outputPath("shopping.png") });
      const products = page.getByRole("button", { name: /BUY \+ DELIVER/ });
      while (await products.count()) await products.first().click();
      await expect(page.getByRole("button", { name: "YOURS · DELIVERED" })).toHaveCount(4);
    }
    expect((await page.evaluate(() => window.homeCommerceScene.state())).career?.furnishings.owned).toHaveLength(16);
    await page.evaluate(() => window.homeCommerceScene.scene("home"));
    const full = (await page.evaluate(() => window.homeCommerceScene.state())).boxes;
    await page.screenshot({ path: info.outputPath("furnished-apartment.png") });
    await page.evaluate(() => window.homeCommerceScene.counter());
    const sofa = page.getByRole("article", { name: "FLOPPA SOFA", exact: true });
    await sofa.getByRole("button").click(); await expect(sofa.getByRole("button")).toHaveAttribute("aria-pressed", "false");
    expect((await page.evaluate(() => window.homeCommerceScene.state())).boxes).toBeLessThan(full);
    await sofa.getByRole("button").click(); expect((await page.evaluate(() => window.homeCommerceScene.state())).boxes).toBe(full);
    await page.screenshot({ path: info.outputPath("home-inventory.png") });
    await page.evaluate(() => window.homeCommerceScene.fuel(30, true));
    const offer = page.getByRole("region", { name: "Fuel service", exact: true });
    await expect(offer).toBeVisible();
    const gauge = page.getByRole("complementary", { name: "Vehicle fuel", exact: true });
    await expect(gauge).toBeVisible();
    if (mobile) {
      const fuelBox = (await gauge.boundingBox())!, damageBox = (await page.locator(".vehicle-damage-status").boundingBox())!;
      expect(fuelBox.y + fuelBox.height).toBeLessThanOrEqual(damageBox.y);
    }
    await page.screenshot({ path: info.outputPath("fuel-and-repairs.png") });
    if (mobile) { await page.setViewportSize({ width: 844, height: 390 }); await offer.getByRole("button", { name: /FILL TANK/ }).scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath("fuel-landscape.png") }); await page.setViewportSize({ width: 390, height: 844 }); }
    const before = (await page.evaluate(() => window.homeCommerceScene.state())).career!.bank;
    if (mobile) await offer.getByRole("button", { name: /FILL TANK/ }).click(); else await page.keyboard.press("f");
    expect(await page.evaluate(() => window.homeCommerceScene.state())).toMatchObject({ fuel: 65, fare: 0, career: { bank: before - 30 } });
    await page.evaluate(() => window.homeCommerceScene.fuel(20));
    await page.getByRole("button", { name: /NOT NOW/ }).click(); await expect(offer).toHaveCount(0);
    await page.evaluate(() => window.homeCommerceScene.leaveLot()); await page.evaluate(() => window.homeCommerceScene.fuel(20));
    await expect(offer).toBeVisible(); await offer.getByRole("button", { name: /\+5.0 L/ }).click();
    expect((await page.evaluate(() => window.homeCommerceScene.state())).fuel).toBe(25);
    await page.evaluate(() => window.homeCommerceScene.save());
    await openScenePage(page, bundle); await page.evaluate(() => window.homeCommerceScene.mount("Canvas 2D"));
    await expect.poll(() => page.evaluate(() => window.homeCommerceScene.state().ready)).toBe(true);
    expect(await page.evaluate(() => window.homeCommerceScene.state())).toMatchObject({ fuel: 25, career: { furnishings: { owned: expect.anything() } } });
    expect((await page.evaluate(() => window.homeCommerceScene.state())).furniture).toHaveLength(16);
    expect(errors).toEqual([]);
  });
});
