// Explicit software Vulkan keeps WebGPU alive on Linux runners without a GPU.
// A virtual display also lets Chromium capture the presented WebGPU canvas.
// https://github.com/vercel-labs/agent-browser/blob/main/skill-data/core/references/webgpu.md
const linuxCi = process.platform === "linux" && Boolean(process.env.CI);

export const WEBGPU_TEST_OPTIONS = {
  channel: "chromium",
  headless: !linuxCi,
  launchOptions: {
    args: ["--enable-unsafe-webgpu", ...(linuxCi ? [
      "--enable-features=Vulkan",
      "--use-angle=vulkan",
      "--use-vulkan=swiftshader",
      "--use-webgpu-adapter=swiftshader",
      "--disable-vulkan-surface",
    ] : [])],
  },
};

// Each regional case captures up to forty full world frames on a CPU renderer.
export const SCENE_TEST_TIMEOUT = linuxCi ? 120_000 : 30_000;

// A presented software-GPU frame can delay the live countdown's next update.
// Keep waiting for the real playing UI within the scene's overall deadline.
export const SCENE_START_TIMEOUT = linuxCi ? 45_000 : 9_000;
