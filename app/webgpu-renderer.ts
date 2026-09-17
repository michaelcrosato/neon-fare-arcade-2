/* eslint-disable @typescript-eslint/no-explicit-any -- WebGPU is not included in this starter's DOM typings. */
"use client";

import {
  MAX_STREAM_BOXES,
  PERSPECTIVE_DRAW_DISTANCE,
} from "@/game/config";
import type {
  Box,
  Camera,
  Game,
  MeshFace,
  NavigationPlan,
  Renderer,
  WorldView,
} from "@/game/model";
import { navigationArrowBoxes } from "@/game/render/navigation-glyph";
import {
  dynamicBoxes,
  playerAvatarBoxes,
  taxiBoxes,
  taxiGroundShadow,
} from "@/game/render/scene";
import { renderTargetSize } from "@/game/render/resolution";
import { detailedTaxiSurfaces, MAX_VEHICLE_SURFACE_FACES, usesVehicleMesh } from "@/game/render/detailed-vehicles";
import {
  MAX_STREAM_SURFACE_QUADS, SURFACE_VERTEX_BYTES, SURFACE_VERTEX_FLOATS, SURFACE_VERTICES_PER_QUAD,
  packSurfaceQuadsInto, surfaceVertexFloats,
} from "@/game/render/surfaces";
import { cameraDepthRange, cameraFraming, viewProjection } from "@/game/render/view-projection";
import {
  perspectiveSkyView,
  shouldRenderPlayerAvatar,
  shouldRenderTaxi,
} from "@/game/render/camera";
import {
  adaptResolution,
  initialAdaptiveState,
  renderQuality,
  resolveRenderTier,
  type AdaptiveState,
  type RenderQuality,
} from "@/game/render/quality";
import { shadowCascades, SUN_DIRECTION } from "@/game/render/sun";
import { WebGPUHorizon } from "./webgpu-horizon";
import { reportRuntimeError } from "./runtime/runtime-errors";
import { isDriving, isInterior } from "@/game/player";
import {
  ACTOR_INSTANCE_CAPACITY,
  CAMERA_UNIFORM_BYTES,
  CAMERA_UNIFORM_FLOATS,
  GHOST_INSTANCE_CAPACITY,
  INSTANCE_BYTES,
  INSTANCE_FLOATS,
  INSTANCE_FIELD_OFFSET_BYTES,
  NAVIGATION_INSTANCE_CAPACITY,
  cubeVertices,
  packBoxesInto,
} from "@/game/render/packing";
import { MOBILE_QUERY } from "./use-mobile-layout";
import { graphicsPreference } from "./graphics-quality";
import {
  ambientOcclusionShaderCode,
  bloomShaderCode,
  postShaderCode,
  sceneShaderCode,
  shadowShaderCode,
} from "./webgpu-shaders";

const USAGE = {
  copyDst: 0x08,
  index: 0x10,
  vertex: 0x20,
  uniform: 0x40,
} as const;

const TEXTURE_USAGE = {
  copySrc: 0x01,
  copyDst: 0x02,
  textureBinding: 0x04,
  renderAttachment: 0x10,
} as const;

const SHADER_STAGE = { vertex: 0x1, fragment: 0x2 } as const;

const SCENE_FORMAT = "rgba16float";
const DEPTH_FORMAT = "depth32float";
/** shadowMatrices(3 x 16) + cascadeFar + cascadeTexel + sun + eye + forward + post. */
const FRAME_UNIFORM_FLOATS = 48 + 24;
const FRAME_UNIFORM_BYTES = FRAME_UNIFORM_FLOATS * Float32Array.BYTES_PER_ELEMENT;
/** Uniform bindings must start on a 256-byte boundary. */
const LIGHT_UNIFORM_STRIDE = 256;
const MAX_CASCADES = 3;
/** World units the occlusion estimator searches around each pixel. */
const AMBIENT_OCCLUSION_RADIUS = 1.6;

const ALPHA_BLEND = {
  color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
  alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
} as const;

const ADDITIVE_BLEND = {
  color: { srcFactor: "one", dstFactor: "one", operation: "add" },
  alpha: { srcFactor: "one", dstFactor: "one", operation: "add" },
} as const;

type PassTimings = Record<string, number>;

/** Reuse a scratch array until a larger one is genuinely needed. */
function grow(current: Float32Array<ArrayBuffer>, floats: number): Float32Array<ArrayBuffer> {
  return current.length >= floats ? current : new Float32Array(floats);
}

export class WebGPURenderer implements Renderer {
  kind = "WebGPU" as const;
  readonly quality: RenderQuality;
  private canvas: HTMLCanvasElement;
  private context: any;
  private device: any;
  private format: any;
  private horizon: WebGPUHorizon;

  private sceneLayout: any;
  private shadowLayout: any;
  private bloomLayout: any;
  private aoLayout: any;
  private postLayout: any;

  private pipeline: any;
  private surfacePipeline: any;
  private ghostSurfacePipeline: any;
  private ghostPipeline: any;
  private transparentPipeline: any;
  private shadowBoxPipeline: any;
  private shadowSurfacePipeline: any;
  private bloomPrefilterPipeline: any;
  private bloomDownPipeline: any;
  private bloomUpPipeline: any;
  private aoPipeline: any;
  private postPipeline: any;

  private vertexBuffer: any;
  private cityBuffer: any;
  private surfaceBuffer: any;
  private vehicleSurfaceBuffer: any;
  private actorBuffer: any;
  private navBuffer: any;
  private ghostBuffer: any;
  private cameraBuffer: any;
  private frameBuffer: any;
  private lightBuffer: any;
  private bloomParamBuffers: any[] = [];
  private aoParamBuffer: any;
  private gradeBuffer: any;

  private sceneBindGroup: any;
  private shadowBindGroups: any[] = [];
  private postBindGroup: any = null;
  private bloomBindGroups: any[] = [];
  private aoBindGroup: any = null;

  private shadowTexture: any = null;
  private shadowViews: any[] = [];
  private shadowArrayView: any = null;
  private shadowSampler: any;
  private linearSampler: any;
  private sceneTexture: any = null;
  private sceneTextureView: any = null;
  private msaaTexture: any = null;
  private msaaTextureView: any = null;
  private depthTexture: any = null;
  private depthTextureView: any = null;
  private bloomTexture: any = null;
  private bloomViews: any[] = [];
  private aoTexture: any = null;
  private aoTextureView: any = null;

