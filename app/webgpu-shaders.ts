import {
  MAT_ADOBE,
  MAT_BEACON,
  MAT_BUILDING,
  MAT_CACTUS,
  MAT_FOLIAGE,
  MAT_GRASS,
  MAT_LAMP,
  MAT_MARKER,
  MAT_ROAD,
  MAT_ROUTE,
  MAT_SANDSTONE,
  MAT_SIGN,
  MAT_SNOW,
  MAT_STONE,
  MAT_TIMBER,
  MAT_TURN,
  MAT_WATER,
  MAT_WINDOW,
} from "@/game/config";
import { BEACON_FAR_DEPTH } from "@/game/render/clip";
import { SUN_DIRECTION } from "@/game/render/sun";

export type SceneShaderOptions = {
  shadowCascades: number;
  shadowTaps: 1 | 4 | 9;
};

export type PostShaderOptions = {
  bloomLevels: number;
  ambientOcclusion: boolean;
  sharpen: boolean;
  sampleCount: 1 | 4;
};

const SUN = `vec3<f32>(${SUN_DIRECTION[0].toFixed(6)}, ${SUN_DIRECTION[1].toFixed(6)}, ${SUN_DIRECTION[2].toFixed(6)})`;

/**
 * Shared declarations. `Camera` keeps its original 24-float layout so the
 * packing contract is unchanged; everything the lighting rig added lives in the
 * separate `Frame` block.
 */
const COMMON = `
struct Camera {
  viewProj: mat4x4<f32>,
  params: vec4<f32>,
  sky: vec4<f32>,
};
struct Frame {
  shadowMatrices: array<mat4x4<f32>, 3>,
  cascadeFar: vec4<f32>,
  cascadeTexel: vec4<f32>,
  sun: vec4<f32>,
  eye: vec4<f32>,
  forward: vec4<f32>,
  post: vec4<f32>,
};
struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) worldPos: vec3<f32>,
  @location(2) localPos: vec3<f32>,
  @location(3) @interpolate(flat) material: u32,
  @location(4) @interpolate(flat) faceShade: f32,
  @location(5) @interpolate(flat) worldNormal: vec3<f32>,
};
struct VertexIn {
  @location(0) localPos: vec3<f32>,
  @location(1) faceShade: f32,
  @location(2) worldData: vec4<f32>,
  @location(3) scale: vec3<f32>,
  @location(4) yaw: f32,
  @location(5) tint: vec4<f32>,
  @location(6) orientation: vec4<f32>,
};
struct SurfaceVertexIn {
  @location(0) worldData: vec4<f32>,
  @location(1) normalShade: vec4<f32>,
  @location(2) tint: vec4<f32>,
};
`;

/**
 * Instance transform shared by the scene and the shadow cascades.
 *
 * `abs` on the scale keeps every cuboid's winding identical: a cube is
 * symmetric about all three axes, so a mirrored scale would only flip the
 * triangle order and defeat back-face culling.
 */
