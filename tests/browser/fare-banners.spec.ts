import { expect, test, type Locator, type Page } from "@playwright/test";
import { SCENE_START_TIMEOUT, SCENE_TEST_TIMEOUT, WEBGPU_TEST_OPTIONS } from "./browser-options";
import { confirmVehicle, lockSteeringIfPrompted, presentUntilVisible } from "./start-helpers";

test.use(WEBGPU_TEST_OPTIONS);
test.setTimeout(Math.max(120_000, SCENE_TEST_TIMEOUT * 4));

async function openOptions(page: Page) {
  await page.getByRole("button", { name: "Pause game" }).click();
  await page.getByRole("button", { name: "OPTIONS · DEV MODE", exact: true }).click();
}

async function resume(page: Page) {
  await page.getByRole("button", { name: "CLOSE OPTIONS", exact: true }).click();
  await page.getByRole("button", { name: "RESUME FREE RUN", exact: true }).click();
}

async function checkBanner(page: Page, card: Locator) {
  await expect(card).toHaveCSS("--fare-duration", "3000ms");
  const stage = (await page.locator(".game-stage").boundingBox())!;
  const sequence = card.locator(".fare-impact__sequence");
  await expect(card).toHaveCSS("visibility", "visible");
  const desktop = !await page.evaluate(() => matchMedia("(max-width: 820px), (pointer: coarse)").matches);
  await expect(card).toHaveAttribute("data-docking", desktop ? "deck" : "fade");
  const motion = await sequence.evaluate(element => {
    const animation = element.getAnimations()[0];
    if (!animation) throw new Error("Fare banner must have its entrance and exit animation");
    animation.pause();
    const frames = [0, 180, 1500, 2580, 2790, 2970].map(time => {
      animation.currentTime = time;
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    });
    return { duration: animation.effect!.getTiming().duration, frames };
  });
  expect(motion.duration).toBe(3000);
  const fitted = motion.frames[2];
  for (const frame of motion.frames.slice(0, 4)) {
    expect(frame.x).toBeGreaterThanOrEqual(fitted.x - 1);
    expect(frame.y + frame.height).toBeLessThanOrEqual(fitted.y + fitted.height + 1);
    expect(frame.width).toBeLessThanOrEqual(fitted.width + 1);
  }
  const landed = motion.frames.at(-1)!;
  if (desktop) {
    const dock = (await page.locator(".fare-card-stack").boundingBox())!;
    expect(landed.x + landed.width / 2).toBeCloseTo(dock.x + dock.width / 2, 0);
    expect(landed.y + landed.height / 2).toBeCloseTo(dock.y + dock.height / 2, 0);
    expect(landed.width).toBeLessThanOrEqual(dock.width + 1);
    expect(landed.height).toBeLessThanOrEqual(dock.height + 1);
    expect(motion.frames[4].width).toBeLessThan(fitted.width);
    expect(motion.frames[4].width).toBeGreaterThan(landed.width);
    expect(motion.frames[4].x).toBeLessThan(fitted.x);
  } else expect(landed.y).toBeLessThan(fitted.y);
  const decoration = await card.evaluate(element => ["::before", "::after"].map(pseudo => getComputedStyle(element, pseudo).display));
  expect(decoration).toEqual(["none", "none"]);
  await expect(card.locator(".fare-impact__speed-lines")).toBeHidden();
  await expect(card).toHaveCSS("pointer-events", "none");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(sequence).toHaveCSS("animation-name", "none");
  await expect(sequence).toBeInViewport({ ratio: 1 });
  const box = (await sequence.boundingBox())!;
  expect(box.width * box.height).toBeGreaterThan(stage.width * stage.height * .13);
  if (desktop) {
    expect(box.width).toBeCloseTo((stage.width - 24) / 2, 0);
    expect(box.x + box.width / 2).toBeCloseTo(stage.x + stage.width / 2, 0);
    expect(box.height).toBeLessThanOrEqual((stage.height - 16) * .38);
  }
  await expect(card.locator(".fare-impact__copy > strong")).toBeVisible();
  const art = (await card.locator(".fare-impact__art").boundingBox())!;
  expect(art.width).toBeGreaterThan(120);
}

