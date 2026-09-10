import { expect, type Page } from "@playwright/test";
import { SCENE_START_TIMEOUT } from "./browser-options";

// Preserve the real app's styles, then unload its continuously animated menu.
// Renderer fixtures own their game and GPU device; drawing a second world behind
// them makes software-GPU screenshots compete with an unrelated animation loop.
// road-renderers.spec.ts separately checks the unmodified app and its lifecycle.
export async function openScenePage(page: Page, bundle: string) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Start Free Run with arcade/i })).toBeEnabled({ timeout: SCENE_START_TIMEOUT });
  const styles = await page.locator('style, link[rel="stylesheet"]').evaluateAll((nodes) =>
    nodes.map((node) => node.outerHTML).join("\n"));
  await page.route("**/__renderer-fixture", (route) => route.fulfill({
    status: 200,
    contentType: "text/html",
    body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,"><title>Renderer fixture</title>${styles}</head><body></body></html>`,
  }), { times: 1 });
  await page.goto("/__renderer-fixture");
  await page.addScriptTag({ content: bundle });
}
