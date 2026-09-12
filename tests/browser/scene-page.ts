import { expect, type Page } from "@playwright/test";

// Reuse the real server-rendered styles without initializing a second game.
// Renderer fixtures own their game and GPU device; booting the full menu first
// delays software-only fixtures and competes with their renderer verification.
// road-renderers.spec.ts separately checks the unmodified app and its lifecycle.
export async function openScenePage(page: Page, bundle: string) {
  const response = await page.request.get("/");
  expect(response.ok(), "the real app serves the renderer fixture's styles").toBe(true);
  const styles = await page.evaluate((html) => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return Array.from(doc.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(node => node.outerHTML).join("\n");
  }, await response.text());
  expect(styles, "server output includes application CSS").not.toBe("");
  await page.route("**/__renderer-fixture", (route) => route.fulfill({
    status: 200,
    contentType: "text/html",
    body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,"><title>Renderer fixture</title>${styles}</head><body></body></html>`,
  }), { times: 1 });
  await page.goto("/__renderer-fixture");
  await page.addScriptTag({ content: bundle });
}
