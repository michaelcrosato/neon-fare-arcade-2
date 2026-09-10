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

export const CITY_SCENES = {
  core: { x: 0, y: 2, heading: -Math.PI / 2 },
  starfall: { x: -36, y: -648, heading: Math.PI / 2 },
  market: { x: -414, y: 180, heading: Math.PI / 2 },
  redline: { x: 432, y: -252, heading: 0 },
  titan: { x: 36, y: 324, heading: -Math.PI / 2 },
  university: { x: -522, y: -558, heading: Math.PI / 2 },
  commons: { x: -690, y: -180, heading: Math.PI / 2 },
  skyline: { x: 680, y: 240, heading: -Math.PI / 2 },
  harbor: { x: 378, y: 396, heading: Math.PI / 2 },
  stadium: { x: -486, y: -18, heading: Math.PI / 2 },
} as const;

declare global {
  interface Window {
    cityScene: {
      mount(kind: "WebGPU" | "Canvas 2D"): Promise<string>;
      render(scene: keyof typeof CITY_SCENES, mode: CameraMode): { z: number; surfaces: number; boxes: number };
      map(full: boolean): void;
    };
  }
}

const game = makeGame("street-ace", 1527, "free-run");
const stream = new CityStream();
let renderer: Renderer;
window.cityScene = {
  async mount(kind) {
    const canvas = document.createElement("canvas");
    canvas.id = "city-fixture";
    canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;z-index:9999";
    document.body.append(canvas);
    renderer = kind === "Canvas 2D" ? new Canvas2DRenderer(canvas)
      : (await createWebGPURenderer(canvas, () => { throw new Error("City fixture device failed"); }, () => false))!;
    if (!renderer) throw new Error("City fixture adapter unavailable");
    return renderer.kind;
  },
  render(scene, mode) {
    const spot = CITY_SCENES[scene];
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
    renderer.render(game, camera, 40, world, buildNavigationPlan(game, { x: -36, y: -648 }, game.heading));
    return { z: game.z, surfaces: world.surfaces?.length ?? 0, boxes: world.boxes.length };
  },
  map(full) {
    const host = document.createElement("div");
    host.id = "city-map-fixture";
    host.style.cssText = "position:fixed;inset:0;z-index:10000;background:#101820;padding:16px;overflow:auto";
    if (!full) host.style.cssText += ";inset:20px auto auto 20px;width:260px;height:260px";
    document.body.append(host);
    const plan = buildNavigationPlan(game, { x: -36, y: -648 }, game.heading);
    const hud = makeHud(game, plan);
    createRoot(host).render(createElement(GpsMap, { hud, full }));
  },
};
