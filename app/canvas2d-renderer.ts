"use client";

import {
  MAT_BUILDING,
  MAT_FOLIAGE,
  MAT_PERSON,
  MAT_SIDEWALK,
  MAT_SIGN,
  MAT_WATER,
  MAT_VEHICLE,
} from "@/game/config";
import { localPoint, normalizeAngle, rgba } from "@/game/math";
import type {
  Box,
  Camera,
  Game,
  MeshFace,
  NavigationPlan,
  Renderer,
  WorldView,
  WorldPoint,
} from "@/game/model";
import { mountainAnimatedBoxes } from "@/game/mountain-scenery";
import { copperAnimatedBoxes } from "@/game/copper-scenery";
import { coastAnimatedBoxes } from "@/game/coast-scenery";
import { reachAnimatedBoxes } from "@/game/reach-scenery";
import { getObjective } from "@/game/state";
import { waitingFares } from "@/game/fare-selection";
import {
  ambientPeopleBoxes,
  dynamicBoxes,
  addCarBoxes,
  boostTrailBoxes,
  farePassengerAppearance,
  farePassengerPoint,
  interactionMarkerBoxes,
  particleBoxes,
  taxiBoxes,
  taxiGroundShadow,
} from "@/game/render/scene";
import { placeBoxesOnRoad } from "@/game/render/road-pose";
import { boxSurfaceFaces } from "@/game/render/surfaces";
import { inElevatedTerrain } from "@/game/terrain/region-forms";
import { groundAt } from "@/game/vehicle-road-contact";
import { groundShadowOffset, litBoxTopColor, litSurfaceColor } from "@/game/render/lighting";
import { renderTargetSize } from "@/game/render/resolution";
import {
  perspectiveSkyView,
  shouldRenderPlayerAvatar,
  shouldRenderTaxi,
} from "@/game/render/camera";
import {
  controlledPose,
  isDriving,
  isInterior,
  walkingMotion,
} from "@/game/player";
import { TerrainRaster } from "./terrain-raster";

