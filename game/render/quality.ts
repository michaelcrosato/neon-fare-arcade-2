/**
 * Device-tier and adaptive-resolution policy for the scene renderers.
 *
 * This module is renderer-neutral and deterministic so the tier a device lands
 * on, and the way it degrades under load, can be characterized in tests instead
 * of only being observed on hardware.
 */

export type RenderTier = "ultra" | "high" | "balanced" | "compatibility";

export type RenderQuality = {
  tier: RenderTier;
  /** Upper bound on scene-surface pixels, before adaptive scaling. */
  pixelBudget: number;
  /** MSAA sample count for the scene pass. 1 disables multisampling. */
  sampleCount: 1 | 4;
  /** Sun shadow cascades; 0 keeps the previous contact-shadow-only look. */
  shadowCascades: 0 | 1 | 2 | 3;
  /** Square edge of one cascade in the shadow atlas. */
  shadowMapSize: 1024 | 2048;
  /** Percentage-closer taps per shadow lookup. */
  shadowTaps: 1 | 4 | 9;
  /** Distance in world units covered by the cascade set. */
  shadowDistance: number;
  /** Terrain and road surfaces also cast, not just boxes. */
  shadowCastsSurfaces: boolean;
  /** Downsample steps in the bloom pyramid; 0 keeps the single-pass glow. */
  bloomLevels: 0 | 3 | 4 | 5;
  /** Screen-space ambient occlusion on the resolved depth buffer. */
  ambientOcclusion: boolean;
  /** Post-resolve contrast-adaptive sharpening. */
  sharpen: boolean;
};

export type DeviceProfile = {
  /** The layout is currently in its phone/tablet breakpoint. */
  mobile: boolean;
  /** `GPUAdapterInfo.vendor`, lowercased, when the browser exposes it. */
  vendor?: string;
  /** `GPUAdapterInfo.architecture`, lowercased, when the browser exposes it. */
  architecture?: string;
  /** `navigator.deviceMemory` in GiB, when available. */
  deviceMemory?: number;
  /** `navigator.hardwareConcurrency`. */
  hardwareConcurrency?: number;
  /** Device pixel ratio reported by the browser. */
  devicePixelRatio?: number;
};

const DESKTOP_GPU_VENDORS = ["nvidia", "amd", "ati"];
const MOBILE_ARCHITECTURES = ["adreno", "mali", "powervr", "immortalis", "xclipse"];

/**
 * Pick a tier from what the browser will actually tell us.
 *
 * Chrome reports a masked `GPUAdapterInfo` on many configurations, so the
 * decision has to survive missing vendor and architecture strings; the layout
 * breakpoint and core/memory counts are the reliable signals.
 */
export function resolveRenderTier(profile: DeviceProfile): RenderTier {
  const vendor = profile.vendor?.toLowerCase() ?? "";
  const architecture = profile.architecture?.toLowerCase() ?? "";
  const mobileGpu = MOBILE_ARCHITECTURES.some((name) => architecture.includes(name) || vendor.includes(name));
  const cores = profile.hardwareConcurrency ?? 4;
  const memory = profile.deviceMemory ?? (profile.mobile ? 4 : 8);

  const discrete = DESKTOP_GPU_VENDORS.some((name) => vendor.includes(name));
  // The layout breakpoint also matches a touchscreen desktop. A reported
  // discrete GPU is the stronger signal, so it wins; a masked adapter on a
  // coarse pointer still takes the phone budget.
  if ((profile.mobile && !discrete) || mobileGpu) {
    // A 2025-class flagship phone (8 cores, 8 GiB) runs the full effect set at
    // a reduced shadow and bloom budget; older phones drop to the plain path.
    return cores >= 6 && memory >= 6 ? "high" : "compatibility";
  }
  if (discrete && cores >= 8 && memory >= 8) return "ultra";
  if (cores >= 8 && memory >= 8) return "balanced";
  return cores >= 4 ? "balanced" : "compatibility";
}

export function renderQuality(tier: RenderTier): RenderQuality {
  switch (tier) {
    case "ultra":
      return {
        tier,
        pixelBudget: 4_200_000,
        sampleCount: 4,
        shadowCascades: 3,
        shadowMapSize: 2048,
        shadowTaps: 9,
        shadowDistance: 300,
        shadowCastsSurfaces: true,
        bloomLevels: 5,
        ambientOcclusion: true,
        sharpen: true,
      };
    case "high":
      // Tile-based mobile GPUs resolve 4x MSAA inside tile memory, so keeping
      // it costs far less than the equivalent resolution increase.
      return {
        tier,
        pixelBudget: 2_500_000,
        sampleCount: 4,
        shadowCascades: 2,
        shadowMapSize: 1024,
        shadowTaps: 4,
        shadowDistance: 190,
        shadowCastsSurfaces: false,
        bloomLevels: 4,
        ambientOcclusion: false,
        sharpen: true,
      };
    case "balanced":
      return {
        tier,
        pixelBudget: 2_500_000,
        sampleCount: 4,
        shadowCascades: 2,
        shadowMapSize: 2048,
        shadowTaps: 4,
        shadowDistance: 240,
        shadowCastsSurfaces: false,
        bloomLevels: 4,
        ambientOcclusion: false,
        sharpen: true,
      };
    default:
      return {
        tier: "compatibility",
        pixelBudget: 2_000_000,
        sampleCount: 1,
        shadowCascades: 0,
        shadowMapSize: 1024,
        shadowTaps: 1,
        shadowDistance: 140,
        shadowCastsSurfaces: false,
        bloomLevels: 0,
        ambientOcclusion: false,
        sharpen: false,
      };
  }
}

export const MIN_RESOLUTION_SCALE = 0.62;
export const MAX_RESOLUTION_SCALE = 1;

export type AdaptiveState = {
  scale: number;
  /** Consecutive samples spent outside the target band. */
  slowSamples: number;
  fastSamples: number;
};

export function initialAdaptiveState(): AdaptiveState {
  return { scale: MAX_RESOLUTION_SCALE, slowSamples: 0, fastSamples: 0 };
}

/**
 * Dynamic resolution with hysteresis.
 *
 * Frame time is measured over whole seconds, and the scale only moves after
 * several consecutive samples agree, so a single hitch (a chunk stream, a GC
 * pause, a modal opening) can never visibly resize the scene.
 */
export function adaptResolution(
  state: AdaptiveState,
  frameMilliseconds: number,
  targetMilliseconds: number,
): AdaptiveState {
  const slow = frameMilliseconds > targetMilliseconds * 1.12;
  const fast = frameMilliseconds < targetMilliseconds * 0.72;
  const slowSamples = slow ? state.slowSamples + 1 : 0;
  const fastSamples = fast ? state.fastSamples + 1 : 0;
  if (slowSamples >= 2 && state.scale > MIN_RESOLUTION_SCALE) {
    return {
      scale: Math.max(MIN_RESOLUTION_SCALE, Math.round((state.scale - 0.08) * 100) / 100),
      slowSamples: 0,
      fastSamples: 0,
    };
  }
  if (fastSamples >= 6 && state.scale < MAX_RESOLUTION_SCALE) {
    return {
      scale: Math.min(MAX_RESOLUTION_SCALE, Math.round((state.scale + 0.04) * 100) / 100),
      slowSamples: 0,
      fastSamples: 0,
    };
  }
  return { scale: state.scale, slowSamples, fastSamples };
}
