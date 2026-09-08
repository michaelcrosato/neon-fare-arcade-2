import { expect, test, type Page } from "@playwright/test";
import { createRequire } from "node:module";

const packageInfo = createRequire(import.meta.url)("../../package.json") as { version: string };
const APP_ORIGIN = "http://127.0.0.1:4173";

let browserErrors: string[];

test.beforeEach(async ({ page }) => {
  browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.stack ?? error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`console.error: ${message.text()}`);
  });
  page.on("requestfailed", (request) => {
    if (new URL(request.url()).origin === APP_ORIGIN) {
      browserErrors.push(`requestfailed: ${request.method()} ${request.url()} · ${request.failure()?.errorText ?? "unknown"}`);
    }
  });
  page.on("response", (response) => {
    if (new URL(response.url()).origin === APP_ORIGIN && response.status() >= 400) {
      browserErrors.push(`http ${response.status()}: ${response.request().method()} ${response.url()}`);
    }
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined });
  });
});

test.afterEach(async ({}, testInfo) => {
  if (browserErrors.length) {
    await testInfo.attach("browser-errors", {
      body: browserErrors.join("\n"),
      contentType: "text/plain",
    });
  }
  expect(browserErrors, "runtime and console errors").toEqual([]);
});

async function startFreeRun(page: Page) {
  await page.goto("/?diagnostics=1");
  await expect(page.getByRole("group", { name: "Choose game mode" })).toBeVisible();
  await expect(page.getByText("CANVAS FALLBACK", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Start Free Run/i }).click();
  await expect(page.getByRole("dialog", { name: "PICK YOUR EDGE" })).toBeVisible();
  await page.getByRole("button", { name: /Choose STREET ACE/i }).click();
  await expect(page.getByRole("button", { name: "Pause game" })).toBeVisible({ timeout: 9_000 });
}

