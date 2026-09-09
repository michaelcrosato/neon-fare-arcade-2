import { Canvas2DRenderer } from "../../../app/canvas2d-renderer";
import { createWebGPURenderer } from "../../../app/webgpu-renderer";
import { makeGame } from "../../../game/state";
import { CityStream } from "../../../game/world";
import { nearestRoadProjection } from "../../../game/road-network";
import { buildNavigationPlan } from "../../../game/navigation";
import { chaseCameraPreset } from "../../../game/config";
import { stepVehicleRoadContact } from "../../../game/vehicle-road-contact";
import { cameraBoomLimit } from "../../../game/render/camera";
import type { CameraMode, Renderer } from "../../../game/model";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { GpsMap } from "../../../app/gps-map";
import { makeHud } from "../../../game/hud";

export const REACH_SCENES = {
  calle: { x: 1278, y: 1152, heading: -Math.PI / 2 },
  bay: { x: 1836, y: 1584, heading: Math.PI / 2 },
  causeway: { x: 1188, y: 1728, heading: 0 },
  stadium: { x: 1656, y: 1926, heading: Math.PI },
  ribbon: { x: 2124, y: 1800, heading: Math.PI / 2 },
  flamingo: { x: 1998, y: 1296, heading: -Math.PI / 2 },
  studios: { x: 1680, y: 1584, heading: -Math.PI / 2 },
  inn: { x: 1908, y: 2232, heading: -Math.PI / 2 },
  moonwater: { x: 1656, y: 2760, heading: Math.PI },
  cape: { x: 1728, y: 3192, heading: Math.PI },
  lighthouse: { x: 1692, y: 3100, heading: Math.PI / 2 },
  southbound: { x: 1692, y: 3024, heading: Math.PI / 2 },
  ocean: { x: 2124, y: 2016, heading: Math.PI / 2 },
} as const;

declare global {
  interface Window {
    reachScene: {
      mount(kind: "WebGPU" | "Canvas 2D"): Promise<string>;
      render(scene: keyof typeof REACH_SCENES, mode: CameraMode): { z: number; surfaces: number; boxes: number };
      map(full: boolean): void;
    };
  }
}

const game = makeGame("street-ace", 1527, "free-run");
const stream = new CityStream();
let renderer: Renderer;
window.reachScene = {
  async mount(kind) {
    const canvas = document.createElement("canvas");
    canvas.id = "reach-fixture";
    canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;z-index:9999";
    document.body.append(canvas);
    renderer = kind === "Canvas 2D" ? new Canvas2DRenderer(canvas)
      : (await createWebGPURenderer(canvas, () => { throw new Error("Palm Reach fixture device failed"); }, () => false))!;
    if (!renderer) throw new Error("Palm Reach fixture adapter unavailable");
    return renderer.kind;
  },
  render(scene, mode) {
    const spot = REACH_SCENES[scene];
    const sample = nearestRoadProjection(spot, spot.heading);
    Object.assign(game, sample.point, { z: (sample.point.z ?? 0) + 0.64, heading: spot.heading, elapsed: 40 });
    game.roadMotion.grounded = true; game.roadMotion.roadId = null;
    game.roadMotion.pitch = 0; game.roadMotion.roll = 0;
    for (let i = 0; i < 45; i += 1) stepVehicleRoadContact(game, 1 / 60, game);
    const world = stream.update(game.x, game.y, mode === "fixed" ? 1 : 3);
    const camera = { x: game.x, y: game.y, heading: game.heading, mode, zoom: 1, onFoot: false,
      boom: mode === "chase-high" || mode === "chase-low" ? chaseCameraPreset(mode, false).distance : 0,
      heightOffset: game.z };
    if (mode === "chase-high" || mode === "chase-low") camera.boom = cameraBoomLimit(camera, world, camera.boom, chaseCameraPreset(mode, false).height);
    renderer.render(game, camera, 40, world, buildNavigationPlan(game, { x: 1638, y: 3204 }, game.heading));
    return { z: game.z, surfaces: world.surfaces?.length ?? 0, boxes: world.boxes.length };
  },
  map(full) {
    const host = document.createElement("div");
    host.id = "reach-map-fixture";
    host.style.cssText = "position:fixed;inset:0;z-index:10000;background:#101820;padding:16px;overflow:auto";
    if (!full) host.style.cssText += ";inset:20px auto auto 20px;width:260px;height:260px";
    document.body.append(host);
    const plan = buildNavigationPlan(game, { x: 1638, y: 3204 }, game.heading);
    const hud = makeHud(game, plan);
    createRoot(host).render(createElement(GpsMap, { hud, full }));
  },
};
