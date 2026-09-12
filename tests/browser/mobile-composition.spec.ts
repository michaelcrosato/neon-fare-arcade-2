import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { openScenePage } from "./scene-page";
import { WEBGPU_TEST_OPTIONS } from "./browser-options";
import type {} from "./fixtures/mobile-composition-scene";

test.use({ ...WEBGPU_TEST_OPTIONS, contextOptions: { hasTouch: true, isMobile: true, reducedMotion: "reduce" } });
test.setTimeout(120_000);
let bundle: string;
test.beforeAll(async () => {
  bundle = (await build({ entryPoints: ["tests/browser/fixtures/mobile-composition-scene.tsx"], bundle: true,
    write: false, format: "iife", platform: "browser", target: "es2022", tsconfig: "tsconfig.json" })).outputFiles[0].text;
});

for (const backend of ["WebGPU", "Canvas 2D"] as const) {
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 568, height: 320 }]) {
    test.describe(backend + " " + viewport.width + "x" + viewport.height, () => {
      test.use({ viewport });
      test("every mobile camera zoom keeps the cab, arrow and fare banner separated", async ({ page }, info) => {
        const errors: string[] = [];
        page.on("pageerror", error => errors.push(error.message));
        page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
        if (backend === "Canvas 2D") await page.addInitScript(() => Object.defineProperty(navigator, "gpu", { value: undefined, configurable: true }));
        await openScenePage(page, bundle);
        for (const mode of ["chase-low", "chase-high", "fixed"] as const) {
          for (const scale of [1, 2, 4, 8] as const) {
            for (const phase of ["pickup", "dropoff"] as const) {
              const result = await page.evaluate(args => window.mobileComposition.render(...args), [mode, scale, phase, backend] as const);
              expect(result.backend).toBe(backend);
              expect(result.failed).toBe(false);
              expect(result.centerBeacons).toBe(0);
              expect(result.pickups).toBe(phase === "pickup" ? 0 : 5);
              expect(result.cab).not.toBeNull();
              if (mode !== "fixed") expect(result.cab!.y / result.height).toBeCloseTo(.75, 4);
              const card = (await page.locator(".fare-impact__sequence").boundingBox())!;
              expect(card.y).toBeLessThanOrEqual(8);
              expect(card.y + card.height).toBeLessThan(viewport.height * .25);
              const badge = page.locator(".navigation-distance");
              if (await badge.isVisible()) {
                const arrowLabel = (await badge.boundingBox())!;
                expect(card.y + card.height).toBeLessThan(arrowLabel.y);
              }
              expect(card.y + card.height).toBeLessThan(result.cab!.y - 15);
              expect(result.arrowPoints.length).toBeGreaterThan(0);
              expect(Math.min(...result.arrowPoints.map(point => point.y))).toBeGreaterThan(card.y + card.height);
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
            expect(offset).toBeCloseTo(.25, 4);
            const card = (await page.locator(".fare-impact__sequence").boundingBox())!;
            const overlapsCard = result.arrowPoints.some(point => point.x > card.x && point.x < card.x + card.width
              && point.y > card.y && point.y < card.y + card.height);
            expect(overlapsCard, "fixed arrow remains clear at heading " + heading + ", zoom " + scale).toBe(false);
            if (scale === 4) await page.screenshot({ path: info.outputPath("fixed-heading-" + heading.toFixed(2) + ".png") });
          }
        }
        expect(errors).toEqual([]);
      });
    });
  }
}