const BOX_TRANSFORM = `
struct BoxPose { world: vec3<f32>, normal: vec3<f32> };
fn boxPose(v: VertexIn, time: f32) -> BoxPose {
  var p = v.localPos * abs(v.scale);
  // cubeVertices assigns one stable faceShade value per cuboid face. Rebuild
  // that face normal here without widening the shared vertex protocol.
  var normal = vec3<f32>(0.0, 0.0, 1.0);
  if (v.faceShade < 0.54) {
    normal = vec3<f32>(0.0, 0.0, -1.0);
  } else if (v.faceShade < 0.60) {
    normal = vec3<f32>(0.0, -1.0, 0.0);
  } else if (v.faceShade < 0.66) {
    normal = vec3<f32>(-1.0, 0.0, 0.0);
  } else if (v.faceShade < 0.76) {
    normal = vec3<f32>(0.0, 1.0, 0.0);
  } else if (v.faceShade < 0.90) {
    normal = vec3<f32>(1.0, 0.0, 0.0);
  }
  let pitch = v.orientation.x;
  if (abs(pitch) > 0.0001) {
    let cp = cos(pitch);
    let sp = sin(pitch);
    p = vec3<f32>(p.x, cp * p.y - sp * p.z, sp * p.y + cp * p.z);
    normal = vec3<f32>(normal.x, cp * normal.y - sp * normal.z, sp * normal.y + cp * normal.z);
  }
  let tilt = v.orientation.y;
  if (abs(tilt) > 0.0001) {
    let ct = cos(tilt);
    let st = sin(tilt);
    p = vec3<f32>(ct * p.x + st * p.z, p.y, -st * p.x + ct * p.z);
    normal = vec3<f32>(ct * normal.x + st * normal.z, normal.y, -st * normal.x + ct * normal.z);
  }
  let c = cos(v.yaw);
  let s = sin(v.yaw);
  let rotated = vec2<f32>(c * p.x - s * p.y, s * p.x + c * p.y);
  let rotatedNormal = vec2<f32>(c * normal.x - s * normal.y, s * normal.x + c * normal.y);
  var world = vec3<f32>(rotated, p.z) + v.worldData.xyz;
  let material = u32(v.worldData.w + 0.5);
  if (material == ${MAT_FOLIAGE}u) {
    let crown = clamp(v.localPos.z + 0.5, 0.0, 1.0);
    let sway = sin(time * 1.7 + v.worldData.x * 0.19 + v.worldData.y * 0.13) * 0.16 * crown;
    world.x += sway;
    world.y += sway * 0.45;
  }
  if (material == ${MAT_WATER}u) {
    world.z += sin(time * 3.6 + v.worldData.x * 0.28 + v.worldData.y * 0.2) * 0.06;
  }
  var pose: BoxPose;
  pose.world = world;
  pose.normal = normalize(vec3<f32>(rotatedNormal, normal.z));
  return pose;
}
`;

function shadowSampling(options: SceneShaderOptions) {
  if (options.shadowCascades < 1) {
    return `
fn sunVisibility(worldPos: vec3<f32>, normal: vec3<f32>, viewDepth: f32) -> f32 { return 1.0; }
`;
  }
  const taps = options.shadowTaps === 9
    ? `
  var sum = 0.0;
  for (var y = -1; y <= 1; y = y + 1) {
    for (var x = -1; x <= 1; x = x + 1) {
      let offset = vec2<f32>(f32(x), f32(y)) * texel;
      sum = sum + textureSampleCompareLevel(shadowMap, shadowSampler, uv + offset, index, reference);
    }
  }
  var visibility = sum / 9.0;`
    : options.shadowTaps === 4
      ? `
  var sum = 0.0;
  // Rotated four-tap disc: two bilinear comparisons per axis already give a
  // 4x4 effective kernel through the hardware comparison sampler.
  let taps = array<vec2<f32>, 4>(
    vec2<f32>(-0.7, -0.7), vec2<f32>(0.7, -0.7),
    vec2<f32>(-0.7, 0.7), vec2<f32>(0.7, 0.7)
  );
  for (var i = 0; i < 4; i = i + 1) {
    sum = sum + textureSampleCompareLevel(shadowMap, shadowSampler, uv + taps[i] * texel, index, reference);
  }
  var visibility = sum * 0.25;`
      : `
  var visibility = textureSampleCompareLevel(shadowMap, shadowSampler, uv, index, reference);`;
  return `
fn cascadeIndex(viewDepth: f32) -> i32 {
  let count = i32(frame.cascadeFar.w);
  var index = 0;
  if (viewDepth > frame.cascadeFar.x) { index = 1; }
  if (viewDepth > frame.cascadeFar.y) { index = 2; }
  return min(index, count - 1);
}
fn sunVisibility(worldPos: vec3<f32>, normal: vec3<f32>, viewDepth: f32) -> f32 {
  let count = i32(frame.cascadeFar.w);
  if (count < 1) { return 1.0; }
  let index = cascadeIndex(viewDepth);
  let world = f32(frame.cascadeTexel[index]);
  // Offset along the surface normal and toward the sun so a receiver never
  // shadows itself at grazing angles, scaled by the cascade's own texel size.
  let biased = worldPos + normal * world * 1.8 + ${SUN} * world * 2.4;
  let clip = frame.shadowMatrices[index] * vec4<f32>(biased, 1.0);
  if (clip.w <= 0.0) { return 1.0; }
  let ndc = clip.xyz / clip.w;
  if (ndc.z < 0.0 || ndc.z > 1.0) { return 1.0; }
  let uv = vec2<f32>(ndc.x * 0.5 + 0.5, 0.5 - ndc.y * 0.5);
  if (uv.x < 0.002 || uv.x > 0.998 || uv.y < 0.002 || uv.y > 0.998) { return 1.0; }
  let texel = vec2<f32>(frame.post.w);
  let reference = ndc.z;
${taps}
  // Dissolve the last cascade into full light instead of ending on a hard line.
  let range = frame.cascadeFar[max(0, count - 1)];
  let fade = smoothstep(range * 0.82, range, viewDepth);
  return mix(visibility, 1.0, fade);
}
`;
}

