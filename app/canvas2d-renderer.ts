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

  render(game: Game, camera: Camera, seconds: number, world: WorldView, navigation: NavigationPlan) {
    const { width, height } = this.canvas;
    const distance = world.landscapeSurfaces?.length ? 1200 : PERSPECTIVE_DRAW_DISTANCE;
    const matrix = viewProjection(game, camera, width / Math.max(1, height), distance);
    const scene = compatibilityScene(game, camera, seconds, world, navigation);
    const sky = this.horizon.update(controlledPose(game), seconds);
    this.canvas.dataset.horizonRegion = sky.regionId;
    const skyBasis = horizonView(game, camera, width / Math.max(1, height), sky.blend);
    if (this.graphics) {
      if (this.graphics.render(matrix, width, height, camera, distance, world, scene, sky, skyBasis)) {
        this.context.drawImage(this.graphics.canvas, 0, 0);
        this.canvas.dataset.renderer = "webgl2";
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
    this.canvas.dataset.renderer = "software3d";
  }

  destroy() { this.graphics?.destroy(); this.graphics = null; }
}
