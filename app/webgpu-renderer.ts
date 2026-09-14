/* eslint-disable @typescript-eslint/no-explicit-any -- WebGPU is not included in this starter's DOM typings. */
"use client";

import {
  MAX_STREAM_BOXES,
  PERSPECTIVE_DRAW_DISTANCE,
  MAT_BEACON,
} from "@/game/config";
import { BEACON_FAR_DEPTH } from "@/game/render/clip";
import type {
  Box,
  Camera,
  Game,
  NavigationPlan,
  Renderer,
  WorldView,
} from "@/game/model";
import { navigationArrowBoxes } from "@/game/render/navigation-glyph";
import {
  cabInteriorBoxes,
  dynamicBoxes,
  playerAvatarBoxes,
  taxiBoxes,
  taxiGroundShadow,
} from "@/game/render/scene";
import { renderTargetSize } from "@/game/render/resolution";
import { detailedTaxiSurfaces, MAX_VEHICLE_SURFACE_FACES } from "@/game/render/detailed-vehicles";
import {
  MAX_STREAM_SURFACE_QUADS, SURFACE_VERTEX_BYTES, SURFACE_VERTICES_PER_QUAD, packSurfaceQuads,
} from "@/game/render/surfaces";
import { viewProjection } from "@/game/render/view-projection";
import {
  perspectiveSkyView,
  shouldRenderPlayerAvatar,
  shouldRenderTaxi,
} from "@/game/render/camera";
import { WebGPUHorizon } from "./webgpu-horizon";
import { reportRuntimeError } from "./runtime/runtime-errors";
import { isDriving, isInterior } from "@/game/player";
import {
  ACTOR_INSTANCE_CAPACITY,
  CAMERA_UNIFORM_BYTES,
  CAMERA_UNIFORM_FLOATS,
  GHOST_INSTANCE_CAPACITY,
  INSTANCE_BYTES,
  INSTANCE_FIELD_OFFSET_BYTES,
  NAVIGATION_INSTANCE_CAPACITY,
  cubeVertices,
  packBoxes,
} from "@/game/render/packing";

export class WebGPURenderer implements Renderer {
  kind = "WebGPU" as const;
  private canvas: HTMLCanvasElement;
  private context: any;
  private device: any;
  private format: any;
  private readonly sceneFormat = "rgba16float";
  private horizon: WebGPUHorizon;
  private pipeline: any;
  private surfacePipeline: any;
  private ghostSurfacePipeline: any;
  private ghostPipeline: any;
  private transparentPipeline: any;
  private postPipeline: any;
  private vertexBuffer: any;
  private cityBuffer: any;
  private surfaceBuffer: any;
  private vehicleSurfaceBuffer: any;
  private actorBuffer: any;
  private navBuffer: any;
  private ghostBuffer: any;
  private cameraBuffer: any;
  private bindGroup: any;
  private surfaceBindGroup: any;
  private ghostSurfaceBindGroup: any;
  private ghostBindGroup: any;
  private transparentBindGroup: any;
  private postBindGroup: any = null;
  private postSampler: any;
  private sceneTexture: any = null;
  private sceneTextureView: any = null;
  private depthTexture: any = null;
  private depthTextureView: any = null;
  private cityCount = 0;
  private surfaceVertexCount = 0;
  private cityKey = "";
  private destroyed = false;
  private onUncapturedError: ((event?: { error?: unknown }) => void) | null = null;