export function sceneShaderCode(options: SceneShaderOptions) {
  return `${COMMON}
@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<uniform> frame: Frame;
@group(0) @binding(2) var shadowMap: texture_depth_2d_array;
@group(0) @binding(3) var shadowSampler: sampler_comparison;
${BOX_TRANSFORM}
${shadowSampling(options)}
@vertex fn vsMain(v: VertexIn) -> VertexOut {
  let pose = boxPose(v, camera.params.x);
  var out: VertexOut;
  out.position = camera.viewProj * vec4<f32>(pose.world, 1.0);
  if (v.worldData.w == ${MAT_BEACON}.0) {
    out.position.z = min(out.position.z, out.position.w * ${BEACON_FAR_DEPTH});
  }
  out.color = v.tint;
  out.worldPos = pose.world;
  out.localPos = v.localPos;
  out.material = u32(v.worldData.w + 0.5);
  out.faceShade = v.faceShade;
  out.worldNormal = pose.normal;
  return out;
}
@vertex fn vsSurface(v: SurfaceVertexIn) -> VertexOut {
  var out: VertexOut;
  out.position = camera.viewProj * vec4<f32>(v.worldData.xyz, 1.0);
  out.color = v.tint;
  out.worldPos = v.worldData.xyz;
  out.localPos = vec3<f32>(0.0);
  out.material = u32(v.worldData.w + 0.5);
  out.faceShade = v.normalShade.w;
  out.worldNormal = v.normalShade.xyz;
  return out;
}
fn hash2(p: vec2<f32>) -> f32 {
  return fract(sin(dot(p, vec2<f32>(12.9898, 78.233))) * 43758.5453);
}
/** The authored per-material surface treatment, unchanged from the original
 * if-chain but dispatched once through a switch on the integer id. */
fn materialColor(material: u32, base: vec3<f32>, worldPos: vec3<f32>, faceShade: f32, direct: f32, time: f32) -> vec3<f32> {
  var color = base;
  switch (material) {
    case ${MAT_ROAD}u: {
      let grain = hash2(floor(worldPos.xy * 1.7));
      color = color * (0.9 + grain * 0.11);
    }
    case ${MAT_BUILDING}u: {
      if (faceShade < 0.95) {
        let windowX = step(0.58, fract((worldPos.x + worldPos.y) * 0.34));
        let windowY = step(0.52, fract(worldPos.z * 0.31));
        color = mix(color, vec3<f32>(0.05, 0.72, 0.76), windowX * windowY * 0.38);
      }
    }
    case ${MAT_WINDOW}u: {
      let windowPulse = 0.46 + sin(time * 4.0) * 0.12;
      color = mix(color, vec3<f32>(0.2, 1.0, 1.0), windowPulse);
      color = color + vec3<f32>(0.01, 0.11, 0.13) * windowPulse;
    }
    case ${MAT_MARKER}u, ${MAT_ROUTE}u, ${MAT_LAMP}u: {
      let pulse = 0.62 + sin(time * 7.0 + worldPos.x * 0.08) * 0.18;
      color = mix(color, vec3<f32>(1.0, 0.97, 0.75), pulse * 0.3);
      color = color + vec3<f32>(0.12, 0.1, 0.035) * pulse;
    }
    case ${MAT_TURN}u: {
      let navPulse = 0.58 + sin(time * 9.0) * 0.16;
      color = mix(color, vec3<f32>(1.0, 0.88, 0.04), navPulse);
      color = color + vec3<f32>(0.18, 0.12, 0.01) * navPulse;
    }
    case ${MAT_GRASS}u: {
      let grassGrain = fract(sin(dot(floor(worldPos.xy * 1.1), vec2<f32>(17.17, 41.73))) * 21845.37);
      color = color * select(0.82 + grassGrain * 0.18, 0.96 + grassGrain * 0.04, worldPos.x < -792.0);
    }
    case ${MAT_FOLIAGE}u: {
      let leafTone = fract(sin(dot(floor(worldPos.xy * 0.75), vec2<f32>(9.31, 63.17))) * 19731.1);
      color = mix(color, vec3<f32>(0.08, 0.42, 0.2), 0.16 + leafTone * 0.2);
    }
    case ${MAT_SIGN}u: {
      let signPulse = 0.18 + sin(time * 5.5 + worldPos.x * 0.09) * 0.1;
      color = mix(color, vec3<f32>(1.0, 0.94, 0.78), signPulse);
      color = color + vec3<f32>(0.055, 0.04, 0.012) * signPulse;
    }
    case ${MAT_WATER}u: {
      let wave = 0.24 + sin(time * 2.8 + worldPos.x * 0.42 + worldPos.y * 0.31) * 0.14;
      color = mix(color, vec3<f32>(0.1, 0.85, 0.92), wave);
    }
    case ${MAT_TIMBER}u: {
      let seam = smoothstep(0.035, 0.09, abs(fract(worldPos.z * 0.65) - 0.5));
      color = color * (0.85 + seam * 0.15);
    }
    case ${MAT_STONE}u: {
      let strata = sin(worldPos.z * 1.8 + worldPos.x * 0.04 + worldPos.y * 0.03);
      color = color * (0.93 + strata * 0.07);
    }
    case ${MAT_SNOW}u: {
      color = mix(color, vec3<f32>(0.74, 0.86, 0.94), (1.0 - direct) * 0.15);
    }
    case ${MAT_ADOBE}u: {
      let plaster = fract(sin(dot(floor(worldPos.xyz * 8.0), vec3<f32>(12.7, 39.1, 18.3))) * 21941.7);
      color = color * (0.95 + plaster * 0.05);
    }
    case ${MAT_CACTUS}u: {
      let rib = sin((worldPos.x + worldPos.y) * 19.0);
      color = color * (0.9 + rib * 0.08);
    }
    case ${MAT_SANDSTONE}u: {
      let band = sin(worldPos.z * 0.94 + sin(worldPos.x * 0.013) + worldPos.y * 0.004);
      let grain = fract(sin(dot(floor(worldPos.xy * 1.8), vec2<f32>(19.7, 53.1))) * 19241.7);
      color = color * (0.94 + band * 0.04 + grain * 0.025);
    }
    default: {}
  }
  return color;
}
/** Signs, windows, lamps, route dots and beacons are their own light source and
 * must not be darkened by the sun's shadow. */
fn isEmissive(material: u32) -> bool {
  return material == ${MAT_WINDOW}u || material == ${MAT_MARKER}u || material == ${MAT_ROUTE}u
    || material == ${MAT_LAMP}u || material == ${MAT_TURN}u || material == ${MAT_SIGN}u
    || material == ${MAT_BEACON}u;
}
@fragment fn fsMain(v: VertexOut) -> @location(0) vec4<f32> {
  if (v.material == ${MAT_BEACON}u) { return v.color; }
  let normal = normalize(v.worldNormal);
  let sunDirection = ${SUN};
  let direct = max(dot(normal, sunDirection), 0.0);
  let toCamera = v.worldPos - frame.eye.xyz;
  let viewDepth = max(0.0, dot(toCamera, frame.forward.xyz));
  var shadow = 1.0;
  if (!isEmissive(v.material) && direct > 0.0) {
    shadow = sunVisibility(v.worldPos, normal, viewDepth);
  }
  let sunMask = smoothstep(0.015, 0.22, direct);
  let occluded = (1.0 - shadow) * sunMask * frame.sun.w;
  let hemisphere = max(normal.z, 0.0) * 0.12 + max(-normal.z, 0.0) * 0.04;
  let faceStyle = 0.92 + v.faceShade * 0.08;
  let contact = 1.0 - (1.0 - smoothstep(0.12, 2.4, v.worldPos.z)) * (1.0 - abs(normal.z)) * 0.1;
  let light = (0.68 + hemisphere + direct * shadow * 0.24) * faceStyle * contact * (1.0 - occluded * 0.22);
  // A cool cast-shadow tint before quantization keeps the posterized bands
  // crisp instead of dissolving the shadow into a single dark step.
  let tinted = mix(v.color.rgb, v.color.rgb * vec3<f32>(0.80, 0.86, 1.06), occluded);
  var color = floor(tinted * light * 9.0 + 0.5) / 9.0;
  color = materialColor(v.material, color, v.worldPos, v.faceShade, direct, camera.params.x);
  let worldDistance = distance(v.worldPos.xy, camera.params.yz);
  let fog = smoothstep(camera.sky.w * 0.58, camera.sky.w * 0.94, worldDistance);
  let desert = camera.params.z > 792.0 && abs(camera.params.y) < 792.0;
  let coast = camera.params.y < -792.0 && abs(camera.params.z) <= 792.0;
  let fogColor = select(select(vec3<f32>(0.72, 0.88, 0.93), vec3<f32>(0.87, 0.77, 0.64), desert), vec3<f32>(0.78, 0.88, 0.86), coast);
  color = mix(color, fogColor, fog * 0.84);
  return vec4<f32>(color, v.color.a);
}
@fragment fn fsGhost(v: VertexOut) -> @location(0) vec4<f32> {
  let hatch = step(0.43, fract((v.position.x + v.position.y) * 0.075));
  let scan = step(0.28, fract(v.position.y * 0.18));
  let alpha = 0.2 + hatch * 0.42 + scan * 0.12;
  return vec4<f32>(1.0, 0.86, 0.08, alpha);
}`;
}

