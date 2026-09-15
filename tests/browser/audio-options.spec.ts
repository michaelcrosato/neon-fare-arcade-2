import { expect, test, type Page } from "@playwright/test";
import { confirmVehicle, lockSteeringIfPrompted } from "./start-helpers";
import { SCENE_START_TIMEOUT, WEBGPU_TEST_OPTIONS } from "./browser-options";
import { installMediaRanges } from "./media-ranges";

test.use(WEBGPU_TEST_OPTIONS);
test.setTimeout(90_000);

type Probe = { media: Record<string, GainNode>; engine: GainNode | null; outputs: GainNode[] };
async function observeAudio(page: Page) {
  await page.addInitScript(() => {
    const probe: Probe = { media: {}, engine: null, outputs: [] };
    (window as Window & { audioProbe?: Probe }).audioProbe = probe;
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (this: AudioNode, ...args: Parameters<typeof connect>) {
      const target = args[0];
      if (this instanceof MediaElementAudioSourceNode && target instanceof GainNode) probe.media[this.mediaElement.id] = target;
      if (this instanceof OscillatorNode && this.type === "triangle" && target instanceof GainNode) probe.engine = target;
      if (this instanceof GainNode && target instanceof AudioDestinationNode) probe.outputs.push(this);
      return Reflect.apply(connect, this, args);
    } as typeof connect;
  });
}
async function levels(page: Page) {
  return page.evaluate(() => {
    const probe = (window as unknown as Window & { audioProbe: Probe }).audioProbe;
    const effects = probe.outputs.find(node => node !== probe.engine && !Object.values(probe.media).includes(node));
    return { music: probe.media["neon-fare-bgm"]?.gain.value, menu: probe.media["neon-fare-menu-bgm"]?.gain.value,
      effects: effects?.gain.value, engine: probe.engine?.gain.value };
  });
}
async function slider(page: Page, name: string, value: number) {
  const control = page.getByRole("slider", { name, exact: true });
  await control.focus(); await control.press("Home");
  for (let step = 0; step < Math.floor(value / 10); step++) await control.press("PageUp");
  for (let step = 0; step < value % 10; step++) await control.press("ArrowRight");
  await expect(control).toHaveValue(String(value));
  await expect(control).toHaveAttribute("aria-valuetext", `${value} percent`);
}

for (const renderer of ["WebGPU", "Canvas"]) for (const mobile of [false, true]) test.describe(`${renderer} ${mobile ? "phone" : "desktop"} audio`, () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 960 },
    contextOptions: { hasTouch: mobile, isMobile: mobile, reducedMotion: "reduce" } });
  test("sliders control native audio, mute preserves the mix, preferences persist and reset", async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    if (renderer === "Canvas") await page.addInitScript(() => Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined }));
    await observeAudio(page); await installMediaRanges(page);
    await page.goto("/");
    await page.getByRole("button", { name: /Start Free Run with arcade/ }).click();
    const menuMusic = page.locator("#neon-fare-menu-bgm");
    await expect.poll(() => menuMusic.evaluate((element: HTMLAudioElement) => !element.paused && element.currentTime > 0)).toBe(true);
    await expect(menuMusic).toHaveAttribute("src", "/music/bgm_01.mp3");
    await confirmVehicle(page);
    await page.getByRole("button", { name: /Choose STREET ACE/ }).click();
    await lockSteeringIfPrompted(page);
    await expect(page.locator(".arcade-shell.mode-playing")).toBeVisible({ timeout: SCENE_START_TIMEOUT });
    await page.getByRole("button", { name: "Pause game", exact: true }).click();
    await page.getByRole("button", { name: /^GAME OPTIONS/ }).click();
    await expect.poll(() => page.locator("#neon-fare-bgm").evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
    if (renderer === "WebGPU") await expect(page.locator(".graphics-status-val")).toHaveText("WEBGPU ACTIVE");
    await slider(page, "Master volume", 50);
    await slider(page, "Music volume", 60);
    await slider(page, "Sound effects volume", 25);
    await slider(page, "Engine volume", 0);
    await expect.poll(async () => Math.abs((await levels(page)).music - .114)).toBeLessThan(.001);
    await expect.poll(async () => Math.abs((await levels(page)).menu - .114)).toBeLessThan(.001);
    await expect.poll(async () => Math.abs(((await levels(page)).effects ?? NaN) - .03)).toBeLessThan(.001);
    const background = page.getByRole("checkbox", { name: /MUTE IN BACKGROUND/ });
    await expect(background).toBeChecked(); await background.uncheck();
    const mute = page.getByRole("button", { name: "Mute all audio", exact: true });
    await mute.click(); await expect(mute).toHaveAttribute("aria-pressed", "true");
    await expect.poll(async () => Math.max(...Object.values(await levels(page)).map(value => value ?? 0))).toBeLessThan(.001);
    await expect(page.getByRole("slider", { name: "Music volume", exact: true })).toHaveValue("60");
    await mute.click();
    await expect.poll(async () => Math.abs((await levels(page)).music - .114)).toBeLessThan(.001);
    await slider(page, "Master volume", 0);
    await expect.poll(async () => Math.max(...Object.values(await levels(page)).map(value => value ?? 0))).toBeLessThan(.001);
    await slider(page, "Master volume", 50);
    await page.locator(".audio-options").scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("audio-options.png") });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("button", { name: "CLOSE OPTIONS", exact: true }).click();
    await page.getByRole("button", { name: "RESUME FREE RUN", exact: true }).click();
    await expect.poll(async () => (await levels(page)).engine ?? 1).toBeLessThan(.00001);
    await page.getByRole("button", { name: "Pause game", exact: true }).click();
    await page.getByRole("button", { name: /^GAME OPTIONS/ }).click();
    await slider(page, "Engine volume", 50); await slider(page, "Sound effects volume", 0);
    await page.getByRole("button", { name: "CLOSE OPTIONS", exact: true }).click();
    await page.getByRole("button", { name: "RESUME FREE RUN", exact: true }).click();
    await expect.poll(async () => (await levels(page)).engine ?? 0).toBeGreaterThan(.0001);
    await expect.poll(async () => (await levels(page)).effects).toBeLessThan(.001);
    await page.keyboard.press("m");
    await expect.poll(async () => Math.max(...Object.values(await levels(page)).map(value => value ?? 0))).toBeLessThan(.001);
    await page.keyboard.press("m");
    await expect.poll(async () => (await levels(page)).engine ?? 0).toBeGreaterThan(.0001);
    await page.reload();
    await page.getByRole("button", { name: "OPTIONS", exact: true }).click();
    await page.getByRole("button", { name: /^GAME OPTIONS/ }).click();
    for (const [name, value] of [["Master", 50], ["Music", 60], ["Sound effects", 0], ["Engine", 50]] as const) {
      await expect(page.getByRole("slider", { name: `${name} volume`, exact: true })).toHaveValue(String(value));
    }
    await expect(background).not.toBeChecked();
    await expect(mute).toHaveAttribute("aria-pressed", "false");
    await page.getByRole("button", { name: "RESET AUDIO DEFAULTS", exact: true }).click();
    for (const name of ["Master", "Music", "Sound effects", "Engine"]) await expect(page.getByRole("slider", { name: `${name} volume`, exact: true })).toHaveValue("100");
    await expect(background).toBeChecked();
    await expect.poll(async () => Math.abs((await levels(page)).menu - .38)).toBeLessThan(.001);
    expect(errors).toEqual([]);
  });
});
