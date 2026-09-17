#!/usr/bin/env node
// Frame-time harness for the WebGPU and Canvas renderers.
//
// Runs the real app in Chromium with background throttling disabled, drives a
// short scripted session per camera, and reports CPU frame time percentiles
// plus the renderer's own GPU pass timings when `timestamp-query` is available.
//
//   node scripts/render-bench.mjs [--url=http://127.0.0.1:4183] [--renderer=webgpu|canvas]
//   [--seconds=6] [--cameras=fixed,chase-high,chase-low,cab] [--headed] [--json=path]

import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";

const args = Object.fromEntries(process.argv.slice(2).map((entry) => {
  const [key, value = "true"] = entry.replace(/^--/, "").split("=");
  return [key, value];
}));

const url = args.url ?? "http://127.0.0.1:4183";
const seconds = Number(args.seconds ?? 6);
const renderer = args.renderer ?? "webgpu";
const cameras = (args.cameras ?? "chase-low,fixed,cab").split(",").filter(Boolean);

const LAUNCH_ARGS = [
  "--enable-unsafe-webgpu",
  "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding",
  "--disable-backgrounding-occluded-windows",
  "--disable-features=CalculateNativeWinOcclusion",
  // Present as fast as the renderer allows so frame time measures real cost
  // instead of the display's refresh interval.
  ...(args.vsync === "true" ? [] : ["--disable-gpu-vsync", "--disable-frame-rate-limit"]),
];

const PROBE = `
window.__bench = {
  frames: [],
  install() {
    if (this.installed) return;
    this.installed = true;
    let last = 0;
    const loop = (t) => {
      if (last) this.frames.push(t - last);
      last = t;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  },
  reset() { this.frames.length = 0; },
  stats() {
    const sorted = this.frames.slice().sort((a, b) => a - b);
    if (!sorted.length) return { frames: 0 };
    const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
    const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
    return {
      frames: sorted.length,
      fps: +(1000 / mean).toFixed(1),
      mean: +mean.toFixed(2),
      p50: +at(0.5).toFixed(2),
      p95: +at(0.95).toFixed(2),
      p99: +at(0.99).toFixed(2),
      max: +sorted[sorted.length - 1].toFixed(2),
    };
  },
};
window.__bench.install();
`;

async function holdKey(page, key, ms) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

const browser = await chromium.launch({
  channel: "chromium",
  headless: args.headed !== "true",
  args: LAUNCH_ARGS,
});
const viewport = {
  width: Number(args.width ?? 1600),
  height: Number(args.height ?? 900),
};
const context = await browser.newContext({
  viewport,
  deviceScaleFactor: Number(args.dpr ?? 1),
  ...(args.mobile === "true" ? { isMobile: true, hasTouch: true } : {}),
});
const page = await context.newPage();
if (args.cpu) {
  const session = await context.newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: Number(args.cpu) });
}

const errors = [];
page.on("pageerror", (error) => errors.push(String(error.message)));
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });

await page.addInitScript({ content: PROBE });
await page.addInitScript((useCanvas) => {
  localStorage.setItem("neon-fare-camera-v1", "chase-low");
  if (useCanvas) Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined });
}, renderer === "canvas");

await page.goto(url, { waitUntil: "domcontentloaded" });
const expected = renderer === "canvas" ? "CANVAS FALLBACK" : "WEBGPU ACTIVE";
await page.getByText(expected, { exact: true }).waitFor({ timeout: 30_000 });

await page.getByRole("button", { name: /Start Free Run with arcade/i }).click();
const garage = page.getByRole("dialog", { name: "SELECT YOUR VEHICLE", exact: true });
await garage.waitFor({ timeout: 30_000 });
await garage.locator(".vehicle-card.is-selected").getByRole("button", { name: /^Lock in / }).click();
const edge = page.getByRole("button", { name: /STREET ACE/i });
await edge.first().waitFor({ timeout: 30_000 });
await edge.first().click();
const steering = page.getByRole("button", { name: /Select DEFAULT/i });
if (await steering.count()) await steering.first().click();
await page.getByRole("button", { name: "Pause game" }).waitFor({ timeout: 30_000 });
await page.waitForTimeout(1500);

const report = { url, renderer, seconds, viewport, cpuThrottle: Number(args.cpu ?? 1), adapter: null, cameras: {}, errors: [] };
report.adapter = await page.evaluate(async () => {
  if (!navigator.gpu) return { kind: "canvas" };
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
  return adapter ? { vendor: adapter.info?.vendor, architecture: adapter.info?.architecture } : null;
});
report.surface = await page.evaluate(() => [...document.querySelectorAll("canvas")]
  .map((canvas) => ({ active: canvas.classList.contains("is-active"), width: canvas.width, height: canvas.height })));

for (const camera of cameras) {
  // Cycle to the requested camera through the same control the player uses.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const label = await page.getByRole("button", { name: /^Camera: /i }).getAttribute("aria-label");
    const active = /FIXED ISO/.test(label ?? "") ? "fixed"
      : /CHASE HIGH/.test(label ?? "") ? "chase-high"
      : /CHASE LOW/.test(label ?? "") ? "chase-low" : "cab";
    if (active === camera) break;
    await page.keyboard.press("c");
    await page.waitForTimeout(150);
  }
  await page.evaluate(() => window.__bench.reset());
  await holdKey(page, "w", seconds * 1000);
  report.cameras[camera] = await page.evaluate(() => window.__bench.stats());
  report.cameras[camera].gpu = await page.evaluate(() => window.__renderStats?.() ?? null);
}

report.errors = errors;
const json = JSON.stringify(report, null, 2);
if (args.json) writeFileSync(args.json, json);
console.log(json);

await browser.close();
if (errors.length) process.exitCode = 1;