/** Depth-only cascade pass. The vertex transform must match the scene exactly,
 * including foliage sway, or shadows detach from their casters. */
export function shadowShaderCode() {
  return `${COMMON}
@group(0) @binding(0) var<uniform> light: Camera;
${BOX_TRANSFORM}
@vertex fn vsBox(v: VertexIn) -> @builtin(position) vec4<f32> {
  let pose = boxPose(v, light.params.x);
  return light.viewProj * vec4<f32>(pose.world, 1.0);
}
@vertex fn vsSurface(v: SurfaceVertexIn) -> @builtin(position) vec4<f32> {
  return light.viewProj * vec4<f32>(v.worldData.xyz, 1.0);
}`;
}

const FULLSCREEN_VERTEX = `
struct FullscreenOut {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};
@vertex fn vsFullscreen(@builtin(vertex_index) vertexIndex: u32) -> FullscreenOut {
  var positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  let clip = positions[vertexIndex];
  var out: FullscreenOut;
  out.position = vec4<f32>(clip, 0.0, 1.0);
  // Render-target textures use a top-left origin; the procedural sky UV used
  // by the scene pass increases upward, so resolve with one explicit Y flip.
  out.uv = vec2<f32>(clip.x * 0.5 + 0.5, 0.5 - clip.y * 0.5);
  return out;
}
`;