  private cityCount = 0;
  private surfaceVertexCount = 0;
  private cityKey = "";
  private destroyed = false;
  private onUncapturedError: ((event?: { error?: unknown }) => void) | null = null;

  private actorScratch: Float32Array;
  private navScratch: Float32Array;
  private ghostScratch: Float32Array;
  private cameraScratch = new Float32Array(CAMERA_UNIFORM_FLOATS);
  private frameScratch = new Float32Array(FRAME_UNIFORM_FLOATS);
  private lightScratch = new Float32Array(LIGHT_UNIFORM_STRIDE / 4);
  private opaqueActors: Box[] = [];
  private transparentActors: Box[] = [];
  // Grown on demand rather than sized for the worst case: the city stream is
  // repacked on every chunk crossing and the vehicle mesh on every frame.
  private cityScratch: Float32Array<ArrayBuffer> = new Float32Array(0);
  private surfaceScratch: Float32Array<ArrayBuffer> = new Float32Array(0);
  private vehicleScratch: Float32Array<ArrayBuffer> = new Float32Array(0);
  private worldFaces: MeshFace[] = [];

  private adaptive: AdaptiveState = initialAdaptiveState();
  private adaptiveWindowStart = 0;
  private adaptiveFrames = 0;
  private adaptiveTotal = 0;
  private pendingResize = false;
  private lastVehicleDetail = "";
  private lastHorizonRegion = "";

  private querySet: any = null;
  private queryResolve: any = null;
  private queryReadback: any = null;
  private queryBusy = false;
  private timings: PassTimings = {};
  private timingSamples: PassTimings[] = [];
  private frameIndex = 0;

