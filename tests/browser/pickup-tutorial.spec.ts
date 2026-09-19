import { expect, test, type Page } from "@playwright/test";
import { SCENE_START_TIMEOUT, WEBGPU_TEST_OPTIONS } from "./browser-options";
import { confirmVehicle, presentUntilVisible } from "./start-helpers";

test.use(WEBGPU_TEST_OPTIONS);
test.setTimeout(120_000);

async function openDev(page: Page) {
  await page.getByRole("button", { name: "Pause game", exact: true }).click();
  await page.getByRole("button", { name: "OPTIONS · DEV MODE", exact: true }).click();
  await page.getByRole("checkbox", { name: /DEV MODE/ }).check();
}

async function resume(page: Page) {
  await page.getByRole("button", { name: "CLOSE OPTIONS", exact: true }).click();
  await page.getByRole("button", { name: /RESUME (FREE RUN|RUN)/ }).click();
}

for (const renderer of ["WebGPU", "Canvas"]) for (const mobile of [false, true]) {
  test.describe(`${renderer} ${mobile ? "mobile" : "desktop"}`, () => {
    test.use({ viewport: mobile ? renderer === "Canvas" ? { width: 320, height: 568 } : { width: 390, height: 844 }
      : renderer === "Canvas" ? { width: 1264, height: 625 } : { width: 1280, height: 800 },
      contextOptions: { hasTouch: mobile, isMobile: mobile, reducedMotion: "reduce" } });
    test("illustrated pickup tutorial pauses startup and reminds after exactly three dropoffs", async ({ page }, info) => {
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.clock.install({ time: new Date("2026-09-19T00:00:00Z") });
      if (renderer === "Canvas") await page.addInitScript(() => Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined }));
      await page.goto("/?diagnostics=1");
      // Cold WebGPU hydration can outlast a short scene transition on this large world.
      await expect(page.locator(".game-canvas").nth(renderer === "WebGPU" ? 1 : 0)).toHaveClass(/is-active/, { timeout: Math.max(30_000, SCENE_START_TIMEOUT) });
      await page.getByRole("button", { name: renderer === "Canvas" && !mobile ? /Start an Arcade Shift/ : /Start Free Run with arcade/ }).click();
      await confirmVehicle(page);
      await page.getByRole("button", { name: /Choose STREET ACE/ }).click();
      await page.clock.pauseAt(new Date("2026-09-19T01:00:00Z"));
      await page.getByRole("button", { name: /Select DEFAULT/ }).click();
      const tutorial = page.getByRole("dialog", { name: "BLUE COLUMNS = PASSENGERS" });
      const start = tutorial.getByRole("button", { name: "GOT IT · LET’S DRIVE" });
      await expect(tutorial).toBeVisible();
      await expect(tutorial.getByRole("img", { name: /passenger.*translucent blue pickup column/i })).toBeVisible();
      await expect(tutorial).toContainText("Slow down and stop inside the blue ring");
      await page.clock.runFor(100);
      await expect(start).toBeFocused();
      await page.keyboard.down("ArrowUp");
      await page.clock.runFor(1500);
      await page.keyboard.up("ArrowUp");
      await expect(page.locator(".arcade-shell")).toHaveClass(/mode-paused/);
      await expect(page.locator(".countdown")).toHaveCount(0);
      await expect(start).toBeInViewport({ ratio: 1 });
      await expect(tutorial.getByRole("img")).toBeInViewport({ ratio: 1 });
      await page.screenshot({ path: info.outputPath("pickup-tutorial.png") });
      if (mobile) {
        await page.setViewportSize({ width: 844, height: 390 });
        await page.clock.runFor(32);
        await expect(start).toBeInViewport({ ratio: 1 });
        await page.screenshot({ path: info.outputPath("pickup-tutorial-landscape.png") });
        await page.setViewportSize({ width: 390, height: 844 });
        await start.tap();
      } else await page.keyboard.press("Enter");
      await expect(tutorial).toHaveCount(0);
      await expect(page.locator(".countdown > span")).toHaveText("3");
      await page.clock.fastForward(3500);
      await page.clock.runFor(100);
      const reminder = page.getByRole("status", { name: "Next passenger reminder" });
      await expect(reminder).toHaveCount(0);
      for (let delivery = 1; delivery <= 4; delivery++) {
        await openDev(page);
        await page.getByRole("button", { name: "CLEAR ACTIVE TRAFFIC", exact: true }).click();
        await page.getByRole("button", { name: "JUMP TO PICKUP", exact: true }).click();
        await resume(page);
        await presentUntilVisible(page, page.locator(".fare-impact--pickup"));
        await expect(reminder).toHaveCount(0);
        await page.clock.fastForward(3500);
        await page.clock.runFor(100);
        await openDev(page);
        await page.getByRole("button", { name: "JUMP TO DROPOFF", exact: true }).click();
        await resume(page);
        await presentUntilVisible(page, page.locator(".fare-impact--dropoff"));
        await expect(reminder).toHaveCount(0);
        await page.clock.fastForward(3500);
        await page.clock.runFor(100);
        if (delivery <= 3) {
          const review = page.locator(".passenger-review");
          if (await review.isVisible()) await expect(reminder).toHaveCount(0);
          await presentUntilVisible(page, reminder, 10_000);
          await expect(review).toBeHidden();
          await expect(reminder).toContainText("LOOK FOR BLUE COLUMNS");
          await expect(reminder.getByRole("img")).toBeVisible();
          await expect(reminder).toBeInViewport({ ratio: 1 });
          await expect(reminder).toHaveCSS("pointer-events", "none");
          if (!mobile) {
            const hint = (await reminder.boundingBox())!;
            const timer = (await page.locator(".timer-card").boundingBox())!;
            expect(hint.y).toBeGreaterThan(timer.y + timer.height);
          }
          const hint = (await reminder.boundingBox())!;
          expect(hint.y).toBeGreaterThan(page.viewportSize()!.height * (mobile ? .32 : .22));
          const exit = (await page.getByRole("button", { name: /EXIT TAXI/ }).boundingBox())!;
          expect(hint.y + hint.height).toBeLessThan(exit.y);
          await page.screenshot({ path: info.outputPath(`pickup-reminder-${delivery}.png`) });
          if (!mobile && delivery === 1) {
            for (const camera of ["FIXED", "HIGH", "CAB", "LOW"]) {
              await page.getByRole("button", { name: "Pause game", exact: true }).click();
              await page.getByRole("group", { name: "Camera view", exact: true }).getByRole("button", { name: camera, exact: true }).click();
              await page.getByRole("button", { name: /RESUME (FREE RUN|RUN)/ }).click();
              await page.clock.runFor(600);
              await expect(reminder).toBeInViewport({ ratio: 1 });
              const cameraHint = (await reminder.boundingBox())!;
              const cameraExit = (await page.getByRole("button", { name: /EXIT TAXI/ }).boundingBox())!;
              expect(cameraHint.y + cameraHint.height).toBeLessThan(cameraExit.y);
              await page.screenshot({ path: info.outputPath(`pickup-reminder-${camera.toLowerCase()}.png`) });
            }
          }
          if (mobile && delivery === 1) {
            await page.setViewportSize({ width: 844, height: 390 });
            await page.clock.runFor(32);
            await expect(reminder).toBeInViewport({ ratio: 1 });
            const hint = (await reminder.boundingBox())!;
            const speed = (await page.locator(".mobile-speed").boundingBox())!;
            expect(hint.y).toBeGreaterThan(speed.y + speed.height);
            await page.screenshot({ path: info.outputPath("pickup-reminder-landscape.png") });
            await page.setViewportSize({ width: 390, height: 844 });
          }
        } else await expect(reminder).toHaveCount(0);
      }
      if (renderer === "WebGPU" && !mobile) {
        await page.getByRole("button", { name: "Pause game", exact: true }).click();
        await page.getByRole("button", { name: "END PLAYTEST", exact: true }).click();
        await page.getByRole("button", { name: "FREE RUN AGAIN", exact: true }).click();
        await confirmVehicle(page);
        await page.getByRole("button", { name: /Choose STREET ACE/ }).click();
        await page.getByRole("button", { name: /Select DEFAULT/ }).click();
        await expect(tutorial).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.locator(".countdown > span")).toHaveText("3");
        await page.clock.fastForward(3500);
        await page.clock.runFor(100);
        await expect(reminder).toHaveCount(0);
      }
      expect(errors).toEqual([]);
    });
  });
}
