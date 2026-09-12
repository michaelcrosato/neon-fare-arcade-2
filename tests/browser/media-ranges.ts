import type { Page } from "@playwright/test";

/** Match production byte-range serving for native media seeking in Worker preview. */
export async function installMediaRanges(page: Page) {
  await page.route("**/music/*.mp3", async route => {
    const response = await route.fetch();
    // Next/Vercel already serves ranges. Worker preview currently sends the
    // complete file with 200, which prevents Chromium from seeking to its end.
    if (response.status() !== 200) return route.fulfill({ response });
    const headers = { ...response.headers(), "accept-ranges": "bytes" };
    const range = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers().range ?? "");
    if (!range) return route.fulfill({ response, headers });
    const bytes = await response.body();
    const start = Number(range[1]);
    const end = Math.min(range[2] ? Number(range[2]) : bytes.length - 1, bytes.length - 1);
    if (start > end) return route.fulfill({
      status: 416, headers: { "content-range": `bytes */${bytes.length}` }, body: "",
    });
    const body = bytes.subarray(start, end + 1);
    await route.fulfill({
      response, status: 206, body,
      headers: {
        ...headers,
        "content-range": `bytes ${start}-${end}/${bytes.length}`,
        "content-length": String(body.length),
      },
    });
  });
}