  constructor(
    canvas: HTMLCanvasElement,
    context: any,
    device: any,
    gpu: any,
    onFailure: () => void,
    quality: RenderQuality,
  ) {
    this.canvas = canvas;
    this.context = context;
    this.device = device;
    this.quality = quality;
    this.format = gpu.getPreferredCanvasFormat();
    this.context.configure({ device, format: this.format, alphaMode: "opaque" });

    this.actorScratch = new Float32Array(ACTOR_INSTANCE_CAPACITY * INSTANCE_FLOATS);
    this.navScratch = new Float32Array(NAVIGATION_INSTANCE_CAPACITY * INSTANCE_FLOATS);
    this.ghostScratch = new Float32Array(GHOST_INSTANCE_CAPACITY * INSTANCE_FLOATS);

    const sampleCount = quality.sampleCount;
    const shader = device.createShaderModule({
      code: sceneShaderCode({ shadowCascades: quality.shadowCascades, shadowTaps: quality.shadowTaps }),
    });
    const shadowShader = device.createShaderModule({ code: shadowShaderCode() });
    const bloomShader = quality.bloomLevels > 0
      ? device.createShaderModule({ code: bloomShaderCode() })
      : null;
    const aoShader = quality.ambientOcclusion
      ? device.createShaderModule({ code: ambientOcclusionShaderCode({ sampleCount }) })
      : null;
    const postShader = device.createShaderModule({
      code: postShaderCode({
        bloomLevels: quality.bloomLevels,
        ambientOcclusion: quality.ambientOcclusion,
        sharpen: quality.sharpen,
        sampleCount,
      }),
    });

    // One explicit layout means one bind group for every scene pipeline instead
    // of five equivalent groups produced by `layout: "auto"`.
    this.sceneLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: SHADER_STAGE.vertex | SHADER_STAGE.fragment, buffer: { type: "uniform" } },
        { binding: 1, visibility: SHADER_STAGE.vertex | SHADER_STAGE.fragment, buffer: { type: "uniform" } },
        { binding: 2, visibility: SHADER_STAGE.fragment, texture: { sampleType: "depth", viewDimension: "2d-array" } },
        { binding: 3, visibility: SHADER_STAGE.fragment, sampler: { type: "comparison" } },
      ],
    });
    this.shadowLayout = device.createBindGroupLayout({
      entries: [{
        binding: 0,
        visibility: SHADER_STAGE.vertex,
        buffer: { type: "uniform", hasDynamicOffset: false, minBindingSize: CAMERA_UNIFORM_BYTES },
      }],
    });
    const scenePipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [this.sceneLayout] });
    const shadowPipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [this.shadowLayout] });

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
    const surfaceBuffers = [{
      arrayStride: SURFACE_VERTEX_BYTES,
      attributes: [
        { shaderLocation: 0, offset: 0, format: "float32x4" },
        { shaderLocation: 1, offset: 16, format: "float32x4" },
        { shaderLocation: 2, offset: 32, format: "float32x4" },
      ],
    }];

    const sceneDepth = { format: DEPTH_FORMAT, depthWriteEnabled: true, depthCompare: "less" };
    const overlayDepth = { format: DEPTH_FORMAT, depthWriteEnabled: false, depthCompare: "greater" };
    const multisample = { count: sampleCount };

    this.horizon = new WebGPUHorizon(device, SCENE_FORMAT, sampleCount, DEPTH_FORMAT);

    // Cuboids are closed volumes whose faces wind consistently once the scale is
    // made positive, and both shared projections mirror X, so the outward faces
    // arrive clockwise. Culling the inward half removes roughly half of the
    // scene's fragment work.
    const solidPrimitive = { topology: "triangle-list", cullMode: "back", frontFace: "cw" } as const;
    const doubleSidedPrimitive = { topology: "triangle-list", cullMode: "none" } as const;

    this.pipeline = device.createRenderPipeline({
      layout: scenePipelineLayout,
      vertex: { module: shader, entryPoint: "vsMain", buffers: vertexBuffers },
      fragment: { module: shader, entryPoint: "fsMain", targets: [{ format: SCENE_FORMAT }] },
      primitive: solidPrimitive,
      depthStencil: sceneDepth,
      multisample,
    });
    const surfaceVertex = { module: shader, entryPoint: "vsSurface", buffers: surfaceBuffers };
    this.surfacePipeline = device.createRenderPipeline({
      layout: scenePipelineLayout,
      vertex: surfaceVertex,
      fragment: { module: shader, entryPoint: "fsMain", targets: [{ format: SCENE_FORMAT }] },
      // Road, terrain and vehicle faces are authored without a winding rule.
      primitive: doubleSidedPrimitive,
      depthStencil: sceneDepth,
      multisample,
    });
    this.ghostSurfacePipeline = device.createRenderPipeline({
      layout: scenePipelineLayout,
      vertex: surfaceVertex,
      fragment: { module: shader, entryPoint: "fsGhost", targets: [{ format: SCENE_FORMAT, blend: ALPHA_BLEND }] },
      primitive: doubleSidedPrimitive,
      depthStencil: overlayDepth,
      multisample,
    });
    this.ghostPipeline = device.createRenderPipeline({
      layout: scenePipelineLayout,
      vertex: { module: shader, entryPoint: "vsMain", buffers: vertexBuffers },
      fragment: { module: shader, entryPoint: "fsGhost", targets: [{ format: SCENE_FORMAT, blend: ALPHA_BLEND }] },
      primitive: solidPrimitive,
      depthStencil: overlayDepth,
      multisample,
    });
    this.transparentPipeline = device.createRenderPipeline({
      layout: scenePipelineLayout,
      vertex: { module: shader, entryPoint: "vsMain", buffers: vertexBuffers },
      fragment: { module: shader, entryPoint: "fsMain", targets: [{ format: SCENE_FORMAT, blend: ALPHA_BLEND }] },
      primitive: solidPrimitive,
      depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: false, depthCompare: "less" },
      multisample,
    });

    if (quality.shadowCascades > 0) {
      // Rendering only the far side of each caster keeps the stored depth
      // behind the lit surface, which removes shadow acne without a large bias.
      this.shadowBoxPipeline = device.createRenderPipeline({
        layout: shadowPipelineLayout,
        vertex: { module: shadowShader, entryPoint: "vsBox", buffers: vertexBuffers },
        primitive: { topology: "triangle-list", cullMode: "front", frontFace: "ccw" },
        depthStencil: {
          format: DEPTH_FORMAT,
          depthWriteEnabled: true,
          depthCompare: "less",
          depthBias: 2,
          depthBiasSlopeScale: 2.5,
          depthBiasClamp: 0.01,
        },
      });
      this.shadowSurfacePipeline = device.createRenderPipeline({
        layout: shadowPipelineLayout,
        vertex: { module: shadowShader, entryPoint: "vsSurface", buffers: surfaceBuffers },
        primitive: doubleSidedPrimitive,
        depthStencil: {
          format: DEPTH_FORMAT,
          depthWriteEnabled: true,
          depthCompare: "less",
          depthBias: 4,
          depthBiasSlopeScale: 3.5,
          depthBiasClamp: 0.02,
        },
      });
    }

    if (bloomShader) {
      this.bloomLayout = device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: SHADER_STAGE.fragment, sampler: { type: "filtering" } },
          { binding: 1, visibility: SHADER_STAGE.fragment, texture: { sampleType: "float" } },
          { binding: 2, visibility: SHADER_STAGE.fragment, buffer: { type: "uniform" } },
        ],
      });
      const bloomPipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [this.bloomLayout] });
      const bloomPipeline = (entryPoint: string, blend?: unknown) => device.createRenderPipeline({
        layout: bloomPipelineLayout,
        vertex: { module: bloomShader, entryPoint: "vsFullscreen" },
        fragment: { module: bloomShader, entryPoint, targets: [{ format: SCENE_FORMAT, ...(blend ? { blend } : {}) }] },
        primitive: { topology: "triangle-list", cullMode: "none" },
      });
      this.bloomPrefilterPipeline = bloomPipeline("fsPrefilter");
      this.bloomDownPipeline = bloomPipeline("fsDown");
      this.bloomUpPipeline = bloomPipeline("fsUp", ADDITIVE_BLEND);
    }

    if (aoShader) {
      this.aoLayout = device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: SHADER_STAGE.fragment,
            texture: { sampleType: "depth", multisampled: sampleCount > 1 },
          },
          { binding: 1, visibility: SHADER_STAGE.fragment, buffer: { type: "uniform" } },
        ],
      });
      this.aoPipeline = device.createRenderPipeline({
        layout: device.createPipelineLayout({ bindGroupLayouts: [this.aoLayout] }),
        vertex: { module: aoShader, entryPoint: "vsFullscreen" },
        fragment: { module: aoShader, entryPoint: "fsAo", targets: [{ format: "r8unorm" }] },
        primitive: { topology: "triangle-list", cullMode: "none" },
      });
    }

    const postEntries: any[] = [
      { binding: 0, visibility: SHADER_STAGE.fragment, sampler: { type: "filtering" } },
      { binding: 1, visibility: SHADER_STAGE.fragment, texture: { sampleType: "float" } },
      { binding: 2, visibility: SHADER_STAGE.fragment, buffer: { type: "uniform" } },
    ];
    if (quality.bloomLevels > 0) {
      postEntries.push({ binding: 3, visibility: SHADER_STAGE.fragment, texture: { sampleType: "float" } });
    }
    if (quality.ambientOcclusion) {
      postEntries.push({ binding: 4, visibility: SHADER_STAGE.fragment, texture: { sampleType: "float" } });
    }
    this.postLayout = device.createBindGroupLayout({ entries: postEntries });
    this.postPipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [this.postLayout] }),
      vertex: { module: postShader, entryPoint: "vsFullscreen" },
      fragment: { module: postShader, entryPoint: "fsPost", targets: [{ format: this.format }] },
      primitive: { topology: "triangle-list", cullMode: "none" },
    });

    const vertices = cubeVertices();
    this.vertexBuffer = device.createBuffer({ size: vertices.byteLength, usage: USAGE.vertex | USAGE.copyDst });
    device.queue.writeBuffer(this.vertexBuffer, 0, vertices);
    this.cityBuffer = device.createBuffer({ size: INSTANCE_BYTES * MAX_STREAM_BOXES, usage: USAGE.vertex | USAGE.copyDst });
    this.surfaceBuffer = device.createBuffer({ size: SURFACE_VERTEX_BYTES * SURFACE_VERTICES_PER_QUAD * MAX_STREAM_SURFACE_QUADS, usage: USAGE.vertex | USAGE.copyDst });
    this.vehicleSurfaceBuffer = device.createBuffer({ size: SURFACE_VERTEX_BYTES * SURFACE_VERTICES_PER_QUAD * MAX_VEHICLE_SURFACE_FACES, usage: USAGE.vertex | USAGE.copyDst });
    this.actorBuffer = device.createBuffer({ size: INSTANCE_BYTES * ACTOR_INSTANCE_CAPACITY, usage: USAGE.vertex | USAGE.copyDst });
    this.navBuffer = device.createBuffer({ size: INSTANCE_BYTES * NAVIGATION_INSTANCE_CAPACITY, usage: USAGE.vertex | USAGE.copyDst });
    this.ghostBuffer = device.createBuffer({ size: INSTANCE_BYTES * GHOST_INSTANCE_CAPACITY, usage: USAGE.vertex | USAGE.copyDst });
    this.cameraBuffer = device.createBuffer({ size: CAMERA_UNIFORM_BYTES, usage: USAGE.uniform | USAGE.copyDst });
    this.frameBuffer = device.createBuffer({ size: FRAME_UNIFORM_BYTES, usage: USAGE.uniform | USAGE.copyDst });
    this.lightBuffer = device.createBuffer({
      size: LIGHT_UNIFORM_STRIDE * MAX_CASCADES,
      usage: USAGE.uniform | USAGE.copyDst,
    });
    this.gradeBuffer = device.createBuffer({ size: 32, usage: USAGE.uniform | USAGE.copyDst });
    if (quality.ambientOcclusion) {
      this.aoParamBuffer = device.createBuffer({ size: 48, usage: USAGE.uniform | USAGE.copyDst });
    }
    for (let level = 0; level <= quality.bloomLevels; level += 1) {
      this.bloomParamBuffers.push(device.createBuffer({ size: 32, usage: USAGE.uniform | USAGE.copyDst }));
    }

    this.shadowSampler = device.createSampler({
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      magFilter: "linear",
      minFilter: "linear",
      compare: "less",
    });
    this.linearSampler = device.createSampler({
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      magFilter: "linear",
      minFilter: "linear",
    });

    this.createShadowResources();
    for (let index = 0; index < MAX_CASCADES; index += 1) {
      this.shadowBindGroups.push(device.createBindGroup({
        layout: this.shadowLayout,
        entries: [{
          binding: 0,
          resource: { buffer: this.lightBuffer, offset: index * LIGHT_UNIFORM_STRIDE, size: CAMERA_UNIFORM_BYTES },
        }],
      }));
    }
    this.sceneBindGroup = device.createBindGroup({
      layout: this.sceneLayout,
      entries: [
        { binding: 0, resource: { buffer: this.cameraBuffer } },
        { binding: 1, resource: { buffer: this.frameBuffer } },
        { binding: 2, resource: this.shadowArrayView },
        { binding: 3, resource: this.shadowSampler },
      ],
    });

    if (device.features?.has?.("timestamp-query")) {
      try {
        this.querySet = device.createQuerySet({ type: "timestamp", count: 6 });
        this.queryResolve = device.createBuffer({ size: 6 * 8, usage: 0x0200 | 0x0004 });
        this.queryReadback = device.createBuffer({ size: 6 * 8, usage: 0x0001 | 0x0008 });
      } catch {
        this.querySet = null;
      }
    }

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

  private createShadowResources() {
    const cascades = Math.max(1, this.quality.shadowCascades);
    const size = this.quality.shadowCascades > 0 ? this.quality.shadowMapSize : 16;
    this.shadowTexture = this.device.createTexture({
      size: [size, size, cascades],
      format: DEPTH_FORMAT,
      usage: TEXTURE_USAGE.renderAttachment | TEXTURE_USAGE.textureBinding,
    });
    this.shadowViews = [];
    for (let index = 0; index < cascades; index += 1) {
      this.shadowViews.push(this.shadowTexture.createView({
        dimension: "2d",
        baseArrayLayer: index,
        arrayLayerCount: 1,
      }));
    }
    this.shadowArrayView = this.shadowTexture.createView({ dimension: "2d-array" });
  }

  /** Scene surface size for the current quality tier and adaptive scale. */
  private targetSize() {
    const rect = this.canvas.getBoundingClientRect();
    const budget = this.quality.pixelBudget * this.adaptive.scale * this.adaptive.scale;
    return renderTargetSize(rect.width, rect.height, window.devicePixelRatio, budget,
      this.device.limits.maxTextureDimension2D);
  }

  resize() {
    const { width, height } = this.targetSize();
    if (
      this.canvas.width === width
      && this.canvas.height === height
      && this.sceneTextureView
      && this.depthTextureView
      && this.postBindGroup
    ) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.releaseSurfaces();

    const sampleCount = this.quality.sampleCount;
    this.sceneTexture = this.device.createTexture({
      size: [width, height],
      format: SCENE_FORMAT,
      usage: TEXTURE_USAGE.renderAttachment | TEXTURE_USAGE.textureBinding,
    });
    this.sceneTextureView = this.sceneTexture.createView();
    if (sampleCount > 1) {
      this.msaaTexture = this.device.createTexture({
        size: [width, height],
        format: SCENE_FORMAT,
        sampleCount,
        usage: TEXTURE_USAGE.renderAttachment,
      });
      this.msaaTextureView = this.msaaTexture.createView();
    }
    this.depthTexture = this.device.createTexture({
      size: [width, height],
      format: DEPTH_FORMAT,
      sampleCount,
      usage: TEXTURE_USAGE.renderAttachment
        | (this.quality.ambientOcclusion ? TEXTURE_USAGE.textureBinding : 0),
    });
    this.depthTextureView = this.depthTexture.createView();

    const levels = this.quality.bloomLevels;
    this.bloomViews = [];
    if (levels > 0) {
      // Every mip halves again, so clamp the chain before a level would round
      // to zero on a small or heavily downscaled surface.
      const usable = Math.max(1, Math.min(levels, Math.floor(Math.log2(Math.max(8, Math.min(width, height)))) - 2));
      this.bloomTexture = this.device.createTexture({
        size: [Math.max(1, width >> 1), Math.max(1, height >> 1)],
        format: SCENE_FORMAT,
        mipLevelCount: usable,
        usage: TEXTURE_USAGE.renderAttachment | TEXTURE_USAGE.textureBinding,
      });
      for (let level = 0; level < usable; level += 1) {
        this.bloomViews.push(this.bloomTexture.createView({
          baseMipLevel: level,
          mipLevelCount: 1,
        }));
      }
      this.bloomBindGroups = [];
      // Level 0 reads the resolved scene; each later level reads the one above.
      this.bloomBindGroups.push(this.device.createBindGroup({
        layout: this.bloomLayout,
        entries: [
          { binding: 0, resource: this.linearSampler },
          { binding: 1, resource: this.sceneTextureView },
          { binding: 2, resource: { buffer: this.bloomParamBuffers[0] } },
        ],
      }));
      for (let level = 0; level < usable; level += 1) {
        this.bloomBindGroups.push(this.device.createBindGroup({
          layout: this.bloomLayout,
          entries: [
            { binding: 0, resource: this.linearSampler },
            { binding: 1, resource: this.bloomViews[level] },
            { binding: 2, resource: { buffer: this.bloomParamBuffers[Math.min(level + 1, this.bloomParamBuffers.length - 1)] } },
          ],
        }));
      }
    }

    if (this.quality.ambientOcclusion) {
      this.aoTexture = this.device.createTexture({
        size: [Math.max(1, width >> 1), Math.max(1, height >> 1)],
        format: "r8unorm",
        usage: TEXTURE_USAGE.renderAttachment | TEXTURE_USAGE.textureBinding,
      });
      this.aoTextureView = this.aoTexture.createView();
      this.aoBindGroup = this.device.createBindGroup({
        layout: this.aoLayout,
        entries: [
          { binding: 0, resource: this.depthTextureView },
          { binding: 1, resource: { buffer: this.aoParamBuffer } },
        ],
      });
    }

    const postEntries: any[] = [
      { binding: 0, resource: this.linearSampler },
      { binding: 1, resource: this.sceneTextureView },
      { binding: 2, resource: { buffer: this.gradeBuffer } },
    ];
    if (levels > 0) postEntries.push({ binding: 3, resource: this.bloomViews[0] });
    if (this.quality.ambientOcclusion) postEntries.push({ binding: 4, resource: this.aoTextureView });
    this.postBindGroup = this.device.createBindGroup({ layout: this.postLayout, entries: postEntries });
  }

  private releaseSurfaces() {
    this.sceneTexture?.destroy?.();
    this.msaaTexture?.destroy?.();
    this.depthTexture?.destroy?.();
    this.bloomTexture?.destroy?.();
    this.aoTexture?.destroy?.();
    this.sceneTexture = null;
    this.msaaTexture = null;
    this.msaaTextureView = null;
    this.depthTexture = null;
    this.bloomTexture = null;
    this.aoTexture = null;
    this.aoTextureView = null;
  }

  /** Measured frame cost, sampled over whole seconds, drives dynamic resolution. */
  private trackFrameCost(now: number) {
    if (!this.adaptiveWindowStart) {
      this.adaptiveWindowStart = now;
      return;
    }
    this.adaptiveFrames += 1;
    this.adaptiveTotal = now - this.adaptiveWindowStart;
    if (this.adaptiveTotal < 1000 || this.adaptiveFrames < 20) return;
    const average = this.adaptiveTotal / this.adaptiveFrames;
    const target = 1000 / 60;
    const next = adaptResolution(this.adaptive, average, target);
    this.adaptiveWindowStart = now;
    this.adaptiveFrames = 0;
    if (next.scale !== this.adaptive.scale) {
      this.adaptive = next;
      this.pendingResize = true;
    } else {
      this.adaptive = next;
    }
  }

  render(game: Game, camera: Camera, seconds: number, world: WorldView, navigationPlan: NavigationPlan) {
    if (this.pendingResize) {
      this.pendingResize = false;
      try { this.resize(); } catch (error) { reportRuntimeError("webgpu-adaptive-resize", error); }
    }
    if (!this.sceneTextureView || !this.depthTextureView || !this.postBindGroup) return;
    this.trackFrameCost(performance.now());
    if (world.key !== this.cityKey) {
      if (world.boxes.length > MAX_STREAM_BOXES) throw new Error("Streamed city exceeded GPU instance budget");
      this.cityScratch = grow(this.cityScratch, world.boxes.length * INSTANCE_FLOATS);
      const instanceFloats = packBoxesInto(world.boxes, this.cityScratch);
      if (instanceFloats) {
        this.device.queue.writeBuffer(this.cityBuffer, 0, this.cityScratch, 0, instanceFloats);
      }
      this.cityCount = world.boxes.length;
      this.worldFaces.length = 0;
      for (const face of world.landscapeSurfaces ?? []) this.worldFaces.push(face);
      for (const face of world.surfaces ?? []) this.worldFaces.push(face);
      this.surfaceScratch = grow(this.surfaceScratch, surfaceVertexFloats(this.worldFaces));
      const surfaceFloats = packSurfaceQuadsInto(this.worldFaces, this.surfaceScratch);
      this.surfaceVertexCount = surfaceFloats / SURFACE_VERTEX_FLOATS;
      if (surfaceFloats) {
        this.device.queue.writeBuffer(this.surfaceBuffer, 0, this.surfaceScratch, 0, surfaceFloats);
      }
      this.cityKey = world.key;
    }
    const playerMode = isInterior(game) ? "interior" : isDriving(game) ? "driving" : "walking";
    const showTaxi = shouldRenderTaxi(playerMode, camera.mode);
    const mesh = usesVehicleMesh(game, camera);
    const taxi = showTaxi ? taxiBoxes(game, { includeGroundShadow: false, includeBody: !mesh }) : [];
    const vehicleFaces = showTaxi && mesh ? detailedTaxiSurfaces(game) : [];
    this.vehicleScratch = grow(this.vehicleScratch, surfaceVertexFloats(vehicleFaces));
    const vehicleFloats = packSurfaceQuadsInto(vehicleFaces, this.vehicleScratch);
    const vehicleVertexCount = vehicleFloats / SURFACE_VERTEX_FLOATS;
    if (vehicleFloats) {
      this.device.queue.writeBuffer(this.vehicleSurfaceBuffer, 0, this.vehicleScratch, 0, vehicleFloats);
    }
    const vehicleDetail = camera.vehicleDetail ?? "classic";
    if (vehicleDetail !== this.lastVehicleDetail) {
      this.lastVehicleDetail = vehicleDetail;
      this.canvas.dataset.vehicleDetail = vehicleDetail;
    }
    // A real cast shadow replaces the painted contact decal; drawing both would
    // darken the same ground twice.
    const taxiShadow = showTaxi && this.quality.shadowCascades === 0 ? taxiGroundShadow(game, mesh) : null;
    const playerAvatar = shouldRenderPlayerAvatar(playerMode, camera.mode)
      ? playerAvatarBoxes(game, seconds)
      : [];
    const ghostActors = [...taxi, ...playerAvatar];
    const route = navigationPlan.route;
    const allActors = dynamicBoxes(game, seconds, route, world, {
      // Draw the player with the taxi after their occlusion silhouettes. An
      // earlier avatar depth write makes its own rear faces appear occluded.
      showPlayerAvatar: false,
      navigation: navigationPlan,
    });
    if (taxiShadow) allActors.push(taxiShadow);
    this.opaqueActors.length = 0;
    this.transparentActors.length = 0;
    for (const actor of allActors) {
      if ((actor.color[3] ?? 1) < 0.99) this.transparentActors.push(actor);
      else this.opaqueActors.push(actor);
    }
    const opaqueCount = this.opaqueActors.length;
    const transparentCount = this.transparentActors.length;
    const actorCount = opaqueCount + transparentCount;
    const navigation = navigationArrowBoxes(game, seconds, navigationPlan, camera.mode);
    if (actorCount > ACTOR_INSTANCE_CAPACITY) throw new Error("Actor instance budget exceeded");
    if (navigation.length > NAVIGATION_INSTANCE_CAPACITY) throw new Error("Navigation instance budget exceeded");
    if (ghostActors.length > GHOST_INSTANCE_CAPACITY) throw new Error("Ghost instance budget exceeded");
    packBoxesInto(this.opaqueActors, this.actorScratch);
    packBoxesInto(this.transparentActors, this.actorScratch.subarray(opaqueCount * INSTANCE_FLOATS));
    if (actorCount) {
      this.device.queue.writeBuffer(this.actorBuffer, 0, this.actorScratch, 0, actorCount * INSTANCE_FLOATS);
    }
    if (navigation.length) {
      packBoxesInto(navigation, this.navScratch);
      this.device.queue.writeBuffer(this.navBuffer, 0, this.navScratch, 0, navigation.length * INSTANCE_FLOATS);
    }
    if (ghostActors.length) {
      packBoxesInto(ghostActors, this.ghostScratch);
      this.device.queue.writeBuffer(this.ghostBuffer, 0, this.ghostScratch, 0, ghostActors.length * INSTANCE_FLOATS);
    }

    const aspect = this.canvas.width / Math.max(1, this.canvas.height);
    const skyView = perspectiveSkyView(camera);
    const drawDistance = world.landscapeSurfaces?.length ? 1_200 : PERSPECTIVE_DRAW_DISTANCE;
    const matrix = viewProjection(game, camera, aspect, drawDistance);
    const uniform = this.cameraScratch;
    uniform.set(matrix, 0);
    uniform[16] = seconds;
    uniform[17] = camera.x;
    uniform[18] = camera.y;
    uniform[19] = skyView?.fovY ?? 0;
    uniform[20] = aspect;
    uniform[21] = camera.heading;
    uniform[22] = skyView?.pitch ?? 0;
    uniform[23] = drawDistance;
    this.device.queue.writeBuffer(this.cameraBuffer, 0, uniform);

    const cascades = this.quality.shadowCascades > 0 && !isInterior(game)
      ? shadowCascades(game, camera, aspect, drawDistance, this.quality.shadowCascades,
        this.quality.shadowMapSize, Math.min(drawDistance, this.quality.shadowDistance))
      : [];
    const framing = cameraFraming(game, camera, aspect);
    const forwardX = framing.target[0] - framing.eye[0];
    const forwardY = framing.target[1] - framing.eye[1];
    const forwardZ = framing.target[2] - framing.eye[2];
    const forwardLength = Math.hypot(forwardX, forwardY, forwardZ) || 1;
    const frame = this.frameScratch;
    frame.fill(0);
    for (let index = 0; index < cascades.length; index += 1) {
      frame.set(cascades[index].matrix, index * 16);
      frame[48 + index] = cascades[index].far;
      frame[52 + index] = cascades[index].texelWorldSize;
    }
    // Receivers past the last cascade need a far value they can never exceed.
    for (let index = cascades.length; index < MAX_CASCADES; index += 1) {
      frame[48 + index] = cascades.length ? cascades[cascades.length - 1].far : 1;
      frame[52 + index] = cascades.length ? cascades[cascades.length - 1].texelWorldSize : 1;
    }
    frame[51] = cascades.length;
    frame[56] = SUN_DIRECTION[0];
    frame[57] = SUN_DIRECTION[1];
    frame[58] = SUN_DIRECTION[2];
    frame[59] = cascades.length ? 1 : 0;
    frame[60] = framing.eye[0];
    frame[61] = framing.eye[1];
    frame[62] = framing.eye[2];
    frame[63] = camera.mode === "cab" ? 0.08 : 0.1;
    frame[64] = forwardX / forwardLength;
    frame[65] = forwardY / forwardLength;
    frame[66] = forwardZ / forwardLength;
    frame[67] = drawDistance;
    frame[71] = this.quality.shadowCascades > 0 ? 1 / this.quality.shadowMapSize : 0;
    this.device.queue.writeBuffer(this.frameBuffer, 0, frame);

    for (let index = 0; index < cascades.length; index += 1) {
      this.lightScratch.fill(0);
      this.lightScratch.set(cascades[index].matrix, 0);
      this.lightScratch[16] = seconds;
      this.device.queue.writeBuffer(this.lightBuffer, index * LIGHT_UNIFORM_STRIDE,
        this.lightScratch, 0, CAMERA_UNIFORM_FLOATS);
    }

    const encoder = this.device.createCommandEncoder();
    const timed = Boolean(this.querySet) && !this.queryBusy && this.frameIndex % 12 === 0;

    for (let index = 0; index < cascades.length; index += 1) {
      const shadowPass = encoder.beginRenderPass({
        colorAttachments: [],
        depthStencilAttachment: {
          view: this.shadowViews[index],
          depthClearValue: 1,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
        ...(timed && index === 0
          ? { timestampWrites: { querySet: this.querySet, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 } }
          : {}),
      });
      shadowPass.setPipeline(this.shadowBoxPipeline);
      shadowPass.setBindGroup(0, this.shadowBindGroups[index]);
      shadowPass.setVertexBuffer(0, this.vertexBuffer);
      shadowPass.setVertexBuffer(1, this.cityBuffer);
      if (this.cityCount) shadowPass.draw(36, this.cityCount);
      if (opaqueCount) {
        shadowPass.setVertexBuffer(1, this.actorBuffer);
        shadowPass.draw(36, opaqueCount);
      }
      if (ghostActors.length) {
        shadowPass.setVertexBuffer(1, this.ghostBuffer);
        shadowPass.draw(36, ghostActors.length);
      }
      if (this.quality.shadowCastsSurfaces) {
        if (this.surfaceVertexCount) {
          shadowPass.setPipeline(this.shadowSurfacePipeline);
          shadowPass.setVertexBuffer(0, this.surfaceBuffer);
          shadowPass.draw(this.surfaceVertexCount);
        }
        if (vehicleVertexCount) {
          shadowPass.setPipeline(this.shadowSurfacePipeline);
          shadowPass.setVertexBuffer(0, this.vehicleSurfaceBuffer);
          shadowPass.draw(vehicleVertexCount);
        }
      }
      shadowPass.end();
    }

    const multisampled = this.quality.sampleCount > 1;
    const scenePass = encoder.beginRenderPass({
      colorAttachments: [{
        view: multisampled ? this.msaaTextureView : this.sceneTextureView,
        resolveTarget: multisampled ? this.sceneTextureView : undefined,
        clearValue: { r: 0.227, g: 0.663, b: 0.941, a: 1 },
        loadOp: "clear",
        // The multisampled attachment only needs to survive until it resolves.
        storeOp: multisampled ? "discard" : "store",
      }],
      depthStencilAttachment: {
        view: this.depthTextureView,
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: this.quality.ambientOcclusion ? "store" : "discard",
      },
      ...(timed ? { timestampWrites: { querySet: this.querySet, beginningOfPassWriteIndex: 2, endOfPassWriteIndex: 3 } } : {}),
    });
    scenePass.setPipeline(this.pipeline);
    scenePass.setBindGroup(0, this.sceneBindGroup);
    scenePass.setVertexBuffer(0, this.vertexBuffer);
    scenePass.setVertexBuffer(1, this.cityBuffer);
    scenePass.draw(36, this.cityCount);
    if (this.surfaceVertexCount) {
      scenePass.setPipeline(this.surfacePipeline);
      scenePass.setVertexBuffer(0, this.surfaceBuffer);
      scenePass.draw(this.surfaceVertexCount);
      scenePass.setPipeline(this.pipeline);
      scenePass.setVertexBuffer(0, this.vertexBuffer);
    }
    scenePass.setVertexBuffer(1, this.actorBuffer);
    if (opaqueCount) scenePass.draw(36, opaqueCount);
    if (navigation.length) {
      scenePass.setPipeline(this.ghostPipeline);
      scenePass.setVertexBuffer(1, this.navBuffer);
      scenePass.draw(36, navigation.length);
      scenePass.setPipeline(this.pipeline);
      scenePass.draw(36, navigation.length);
    }
    if (ghostActors.length) {
      scenePass.setPipeline(this.ghostPipeline);
      scenePass.setVertexBuffer(1, this.ghostBuffer);
      scenePass.draw(36, ghostActors.length);
      scenePass.setPipeline(this.pipeline);
      scenePass.draw(36, ghostActors.length);
    }
    if (vehicleVertexCount) {
      scenePass.setPipeline(this.ghostSurfacePipeline);
      scenePass.setVertexBuffer(0, this.vehicleSurfaceBuffer);
      scenePass.draw(vehicleVertexCount);
      scenePass.setPipeline(this.surfacePipeline);
      scenePass.draw(vehicleVertexCount);
    }
    // The panorama fills only the pixels still at the cleared far depth, so the
    // streamed city no longer pays for a full-screen sky underneath it.
    const horizonRegion = this.horizon.render(scenePass, game, camera, seconds, aspect);
    if (horizonRegion !== this.lastHorizonRegion) {
      this.lastHorizonRegion = horizonRegion;
      this.canvas.dataset.horizonRegion = horizonRegion;
    }
    // The panorama owns group 0 while it draws; take it back for the scene.
    scenePass.setBindGroup(0, this.sceneBindGroup);
    if (transparentCount) {
      scenePass.setPipeline(this.transparentPipeline);
      scenePass.setVertexBuffer(0, this.vertexBuffer);
      scenePass.setVertexBuffer(1, this.actorBuffer);
      scenePass.draw(36, transparentCount, 0, opaqueCount);
    }
    scenePass.end();

    if (this.quality.ambientOcclusion) {
      this.encodeAmbientOcclusion(encoder, cameraDepthRange(game, camera, aspect, drawDistance));
    }
    if (this.quality.bloomLevels > 0) this.encodeBloom(encoder);
    this.encodeComposite(encoder, timed);

    if (timed) {
      encoder.resolveQuerySet(this.querySet, 0, 6, this.queryResolve, 0);
      encoder.copyBufferToBuffer(this.queryResolve, 0, this.queryReadback, 0, 48);
    }
    this.device.queue.submit([encoder.finish()]);
    if (timed) this.readTimings();
    this.frameIndex += 1;
  }

  private encodeAmbientOcclusion(encoder: any, depth: ReturnType<typeof cameraDepthRange>) {
    const params = new Float32Array(12);
    params[0] = this.canvas.width;
    params[1] = this.canvas.height;
    params[2] = depth.orthographic ? 1 : 0;
    params[4] = depth.near;
    params[5] = depth.far;
    params[6] = AMBIENT_OCCLUSION_RADIUS;
    params[7] = 1;
    params[8] = depth.halfWidth;
    params[9] = depth.halfHeight;
    this.device.queue.writeBuffer(this.aoParamBuffer, 0, params);
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: this.aoTextureView,
        clearValue: { r: 1, g: 1, b: 1, a: 1 },
        loadOp: "clear",
        storeOp: "store",
      }],
    });
    pass.setPipeline(this.aoPipeline);
    pass.setBindGroup(0, this.aoBindGroup);
    pass.draw(3);
    pass.end();
  }

  private encodeBloom(encoder: any) {
    const levels = this.bloomViews.length;
    if (!levels) return;
    const params = new Float32Array(8);
    // One parameter block per source, including the smallest mip that only the
    // upsample chain reads back.
    for (let level = 0; level <= levels; level += 1) {
      params.fill(0);
      params[0] = 1 / Math.max(1, this.canvas.width >> level);
      params[1] = 1 / Math.max(1, this.canvas.height >> level);
      params[4] = 0.92;
      params[5] = 0.34;
      params[6] = 1.1;
      params[7] = 1;
      this.device.queue.writeBuffer(this.bloomParamBuffers[Math.min(level, this.bloomParamBuffers.length - 1)], 0, params);
    }
    for (let level = 0; level < levels; level += 1) {
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: this.bloomViews[level],
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        }],
      });
      pass.setPipeline(level === 0 ? this.bloomPrefilterPipeline : this.bloomDownPipeline);
      pass.setBindGroup(0, this.bloomBindGroups[level]);
      pass.draw(3);
      pass.end();
    }
    for (let level = levels - 1; level > 0; level -= 1) {
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: this.bloomViews[level - 1],
          loadOp: "load",
          storeOp: "store",
        }],
      });
      pass.setPipeline(this.bloomUpPipeline);
      pass.setBindGroup(0, this.bloomBindGroups[level + 1]);
      pass.draw(3);
      pass.end();
    }
  }

  private encodeComposite(encoder: any, timed: boolean) {
    const grade = new Float32Array(8);
    grade[0] = 1 / this.canvas.width;
    grade[1] = 1 / this.canvas.height;
    grade[2] = 1.02;
    grade[3] = this.quality.bloomLevels > 0 ? 0.55 : 0;
    grade[4] = this.quality.ambientOcclusion ? 0.8 : 0;
    grade[5] = this.quality.sharpen ? 0.32 : 0;
    grade[6] = 1.07;
    grade[7] = 1.035;
    this.device.queue.writeBuffer(this.gradeBuffer, 0, grade);
    const postPass = encoder.beginRenderPass({
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(),
        clearValue: { r: 0.02, g: 0.02, b: 0.02, a: 1 },
        loadOp: "clear",
        storeOp: "store",
      }],
      ...(timed ? { timestampWrites: { querySet: this.querySet, beginningOfPassWriteIndex: 4, endOfPassWriteIndex: 5 } } : {}),
    });
    postPass.setPipeline(this.postPipeline);
    postPass.setBindGroup(0, this.postBindGroup);
    postPass.draw(3);
    postPass.end();
  }

  /** Single GPU frames are noisy; report the median of the recent samples. */
  private readTimings() {
    this.queryBusy = true;
    void this.queryReadback.mapAsync(0x0001).then(() => {
      const values = new BigUint64Array(this.queryReadback.getMappedRange().slice(0));
      this.queryReadback.unmap();
      const sample: PassTimings = {
        shadowMs: Number(values[1] - values[0]) / 1e6,
        sceneMs: Number(values[3] - values[2]) / 1e6,
        postMs: Number(values[5] - values[4]) / 1e6,
      };
      if (Object.values(sample).every((value) => Number.isFinite(value) && value >= 0 && value < 1000)) {
        this.timingSamples.push(sample);
        if (this.timingSamples.length > 9) this.timingSamples.shift();
        const median = (key: string) => {
          const sorted = this.timingSamples.map((entry) => entry[key]).sort((a, b) => a - b);
          return Math.round(sorted[Math.floor(sorted.length / 2)] * 1000) / 1000;
        };
        this.timings = { shadowMs: median("shadowMs"), sceneMs: median("sceneMs"), postMs: median("postMs") };
      }
      this.queryBusy = false;
    }).catch(() => {
      this.queryBusy = false;
    });
  }

  /** Diagnostics surface for the render benchmark and the development panel. */
  stats() {
    return {
      tier: this.quality.tier,
      sampleCount: this.quality.sampleCount,
      shadowCascades: this.quality.shadowCascades,
      bloomLevels: this.bloomViews.length,
      ambientOcclusion: this.quality.ambientOcclusion,
      resolutionScale: this.adaptive.scale,
      width: this.canvas.width,
      height: this.canvas.height,
      cityInstances: this.cityCount,
      surfaceVertices: this.surfaceVertexCount,
      ...this.timings,
    };
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.onUncapturedError) {
      this.device.removeEventListener?.("uncapturederror", this.onUncapturedError);
      this.onUncapturedError = null;
    }
    this.releaseSurfaces();
    this.shadowTexture?.destroy?.();
    this.vertexBuffer?.destroy?.();
    this.cityBuffer?.destroy?.();
    this.surfaceBuffer?.destroy?.();
    this.vehicleSurfaceBuffer?.destroy?.();
    this.actorBuffer?.destroy?.();
    this.navBuffer?.destroy?.();
    this.ghostBuffer?.destroy?.();
    this.cameraBuffer?.destroy?.();
    this.frameBuffer?.destroy?.();
    this.lightBuffer?.destroy?.();
    this.gradeBuffer?.destroy?.();
    this.aoParamBuffer?.destroy?.();
    for (const buffer of this.bloomParamBuffers) buffer?.destroy?.();
    this.querySet?.destroy?.();
    this.queryResolve?.destroy?.();
    this.queryReadback?.destroy?.();
    this.horizon?.destroy();
    const globals = window as Window & { __renderStats?: () => unknown };
    if (globals.__renderStats) delete globals.__renderStats;
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
    const requiredFeatures = adapter.features?.has?.("timestamp-query") ? ["timestamp-query"] : [];
    device = await adapter.requestDevice({ requiredFeatures });
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
    const navigatorWithHints = navigator as Navigator & { deviceMemory?: number };
    const preference = graphicsPreference();
    const detected = resolveRenderTier({
      mobile: window.matchMedia?.(MOBILE_QUERY)?.matches ?? false,
      vendor: adapter.info?.vendor,
      architecture: adapter.info?.architecture,
      deviceMemory: navigatorWithHints.deviceMemory,
      hardwareConcurrency: navigator.hardwareConcurrency,
      devicePixelRatio: window.devicePixelRatio,
    });
    const tier = preference === "auto" ? detected : preference;
    onProgress?.("COMPILING WEBGPU SHADERS...");
    const renderer = new WebGPURenderer(canvas, context, device, gpu, onFailure, renderQuality(tier));
    (window as Window & { __renderStats?: () => unknown }).__renderStats = () => renderer.stats();
    return renderer;
  } catch (error) {
    reportRuntimeError("webgpu-init", error);
    context?.unconfigure?.();
    device?.destroy?.();
    return null;
  }
}
