"use client";

import type { Camera, Game, NavigationPlan, Renderer, WorldView } from "@/game/model";
import { PERSPECTIVE_DRAW_DISTANCE } from "@/game/config";
import { renderTargetSize } from "@/game/render/resolution";
import { viewProjection } from "@/game/render/view-projection";
import { compatibilityScene } from "./compatibility-scene";
import { WebGLScene } from "./webgl-scene";
import { SoftwareScene } from "./software-scene";
import { HorizonPanorama } from "./horizon-panorama";
import { SoftwareHorizon } from "./software-horizon";
import { horizonView } from "@/game/render/horizon-view";
import { controlledPose } from "@/game/player";

/** Canvas-first lifecycle, with real 3D in both accelerated and software paths. */
export class Canvas2DRenderer implements Renderer {
  readonly kind = "Canvas 2D" as const;
  private context: CanvasRenderingContext2D;
  private graphics: WebGLScene | null = null;
  private software = new SoftwareScene();
  private softwareCanvas = document.createElement("canvas");
  private horizon = new HorizonPanorama();
  private softwareHorizon = new SoftwareHorizon();
  private released = false;
  // Writing these every frame invalidated layout for the HUD presenters.
  private lastVehicleDetail = "";
  private lastHorizonRegion = "";
  private lastBackend = "";

  constructor(private canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    this.context = context;
    try { this.graphics = new WebGLScene(); } catch { /* Software 3D also supports every camera. */ }
    this.resize();
  }

  resize() {
    const bounds = this.canvas.getBoundingClientRect();
    const size = renderTargetSize(bounds.width, bounds.height, window.devicePixelRatio, this.graphics ? 1800000 : 360000);
    this.canvas.width = size.width; this.canvas.height = size.height;
  }

  /** Drop the accelerated surface once another renderer owns the frame. The
   * WebGL2 context holds a second copy of the streamed city and its horizon
   * textures; on a phone that memory matters more than a fast reactivation. */
  releaseAcceleratedResources() {
    this.graphics?.destroy();
    this.graphics = null;
    this.released = true;
  }

  render(game: Game, camera: Camera, seconds: number, world: WorldView, navigation: NavigationPlan) {
    if (this.released) {
      this.released = false;
      try { this.graphics = new WebGLScene(); } catch { /* Software 3D also supports every camera. */ }
      this.resize();
    }
    const vehicleDetail = camera.vehicleDetail ?? "classic";
    if (vehicleDetail !== this.lastVehicleDetail) {
      this.lastVehicleDetail = vehicleDetail;
      this.canvas.dataset.vehicleDetail = vehicleDetail;
    }
    const { width, height } = this.canvas;
    const distance = world.landscapeSurfaces?.length ? 1200 : PERSPECTIVE_DRAW_DISTANCE;
    const matrix = viewProjection(game, camera, width / Math.max(1, height), distance);
    const scene = compatibilityScene(game, camera, seconds, world, navigation);
    const sky = this.horizon.update(controlledPose(game), seconds);
    if (sky.regionId !== this.lastHorizonRegion) {
      this.lastHorizonRegion = sky.regionId;
      this.canvas.dataset.horizonRegion = sky.regionId;
    }
    const skyBasis = horizonView(game, camera, width / Math.max(1, height), sky.blend);
    if (this.graphics) {
      if (this.graphics.render(matrix, width, height, camera, distance, world, scene, sky, skyBasis)) {
        this.context.drawImage(this.graphics.canvas, 0, 0);
        this.setBackend("webgl2");
        return;
      }
      this.graphics.destroy(); this.graphics = null; this.resize();
    }
    const size = renderTargetSize(this.canvas.width, this.canvas.height, 1, 360000);
    const raster = this.software.render(matrix, size.width, size.height, world, scene);
    if (this.softwareCanvas.width !== size.width || this.softwareCanvas.height !== size.height) {
      this.softwareCanvas.width = size.width; this.softwareCanvas.height = size.height;
    }
    this.softwareCanvas.getContext("2d")!.putImageData(raster, 0, 0);
    this.softwareHorizon.render(this.context, sky, skyBasis, this.canvas.width, this.canvas.height);
    this.context.drawImage(this.softwareCanvas, 0, 0, this.canvas.width, this.canvas.height);
    this.setBackend("software3d");
  }

  private setBackend(backend: string) {
    if (backend === this.lastBackend) return;
    this.lastBackend = backend;
    this.canvas.dataset.renderer = backend;
  }

  destroy() { this.graphics?.destroy(); this.graphics = null; }
}
