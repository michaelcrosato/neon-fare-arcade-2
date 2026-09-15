import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import { openScenePage } from "./scene-page";
import { SCENE_TEST_TIMEOUT, WEBGPU_TEST_OPTIONS } from "./browser-options";
import type {} from "./fixtures/mobile-composition-scene";

test.use(WEBGPU_TEST_OPTIONS);
test.setTimeout(Math.max(120_000, SCENE_TEST_TIMEOUT * 5));
let bundle: string;
test.beforeAll(async () => {
  bundle = (await build({ entryPoints: ["tests/browser/fixtures/mobile-composition-scene.tsx"], bundle: true,
    write: false, format: "iife", platform: "browser", target: "es2022", tsconfig: "tsconfig.json" })).outputFiles[0].text;
});

async function checkImpact(page: Page, result: Awaited<ReturnType<Window["mobileComposition"]["render"]>>) {
  const stage = (await page.locator(".game-canvas").boundingBox())!;
  const card = (await page.locator(".fare-impact__sequence").boundingBox())!;
  expect(card.y).toBeCloseTo(stage.y + 8, 0);
  expect(card.x + card.width / 2).toBeCloseTo(stage.x + stage.width / 2, 0);
  expect(card.x).toBeGreaterThanOrEqual(stage.x + 11);
  expect(card.x + card.width).toBeLessThanOrEqual(stage.x + stage.width - 11);
  expect(card.height).toBeGreaterThan(80);
  expect(card.height).toBeLessThanOrEqual((stage.height - 16) * .3);
  await expect(page.locator(".fare-impact")).toHaveAttribute("data-layout", "wide");
  if (!await page.evaluate(() => matchMedia("(max-width: 820px), (pointer: coarse)").matches)) {
    expect(card.width).toBeCloseTo((stage.width - 24) / 2, 0);
  }
  await expect(page.locator(".fare-impact__copy > strong")).toBeVisible();
  const overflow = await page.locator(".fare-impact__copy").evaluate(element => element.scrollHeight > element.clientHeight + 2);
  expect(overflow, `copy must fit: ${JSON.stringify(result.layout)}`).toBe(false);
  return card;
}

for (const backend of ["WebGPU", "Canvas 2D"] as const) test.describe(`${backend} resizing`, () => {
  test.use({ contextOptions: { hasTouch: true, isMobile: true, reducedMotion: "reduce" } });
  test("long fare copy stays readable through phone rotation and tablet resizing", async ({ page }, info) => {
    if (backend === "Canvas 2D") await page.addInitScript(() => Object.defineProperty(navigator, "gpu", { value: undefined, configurable: true }));
    await openScenePage(page, bundle);
    for (const viewport of [{ width: 320, height: 568 }, { width: 568, height: 320 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }]) {
      await page.setViewportSize(viewport);
      for (const mode of ["chase-low", "fixed", "cab"] as const) {
        const result = await page.evaluate(args => window.mobileComposition.render(...args), [mode, 1, "pickup", backend] as const);
        await page.locator(".fare-impact__copy > strong").evaluate(element => { element.textContent = "ESTRELLA IN!"; });
        await page.locator(".fare-impact__route span").evaluate(element => { element.textContent = "TIMBER PASS GAS & GENERAL"; });
        await page.locator(".fare-card-occasion").evaluate(element => { element.textContent = "GENERAL-STORE ERRAND"; });
        await checkImpact(page, result);
        if (mode === "chase-low") await page.screenshot({ path: info.outputPath(`${viewport.width}x${viewport.height}-long-copy.png`) });
      }
    }
  });
});

for (const backend of ["WebGPU", "Canvas 2D"] as const) {
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 568, height: 320 },
    { width: 1280, height: 800 }, { width: 1920, height: 1080 }]) {
    const mobile = viewport.width < 1000;
    test.describe(backend + " " + viewport.width + "x" + viewport.height, () => {
      test.use({ viewport, contextOptions: { hasTouch: mobile, isMobile: mobile, reducedMotion: "reduce" } });
      test("fare card frame stays fixed across cameras, zoom, headings and pickup/dropoff", async ({ page }, info) => {
        const errors: string[] = [];
        page.on("pageerror", error => errors.push(error.message));
        page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
        if (backend === "Canvas 2D") await page.addInitScript(() => Object.defineProperty(navigator, "gpu", { value: undefined, configurable: true }));
        await openScenePage(page, bundle);
        let stableCard: { x: number; y: number; width: number; height: number } | undefined;
        for (const mode of ["chase-low", "chase-high", "fixed", "cab"] as const) {
          for (const scale of [1, 2, 4, 8] as const) {
            if (mode === "cab" && scale !== 1) continue;
            for (const phase of ["pickup", "dropoff"] as const) {
              const result = await page.evaluate(args => window.mobileComposition.render(...args), [mode, scale, phase, backend] as const);
              expect(result.backend).toBe(backend);
              expect(result.failed).toBe(false);
              expect(result.centerBeacons).toBe(0);
              expect(result.pickups).toBe(phase === "pickup" ? 0 : 5);
              if (mode !== "cab") expect(result.cab).not.toBeNull();
              if (mobile && mode.startsWith("chase")) expect(result.cab!.y / result.height).toBeCloseTo(.75, 4);
              const card = await checkImpact(page, result);
              stableCard ??= card;
              expect(card).toEqual(stableCard);
              expect(result.arrowPoints.length).toBeGreaterThan(0);
              if (phase === "dropoff") await page.screenshot({ path: info.outputPath(mode + "-" + scale + "x.png") });
            }
          }
        }
        // Fixed ISO also reserves space when driving across or down the screen.
        for (const heading of [0, Math.PI / 2, Math.PI, Math.PI / 4]) {
          for (const scale of [1, 2, 4, 8] as const) {
            const result = await page.evaluate(args => window.mobileComposition.render(...args), ["fixed", scale, "dropoff", backend, heading] as const);
            expect(result.cab).not.toBeNull();
            const offset = Math.max(Math.abs(result.cab!.x / result.width - .5), Math.abs(result.cab!.y / result.height - .5));
            if (mobile) expect(offset).toBeCloseTo(.25, 4);
            expect(await checkImpact(page, result)).toEqual(stableCard);
            if (scale === 4) await page.screenshot({ path: info.outputPath("fixed-heading-" + heading.toFixed(2) + ".png") });
          }
        }
        expect(errors).toEqual([]);
      });
    });
  }
}