  constructor(canvas: HTMLCanvasElement, context: any, device: any, gpu: any, onFailure: () => void) {
    this.canvas = canvas;
    this.context = context;
    this.device = device;
    this.format = gpu.getPreferredCanvasFormat();
    this.context.configure({ device, format: this.format, alphaMode: "opaque" });

    const shader = device.createShaderModule({
      code: `
struct Camera {
  viewProj: mat4x4<f32>,
  params: vec4<f32>,
  sky: vec4<f32>,
};
@group(0) @binding(0) var<uniform> camera: Camera;
struct VertexIn {
  @location(0) localPos: vec3<f32>,
  @location(1) faceShade: f32,
  @location(2) worldData: vec4<f32>,
  @location(3) scale: vec3<f32>,
  @location(4) yaw: f32,
  @location(5) tint: vec4<f32>,
  @location(6) orientation: vec4<f32>,
};
struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) worldPos: vec3<f32>,
  @location(2) localPos: vec3<f32>,
  @location(3) @interpolate(flat) material: f32,
  @location(4) @interpolate(flat) faceShade: f32,
  @location(5) @interpolate(flat) worldNormal: vec3<f32>,
};
@vertex fn vsMain(v: VertexIn) -> VertexOut {
  var p = v.localPos * v.scale;
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
  if (v.worldData.w > 10.5 && v.worldData.w < 11.5) {
    let crown = clamp(v.localPos.z + 0.5, 0.0, 1.0);
    let sway = sin(camera.params.x * 1.7 + v.worldData.x * 0.19 + v.worldData.y * 0.13) * 0.16 * crown;
    world.x += sway;
    world.y += sway * 0.45;
  }
  if (v.worldData.w > 13.5 && v.worldData.w < 14.5) {
    world.z += sin(camera.params.x * 3.6 + v.worldData.x * 0.28 + v.worldData.y * 0.2) * 0.06;
  }
  var out: VertexOut;
  out.position = camera.viewProj * vec4<f32>(world, 1.0);
  if (v.worldData.w == ${MAT_BEACON}.0) {
    out.position.z = min(out.position.z, out.position.w * ${BEACON_FAR_DEPTH});
  }
  out.color = v.tint;
  out.worldPos = world;
  out.localPos = v.localPos;
  out.material = v.worldData.w;
  out.faceShade = v.faceShade;
  out.worldNormal = normalize(vec3<f32>(rotatedNormal, normal.z));
  return out;
}
struct SurfaceVertexIn {
  @location(0) worldData: vec4<f32>,
  @location(1) normalShade: vec4<f32>,
  @location(2) tint: vec4<f32>,
};
@vertex fn vsSurface(v: SurfaceVertexIn) -> VertexOut {
  var out: VertexOut;
  out.position = camera.viewProj * vec4<f32>(v.worldData.xyz, 1.0);
  out.color = v.tint;
  out.worldPos = v.worldData.xyz;
  out.localPos = vec3<f32>(0.0);
  out.material = v.worldData.w;
  out.faceShade = v.normalShade.w;
  out.worldNormal = v.normalShade.xyz;
  return out;
}
@fragment fn fsMain(v: VertexOut) -> @location(0) vec4<f32> {
  if (v.material == ${MAT_BEACON}.0) { return v.color; }
  let normal = normalize(v.worldNormal);
  let sunDirection = normalize(vec3<f32>(0.64, 0.22, 0.74));
  let direct = max(dot(normal, sunDirection), 0.0);
  let hemisphere = max(normal.z, 0.0) * 0.12 + max(-normal.z, 0.0) * 0.04;
  let faceStyle = 0.92 + v.faceShade * 0.08;
  let contact = 1.0 - (1.0 - smoothstep(0.12, 2.4, v.worldPos.z)) * (1.0 - abs(normal.z)) * 0.1;
  let light = (0.68 + hemisphere + direct * 0.24) * faceStyle * contact;
  var color = floor(v.color.rgb * light * 9.0 + 0.5) / 9.0;
  if (v.material > 0.5 && v.material < 1.5) {
    let grain = fract(sin(dot(floor(v.worldPos.xy * 1.7), vec2<f32>(12.9898, 78.233))) * 43758.5453);
    color *= 0.9 + grain * 0.11;
  }
  if (v.material > 2.5 && v.material < 3.5 && v.faceShade < 0.95) {
    let windowX = step(0.58, fract((v.worldPos.x + v.worldPos.y) * 0.34));
    let windowY = step(0.52, fract(v.worldPos.z * 0.31));
    color = mix(color, vec3<f32>(0.05, 0.72, 0.76), windowX * windowY * 0.38);
  }
  if (v.material > 3.5 && v.material < 4.5) {
    let windowPulse = 0.46 + sin(camera.params.x * 4.0) * 0.12;
    color = mix(color, vec3<f32>(0.2, 1.0, 1.0), windowPulse);
    color += vec3<f32>(0.01, 0.11, 0.13) * windowPulse;
  }
  if (v.material > 5.5 && v.material < 8.5) {
    let pulse = 0.62 + sin(camera.params.x * 7.0 + v.worldPos.x * 0.08) * 0.18;
    color = mix(color, vec3<f32>(1.0, 0.97, 0.75), pulse * 0.3);
    color += vec3<f32>(0.12, 0.1, 0.035) * pulse;
  }
  if (v.material > 8.5 && v.material < 9.5) {
    let navPulse = 0.58 + sin(camera.params.x * 9.0) * 0.16;
    color = mix(color, vec3<f32>(1.0, 0.88, 0.04), navPulse);
    color += vec3<f32>(0.18, 0.12, 0.01) * navPulse;
  }
  if (v.material > 9.5 && v.material < 10.5) {
    let grassGrain = fract(sin(dot(floor(v.worldPos.xy * 1.1), vec2<f32>(17.17, 41.73))) * 21845.37);
    color *= select(0.82 + grassGrain * 0.18, 0.96 + grassGrain * 0.04, v.worldPos.x < -792.0);
  }
  if (v.material > 10.5 && v.material < 11.5) {
    let leafTone = fract(sin(dot(floor(v.worldPos.xy * 0.75), vec2<f32>(9.31, 63.17))) * 19731.1);
    color = mix(color, vec3<f32>(0.08, 0.42, 0.2), 0.16 + leafTone * 0.2);
  }
  if (v.material > 11.5 && v.material < 12.5) {
    let signPulse = 0.18 + sin(camera.params.x * 5.5 + v.worldPos.x * 0.09) * 0.1;
    color = mix(color, vec3<f32>(1.0, 0.94, 0.78), signPulse);
    color += vec3<f32>(0.055, 0.04, 0.012) * signPulse;
  }
  if (v.material > 12.5 && v.material < 13.5) {
    let wave = 0.24 + sin(camera.params.x * 2.8 + v.worldPos.x * 0.42 + v.worldPos.y * 0.31) * 0.14;
    color = mix(color, vec3<f32>(0.1, 0.85, 0.92), wave);
  }
  let worldDistance = distance(v.worldPos.xy, camera.params.yz);
  if (v.material > 15.5 && v.material < 16.5) {
    let seam = smoothstep(0.035, 0.09, abs(fract(v.worldPos.z * 0.65) - 0.5));
    color *= 0.85 + seam * 0.15;
  }
  if (v.material > 16.5 && v.material < 17.5) {
    let strata = sin(v.worldPos.z * 1.8 + v.worldPos.x * 0.04 + v.worldPos.y * 0.03);
    color *= 0.93 + strata * 0.07;
  }
  if (v.material > 17.5 && v.material < 18.5) {
    color = mix(color, vec3<f32>(0.74, 0.86, 0.94), (1.0 - direct) * 0.15);
  }
  if (v.material > 18.5 && v.material < 19.5) {
    let plaster = fract(sin(dot(floor(v.worldPos.xyz * 8.0), vec3<f32>(12.7, 39.1, 18.3))) * 21941.7);
    color *= 0.95 + plaster * 0.05;
  }
  if (v.material > 19.5 && v.material < 20.5) {
    let rib = sin((v.worldPos.x + v.worldPos.y) * 19.0);
    color *= 0.9 + rib * 0.08;
  }
  if (v.material > 20.5 && v.material < 21.5) {
    let band = sin(v.worldPos.z * 0.94 + sin(v.worldPos.x * 0.013) + v.worldPos.y * 0.004);
    let grain = fract(sin(dot(floor(v.worldPos.xy * 1.8), vec2<f32>(19.7, 53.1))) * 19241.7);
    color *= 0.94 + band * 0.04 + grain * 0.025;
  }
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
}`,
    });

    const postShader = device.createShaderModule({
      code: `
@group(0) @binding(0) var postSampler: sampler;
@group(0) @binding(1) var postTexture: texture_2d<f32>;
struct PostOut {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};
@vertex fn vsPost(@builtin(vertex_index) vertexIndex: u32) -> PostOut {
  var positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  let clip = positions[vertexIndex];
  let proceduralUv = clip * 0.5 + vec2<f32>(0.5);
  var out: PostOut;
  out.position = vec4<f32>(clip, 0.0, 1.0);
  // Render-target textures use a top-left origin; the procedural sky UV used
  // by the scene pass increases upward, so resolve with one explicit Y flip.
  out.uv = vec2<f32>(proceduralUv.x, 1.0 - proceduralUv.y);
  return out;
}
fn luminance(color: vec3<f32>) -> f32 {
  return dot(color, vec3<f32>(0.2126, 0.7152, 0.0722));
}
fn bloomColor(color: vec3<f32>) -> vec3<f32> {
  let peak = max(color.r, max(color.g, color.b));
  let gate = smoothstep(0.96, 1.08, peak);
  return max(color - vec3<f32>(0.76), vec3<f32>(0.0)) * gate;
}
@fragment fn fsPost(v: PostOut) -> @location(0) vec4<f32> {
  let dimensions = vec2<f32>(textureDimensions(postTexture));
  let texel = 1.0 / dimensions;
  let uv = clamp(v.uv, vec2<f32>(0.0), vec2<f32>(1.0));
  let center = textureSample(postTexture, postSampler, uv).rgb;

  // A compact edge resolve keeps the cuboid silhouettes crisp without the
  // memory cost of a multisampled city target.
  let sampleRadius = texel * 1.25;
  let edgeNorthWest = textureSample(postTexture, postSampler, uv + sampleRadius * vec2<f32>(-1.0, 1.0)).rgb;
  let edgeNorthEast = textureSample(postTexture, postSampler, uv + sampleRadius * vec2<f32>(1.0, 1.0)).rgb;
  let edgeSouthWest = textureSample(postTexture, postSampler, uv + sampleRadius * vec2<f32>(-1.0, -1.0)).rgb;
  let edgeSouthEast = textureSample(postTexture, postSampler, uv + sampleRadius * vec2<f32>(1.0, -1.0)).rgb;
  let edgeAverage = (edgeNorthWest + edgeNorthEast + edgeSouthWest + edgeSouthEast) * 0.25;
  let edgeStrength = smoothstep(0.08, 0.34, abs(luminance(center) - luminance(edgeAverage)));
  var color = mix(center, edgeAverage, edgeStrength * 0.22);

  // Reuse the edge taps for a restrained HDR glow around only the brightest
  // route, window and sign colors. The post pass stays at five total samples.
  let glow = (
    bloomColor(edgeNorthWest)
    + bloomColor(edgeNorthEast)
    + bloomColor(edgeSouthWest)
    + bloomColor(edgeSouthEast)
  ) * 0.25;
  color += glow * 0.24;

  // Gentle highlight compression, richer chroma and a light lens falloff keep
  // the grade punchy while preserving the existing palette and HUD contrast.
  color /= vec3<f32>(1.0) + max(color - vec3<f32>(0.82), vec3<f32>(0.0)) * 0.34;
  let gray = luminance(color);
  color = mix(vec3<f32>(gray), color, 1.07);
  color = (color - vec3<f32>(0.5)) * 1.035 + vec3<f32>(0.5);
  let centered = (uv - vec2<f32>(0.5)) * vec2<f32>(dimensions.x / dimensions.y, 1.0);
  let vignette = 1.0 - smoothstep(0.42, 1.05, length(centered)) * 0.11;
  color *= vignette;
  let grain = fract(sin(dot(floor(v.position.xy), vec2<f32>(12.9898, 78.233))) * 43758.5453) - 0.5;
  color += grain * 0.006;
  return vec4<f32>(clamp(color, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}`,
    });

    const vertexBuffers = [
      {
        arrayStride: 16,
        attributes: [
          { shaderLocation: 0, offset: 0, format: "float32x3" },
          { shaderLocation: 1, offset: 12, format: "float32" },
        ],
      },
      {
        arrayStride: INSTANCE_BYTES,
        stepMode: "instance",
        attributes: [
          { shaderLocation: 2, offset: INSTANCE_FIELD_OFFSET_BYTES.world, format: "float32x4" },
          { shaderLocation: 3, offset: INSTANCE_FIELD_OFFSET_BYTES.scale, format: "float32x3" },
          { shaderLocation: 4, offset: INSTANCE_FIELD_OFFSET_BYTES.scale + 12, format: "float32" },
          { shaderLocation: 5, offset: INSTANCE_FIELD_OFFSET_BYTES.tint, format: "float32x4" },
          { shaderLocation: 6, offset: INSTANCE_FIELD_OFFSET_BYTES.orientation, format: "float32x4" },
        ],
      },
    ];

    this.horizon = new WebGPUHorizon(device, this.sceneFormat);
    this.pipeline = device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: shader,
        entryPoint: "vsMain",
        buffers: vertexBuffers,
      },
      fragment: { module: shader, entryPoint: "fsMain", targets: [{ format: this.sceneFormat }] },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil: { format: "depth24plus", depthWriteEnabled: true, depthCompare: "less" },
    });
    const surfaceVertex = {
        module: shader, entryPoint: "vsSurface",
        buffers: [{
          arrayStride: SURFACE_VERTEX_BYTES,
          attributes: [
            { shaderLocation: 0, offset: 0, format: "float32x4" },
            { shaderLocation: 1, offset: 16, format: "float32x4" },
            { shaderLocation: 2, offset: 32, format: "float32x4" },
          ],
        }],
      };
    this.surfacePipeline = device.createRenderPipeline({
      layout: "auto",
      vertex: surfaceVertex,
      fragment: { module: shader, entryPoint: "fsMain", targets: [{ format: this.sceneFormat }] },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil: { format: "depth24plus", depthWriteEnabled: true, depthCompare: "less" },
    });
    this.ghostSurfacePipeline = device.createRenderPipeline({
      layout: "auto", vertex: surfaceVertex,
      fragment: { module: shader, entryPoint: "fsGhost", targets: [{ format: this.sceneFormat, blend: {
        color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
        alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
      } }] },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil: { format: "depth24plus", depthWriteEnabled: false, depthCompare: "greater" },
    });
    this.ghostPipeline = device.createRenderPipeline({
      layout: "auto",
      vertex: { module: shader, entryPoint: "vsMain", buffers: vertexBuffers },
      fragment: {
        module: shader,
        entryPoint: "fsGhost",
        targets: [{
          format: this.sceneFormat,
          blend: {
            color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
            alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
          },
        }],
      },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil: { format: "depth24plus", depthWriteEnabled: false, depthCompare: "greater" },
    });
    this.transparentPipeline = device.createRenderPipeline({
      layout: "auto",
      vertex: { module: shader, entryPoint: "vsMain", buffers: vertexBuffers },
      fragment: {
        module: shader,
        entryPoint: "fsMain",
        targets: [{
          format: this.sceneFormat,
          blend: {
            color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
            alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
          },
        }],
      },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil: { format: "depth24plus", depthWriteEnabled: false, depthCompare: "less" },
    });
    this.postPipeline = device.createRenderPipeline({
      layout: "auto",
      vertex: { module: postShader, entryPoint: "vsPost" },
      fragment: { module: postShader, entryPoint: "fsPost", targets: [{ format: this.format }] },
      primitive: { topology: "triangle-list", cullMode: "none" },
    });

    const vertices = cubeVertices();
    this.vertexBuffer = device.createBuffer({ size: vertices.byteLength, usage: 0x20 | 0x08 });
    device.queue.writeBuffer(this.vertexBuffer, 0, vertices);
    this.cityBuffer = device.createBuffer({ size: INSTANCE_BYTES * MAX_STREAM_BOXES, usage: 0x20 | 0x08 });
    this.surfaceBuffer = device.createBuffer({ size: SURFACE_VERTEX_BYTES * SURFACE_VERTICES_PER_QUAD * MAX_STREAM_SURFACE_QUADS, usage: 0x20 | 0x08 });
    this.vehicleSurfaceBuffer = device.createBuffer({ size: SURFACE_VERTEX_BYTES * SURFACE_VERTICES_PER_QUAD * MAX_VEHICLE_SURFACE_FACES, usage: 0x20 | 0x08 });
    this.actorBuffer = device.createBuffer({ size: INSTANCE_BYTES * ACTOR_INSTANCE_CAPACITY, usage: 0x20 | 0x08 });
    this.navBuffer = device.createBuffer({ size: INSTANCE_BYTES * NAVIGATION_INSTANCE_CAPACITY, usage: 0x20 | 0x08 });
    this.ghostBuffer = device.createBuffer({ size: INSTANCE_BYTES * GHOST_INSTANCE_CAPACITY, usage: 0x20 | 0x08 });
    this.cameraBuffer = device.createBuffer({ size: CAMERA_UNIFORM_BYTES, usage: 0x40 | 0x08 });
    this.bindGroup = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.cameraBuffer } }],
    });
    this.surfaceBindGroup = device.createBindGroup({
      layout: this.surfacePipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.cameraBuffer } }],
    });
    this.ghostSurfaceBindGroup = device.createBindGroup({
      layout: this.ghostSurfacePipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.cameraBuffer } }],
    });
    this.ghostBindGroup = device.createBindGroup({
      layout: this.ghostPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.cameraBuffer } }],
    });
    this.transparentBindGroup = device.createBindGroup({
      layout: this.transparentPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.cameraBuffer } }],
    });
    this.postSampler = device.createSampler({
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      magFilter: "linear",
      minFilter: "linear",
    });
    this.resize();

    this.onUncapturedError = (event) => {
      reportRuntimeError("webgpu-uncaptured-error", event?.error ?? event);
      onFailure();
    };
    this.device.addEventListener?.("uncapturederror", this.onUncapturedError);
    void this.device.lost?.then((info: { message?: string; reason?: string } | undefined) => {
      if (this.destroyed) return;
      reportRuntimeError("webgpu-device-lost", info?.message ?? "WebGPU device lost", {
        reason: info?.reason,
      });
      onFailure();
    }).catch((error: unknown) => {
      if (this.destroyed) return;
      reportRuntimeError("webgpu-device-lost", error);
      onFailure();
    });
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const { width, height } = renderTargetSize(rect.width, rect.height,
      window.devicePixelRatio, 2500000, this.device.limits.maxTextureDimension2D);
    if (
      this.canvas.width === width
      && this.canvas.height === height
      && this.sceneTexture
      && this.sceneTextureView
      && this.depthTexture
      && this.depthTextureView
      && this.postBindGroup
    ) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.sceneTexture?.destroy?.();
    this.depthTexture?.destroy?.();
    this.sceneTexture = this.device.createTexture({
      size: [width, height],
      format: this.sceneFormat,
      usage: 0x10 | 0x04,
    });
    this.depthTexture = this.device.createTexture({
      size: [width, height],
      format: "depth24plus",
      usage: 0x10,
    });
    this.sceneTextureView = this.sceneTexture.createView();
    this.depthTextureView = this.depthTexture.createView();
    this.postBindGroup = this.device.createBindGroup({
      layout: this.postPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.postSampler },
        { binding: 1, resource: this.sceneTextureView },
      ],
    });
  }

  render(game: Game, camera: Camera, seconds: number, world: WorldView, navigationPlan: NavigationPlan) {
    if (!this.sceneTextureView || !this.depthTextureView || !this.postBindGroup) return;
    if (world.key !== this.cityKey) {
      if (world.boxes.length > MAX_STREAM_BOXES) throw new Error("Streamed city exceeded GPU instance budget");
      this.device.queue.writeBuffer(this.cityBuffer, 0, packBoxes(world.boxes));
      this.cityCount = world.boxes.length;
      const surfaces = packSurfaceQuads([...(world.landscapeSurfaces ?? []), ...(world.surfaces ?? [])]);
      this.surfaceVertexCount = surfaces.length / (SURFACE_VERTEX_BYTES / Float32Array.BYTES_PER_ELEMENT);
      if (surfaces.byteLength) this.device.queue.writeBuffer(this.surfaceBuffer, 0, surfaces);
      this.cityKey = world.key;
    }
    const playerMode = isInterior(game) ? "interior" : isDriving(game) ? "driving" : "walking";
    const showTaxi = shouldRenderTaxi(playerMode, camera.mode);
    const taxi = showTaxi ? taxiBoxes(game, { includeGroundShadow: false, includeBody: camera.vehicleDetail !== "detailed" }) : [];
    const vehicleVertices = packSurfaceQuads(showTaxi && camera.vehicleDetail === "detailed" ? detailedTaxiSurfaces(game) : []);
    const vehicleVertexCount = vehicleVertices.byteLength / SURFACE_VERTEX_BYTES;
    if (vehicleVertexCount) this.device.queue.writeBuffer(this.vehicleSurfaceBuffer, 0, vehicleVertices);
    this.canvas.dataset.vehicleDetail = camera.vehicleDetail ?? "classic";
    const taxiShadow = showTaxi ? taxiGroundShadow(game, camera.vehicleDetail === "detailed") : null;
    const playerAvatar = shouldRenderPlayerAvatar(playerMode, camera.mode)
      ? playerAvatarBoxes(game, seconds)
      : [];
    const ghostActors = [...taxi, ...playerAvatar];
    const route = navigationPlan.route;
    const cockpit = playerMode === "driving" && camera.mode === "cab"
      ? cabInteriorBoxes(game)
      : [];
    const allActors = [...dynamicBoxes(game, seconds, route, world, {
      // Draw the player with the taxi after their occlusion silhouettes. An
      // earlier avatar depth write makes its own rear faces appear occluded.
      showPlayerAvatar: false,
    }), ...cockpit, ...(taxiShadow ? [taxiShadow] : [])];
    const opaqueActors: Box[] = [];
    const transparentActors: Box[] = [];
    for (const actor of allActors) {
      if ((actor.color[3] ?? 1) < 0.99) {
        transparentActors.push(actor);
      } else {
        opaqueActors.push(actor);
      }
    }
    const actors = [...opaqueActors, ...transparentActors];
    const navigation = navigationArrowBoxes(game, seconds, navigationPlan, camera.mode);
    if (actors.length > ACTOR_INSTANCE_CAPACITY) throw new Error("Actor instance budget exceeded");
    if (navigation.length > NAVIGATION_INSTANCE_CAPACITY) throw new Error("Navigation instance budget exceeded");
    this.device.queue.writeBuffer(this.actorBuffer, 0, packBoxes(actors));
    if (navigation.length) this.device.queue.writeBuffer(this.navBuffer, 0, packBoxes(navigation));
    if (ghostActors.length > GHOST_INSTANCE_CAPACITY) throw new Error("Ghost instance budget exceeded");
    this.device.queue.writeBuffer(this.ghostBuffer, 0, packBoxes(ghostActors));
    const aspect = this.canvas.width / Math.max(1, this.canvas.height);
    const skyView = perspectiveSkyView(camera);
    const drawDistance = world.landscapeSurfaces?.length ? 1_200 : PERSPECTIVE_DRAW_DISTANCE;
    const matrix = viewProjection(game, camera, aspect, drawDistance);
    const uniform = new Float32Array(CAMERA_UNIFORM_FLOATS);
    uniform.set(matrix, 0);
    uniform.set([seconds, camera.x, camera.y, skyView?.fovY ?? 0], 16);
    uniform.set([aspect, camera.heading, skyView?.pitch ?? 0, drawDistance], 20);
    this.device.queue.writeBuffer(this.cameraBuffer, 0, uniform);

    const encoder = this.device.createCommandEncoder();
    const scenePass = encoder.beginRenderPass({
      colorAttachments: [{
        view: this.sceneTextureView,
        clearValue: { r: 0.227, g: 0.663, b: 0.941, a: 1 },
        loadOp: "clear",
        storeOp: "store",
      }],
      depthStencilAttachment: {
        view: this.depthTextureView,
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: "discard",
      },
    });
    this.canvas.dataset.horizonRegion = this.horizon.render(scenePass, game, camera, seconds, aspect);
    scenePass.setPipeline(this.pipeline);
    scenePass.setBindGroup(0, this.bindGroup);
    scenePass.setVertexBuffer(0, this.vertexBuffer);
    scenePass.setVertexBuffer(1, this.cityBuffer);
    scenePass.draw(36, this.cityCount);
    if (this.surfaceVertexCount) {
      scenePass.setPipeline(this.surfacePipeline);
      scenePass.setBindGroup(0, this.surfaceBindGroup);
      scenePass.setVertexBuffer(0, this.surfaceBuffer);
      scenePass.draw(this.surfaceVertexCount);
      scenePass.setPipeline(this.pipeline);
      scenePass.setBindGroup(0, this.bindGroup);
      scenePass.setVertexBuffer(0, this.vertexBuffer);
    }
    scenePass.setVertexBuffer(1, this.actorBuffer);
    if (opaqueActors.length) scenePass.draw(36, opaqueActors.length);
    if (navigation.length) {
      scenePass.setPipeline(this.ghostPipeline);
      scenePass.setBindGroup(0, this.ghostBindGroup);
      scenePass.setVertexBuffer(1, this.navBuffer);
      scenePass.draw(36, navigation.length);
      scenePass.setPipeline(this.pipeline);
      scenePass.setBindGroup(0, this.bindGroup);
      scenePass.draw(36, navigation.length);
    }
    if (ghostActors.length) {
      scenePass.setPipeline(this.ghostPipeline);
      scenePass.setBindGroup(0, this.ghostBindGroup);
      scenePass.setVertexBuffer(1, this.ghostBuffer);
      scenePass.draw(36, ghostActors.length);
      scenePass.setPipeline(this.pipeline);
      scenePass.setBindGroup(0, this.bindGroup);
      scenePass.draw(36, ghostActors.length);
    }
    if (vehicleVertexCount) {
      scenePass.setPipeline(this.ghostSurfacePipeline);
      scenePass.setBindGroup(0, this.ghostSurfaceBindGroup);
      scenePass.setVertexBuffer(0, this.vehicleSurfaceBuffer);
      scenePass.draw(vehicleVertexCount);
      scenePass.setPipeline(this.surfacePipeline);
      scenePass.setBindGroup(0, this.surfaceBindGroup);
      scenePass.draw(vehicleVertexCount);
    }
    if (transparentActors.length) {
      scenePass.setPipeline(this.transparentPipeline);
      scenePass.setBindGroup(0, this.transparentBindGroup);
      scenePass.setVertexBuffer(0, this.vertexBuffer);
      scenePass.setVertexBuffer(1, this.actorBuffer);
      scenePass.draw(36, transparentActors.length, 0, opaqueActors.length);
    }
    scenePass.end();

    const postPass = encoder.beginRenderPass({
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(),
        clearValue: { r: 0.02, g: 0.02, b: 0.02, a: 1 },
        loadOp: "clear",
        storeOp: "store",
      }],
    });
    postPass.setPipeline(this.postPipeline);
    postPass.setBindGroup(0, this.postBindGroup);
    postPass.draw(3);
    postPass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.onUncapturedError) {
      this.device.removeEventListener?.("uncapturederror", this.onUncapturedError);
      this.onUncapturedError = null;
    }
    this.sceneTexture?.destroy?.();
    this.depthTexture?.destroy?.();
    this.vertexBuffer?.destroy?.();
    this.cityBuffer?.destroy?.();
    this.surfaceBuffer?.destroy?.();
    this.vehicleSurfaceBuffer?.destroy?.();
    this.actorBuffer?.destroy?.();
    this.navBuffer?.destroy?.();
    this.ghostBuffer?.destroy?.();
    this.cameraBuffer?.destroy?.();
    this.horizon?.destroy();
    this.context.unconfigure?.();
    this.device.destroy?.();
  }
}

export async function createWebGPURenderer(
  canvas: HTMLCanvasElement,
  onFailure: () => void,
  shouldAbort: () => boolean,
  onProgress?: (stage: string) => void,
): Promise<WebGPURenderer | null> {
  const gpu = (navigator as Navigator & { gpu?: any }).gpu;
  if (!gpu) return null;

  let device: any = null;
  let context: any = null;
  try {
    onProgress?.("REQUESTING GPU ADAPTER...");
    const adapter = await gpu.requestAdapter({ powerPreference: "high-performance" });
    if (!adapter || shouldAbort()) return null;
    onProgress?.("CONFIGURING GPU DEVICE...");
    device = await adapter.requestDevice();
    if (!device || shouldAbort()) {
      device?.destroy?.();
      return null;
    }
    context = canvas.getContext("webgpu") as any;
    if (!context || shouldAbort()) {
      context?.unconfigure?.();
      device.destroy?.();
      return null;
    }
    onProgress?.("COMPILING WEBGPU SHADERS...");
    return new WebGPURenderer(canvas, context, device, gpu, onFailure);
  } catch (error) {
    reportRuntimeError("webgpu-init", error);
    context?.unconfigure?.();
    device?.destroy?.();
    return null;
  }
}