/**
 * Bloom pyramid.
 *
 * `fsDown` is the thirteen-tap Call of Duty downsample, which stays stable
 * under motion where a naive box filter fireflies; `fsUp` is the nine-tap tent
 * that is additively blended back up the chain.
 */
export function bloomShaderCode() {
  return `${FULLSCREEN_VERTEX}
// texel.xy = source texel size; settings = (threshold, knee, radius, intensity).
struct BloomParams { texel: vec4<f32>, settings: vec4<f32> };
@group(0) @binding(0) var bloomSampler: sampler;
@group(0) @binding(1) var sourceTexture: texture_2d<f32>;
@group(0) @binding(2) var<uniform> params: BloomParams;
fn tap(uv: vec2<f32>, offset: vec2<f32>) -> vec3<f32> {
  return textureSampleLevel(sourceTexture, bloomSampler, uv + offset, 0.0).rgb;
}
@fragment fn fsPrefilter(v: FullscreenOut) -> @location(0) vec4<f32> {
  let e = params.texel.xy;
  var color = tap(v.uv, vec2<f32>(0.0)) * 0.5;
  color = color + (tap(v.uv, vec2<f32>(-e.x, -e.y)) + tap(v.uv, vec2<f32>(e.x, -e.y))
    + tap(v.uv, vec2<f32>(-e.x, e.y)) + tap(v.uv, vec2<f32>(e.x, e.y))) * 0.125;
  // Soft knee threshold: the brightest signs and route dots bloom, the lit
  // road surface does not suddenly cross a hard cutoff as the camera moves.
  let threshold = params.settings.x;
  let knee = params.settings.y;
  let brightness = max(color.r, max(color.g, color.b));
  let soft = clamp(brightness - threshold + knee, 0.0, 2.0 * knee);
  let contribution = max(soft * soft / (4.0 * knee + 0.0001), brightness - threshold);
  return vec4<f32>(color * (contribution / max(brightness, 0.0001)), 1.0);
}
@fragment fn fsDown(v: FullscreenOut) -> @location(0) vec4<f32> {
  let e = params.texel.xy;
  let a = tap(v.uv, vec2<f32>(-2.0 * e.x, 2.0 * e.y));
  let b = tap(v.uv, vec2<f32>(0.0, 2.0 * e.y));
  let c = tap(v.uv, vec2<f32>(2.0 * e.x, 2.0 * e.y));
  let d = tap(v.uv, vec2<f32>(-2.0 * e.x, 0.0));
  let f = tap(v.uv, vec2<f32>(0.0, 0.0));
  let g = tap(v.uv, vec2<f32>(2.0 * e.x, 0.0));
  let h = tap(v.uv, vec2<f32>(-2.0 * e.x, -2.0 * e.y));
  let i = tap(v.uv, vec2<f32>(0.0, -2.0 * e.y));
  let j = tap(v.uv, vec2<f32>(2.0 * e.x, -2.0 * e.y));
  let k = tap(v.uv, vec2<f32>(-e.x, e.y));
  let l = tap(v.uv, vec2<f32>(e.x, e.y));
  let m = tap(v.uv, vec2<f32>(-e.x, -e.y));
  let n = tap(v.uv, vec2<f32>(e.x, -e.y));
  var color = f * 0.125;
  color = color + (a + c + h + j) * 0.03125;
  color = color + (b + d + g + i) * 0.0625;
  color = color + (k + l + m + n) * 0.125;
  return vec4<f32>(color, 1.0);
}
@fragment fn fsUp(v: FullscreenOut) -> @location(0) vec4<f32> {
  let e = params.texel.xy * params.settings.z;
  var color = tap(v.uv, vec2<f32>(-e.x, e.y)) + tap(v.uv, vec2<f32>(0.0, e.y)) * 2.0 + tap(v.uv, vec2<f32>(e.x, e.y));
  color = color + tap(v.uv, vec2<f32>(-e.x, 0.0)) * 2.0 + tap(v.uv, vec2<f32>(0.0, 0.0)) * 4.0 + tap(v.uv, vec2<f32>(e.x, 0.0)) * 2.0;
  color = color + tap(v.uv, vec2<f32>(-e.x, -e.y)) + tap(v.uv, vec2<f32>(0.0, -e.y)) * 2.0 + tap(v.uv, vec2<f32>(e.x, -e.y));
  return vec4<f32>(color * (1.0 / 16.0) * params.settings.w, 1.0);
}`;
}