async function holdKeyUntil(page: Page, key: string, assertion: () => Promise<void>) {
  await page.keyboard.down(key);
  try {
    await assertion();
  } finally {
    await page.keyboard.up(key);
  }
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

test("free run supports exploration, GPS, driving, pause, and copyable replay diagnostics", async ({ page }) => {
  await startFreeRun(page);

  await expect(page.getByRole("button", { name: /EXIT TAXI/i })).toBeVisible();
  await holdKeyUntil(page, "e", () => expect(page.getByLabel("On-foot controls")).toBeVisible());
  await expect(page.getByRole("button", { name: /ENTER TAXI/i })).toBeVisible();
  await holdKeyUntil(page, "e", () => expect(page.getByLabel("On-foot controls")).toBeHidden());
  await expect(page.getByRole("button", { name: /EXIT TAXI/i })).toBeVisible();

  await page.keyboard.press("g");
  const gpsDialog = page.getByRole("dialog", { name: "REGIONAL GPS" });
  await expect(gpsDialog).toBeVisible();
  const map = gpsDialog.getByRole("img", { name: /Interactive Neon Fare regional GPS/i });
  await map.focus();
  await page.keyboard.press("Shift+ArrowRight");
  await expect(gpsDialog.getByRole("status", { name: "GPS pin status" })).toContainText("PIN READY");
  await page.keyboard.press("Enter");
  await expect(page.locator(".gps-header b")).toHaveText("CUSTOM ROUTE");

  await page.keyboard.down("w");
  try {
    await expect.poll(async () => Number(await page.locator(".speedometer > strong").textContent())).toBeGreaterThan(0);
  } finally {
    await page.keyboard.up("w");
  }

  await page.keyboard.press("p");
  const paused = page.getByRole("region", { name: "Game paused" });
  await expect(paused).toBeVisible();
  await paused.getByRole("button", { name: "COPY DIAGNOSTICS" }).click();
  await expect(paused.getByRole("status")).toContainText("DIAGNOSTICS COPIED");
  const diagnosticText = await page.evaluate(() => navigator.clipboard.readText());
  const diagnostics = JSON.parse(diagnosticText) as {
    schemaVersion: number;
    app: { version: string };
    runtime: { renderer: string };
    trace: { nextTick: number; segments: Array<{ ticks: unknown[] }> };
    currentGame: { customDestination: unknown };
    recentErrors: unknown[];
  };
  expect(diagnostics.schemaVersion).toBe(3);
  expect(diagnostics.app.version).toBe(packageInfo.version);
  expect(diagnostics.runtime.renderer).toBe("Canvas 2D");
  expect(diagnostics.trace.nextTick).toBeGreaterThan(0);
  expect(diagnostics.trace.segments.flatMap((segment) => segment.ticks).length).toBeGreaterThan(0);
  expect(diagnostics.currentGame.customDestination).not.toBeNull();
  expect(diagnostics.recentErrors).toEqual([]);

  await page.getByRole("button", { name: "RESUME FREE RUN" }).click();
  await expect(page.getByRole("region", { name: "Game paused" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Pause game" })).toBeVisible();
});

test("Simulation Free Run selects the Crown cab and exposes real powertrain controls", async ({ page }) => {
  await page.goto("/?diagnostics=1");
  await page.getByRole("button", { name: /Start Simulation Free Run/i }).click();
  const specification = page.getByRole("dialog", { name: /CROWN CAB/i });
  await expect(specification).toContainText("1,900 KG");
  await specification.getByRole("button", { name: /Start Simulation Free Run/i }).click();
  await expect(page.getByRole("button", { name: "Pause game" })).toBeVisible({ timeout: 9_000 });
  await expect(page.locator('button[aria-label="Parking brake"]')).toHaveCount(1);
  await page.keyboard.down("w");
  try {
    await expect.poll(async () => Number(await page.locator(".speedometer > strong").textContent())).toBeGreaterThan(0);
  } finally {
    await page.keyboard.up("w");
  }
  await expect(page.locator(".boost-label")).toContainText(/D[1-4].*RPM/);
});

test("modal focus is trapped, Escape closes, and focus returns to its trigger", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "HOW TO PLAY", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "HOW TO PLAY" });
  await expect(dialog).toBeVisible();
  const close = page.getByRole("button", { name: "Close dialog" });
  const back = page.getByRole("button", { name: "BACK TO MODE SELECT" });
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(back).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("malformed career storage recovers to a normalized save", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("neon-fare-career-v1", "{not-json"));
  await page.goto("/");
  await expect(page.getByRole("group", { name: "Choose game mode" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Start Free Run with arcade/i })).toBeEnabled();
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem("neon-fare-career-v1") ?? "null"))).toEqual({
    version: 1,
    bank: 0,
    owned: [],
    runsCompleted: 0,
    lifetimeFare: 0,
    lifetimeScore: 0,
    lifetimeDeliveries: 0,
  });
});

test("valid career and run-log saves hydrate into the menu", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("neon-fare-career-v1", JSON.stringify({
      version: 1,
      bank: 4321,
      owned: ["neon-loft"],
      runsCompleted: 7,
      lifetimeFare: 4321,
      lifetimeScore: 9876,
      lifetimeDeliveries: 14,
    }));
    localStorage.setItem("neon-fare-runs", JSON.stringify([
      { score: 4321, fare: 88, deliveries: 3, rank: "A", date: "AUG 25" },
    ]));
  });
  await page.goto("/");
  await expect(page.getByText("BANK $4321", { exact: true })).toBeVisible();
  await expect(page.getByText("BEST 4,321", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "RUN LOG", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "RUN LOG" })).toContainText("4,321");
  await expect(page.getByRole("dialog", { name: "RUN LOG" })).toContainText("3 DELIVERIES · $88 · AUG 25");
});

test.describe("mobile touch", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    contextOptions: {
      hasTouch: true,
      isMobile: true,
      reducedMotion: "reduce",
    },
  });

  test("a trusted held touch accelerates the taxi", async ({ page, context }) => {
    await startFreeRun(page);
    const accelerate = page.getByRole("button", { name: "Accelerate" });
    await expect(accelerate).toBeVisible();
    const box = await accelerate.boundingBox();
    expect(box).not.toBeNull();
    const x = box!.x + box!.width / 2;
    const y = box!.y + box!.height / 2;
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y, radiusX: 2, radiusY: 2, force: 1, id: 1 }],
    });
    try {
      await expect.poll(async () => Number(await page.locator(".speedometer > strong").textContent())).toBeGreaterThan(0);
    } finally {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    }
  });
});