export class Canvas2DRenderer implements Renderer {
  kind = "Canvas 2D" as const;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width = 1;
  private height = 1;
  private dpr = 1;
  private skyGradient!: CanvasGradient;
  private vignette!: CanvasGradient;
  private boxFaces = new WeakMap<Box, MeshFace[]>();
  private terrainRaster = new TerrainRaster();
  private terrainCanvas = document.createElement("canvas");

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    this.ctx = ctx;
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    const target = renderTargetSize(this.width, this.height, window.devicePixelRatio, 1800000);
    this.dpr = target.scale;
    this.canvas.width = target.width;
    this.canvas.height = target.height;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.skyGradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
    this.skyGradient.addColorStop(0, "#2488d4");
    this.skyGradient.addColorStop(0.56, "#53b7ec");
    this.skyGradient.addColorStop(1, "#bde5ee");
    const radius = Math.max(this.width, this.height) * 0.72;
    this.vignette = this.ctx.createRadialGradient(this.width / 2, this.height / 2, Math.min(this.width, this.height) * 0.25, this.width / 2, this.height / 2, radius);
    this.vignette.addColorStop(0, "rgba(0,0,0,0)");
    this.vignette.addColorStop(1, "rgba(0,0,0,0.18)");
  }

  render(game: Game, camera: Camera, seconds: number, world: WorldView, navigationPlan: NavigationPlan) {
    const ctx = this.ctx;
    const driving = isDriving(game);
    const interior = isInterior(game);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const directional = camera.mode !== "fixed";
    ctx.fillStyle = this.skyGradient;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = "rgba(224, 244, 242, 0.2)";
    ctx.fillRect(0, this.height * 0.62, this.width, Math.max(8, this.height * 0.045));
    if (directional) {
      const skyView = perspectiveSkyView(camera, true)!;
      const tanHalfFov = Math.tan(skyView.fovY / 2);
      const tanHalfHorizontal = tanHalfFov * (this.width / Math.max(1, this.height));
      const horizontalHalf = Math.atan(tanHalfHorizontal);
      const visibleBearing = (bearing: number, padding = 0) => Math.abs(normalizeAngle(bearing - camera.heading)) <= horizontalHalf + padding;
      const bearingToX = (bearing: number) => {
        const delta = normalizeAngle(bearing - camera.heading);
        if (Math.abs(delta) > Math.PI / 2 - 0.015) return delta < 0 ? -10000 : 10000;
        return this.width * (0.5 + Math.tan(delta) / (2 * tanHalfHorizontal));
      };
      const elevationToY = (elevation: number) => this.height * (0.5 - Math.tan(elevation + skyView.pitch) / (2 * tanHalfFov));
      const skyScale = Math.max(0.58, Math.min(1.15, Math.min(this.width, this.height) / 900));
      const sunX = bearingToX(0.32);
      const sunY = elevationToY(0.19);
      const sunRadius = 55 * skyScale;
      ctx.save();
      ctx.lineCap = "square";
      for (let i = 0; i < 8; i += 1) {
        const angle = i * Math.PI / 4;
        const ax = Math.cos(angle);
        const ay = Math.sin(angle);
        ctx.beginPath();
        ctx.moveTo(sunX + ax * sunRadius * 1.25 + 5, sunY + ay * sunRadius * 1.25 + 6);
        ctx.lineTo(sunX + ax * sunRadius * 1.68 + 5, sunY + ay * sunRadius * 1.68 + 6);
        ctx.strokeStyle = "#090909";
        ctx.lineWidth = 11 * skyScale;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sunX + ax * sunRadius * 1.25, sunY + ay * sunRadius * 1.25);
        ctx.lineTo(sunX + ax * sunRadius * 1.64, sunY + ay * sunRadius * 1.64);
        ctx.strokeStyle = "#ffd600";
        ctx.lineWidth = 6 * skyScale;
        ctx.stroke();
      }
      const drawOctagon = (x: number, y: number, radius: number, fill: string) => {
        ctx.beginPath();
        for (let i = 0; i < 8; i += 1) {
          const angle = Math.PI / 8 + i * Math.PI / 4;
          const px = x + Math.cos(angle) * radius;
          const py = y + Math.sin(angle) * radius;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
      };
      drawOctagon(sunX + 7, sunY + 8, sunRadius * 1.1, "#090909");
      drawOctagon(sunX, sunY, sunRadius * 1.06, "#ff4020");
      drawOctagon(sunX, sunY, sunRadius * 0.82, "#ffd600");
      ctx.restore();

      const cloudPoints: Array<[number, number]> = [
        [-72, 18], [-72, -4], [-48, -4], [-48, -24], [-20, -24], [-20, -42],
        [18, -42], [18, -24], [48, -24], [48, -8], [72, -8], [72, 18],
      ];
      const drawCloud = (x: number, y: number, scale: number) => {
        const trace = (offsetX: number, offsetY: number) => {
          ctx.beginPath();
          cloudPoints.forEach(([px, py], index) => {
            if (index === 0) ctx.moveTo(px * scale + offsetX, py * scale + offsetY);
            else ctx.lineTo(px * scale + offsetX, py * scale + offsetY);
          });
          ctx.closePath();
        };
        ctx.save();
        ctx.translate(x, y);
        trace(7 * scale, 8 * scale);
        ctx.fillStyle = "rgba(9, 9, 9, 0.82)";
        ctx.fill();
        trace(0, 0);
        ctx.fillStyle = "#f5efd6";
        ctx.fill();
        ctx.fillStyle = "#8cd2e8";
        ctx.fillRect(-68 * scale, 7 * scale, 136 * scale, 11 * scale);
        ctx.strokeStyle = "#090909";
        ctx.lineWidth = 4 * scale;
        ctx.stroke();
        ctx.restore();
      };
      drawCloud(bearingToX(-1.12), elevationToY(0.23), 0.78 * skyScale);
      drawCloud(bearingToX(1.08), elevationToY(0.17), 0.64 * skyScale);
      drawCloud(bearingToX(-2.55), elevationToY(0.25), 0.54 * skyScale);

      const drawAngularRect = (bearing: number, elevation: number, halfBearing: number, halfElevation: number, fill: string) => {
        if (!visibleBearing(bearing, halfBearing + 0.08)) return;
        const x1 = bearingToX(bearing - halfBearing);
        const x2 = bearingToX(bearing + halfBearing);
        const y1 = elevationToY(elevation + halfElevation);
        const y2 = elevationToY(elevation - halfElevation);
        ctx.fillStyle = fill;
        ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
      };
      const drawMountain = (bearing: number, width: number, height: number, fill: string) => {
        if (!visibleBearing(bearing, width + 0.08)) return;
        const left = bearingToX(bearing - width);
        const center = bearingToX(bearing);
        const right = bearingToX(bearing + width);
        const baseY = elevationToY(-0.055);
        const peakY = elevationToY(height);
        ctx.beginPath();
        ctx.moveTo(left, baseY);
        ctx.lineTo(center, peakY);
        ctx.lineTo(right, baseY);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = "#090909";
        ctx.lineWidth = 4;
        ctx.stroke();
      };

      if (!(camera.x >= 792 && camera.y >= 792)) {
      // Regional compass sectors, drawn over the celestial layer.
      const north = -Math.PI / 2 - camera.x / 6000;
      drawMountain(north - 0.46, 0.17, 0.18, "#709baa");
      drawMountain(north, 0.25, 0.27, "#83adba");
      drawMountain(north + 0.47, 0.17, 0.2, "#668e9d");
      drawAngularRect(north + 0.2, 0.12, 0.008, 0.15, "#7d281c");

      const west = Math.PI + camera.y / 5200;
      for (let index = -4; index <= 4; index += 1) {
        const top = 0.09 + ((index * index * 17 + 31) % 7) * 0.022;
        drawAngularRect(west + index * 0.075, (top - 0.05) / 2, 0.028, (top + 0.05) / 2, index % 2 ? "#174657" : "#203a4b");
      }
      drawAngularRect(west, 0.12, 0.043, 0.17, "#090909");
      drawAngularRect(west, 0.285, 0.007, 0.025, "#f0442e");

      const south = Math.PI / 2 + camera.x / 4700;
      drawMountain(south - 0.46, 0.2, 0.13, "#8a311c");
      drawMountain(south, 0.28, 0.17, "#a64725");
      drawMountain(south + 0.46, 0.19, 0.12, "#7b2819");
      for (let index = -3; index <= 3; index += 1) drawAngularRect(south + index * 0.13, 0.025, 0.045, 0.075, "#656b68");
      drawAngularRect(south - 0.24, 0.11, 0.014, 0.17, "#8b2d1c");
      drawAngularRect(south + 0.05, 0.09, 0.016, 0.14, "#a03a1e");
      drawAngularRect(south + 0.3, 0.19, 0.08, 0.008, "#f05b23");

      const east = -camera.y / 5200;
      if (camera.x > 792 && Math.abs(camera.y) < 792) {
        for (let index = -8; index <= 8; index++) {
          const bearing = east + index * 0.075;
          const top = 0.035 + (index * index % 5) * 0.004;
          drawAngularRect(bearing, -0.005, 0.047, top, index % 2 ? "#497651" : "#3b6748");
        }
      } else {
      drawAngularRect(east, -0.03, 0.58, 0.02, "#197aa5");
      drawMountain(east - 0.46, 0.18, 0.08, "#24634d");
      drawMountain(east, 0.24, 0.11, "#2b7356");
      drawMountain(east + 0.48, 0.17, 0.075, "#205943");
      drawAngularRect(east - 0.32, 0.11, 0.014, 0.15, "#101d20");
      drawAngularRect(east + 0.32, 0.11, 0.014, 0.15, "#101d20");
      drawAngularRect(east, 0.015, 0.48, 0.012, "#101d20");
      drawAngularRect(east - 0.5, 0.075, 0.015, 0.11, "#f4edd8");
      }


      }
    }
    const denominator = camera.mode === "chase-high"
      ? camera.onFoot ? 46 : 58
      : camera.mode === "chase-low"
        ? camera.onFoot ? 39 : 48
        : camera.mode === "cab" ? 42 : 50;
    const anchorY = camera.mode === "chase-high" ? 0.68 : camera.mode === "chase-low" ? 0.77 : camera.mode === "cab" ? 0.84 : 0.5;
    const forwardX = Math.cos(camera.heading);
    const forwardY = Math.sin(camera.heading);
    const scale = Math.min(this.width, this.height) / denominator * camera.zoom;
    const cameraLift = camera.heightOffset * scale * 0.6;
    const project = (x: number, y: number, z = 0) => {
      if (!directional) {
        return {
          x: this.width / 2 + (x - camera.x) * scale,
          y: this.height / 2 + (y - camera.y) * scale + cameraLift - z * scale * 0.6,
        };
      }
      const deltaX = x - camera.x;
      const deltaY = y - camera.y;
      return {
        x: this.width / 2 + (-forwardY * deltaX + forwardX * deltaY) * scale,
        y: this.height * anchorY - (forwardX * deltaX + forwardY * deltaY) * scale + cameraLift - z * scale * 0.6,
      };
    };
    const screenYaw = (yaw: number) => directional ? yaw - camera.heading - Math.PI / 2 : yaw;
    const mountainFrame = (inElevatedTerrain(camera.x, camera.y) || camera.x > 792) && !interior;
    if (mountainFrame) {
      const raster = this.terrainRaster;
      const rasterScale = Math.min(1, Math.sqrt(1_200_000 / (this.width * this.height)));
      const width = Math.ceil(this.width * rasterScale), height = Math.ceil(this.height * rasterScale);
      raster.begin(width, height);
      const face = (surface: MeshFace) => {
        const vertices = surface.corners.map(p => {
          const screen = project(p.x, p.y, p.z);
          return { x: screen.x * rasterScale, y: screen.y * rasterScale, depth: p.z + (directional
            ? -0.6 * (forwardX * (p.x - camera.x) + forwardY * (p.y - camera.y)) : 0.6 * (p.y - camera.y)) };
        });
        if (vertices.every(p => p.x < 0) || vertices.every(p => p.x > width) || vertices.every(p => p.y < 0) || vertices.every(p => p.y > height)) return;
        const [a, b, c] = surface.corners;
        const nx = (b.y - a.y) * (c.z - a.z) - (b.z - a.z) * (c.y - a.y);
        const ny = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);
        const nz = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
        const length = Math.hypot(nx, ny, nz) || 1;
        const color = litSurfaceColor(surface.color, nx / length, ny / length, nz / length);
        raster.triangle(vertices[0], vertices[1], vertices[2], color);
        if (vertices.length === 4) raster.triangle(vertices[0], vertices[2], vertices[3], color);
      };
      for (const surface of world.landscapeSurfaces ?? []) face(surface);
      for (const surface of world.surfaces ?? []) face(surface);
      for (const box of world.boxes) {
        let faces = this.boxFaces.get(box);
        if (!faces) { faces = boxSurfaceFaces(box); this.boxFaces.set(box, faces); }
        for (const surface of faces) face(surface);
      }
      const actorBoxes = dynamicBoxes(game, seconds, navigationPlan.route, world,
        { showPlayerAvatar: shouldRenderPlayerAvatar(driving ? "driving" : "walking", camera.mode) });
      if (shouldRenderTaxi(driving ? "driving" : "walking", camera.mode)) actorBoxes.push(...taxiBoxes(game));
      for (const box of actorBoxes) for (const surface of boxSurfaceFaces(box)) face(surface);
      if (this.terrainCanvas.width !== width || this.terrainCanvas.height !== height) {
        this.terrainCanvas.width = width; this.terrainCanvas.height = height;
      }
      this.terrainCanvas.getContext("2d")!.putImageData(new ImageData(raster.pixels, width, height), 0, 0);
      ctx.drawImage(this.terrainCanvas, 0, 0, this.width, this.height);
    }
    const deckDraws: Array<{ height: number; draw: () => void }> = [];
    const drawOnDeck = (height: number, draw: () => void, point: WorldPoint = camera) => {
      if (!mountainFrame && height <= 1) draw();
      else {
        const depth = mountainFrame ? height + (directional
          ? -0.6 * (forwardX * (point.x - camera.x) + forwardY * (point.y - camera.y))
          : 0.6 * (point.y - camera.y)) : height;
        deckDraws.push({ height: depth, draw });
      }
    };

    // Two small ellipses give contact and a soft edge without per-actor blur.
    const drawGroundShadow = (x: number, y: number, sx: number, sy: number, yaw: number, alpha = 0.22, z = 0) => {
      if (mountainFrame) return;
      const p = project(x, y, z);
      const radius = Math.max(sx, sy) * scale * 0.55;
      if (p.x < -radius || p.x > this.width + radius || p.y < -radius || p.y > this.height + radius) return;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(screenYaw(yaw));
      ctx.fillStyle = `rgba(12,24,38,${alpha * 0.45})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, sx * scale * 0.55, sy * scale * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(12,24,38,${alpha})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, sx * scale * 0.46, sy * scale * 0.46, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const drawBox = (box: Box) => {
      if (mountainFrame) return;
      if (box.z < -0.4) return;
      const p = project(box.x, box.y, box.screenLift ?? 0);
      const roll = box.pitch ?? 0;
      const pitch = box.tilt ?? 0;
      const width = (Math.abs(Math.cos(pitch)) * box.sx + Math.abs(Math.sin(pitch)) * box.sz) * scale;
      const height = (Math.abs(Math.cos(roll)) * box.sy + Math.abs(Math.sin(roll)) * box.sz) * scale;
      if (p.x + width < -40 || p.x - width > this.width + 40 || p.y + height < -40 || p.y - height > this.height + 40) return;
      if (box.material === MAT_FOLIAGE || (box.material === MAT_PERSON && box.z < 1.5)) {
        const offset = groundShadowOffset(box.z, 0.5);
        drawGroundShadow(box.x + offset.x, box.y + offset.y, box.sx * 1.12, box.sy * 1.12, box.yaw, 0.17);
      }
      ctx.save();
      if (box.material === MAT_BUILDING && box.sz > 1) {
        const offset = groundShadowOffset(box.sz * 0.15);
        const shadow = project(box.x + offset.x, box.y + offset.y);
        ctx.save();
        ctx.translate(shadow.x, shadow.y);
        ctx.rotate(screenYaw(box.yaw));
        ctx.fillStyle = "rgba(12,24,38,0.3)";
        ctx.fillRect(-width / 2, -height / 2, width, height);
        ctx.restore();
      }
      ctx.translate(p.x, p.y);
      ctx.rotate(screenYaw(box.yaw));
      const shaded = box.material === MAT_BUILDING || box.material === MAT_VEHICLE || box.material === MAT_FOLIAGE;
      ctx.fillStyle = rgba(shaded ? litBoxTopColor(box) : box.color);
      if (box.material === MAT_FOLIAGE) {
        ctx.beginPath();
        ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(9,9,9,0.28)";
        ctx.lineWidth = Math.max(1, scale * 0.07);
        ctx.stroke();
      } else {
        if (box.material === MAT_SIGN) {
          ctx.shadowColor = rgba(box.color, 0.7);
          ctx.shadowBlur = 6;
        }
        ctx.fillRect(-width / 2, -height / 2, width, height);
      }
      if (box.material === MAT_BUILDING && box.sz > 1 && width > 7 && height > 7) {
        // Narrow facade bands separate large roofs, with light fixed in world space.
        const edge = Math.min(3, width * 0.08, height * 0.08);
        const c = Math.cos(box.yaw);
        const s = Math.sin(box.yaw);
        ctx.fillStyle = rgba(litSurfaceColor(box.color, -c, -s, 0));
        ctx.fillRect(-width / 2, -height / 2, edge, height);
        ctx.fillStyle = rgba(litSurfaceColor(box.color, c, s, 0));
        ctx.fillRect(width / 2 - edge, -height / 2, edge, height);
        ctx.fillStyle = rgba(litSurfaceColor(box.color, s, -c, 0));
        ctx.fillRect(-width / 2, -height / 2, width, edge);
        ctx.fillStyle = rgba(litSurfaceColor(box.color, -s, c, 0));
        ctx.fillRect(-width / 2, height / 2 - edge, width, edge);
        ctx.strokeStyle = "rgba(9,9,9,0.28)";
        ctx.lineWidth = 1;
        ctx.strokeRect(-width / 2, -height / 2, width, height);
      }
      if (box.material === MAT_SIDEWALK) {
        ctx.strokeStyle = "rgba(9,9,9,0.2)";
        ctx.lineWidth = Math.max(1, scale * 0.08);
        ctx.strokeRect(-width / 2, -height / 2, width, height);
      }
      if (box.material === MAT_WATER) {
        ctx.strokeStyle = "rgba(255,255,255,0.48)";
        ctx.lineWidth = Math.max(1, scale * 0.08);
        ctx.beginPath();
        ctx.moveTo(-width * 0.34, -height * 0.12);
        ctx.lineTo(width * 0.32, height * 0.12);
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawSurface = (surface: MeshFace) => {
      if (mountainFrame) return;
      const [a, b, c] = surface.corners;
      const points = surface.corners.map((point) => project(point.x, point.y, point.z));
      const [pa, pb, pc] = points;
      // Projected winding also selects the visible walls of pitched buildings.
      if ((pb.x - pa.x) * (pc.y - pa.y) - (pb.y - pa.y) * (pc.x - pa.x) < -1e-8) return;
      if (points.every((point) => point.x < -40) || points.every((point) => point.x > this.width + 40)
        || points.every((point) => point.y < -40) || points.every((point) => point.y > this.height + 40)) return;
      const center = { x: surface.corners.reduce((sum, p) => sum + p.x, 0) / surface.corners.length,
        y: surface.corners.reduce((sum, p) => sum + p.y, 0) / surface.corners.length };
      drawOnDeck(surface.corners.reduce((sum, point) => sum + point.z, 0) / surface.corners.length, () => {
        const nx = (b.y - a.y) * (c.z - a.z) - (b.z - a.z) * (c.y - a.y);
        const ny = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);
        const nz = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
        const length = Math.hypot(nx, ny, nz) || 1;
        ctx.fillStyle = rgba(litSurfaceColor(surface.color, nx / length, ny / length, nz / length));
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }, center);
    };
    for (const box of world.boxes) {
      if (mountainFrame && inElevatedTerrain(box.x, box.y)) {
        let faces = this.boxFaces.get(box);
        if (!faces) { faces = boxSurfaceFaces(box); this.boxFaces.set(box, faces); }
        for (const face of faces) drawSurface(face);
      } else drawOnDeck(box.screenLift ? box.z : 0, () => drawBox(box), box);
    }
    for (const surface of [...(world.landscapeSurfaces ?? []), ...(world.surfaces ?? [])]) drawSurface(surface);
    if (!interior) {
      for (const box of ambientPeopleBoxes(game, seconds, controlledPose(game))) drawOnDeck(box.z, () => drawBox(box));
      for (const box of mountainAnimatedBoxes(seconds, controlledPose(game))) drawOnDeck(box.z, () => drawBox(box));
      for (const box of copperAnimatedBoxes(seconds, controlledPose(game))) {
        for (const face of boxSurfaceFaces(box)) drawSurface(face);
      }
      for (const box of coastAnimatedBoxes(seconds, controlledPose(game))) {
        for (const face of boxSurfaceFaces(box)) drawSurface(face);
      }
      for (const box of reachAnimatedBoxes(seconds, controlledPose(game))) {
        for (const face of boxSurfaceFaces(box)) drawSurface(face);
      }
    }

    const fareWaiters = interior ? [] : waitingFares(game);
    const ringPulse = 1 + Math.sin(seconds * 5) * 0.08;
    const drawObjectiveRing = (point: WorldPoint, color: string, selected = false, dashed = false, radius = 3.9) => {
      drawOnDeck((point.z ?? 0) + 0.9, () => {
        const center = project(point.x, point.y, point.z ?? 0);
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = selected ? 7 : 4;
        ctx.setLineDash(dashed ? [8, 6] : []);
        ctx.beginPath();
        ctx.arc(center.x, center.y, scale * radius * ringPulse, 0, Math.PI * 2);
        ctx.stroke();
        if (selected) {
          ctx.strokeStyle = "rgba(255,255,255,0.92)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(center.x, center.y, scale * (radius + 0.55) * ringPulse, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      });
    };
    for (const { index, job } of fareWaiters) {
      const selected = !game.onboard && index === game.jobIndex;
      drawObjectiveRing(job.pickup, "#00dfe9", selected, !selected);
    }
    if (!interior && game.onboard) drawObjectiveRing(getObjective(game), "#ef281c", true);
    if (!interior && game.activeCourier) drawObjectiveRing(getObjective(game),
      game.activeCourier.stage === "pickup" ? "#ef6a1f" : "#ed3f96", true, true, 4.3);

    const route = driving ? navigationPlan.route : [];
    let dashDistance = 0;
    for (let index = 1; index < route.length; index += 1) {
      const a = route[index - 1], b = route[index];
      const start = project(a.x, a.y, (a.z ?? 0) + 0.75);
      const end = project(b.x, b.y, (b.z ?? 0) + 0.75);
      const phase = dashDistance;
      dashDistance += Math.hypot(end.x - start.x, end.y - start.y);
      drawOnDeck(((a.z ?? 0) + (b.z ?? 0)) / 2 + 0.75, () => {
        ctx.save();
        ctx.setLineDash([11, 9]);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineDashOffset = phase - seconds * 18;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.strokeStyle = "#090909";
        ctx.lineWidth = 10;
        ctx.stroke();
        ctx.strokeStyle = game.customDestination
          ? "#ffd400"
          : game.activeCourier
          ? game.activeCourier.stage === "pickup" ? "#ef6a1f" : "#ed3f96"
          : game.onboard ? "#f0442e" : "#16dfe4";
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.restore();
      });
    }

    for (const car of interior ? [] : game.traffic) {
      if (game.elapsed >= car.activeAt) {
        const boxes: Box[] = [];
        addCarBoxes(boxes, car.x, car.y, car.heading, car.color, false, false);
        placeBoxesOnRoad(boxes, 0, { x: car.x, y: car.y, heading: car.heading, z: car.z ?? 0, pitch: car.pitch ?? 0, roll: car.roll ?? 0 });
        drawOnDeck((car.z ?? 0) + 1, () => {
          drawGroundShadow(car.x, car.y, 5.2, 2.7, car.heading, 0.22, car.z ?? 0);
          for (const box of boxes) drawBox(box);
        });
      }
    }
    for (const box of boostTrailBoxes(game, seconds)) drawOnDeck((game.z ?? 0) + 1, () => drawBox(box));
    for (const box of particleBoxes(game, seconds)) drawOnDeck(box.z + 0.8, () => drawBox(box));
    if (shouldRenderTaxi(interior ? "interior" : driving ? "driving" : "walking", camera.mode)) {
      const shadow = taxiGroundShadow(game)!;
      drawOnDeck(game.z + 1, () => {
        drawGroundShadow(shadow.x, shadow.y, shadow.sx, shadow.sy, shadow.yaw, 0.28, shadow.screenLift);
        for (const box of taxiBoxes(game, { includeGroundShadow: false })) drawBox(box);
      });
      const taxi = project(game.x, game.y, game.z);
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = "rgba(22,223,228,0.72)";
      ctx.lineWidth = 3;
      ctx.strokeRect(taxi.x - 2.8 * scale, taxi.y - 1.8 * scale, 5.6 * scale, 3.6 * scale);
      ctx.restore();
    }

    const drawFarePassenger = (
      artCell: number,
      rider: string,
      x: number,
      y: number,
      selected: boolean,
      z = 0,
    ) => {
      if (mountainFrame) return;
      const point = project(x, y, z);
      const height = Math.max(26, Math.min(62, scale * 2.65));
      const width = height * 0.42;
      const appearance = farePassengerAppearance(artCell);
      const outfit = rgba(appearance.outfit);
      const accent = rgba(appearance.accent);
      const bob = Math.sin(seconds * 4.2 + artCell * 1.7) * 2;
      ctx.save();
      ctx.translate(point.x, point.y + bob);
      ctx.fillStyle = "rgba(0,0,0,0.36)";
      ctx.beginPath();
      ctx.ellipse(0, 2, width * 0.68, height * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#090909";
      ctx.lineWidth = Math.max(2, height * 0.055);
      ctx.lineCap = "round";
      ctx.fillStyle = rgba(appearance.trousers);
      ctx.fillRect(-width * 0.42, -height * 0.3, width * 0.27, height * 0.3);
      ctx.fillRect(width * 0.15, -height * 0.3, width * 0.27, height * 0.3);
      ctx.fillStyle = outfit;
      ctx.fillRect(-width * 0.48, -height * 0.68, width * 0.96, height * 0.4);
      ctx.strokeRect(-width * 0.48, -height * 0.68, width * 0.96, height * 0.4);
      ctx.fillStyle = accent;
      ctx.fillRect(-width * 0.5, -height * 0.52, width, height * 0.1);
      ctx.beginPath();
      ctx.moveTo(-width * 0.45, -height * 0.58);
      ctx.lineTo(-width * 0.82, -height * 0.3);
      ctx.moveTo(width * 0.45, -height * 0.58);
      ctx.lineTo(width * 0.78, -height * 0.92);
      ctx.stroke();
      ctx.fillStyle = rgba(appearance.skin);
      ctx.beginPath();
      ctx.arc(0, -height * 0.82, width * 0.31, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = rgba(appearance.hair);
      ctx.fillRect(-width * 0.34, -height * 0.97, width * 0.68, height * 0.13);
      ctx.fillStyle = accent;
      ctx.fillRect(
        appearance.bagSide * width * 0.48 - width * 0.18,
        -height * 0.48,
        width * 0.36,
        height * 0.25,
      );
      if (selected) {
        ctx.font = `900 ${Math.max(11, height * 0.22)}px Barlow Condensed, Impact, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const labelWidth = Math.max(width * 1.8, ctx.measureText(rider).width + 14);
        ctx.fillStyle = "#090909";
        ctx.fillRect(-labelWidth / 2 + 3, -height * 1.36 + 3, labelWidth, height * 0.3);
        ctx.fillStyle = "#ffd400";
        ctx.fillRect(-labelWidth / 2, -height * 1.36, labelWidth, height * 0.3);
        ctx.fillStyle = "#090909";
        ctx.fillText(rider, 0, -height * 1.21);
      }
      ctx.restore();
    };
    for (const { index, job } of fareWaiters) {
      const point = farePassengerPoint(job);
      drawOnDeck((point.z ?? 0) + 2.5, () => drawFarePassenger(
        job.passengerArtCell,
        job.rider,
        point.x,
        point.y,
        !game.onboard && index === game.jobIndex,
        point.z,
      ));
    }

    if (game.passengerReview && game.elapsed < game.passengerReview.until && !interior) {
      const job = game.passengerReview.job;
      const point = game.passengerReview.point;
      drawOnDeck((point.z ?? 0) + 2.5, () => drawFarePassenger(job.passengerArtCell, job.rider, point.x, point.y, false, point.z));
    }

    const drawPlayerAvatar = () => {
      if (mountainFrame) return;
      if (game.player.kind !== "walking") return;
      const { actor } = game.player;
      const motion = walkingMotion(actor);
      const groundHeight = interior ? 0 : groundAt({ x: actor.x, y: actor.y, z: motion.elevation }).height;
      const airHeight = Math.max(0, motion.elevation - groundHeight);
      const ground = project(actor.x, actor.y, groundHeight);
      const animate = seconds !== 0;
      const phase = animate ? motion.gaitPhase : 0;
      const speedMix = Math.min(1, actor.speed / 8.2);
      const crouch = motion.crouchAmount;
      const airborne = !motion.grounded;
      const height = Math.max(34, Math.min(76, scale * 2.55)) * (1 - crouch * 0.28);
      const width = height * 0.42;
      const stride = Math.sin(phase) * width * 0.2 * speedMix * (1 - crouch * 0.5);
      const runLean = motion.action === "run" ? width * 0.08 * speedMix : 0;
      const lift = airHeight * scale * 0.6;
      const landingSquash = animate ? motion.landingImpact * height * 0.04 : 0;
      const faceDirection = Math.sin(screenYaw(actor.heading));

      ctx.save();
      ctx.translate(ground.x, ground.y);
      ctx.fillStyle = `rgba(12,24,38,${0.38 / (1 + airHeight * 0.5)})`;
      ctx.beginPath();
      ctx.ellipse(0, 2, width * (0.63 - Math.min(0.28, motion.elevation * 0.1)), height * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.translate(0, -lift + landingSquash);
      ctx.rotate((animate ? motion.turnLean : 0) * 0.07);
      ctx.lineWidth = Math.max(2, height * 0.045);
      ctx.strokeStyle = "#090909";
      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      const legTop = -height * 0.34;
      const footY = airborne ? -height * 0.09 : 0;
      for (const side of [-1, 1]) {
        const legX = side * width * 0.2 + stride * side;
        ctx.fillStyle = "#146aa3";
        ctx.fillRect(legX - width * 0.105, legTop, width * 0.21, footY - legTop);
        ctx.strokeRect(legX - width * 0.105, legTop, width * 0.21, footY - legTop);
        ctx.fillStyle = "#090909";
        ctx.fillRect(legX - width * 0.15 + faceDirection * width * 0.05, footY - height * 0.05, width * 0.3, height * 0.08);
      }

      ctx.fillStyle = "#090909";
      ctx.fillRect(-width * 0.36 + runLean, -height * 0.43, width * 0.72, height * 0.13);
      ctx.fillStyle = "#f0442e";
      ctx.beginPath();
      ctx.moveTo(-width * 0.48 + runLean, -height * 0.7);
      ctx.lineTo(width * 0.48 + runLean, -height * 0.7);
      ctx.lineTo(width * 0.38 + runLean, -height * 0.38);
      ctx.lineTo(-width * 0.38 + runLean, -height * 0.38);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#16dfe4";
      ctx.fillRect(-width * 0.45 + runLean, -height * 0.54, width * 0.9, height * 0.08);

      for (const side of [-1, 1]) {
        const armSwing = -Math.sin(phase) * side * height * 0.08 * speedMix;
        ctx.strokeStyle = "#090909";
        ctx.lineWidth = Math.max(6, width * 0.24);
        ctx.beginPath();
        ctx.moveTo(side * width * 0.47 + runLean, -height * 0.65);
        ctx.lineTo(side * width * 0.55 + runLean, -height * 0.39 + armSwing - (airborne ? height * 0.12 : 0));
        ctx.stroke();
        ctx.strokeStyle = "#f0442e";
        ctx.lineWidth = Math.max(4, width * 0.15);
        ctx.stroke();
        ctx.fillStyle = "#f7ead0";
        ctx.beginPath();
        ctx.arc(side * width * 0.55 + runLean, -height * 0.37 + armSwing - (airborne ? height * 0.12 : 0), width * 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#090909";
        ctx.lineWidth = Math.max(2, width * 0.04);
        ctx.stroke();
      }

      ctx.fillStyle = "#f7ead0";
      ctx.beginPath();
      ctx.arc(runLean, -height * 0.82, width * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#090909";
      ctx.lineWidth = Math.max(2, height * 0.04);
      ctx.stroke();
      ctx.fillStyle = "#090909";
      ctx.fillRect(-width * 0.29 + runLean, -height * 0.95, width * 0.58, height * 0.08);
      ctx.fillStyle = "#ffd400";
      ctx.fillRect(-width * 0.36 + runLean, -height * 1.0, width * 0.72, height * 0.09);
      ctx.fillRect(runLean + faceDirection * width * 0.25 - width * 0.16, -height * 0.94, width * 0.32, height * 0.055);

      if (game.activeCourier?.stage === "dropoff" && !game.activeCourier.loadedInTaxi) {
        ctx.fillStyle = "#ef6a1f";
        ctx.fillRect(-width * 0.34 + runLean, -height * 0.58, width * 0.68, height * 0.27);
        ctx.strokeRect(-width * 0.34 + runLean, -height * 0.58, width * 0.68, height * 0.27);
        ctx.fillStyle = "#ef4375";
        ctx.fillRect(-width * 0.27 + runLean, -height * 0.48, width * 0.54, height * 0.035);
      }
      ctx.restore();
    };

    if (shouldRenderPlayerAvatar(interior ? "interior" : driving ? "driving" : "walking", camera.mode)) {
      drawOnDeck((controlledPose(game).z ?? 0) + 1.2, drawPlayerAvatar);
    }
    for (const box of interactionMarkerBoxes(game, world, seconds)) drawOnDeck(box.z, () => drawBox(box));
    deckDraws.sort((a, b) => a.height - b.height);
    for (const item of deckDraws) item.draw();
    if (!interior && groundAt({ x: game.x, y: game.y, z: game.z + 100 }).height > game.z + 2) {
      const taxi = project(game.x, game.y, game.z);
      ctx.save();
      ctx.translate(taxi.x, taxi.y);
      ctx.rotate(screenYaw(game.heading));
      ctx.strokeStyle = "rgba(22,223,228,0.75)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(-2.5 * scale, -1.3 * scale, 5 * scale, 2.6 * scale);
      ctx.restore();
    }

    const turnCue = navigationPlan.turnCue;
    if (driving && navigationPlan.requiresUTurn) {
      const marker = localPoint(game.x, game.y, game.heading, 11, 0);
      const ground = project(marker.x, marker.y, game.z);
      const bob = Math.sin(seconds * 5) * 4;
      ctx.save();
      ctx.translate(ground.x, ground.y - 35 - bob);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "900 86px Impact, Haettenschweiler, sans-serif";
      ctx.lineJoin = "round";
      ctx.shadowColor = "rgba(22,223,228,0.9)";
      ctx.shadowBlur = 18;
      ctx.strokeStyle = "#090909";
      ctx.lineWidth = 14;
      ctx.strokeText("↶", 0, 0);
      ctx.fillStyle = "#ffd400";
      ctx.fillText("↶", 0, 0);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#ef281c";
      ctx.fillRect(-44, 38, 88, 25);
      ctx.strokeStyle = "#090909";
      ctx.lineWidth = 4;
      ctx.strokeRect(-44, 38, 88, 25);
      ctx.fillStyle = "#fffaf0";
      ctx.font = "900 17px Impact, Haettenschweiler, sans-serif";
      ctx.fillText("U-TURN", 0, 51);
      ctx.restore();
    } else if (driving && turnCue) {
      const ground = project(turnCue.point.x, turnCue.point.y, turnCue.point.z ?? 0);
      const hover = 25 + Math.sin(seconds * 5) * 5;
      ctx.save();
      ctx.strokeStyle = "rgba(22,223,228,0.85)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(ground.x, ground.y - 3);
      ctx.lineTo(ground.x, ground.y - hover + 4);
      ctx.stroke();
      ctx.fillStyle = "rgba(9,9,9,0.38)";
      ctx.beginPath();
      ctx.ellipse(ground.x, ground.y, 24, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.translate(ground.x, ground.y - hover);
      ctx.rotate(screenYaw(turnCue.yaw));
      const arrowPath = () => {
        ctx.beginPath();
        ctx.moveTo(-28, -9);
        ctx.lineTo(6, -9);
        ctx.lineTo(6, -20);
        ctx.lineTo(35, 0);
        ctx.lineTo(6, 20);
        ctx.lineTo(6, 9);
        ctx.lineTo(-28, 9);
        ctx.closePath();
      };
      ctx.translate(8, 8);
      arrowPath();
      ctx.fillStyle = "#090909";
      ctx.fill();
      ctx.translate(-8, -8);
      arrowPath();
      ctx.fillStyle = "#ffd400";
      ctx.fill();
      ctx.strokeStyle = "#fffaf0";
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();
    }

    // Compatibility renderer cockpit: the WebGPU path uses real cuboids in
    // cab space; Canvas retains the same dashboard hierarchy as a 2D fallback.
    if (driving && camera.mode === "cab") {
      const dashTop = this.height * 0.78;
      ctx.save();
      if (game.drivingModel === "simulation") {
        const rollScale = 1 + Math.abs(Math.sin(game.simulationVehicle.bodyRoll)) * 0.42;
        ctx.translate(this.width * 0.5, this.height * 0.7);
        ctx.rotate(game.simulationVehicle.bodyRoll);
        ctx.scale(rollScale, rollScale);
        ctx.translate(-this.width * 0.5, -this.height * 0.7);
      }
      ctx.fillStyle = "rgba(9, 9, 9, 0.96)";
      ctx.beginPath();
      ctx.moveTo(0, this.height);
      ctx.lineTo(0, dashTop + 34);
      ctx.lineTo(this.width * 0.18, dashTop);
      ctx.lineTo(this.width * 0.82, dashTop);
      ctx.lineTo(this.width, dashTop + 34);
      ctx.lineTo(this.width, this.height);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffc400";
      ctx.beginPath();
      ctx.moveTo(this.width * 0.24, dashTop + 2);
      ctx.lineTo(this.width * 0.76, dashTop + 2);
      ctx.lineTo(this.width * 0.66, dashTop - 32);
      ctx.lineTo(this.width * 0.34, dashTop - 32);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#090909";
      ctx.lineWidth = 9;
      ctx.stroke();

      ctx.strokeStyle = "#171512";
      ctx.lineWidth = Math.max(18, this.width * 0.022);
      ctx.beginPath();
      ctx.moveTo(this.width * 0.1, 0);
      ctx.lineTo(this.width * 0.16, dashTop + 25);
      ctx.moveTo(this.width * 0.9, 0);
      ctx.lineTo(this.width * 0.84, dashTop + 25);
      ctx.stroke();

      const wheelX = this.width * 0.31;
      const wheelY = this.height * 0.91;
      const wheelRadius = Math.min(this.width, this.height) * 0.15;
      ctx.save();
      ctx.translate(wheelX, wheelY);
      ctx.rotate(game.steering * 0.55);
      ctx.strokeStyle = "#050505";
      ctx.lineWidth = Math.max(17, wheelRadius * 0.16);
      ctx.beginPath();
      ctx.arc(0, 0, wheelRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = Math.max(9, wheelRadius * 0.09);
      for (const angle of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle) * wheelRadius, Math.sin(angle) * wheelRadius);
        ctx.stroke();
      }
      ctx.restore();
      ctx.restore();
    }

    ctx.fillStyle = this.vignette;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  destroy() {}
}