/**
 * Screen-space ambient occlusion over the scene depth buffer.
 *
 * There is no G-buffer, so the view position is rebuilt from depth and the
 * normal from the nearest depth neighbours. The estimator is the Alchemy AO
 * form, which only counts samples that rise out of the surface's own tangent
 * plane; a plain depth-difference test darkens every receding ground plane
 * uniformly instead of only its creases.
 */
export function ambientOcclusionShaderCode(options: { sampleCount: 1 | 4 }) {
  const depthType = options.sampleCount > 1 ? "texture_depth_multisampled_2d" : "texture_depth_2d";
  return `${FULLSCREEN_VERTEX}
// size.xy = depth texture size, size.z = 1 when the camera is orthographic;
// settings = (near, far, world radius, strength);
// projection.xy = half extent at unit depth (or half the ortho box).
struct AoParams { size: vec4<f32>, settings: vec4<f32>, projection: vec4<f32> };
@group(0) @binding(0) var depthTexture: ${depthType};
@group(0) @binding(1) var<uniform> params: AoParams;
fn linearDepth(raw: f32) -> f32 {
  let near = params.settings.x;
  let far = params.settings.y;
  if (params.size.z > 0.5) { return near + raw * (far - near); }
  if (raw >= 0.999999) { return far; }
  return near * far / (far - raw * (far - near));
}
fn depthAt(coord: vec2<i32>) -> f32 {
  let clamped = clamp(coord, vec2<i32>(0), vec2<i32>(params.size.xy) - vec2<i32>(1));
  return linearDepth(textureLoad(depthTexture, clamped, 0));
}
fn viewPosition(coord: vec2<i32>) -> vec3<f32> {
  let z = depthAt(coord);
  let uv = (vec2<f32>(coord) + vec2<f32>(0.5)) / params.size.xy;
  let ndc = vec2<f32>(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0);
  if (params.size.z > 0.5) { return vec3<f32>(ndc * params.projection.xy, z); }
  return vec3<f32>(ndc * params.projection.xy * z, z);
}
@fragment fn fsAo(v: FullscreenOut) -> @location(0) vec4<f32> {
  let coord = vec2<i32>(v.uv * params.size.xy);
  let center = viewPosition(coord);
  let far = params.settings.y;
  if (center.z >= far * 0.99) { return vec4<f32>(1.0); }
  // Pick the closer neighbour on each axis so a silhouette edge does not
  // produce a normal that spans two different surfaces.
  let right = viewPosition(coord + vec2<i32>(2, 0));
  let left = viewPosition(coord - vec2<i32>(2, 0));
  let down = viewPosition(coord + vec2<i32>(0, 2));
  let up = viewPosition(coord - vec2<i32>(0, 2));
  let dx = select(center - left, right - center, abs(right.z - center.z) < abs(left.z - center.z));
  let dy = select(center - up, down - center, abs(down.z - center.z) < abs(up.z - center.z));
  let normal = normalize(cross(dx, dy));
  let radius = params.settings.z;
  // A world-space radius becomes fewer pixels as the surface recedes.
  let pixels = clamp(radius * params.size.y * 0.5 / max(center.z * params.projection.y, 0.001), 3.0, 40.0);
  let rotation = fract(sin(dot(vec2<f32>(coord), vec2<f32>(12.9898, 78.233))) * 43758.5453) * 6.2831853;
  var occlusion = 0.0;
  for (var i = 0; i < 8; i = i + 1) {
    let angle = rotation + f32(i) * 0.7853982;
    let step = (0.35 + 0.65 * fract(f32(i) * 0.618034 + rotation)) * pixels;
    let offset = vec2<i32>(vec2<f32>(cos(angle), sin(angle)) * step);
    let sample = viewPosition(coord + offset);
    let toSample = sample - center;
    let distanceSquared = dot(toSample, toSample);
    // Reject anything outside the radius so a distant object in front of a
    // wall cannot paint a halo onto it.
    if (distanceSquared > radius * radius * 4.0) { continue; }
    occlusion = occlusion + max(0.0, dot(toSample, normal) - center.z * 0.006)
      / (distanceSquared + 0.06);
  }
  let strength = params.settings.w;
  let ao = clamp(1.0 - strength * (0.6 * radius / 8.0) * occlusion, 0.0, 1.0);
  return vec4<f32>(ao, ao, ao, 1.0);
}`;
}

