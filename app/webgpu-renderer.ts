/* eslint-disable @typescript-eslint/no-explicit-any -- WebGPU is not included in this starter's DOM typings. */
"use client";

import {
  MAX_STREAM_BOXES,
  PERSPECTIVE_DRAW_DISTANCE,
} from "@/game/config";
import type {
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
import {
  MAX_STREAM_SURFACE_QUADS, SURFACE_VERTEX_BYTES, SURFACE_VERTICES_PER_QUAD, packSurfaceQuads,
} from "@/game/render/surfaces";
import { viewProjection } from "@/game/render/view-projection";
import {
  perspectiveSkyView,
  shouldRenderPlayerAvatar,
  shouldRenderTaxi,
} from "@/game/render/camera";
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
  private skyPipeline: any;
  private pipeline: any;
  private surfacePipeline: any;
  private ghostPipeline: any;
  private postPipeline: any;
  private vertexBuffer: any;
  private cityBuffer: any;
  private surfaceBuffer: any;
  private actorBuffer: any;
  private navBuffer: any;
  private ghostBuffer: any;
  private cameraBuffer: any;
  private skyBindGroup: any;
  private bindGroup: any;
  private surfaceBindGroup: any;
  private ghostBindGroup: any;
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
struct SkyOut {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};
@vertex fn vsSky(@builtin(vertex_index) vertexIndex: u32) -> SkyOut {
  var positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  let clip = positions[vertexIndex];
  var out: SkyOut;
  out.position = vec4<f32>(clip, 0.999, 1.0);
  out.uv = clip * 0.5 + vec2<f32>(0.5);
  return out;
}
fn ellipseMask(point: vec2<f32>, center: vec2<f32>, radius: vec2<f32>) -> f32 {
  let p = (point - center) / radius;
  return 1.0 - smoothstep(0.82, 1.0, dot(p, p));
}
fn rectangleMask(point: vec2<f32>, halfSize: vec2<f32>, feather: f32) -> f32 {
  let edge = max(abs(point.x) - halfSize.x, abs(point.y) - halfSize.y);
  return 1.0 - smoothstep(0.0, feather, edge);
}
fn wrapAngle(angle: f32) -> f32 {
  return angle - 6.2831853 * floor((angle + 3.14159265) / 6.2831853);
}
fn angularWindow(delta: f32, inner: f32, outer: f32) -> f32 {
  return 1.0 - smoothstep(inner, outer, abs(delta));
}
fn heightBand(elevation: f32, base: f32, top: f32, feather: f32) -> f32 {
  return smoothstep(base - feather, base, elevation) * (1.0 - smoothstep(top, top + feather, elevation));
}
fn peak(x: f32, center: f32, halfWidth: f32, height: f32) -> f32 {
  return max(0.0, 1.0 - abs(x - center) / halfWidth) * height;
}
fn hash1(value: f32) -> f32 {
  var p = fract(value * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}
fn angularRect(azimuth: f32, elevation: f32, bearing: f32, centerElevation: f32, halfSize: vec2<f32>, feather: f32) -> f32 {
  return rectangleMask(vec2<f32>(wrapAngle(azimuth - bearing), elevation - centerElevation), halfSize, feather);
}
fn cloudMask(point: vec2<f32>, scale: f32) -> f32 {
  let p = point / scale;
  let left = ellipseMask(p, vec2<f32>(-0.055, 0.0), vec2<f32>(0.064, 0.031));
  let crown = ellipseMask(p, vec2<f32>(0.0, 0.018), vec2<f32>(0.07, 0.052));
  let right = ellipseMask(p, vec2<f32>(0.066, -0.002), vec2<f32>(0.069, 0.035));
  let base = rectangleMask(p - vec2<f32>(0.008, -0.013), vec2<f32>(0.12, 0.026), 0.008);
  return max(max(left, crown), max(right, base));
}
fn paintWorldCloud(baseColor: vec3<f32>, azimuth: f32, elevation: f32, bearing: f32, cloudElevation: f32, scale: f32) -> vec3<f32> {
  let point = vec2<f32>(wrapAngle(azimuth - bearing), elevation - cloudElevation);
  let shadowPoint = point - vec2<f32>(0.008, -0.01);
  let shadow = cloudMask(shadowPoint, scale * 1.08);
  let outline = cloudMask(point, scale * 1.08);
  let body = cloudMask(point, scale);
  let localY = point.y / scale;
  let underside = body * (1.0 - smoothstep(-0.006, 0.018, localY));
  var color = mix(baseColor, vec3<f32>(0.035, 0.035, 0.03), max(shadow * 0.72, outline * 0.92));
  color = mix(color, vec3<f32>(0.96, 0.94, 0.84), body);
  color = mix(color, vec3<f32>(0.55, 0.82, 0.91), underside * 0.52);
  return color;
}
fn sunRayMask(point: vec2<f32>, thickness: f32, inner: f32, outer: f32) -> f32 {
  let p = abs(point);
  let vertical = (1.0 - smoothstep(thickness, thickness + 0.004, p.x))
    * smoothstep(inner, inner + 0.004, p.y)
    * (1.0 - smoothstep(outer, outer + 0.004, p.y));
  let horizontal = (1.0 - smoothstep(thickness, thickness + 0.004, p.y))
    * smoothstep(inner, inner + 0.004, p.x)
    * (1.0 - smoothstep(outer, outer + 0.004, p.x));
  return max(vertical, horizontal);
}
@fragment fn fsSky(v: SkyOut) -> @location(0) vec4<f32> {
  let uv = v.uv;
  let aspect = max(camera.sky.x, 0.5);
  let horizon = vec3<f32>(0.74, 0.90, 0.94);
  let middle = vec3<f32>(0.33, 0.72, 0.93);
  let zenith = vec3<f32>(0.14, 0.52, 0.83);
  var color = mix(horizon, middle, smoothstep(0.04, 0.56, uv.y));
  color = mix(color, zenith, smoothstep(0.56, 1.0, uv.y));
  let screenHaze = 1.0 - smoothstep(0.12, 0.34, abs(uv.y - 0.34));
  color = mix(color, vec3<f32>(0.82, 0.93, 0.94), screenHaze * 0.22);

  if (camera.params.w > 0.01) {
    let tanHalfFov = tan(camera.params.w * 0.5);
    let rayOffset = atan((uv.x * 2.0 - 1.0) * aspect * tanHalfFov);
    let azimuth = wrapAngle(camera.sky.y + rayOffset);
    let elevation = atan((uv.y * 2.0 - 1.0) * tanHalfFov) - camera.sky.z;
    color = mix(horizon, middle, smoothstep(-0.03, 0.24, elevation));
    color = mix(color, zenith, smoothstep(0.24, 0.66, elevation));
    let worldHaze = 1.0 - smoothstep(0.018, 0.12, abs(elevation));
    color = mix(color, vec3<f32>(0.82, 0.93, 0.94), worldHaze * 0.3);

    // Celestial dome: fixed compass bearings, never fixed screen coordinates.
    let sunPoint = vec2<f32>(wrapAngle(azimuth - 0.32), elevation - 0.19);
    let shadowPoint = sunPoint - vec2<f32>(0.008, -0.011);
    let rotatedPoint = vec2<f32>((sunPoint.x - sunPoint.y) * 0.7071, (sunPoint.x + sunPoint.y) * 0.7071);
    let rotatedShadow = vec2<f32>((shadowPoint.x - shadowPoint.y) * 0.7071, (shadowPoint.x + shadowPoint.y) * 0.7071);
    let rayShadow = max(sunRayMask(shadowPoint, 0.012, 0.08, 0.126), sunRayMask(rotatedShadow, 0.012, 0.08, 0.126));
    let ray = max(sunRayMask(sunPoint, 0.007, 0.084, 0.12), sunRayMask(rotatedPoint, 0.007, 0.084, 0.12));
    color = mix(color, vec3<f32>(0.035, 0.035, 0.03), rayShadow * 0.94);
    color = mix(color, vec3<f32>(1.0, 0.73, 0.02), ray);
    let shadowMetric = max(max(abs(shadowPoint.x), abs(shadowPoint.y)), (abs(shadowPoint.x) + abs(shadowPoint.y)) * 0.71);
    let sunMetric = max(max(abs(sunPoint.x), abs(sunPoint.y)), (abs(sunPoint.x) + abs(sunPoint.y)) * 0.71);
    let sunShadow = 1.0 - smoothstep(0.073, 0.08, shadowMetric);
    let sunRim = 1.0 - smoothstep(0.069, 0.075, sunMetric);
    let sunCore = 1.0 - smoothstep(0.055, 0.062, sunMetric);
    color = mix(color, vec3<f32>(0.035, 0.035, 0.03), sunShadow);
    color = mix(color, vec3<f32>(1.0, 0.25, 0.08), sunRim);
    color = mix(color, vec3<f32>(1.0, 0.84, 0.03), sunCore);
    color = paintWorldCloud(color, azimuth, elevation, -1.12, 0.23, 1.15);
    color = paintWorldCloud(color, azimuth, elevation, 1.08, 0.17, 0.95);
    color = paintWorldCloud(color, azimuth, elevation, -2.55, 0.25, 0.82);

    if ((abs(camera.params.z) < 792.0 || abs(camera.params.y) > 792.0)
      && !(camera.params.y >= 792.0 && camera.params.z >= 792.0)
      && !(camera.params.y < -792.0 && abs(camera.params.z) <= 792.0)) {
    // NORTH: separated mountain ranges, snow, pines and a radio mast.
    let northFar = wrapAngle(azimuth - (-1.5707963 - camera.params.y / 6000.0));
    let northGate = max(max(angularWindow(northFar + 0.48, 0.1, 0.18), angularWindow(northFar, 0.17, 0.25)), angularWindow(northFar - 0.48, 0.1, 0.18));
    let northTop = 0.025 + max(max(peak(northFar, -0.48, 0.18, 0.16), peak(northFar, -0.03, 0.27, 0.25)), peak(northFar, 0.48, 0.18, 0.18));
    let mountainOutline = northGate * heightBand(elevation, -0.065, northTop + 0.012, 0.003);
    let mountain = northGate * heightBand(elevation, -0.055, northTop, 0.005);
    color = mix(color, vec3<f32>(0.035, 0.035, 0.03), mountainOutline * 0.76);
    color = mix(color, vec3<f32>(0.40, 0.61, 0.70), mountain);
    let snow = northGate * step(0.12, northTop) * heightBand(elevation, northTop - 0.045, northTop + 0.002, 0.004);
    color = mix(color, vec3<f32>(0.95, 0.92, 0.82), snow * 0.94);
    let northNear = wrapAngle(azimuth - (-1.5707963 - camera.params.y / 2500.0));
    let pineCell = floor((northNear + 0.58) / 0.052);
    let pineCenter = (pineCell + 0.5) * 0.052 - 0.58;
    let pineTop = 0.035 + hash1(pineCell + 8.0) * 0.07;
    let pine = angularWindow(northNear, 0.49, 0.59) * step(0.2, hash1(pineCell + 14.0))
      * (1.0 - smoothstep(0.018, 0.024, abs(northNear - pineCenter))) * heightBand(elevation, -0.05, pineTop, 0.004);
    color = mix(color, vec3<f32>(0.05, 0.22, 0.17), pine);
    let mastBearing = -1.3707963 - camera.params.y / 2500.0;
    let mast = max(angularRect(azimuth, elevation, mastBearing, 0.11, vec2<f32>(0.007, 0.15), 0.003), angularRect(azimuth, elevation, mastBearing, 0.19, vec2<f32>(0.04, 0.006), 0.003));
    color = mix(color, vec3<f32>(0.28, 0.10, 0.08), mast);


    // WEST: broken downtown groups and one Art-Deco crown.
    let westFar = wrapAngle(azimuth - (3.14159265 + camera.params.z / 5200.0));
    let westGate = max(max(angularWindow(westFar + 0.48, 0.1, 0.18), angularWindow(westFar, 0.14, 0.2)), angularWindow(westFar - 0.48, 0.1, 0.18));
    let cityCell = floor((westFar + 0.6) / 0.064);
    let cityCenter = (cityCell + 0.5) * 0.064 - 0.6;
    let cityWidth = 0.022 + hash1(cityCell + 22.0) * 0.009;
    let cityTop = 0.07 + hash1(cityCell + 30.0) * 0.16;
    let cityOutline = westGate * (1.0 - smoothstep(cityWidth + 0.004, cityWidth + 0.01, abs(westFar - cityCenter))) * heightBand(elevation, -0.06, cityTop + 0.012, 0.003);
    let city = westGate * (1.0 - smoothstep(cityWidth, cityWidth + 0.004, abs(westFar - cityCenter))) * heightBand(elevation, -0.052, cityTop, 0.004);
    color = mix(color, vec3<f32>(0.035, 0.035, 0.03), cityOutline * 0.86);
    color = mix(color, vec3<f32>(0.09, 0.28, 0.37), city);
    let westNearBearing = 3.14159265 + camera.params.z / 2300.0;
    let deco = max(angularRect(azimuth, elevation, westNearBearing, 0.09, vec2<f32>(0.04, 0.14), 0.004), max(angularRect(azimuth, elevation, westNearBearing, 0.225, vec2<f32>(0.028, 0.028), 0.003), angularRect(azimuth, elevation, westNearBearing, 0.278, vec2<f32>(0.006, 0.028), 0.002)));
    color = mix(color, vec3<f32>(0.035, 0.035, 0.03), deco);

    // SOUTH: the terminal foreground yields to Copper Mesa's red-rock horizon
    // once the taxi crosses into the desert cell.
    let southFar = wrapAngle(azimuth - (1.5707963 + camera.params.y / 4700.0));
    let southGate = max(max(angularWindow(southFar + 0.48, 0.1, 0.18), angularWindow(southFar, 0.12, 0.19)), angularWindow(southFar - 0.48, 0.1, 0.18));
    let mesaTop = 0.015 + max(max(peak(southFar, -0.48, 0.2, 0.12), peak(southFar, 0.0, 0.28, 0.16)), peak(southFar, 0.48, 0.19, 0.11));
    let mesaOutline = southGate * heightBand(elevation, -0.07, mesaTop + 0.012, 0.003);
    let mesaBody = southGate * heightBand(elevation, -0.062, mesaTop, 0.004);
    color = mix(color, vec3<f32>(0.035, 0.035, 0.03), mesaOutline * 0.82);
    color = mix(color, vec3<f32>(0.52, 0.18, 0.10), mesaBody * 0.9);
    let southIndustry = 1.0 - smoothstep(860.0, 1280.0, camera.params.y);
    let warehouseCell = floor((southFar + 0.57) / 0.095);
    let warehouseCenter = (warehouseCell + 0.5) * 0.095 - 0.57;
    let warehouseTop = 0.045 + hash1(warehouseCell + 44.0) * 0.065;
    let warehouse = southIndustry * southGate * (1.0 - smoothstep(0.035, 0.043, abs(southFar - warehouseCenter))) * heightBand(elevation, -0.052, warehouseTop, 0.004);
    color = mix(color, vec3<f32>(0.29, 0.31, 0.31), warehouse);
    let southNear = 1.5707963 + camera.params.y / 2300.0;
    let stacks = southIndustry * max(angularRect(azimuth, elevation, southNear - 0.24, 0.10, vec2<f32>(0.013, 0.16), 0.003), angularRect(azimuth, elevation, southNear + 0.05, 0.08, vec2<f32>(0.015, 0.13), 0.003));
    color = mix(color, vec3<f32>(0.43, 0.14, 0.08), stacks);
    let crane = southIndustry * max(angularRect(azimuth, elevation, southNear + 0.31, 0.075, vec2<f32>(0.009, 0.13), 0.003), angularRect(azimuth, elevation, southNear + 0.255, 0.19, vec2<f32>(0.075, 0.007), 0.003));
    color = mix(color, vec3<f32>(0.94, 0.34, 0.08), crane);
    let tank = southIndustry * ellipseMask(vec2<f32>(wrapAngle(azimuth - (southNear - 0.39)), elevation), vec2<f32>(0.0, 0.16), vec2<f32>(0.065, 0.04));
    color = mix(color, vec3<f32>(0.16, 0.28, 0.31), tank);
    let desertDepth = smoothstep(900.0, 1420.0, camera.params.y);
    let cactusBearing = southNear + 0.27;
    let cactus = max(
      angularRect(azimuth, elevation, cactusBearing, 0.035, vec2<f32>(0.008, 0.085), 0.003),
      max(
        angularRect(azimuth, elevation, cactusBearing - 0.015, 0.055, vec2<f32>(0.022, 0.006), 0.003),
        angularRect(azimuth, elevation, cactusBearing + 0.017, 0.072, vec2<f32>(0.019, 0.006), 0.003)
      )
    );
    color = mix(color, vec3<f32>(0.05, 0.22, 0.12), cactus * desertDepth);

    // Cedar's low tree line replaces the old eastern harbor after arrival.
    let eastFar = wrapAngle(azimuth - (-camera.params.z / 5200.0));
    if (camera.params.y > 792.0 && abs(camera.params.z) < 792.0) {
      let treeCell = floor((eastFar + 0.7) / 0.065);
      let treeCenter = (treeCell + 0.5) * 0.065 - 0.7;
      let treeTop = 0.03 + hash1(treeCell + 18.0) * 0.024;
      let grove = angularWindow(eastFar, 0.58, 0.72)
        * (1.0 - smoothstep(0.034, 0.046, abs(eastFar - treeCenter)))
        * heightBand(elevation, -0.065, treeTop, 0.004);
      color = mix(color, vec3<f32>(0.25, 0.42, 0.29), grove);
    } else {
    // From the other regions the distant harbor retains its compass bearing.
    let eastGate = max(max(angularWindow(eastFar + 0.5, 0.1, 0.17), angularWindow(eastFar, 0.13, 0.21)), angularWindow(eastFar - 0.5, 0.1, 0.17));
    let eastWater = eastGate * heightBand(elevation, -0.052, -0.014, 0.004);
    color = mix(color, vec3<f32>(0.08, 0.43, 0.66), eastWater * 0.88);
    let eastTop = 0.025 + max(max(peak(eastFar, -0.5, 0.18, 0.07), peak(eastFar, 0.0, 0.24, 0.095)), peak(eastFar, 0.5, 0.18, 0.065));
    let eastHills = eastGate * heightBand(elevation, -0.065, eastTop, 0.005);
    color = mix(color, vec3<f32>(0.12, 0.35, 0.28), eastHills);
    let bridgeBearing = -camera.params.z / 2450.0;
    let bridgeX = wrapAngle(azimuth - bridgeBearing);
    let bridgeSpan = angularWindow(bridgeX, 0.41, 0.49);
    let bridgeDeck = bridgeSpan * heightBand(elevation, 0.004, 0.024, 0.003);
    let cableHeight = 0.075 + bridgeX * bridgeX * 0.48;
    let bridgeCable = bridgeSpan * (1.0 - smoothstep(0.004, 0.009, abs(elevation - cableHeight)));
    let bridgeTowers = max(angularRect(azimuth, elevation, bridgeBearing - 0.32, 0.105, vec2<f32>(0.013, 0.145), 0.003), angularRect(azimuth, elevation, bridgeBearing + 0.32, 0.105, vec2<f32>(0.013, 0.145), 0.003));
    color = mix(color, vec3<f32>(0.055, 0.11, 0.13), max(bridgeDeck, max(bridgeCable, bridgeTowers)));
    let lighthouseBearing = bridgeBearing - 0.5;
    let lighthouse = max(angularRect(azimuth, elevation, lighthouseBearing, 0.06, vec2<f32>(0.014, 0.1), 0.003), angularRect(azimuth, elevation, lighthouseBearing, 0.165, vec2<f32>(0.027, 0.015), 0.003));
    color = mix(color, vec3<f32>(0.95, 0.92, 0.82), lighthouse);
    }


    }
    // Palm Reach uses its physical shoreline and skyline meshes. A warm
    // marine haze keeps the open horizon legible without a false land silhouette.
    let reachDepth = smoothstep(792.0, 1120.0, min(camera.params.y, camera.params.z));
    let marineHaze = reachDepth * heightBand(elevation, -0.055, 0.07, 0.045);
    color = mix(color, vec3<f32>(0.83, 0.66, 0.71), marineHaze * 0.38);
  }

  let dotCell = floor(v.position.xy / vec2<f32>(9.0));
  let dotNoise = fract(sin(dot(dotCell, vec2<f32>(12.9898, 78.233))) * 43758.5453);
  let dot = step(0.91, dotNoise) * (1.0 - smoothstep(0.42, 0.74, uv.y));
  color *= 1.0 - dot * 0.035;
  return vec4<f32>(color, 1.0);
}
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
  return vec4<f32>(color, 1.0);
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

    this.skyPipeline = device.createRenderPipeline({
      layout: "auto",
      vertex: { module: shader, entryPoint: "vsSky" },
      fragment: { module: shader, entryPoint: "fsSky", targets: [{ format: this.sceneFormat }] },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil: { format: "depth24plus", depthWriteEnabled: false, depthCompare: "always" },
    });
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
    this.surfacePipeline = device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: shader, entryPoint: "vsSurface",
        buffers: [{
          arrayStride: SURFACE_VERTEX_BYTES,
          attributes: [
            { shaderLocation: 0, offset: 0, format: "float32x4" },
            { shaderLocation: 1, offset: 16, format: "float32x4" },
            { shaderLocation: 2, offset: 32, format: "float32x4" },
          ],
        }],
      },
      fragment: { module: shader, entryPoint: "fsMain", targets: [{ format: this.sceneFormat }] },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil: { format: "depth24plus", depthWriteEnabled: true, depthCompare: "less" },
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
    this.actorBuffer = device.createBuffer({ size: INSTANCE_BYTES * ACTOR_INSTANCE_CAPACITY, usage: 0x20 | 0x08 });
    this.navBuffer = device.createBuffer({ size: INSTANCE_BYTES * NAVIGATION_INSTANCE_CAPACITY, usage: 0x20 | 0x08 });
    this.ghostBuffer = device.createBuffer({ size: INSTANCE_BYTES * GHOST_INSTANCE_CAPACITY, usage: 0x20 | 0x08 });
    this.cameraBuffer = device.createBuffer({ size: CAMERA_UNIFORM_BYTES, usage: 0x40 | 0x08 });
    this.skyBindGroup = device.createBindGroup({
      layout: this.skyPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.cameraBuffer } }],
    });
    this.bindGroup = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.cameraBuffer } }],
    });
    this.surfaceBindGroup = device.createBindGroup({
      layout: this.surfacePipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.cameraBuffer } }],
    });
    this.ghostBindGroup = device.createBindGroup({
      layout: this.ghostPipeline.getBindGroupLayout(0),
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
    const taxi = showTaxi ? taxiBoxes(game, { includeGroundShadow: false }) : [];
    const taxiShadow = showTaxi ? taxiGroundShadow(game) : null;
    const playerAvatar = shouldRenderPlayerAvatar(playerMode, camera.mode)
      ? playerAvatarBoxes(game, seconds)
      : [];
    const ghostActors = [...taxi, ...playerAvatar];
    const route = navigationPlan.route;
    const cockpit = playerMode === "driving" && camera.mode === "cab"
      ? cabInteriorBoxes(game)
      : [];
    const actors = [...dynamicBoxes(game, seconds, route, world, {
      // Draw the player with the taxi after their occlusion silhouettes. An
      // earlier avatar depth write makes its own rear faces appear occluded.
      showPlayerAvatar: false,
    }), ...cockpit, ...(taxiShadow ? [taxiShadow] : [])];
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
    scenePass.setPipeline(this.skyPipeline);
    scenePass.setBindGroup(0, this.skyBindGroup);
    scenePass.draw(3);
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
    scenePass.draw(36, actors.length);
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
    this.actorBuffer?.destroy?.();
    this.navBuffer?.destroy?.();
    this.ghostBuffer?.destroy?.();
    this.cameraBuffer?.destroy?.();
    this.context.unconfigure?.();
    this.device.destroy?.();
  }
}

export async function createWebGPURenderer(
  canvas: HTMLCanvasElement,
  onFailure: () => void,
  shouldAbort: () => boolean,
): Promise<WebGPURenderer | null> {
  const gpu = (navigator as Navigator & { gpu?: any }).gpu;
  if (!gpu) return null;

  let device: any = null;
  let context: any = null;
  try {
    const adapter = await gpu.requestAdapter({ powerPreference: "high-performance" });
    if (!adapter || shouldAbort()) return null;
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
    return new WebGPURenderer(canvas, context, device, gpu, onFailure);
  } catch (error) {
    reportRuntimeError("webgpu-init", error);
    context?.unconfigure?.();
    device?.destroy?.();
    return null;
  }
}