for (const renderer of ["WebGPU", "Canvas"]) for (const mobile of [false, true]) {
  test.describe(`${renderer} ${mobile ? "mobile" : "desktop"}`, () => {
    test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 },
      contextOptions: { hasTouch: mobile, isMobile: mobile, reducedMotion: "no-preference" } });
    test("passenger and destination cards make a fitted impact for three seconds", async ({ page }, info) => {
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.clock.install({ time: new Date("2026-09-12T00:00:00Z") });
      if (renderer === "Canvas") await page.addInitScript(() => Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined }));
      await page.goto("/?diagnostics=1");
      await expect(page.locator(".topbar nav button")).toHaveText(["OPTIONS"]);
      await expect(page.locator(".game-canvas").nth(renderer === "WebGPU" ? 1 : 0)).toHaveClass(/is-active/, { timeout: SCENE_START_TIMEOUT });
      await page.getByRole("button", { name: /Start Free Run with arcade/ }).click();
      await confirmVehicle(page);
      await page.clock.pauseAt(new Date("2026-09-12T01:00:00Z"));
      await page.getByRole("button", { name: /Choose STREET ACE/ }).click();
      await lockSteeringIfPrompted(page);
      await page.clock.fastForward(3500);
      await page.clock.runFor(100);
      await openOptions(page);
      await page.getByRole("checkbox", { name: /DEV MODE/ }).check();
      await page.getByRole("button", { name: "CLEAR ACTIVE TRAFFIC", exact: true }).click();
      await page.getByRole("combobox", { name: "Landmark", exact: true }).selectOption("pulse-stadium");
      await page.getByRole("combobox", { name: "Occasion", exact: true }).selectOption("1");
      await page.getByRole("button", { name: "LOAD TEST FARE", exact: true }).click();
      await resume(page);
      await page.clock.runFor(32);
      const pickup = page.locator(".fare-impact--pickup");
      await expect(pickup.locator(".fare-impact__sprite")).toHaveCSS("background-image", /fare-passengers/);
      await checkBanner(page, pickup);
      await page.screenshot({ path: info.outputPath("passenger-banner.png") });
      if (mobile) {
        await page.setViewportSize({ width: 844, height: 390 });
        await page.clock.runFor(32);
        await expect(pickup.locator(".fare-impact__sequence")).toBeInViewport({ ratio: 1 });
        await page.screenshot({ path: info.outputPath("passenger-landscape.png") });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.clock.runFor(32);
      }
      await page.clock.fastForward(2800);
      await expect(pickup).toBeVisible();
      await page.getByRole("button", { name: "Pause game" }).click();
      await page.clock.fastForward(5000);
      await page.getByRole("button", { name: "RESUME FREE RUN", exact: true }).click();
      await page.clock.fastForward(100);
      await expect(pickup).toBeVisible();
      await page.clock.fastForward(100);
      await expect(pickup).toHaveCount(0);
      if (!mobile) await expect(page.getByRole("button", { name: /Pause and browse 1 run card/ })).toBeVisible();

      await openOptions(page);
      await page.getByRole("button", { name: "JUMP TO DROPOFF", exact: true }).click();
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await resume(page);
      const dropoff = page.locator(".fare-impact--dropoff");
      await presentUntilVisible(page, dropoff.locator(".fare-card-occasion"));
      await expect(dropoff).toContainText("STADIUM CONCERT");
      await expect(dropoff.locator(".fare-impact__sprite")).toHaveCSS("background-image", /fare-destinations-7/);
      await checkBanner(page, dropoff);
      await page.screenshot({ path: info.outputPath("destination-banner.png") });
      // The normal fixed-step dwell can create the card within the last 100 ms frame.
      await page.clock.fastForward(2700);
      await expect(dropoff).toBeVisible();
      await page.clock.fastForward(400);
      await expect(dropoff).toHaveCount(0);
      if (!mobile) await expect(page.getByRole("button", { name: /Pause and browse 2 run cards/ })).toBeVisible();
      expect(errors).toEqual([]);
    });
  });
}