export function postShaderCode(options: PostShaderOptions) {
  const bloom = options.bloomLevels > 0;
  const bindings = [
    "@group(0) @binding(0) var postSampler: sampler;",
    "@group(0) @binding(1) var sceneTexture: texture_2d<f32>;",
    "@group(0) @binding(2) var<uniform> grade: GradeParams;",
    bloom ? "@group(0) @binding(3) var bloomTexture: texture_2d<f32>;" : "",
    options.ambientOcclusion ? "@group(0) @binding(4) var aoTexture: texture_2d<f32>;" : "",
  ].filter(Boolean).join("\n");

  const legacyEdgeResolve = options.sampleCount > 1 ? "" : `
  // Without multisampling the cuboid silhouettes need a cheap edge resolve.
  let sampleRadius = texel * 1.25;
  let northWest = textureSampleLevel(sceneTexture, postSampler, uv + sampleRadius * vec2<f32>(-1.0, -1.0), 0.0).rgb;
  let northEast = textureSampleLevel(sceneTexture, postSampler, uv + sampleRadius * vec2<f32>(1.0, -1.0), 0.0).rgb;
  let southWest = textureSampleLevel(sceneTexture, postSampler, uv + sampleRadius * vec2<f32>(-1.0, 1.0), 0.0).rgb;
  let southEast = textureSampleLevel(sceneTexture, postSampler, uv + sampleRadius * vec2<f32>(1.0, 1.0), 0.0).rgb;
  let edgeAverage = (northWest + northEast + southWest + southEast) * 0.25;
  let edgeStrength = smoothstep(0.08, 0.34, abs(luminance(color) - luminance(edgeAverage)));
  color = mix(color, edgeAverage, edgeStrength * 0.22);
  color = color + max(edgeAverage - vec3<f32>(0.76), vec3<f32>(0.0)) * 0.24;`;

  const sharpen = options.sharpen ? `
  // Contrast-adaptive sharpening restores the micro-detail that multisample
  // resolve and dynamic resolution soften, without ringing on flat panels.
  let n = textureSampleLevel(sceneTexture, postSampler, uv + vec2<f32>(0.0, -texel.y), 0.0).rgb;
  let s = textureSampleLevel(sceneTexture, postSampler, uv + vec2<f32>(0.0, texel.y), 0.0).rgb;
  let w = textureSampleLevel(sceneTexture, postSampler, uv + vec2<f32>(-texel.x, 0.0), 0.0).rgb;
  let e = textureSampleLevel(sceneTexture, postSampler, uv + vec2<f32>(texel.x, 0.0), 0.0).rgb;
  let neighbourhood = (n + s + w + e) * 0.25;
  let low = min(min(luminance(n), luminance(s)), min(luminance(w), luminance(e)));
  let high = max(max(luminance(n), luminance(s)), max(luminance(w), luminance(e)));
  let contrast = clamp(1.0 - (high - low) * 1.6, 0.0, 1.0);
  color = color + (color - neighbourhood) * grade.tone.y * contrast;` : "";

  return `${FULLSCREEN_VERTEX}
// texel.xy = output texel size, texel.z = exposure, texel.w = bloom strength;
// tone = (ambient occlusion strength, sharpen amount, saturation, contrast).
struct GradeParams { texel: vec4<f32>, tone: vec4<f32> };
${bindings}
fn luminance(color: vec3<f32>) -> f32 {
  return dot(color, vec3<f32>(0.2126, 0.7152, 0.0722));
}
/** Gentle filmic shoulder. The scene is authored close to display range, so a
 * full ACES curve would crush the flat comic midtones; this only compresses
 * what the bloom and emissive materials push above white. */
fn tonemap(color: vec3<f32>) -> vec3<f32> {
  let shoulder = max(color - vec3<f32>(0.78), vec3<f32>(0.0));
  return color / (vec3<f32>(1.0) + shoulder * 0.42);
}
@fragment fn fsPost(v: FullscreenOut) -> @location(0) vec4<f32> {
  let texel = grade.texel.xy;
  let uv = clamp(v.uv, vec2<f32>(0.0), vec2<f32>(1.0));
  var color = textureSampleLevel(sceneTexture, postSampler, uv, 0.0).rgb;
${legacyEdgeResolve}
${sharpen}
  color = color * grade.texel.z;
${bloom ? `  let glow = textureSampleLevel(bloomTexture, postSampler, uv, 0.0).rgb;
  color = color + glow * grade.texel.w;` : ""}
${options.ambientOcclusion ? `  let ao = textureSampleLevel(aoTexture, postSampler, uv, 0.0).r;
  // Roll the occlusion off on bright pixels so lit signs, route dots and the
  // sky keep their authored colour.
  color = color * mix(1.0, ao, grade.tone.x * clamp(1.0 - luminance(color) * 0.6, 0.0, 1.0));` : ""}
  color = tonemap(color);
  let gray = luminance(color);
  color = mix(vec3<f32>(gray), color, grade.tone.z);
  color = (color - vec3<f32>(0.5)) * grade.tone.w + vec3<f32>(0.5);
  let dimensions = 1.0 / texel;
  let centered = (uv - vec2<f32>(0.5)) * vec2<f32>(dimensions.x / dimensions.y, 1.0);
  let vignette = 1.0 - smoothstep(0.42, 1.05, length(centered)) * 0.11;
  color = color * vignette;
  // Triangular-PDF dither: one 8-bit step of noise removes the banding the sky
  // gradient and the posterized ramps would otherwise show.
  let noiseA = fract(sin(dot(v.position.xy, vec2<f32>(12.9898, 78.233))) * 43758.5453);
  let noiseB = fract(sin(dot(v.position.xy, vec2<f32>(63.7264, 10.873))) * 32729.1213);
  color = color + (noiseA + noiseB - 1.0) * (1.0 / 255.0);
  return vec4<f32>(clamp(color, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}`;
}
