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
import { makeWalkingActor } from "../../../game/player";
import { terrainHeightAt } from "../../../game/terrain/surface";

export const MOUNTAIN_SCENES = {
  gateway: { x: 0, y: -864, heading: -Math.PI / 2 },
  gallery: { x: 402, y: -1194, heading: -Math.PI / 2 },
  gorge: { x: -210, y: -1782, heading: 0 },
  village: { x: 72, y: -1440, heading: Math.PI },
  lake: { x: 620, y: -1740, heading: -Math.PI / 2 },
  waterfall: { x: 288, y: -1910, heading: Math.PI / 2 },
  resort: { x: -36, y: -2160, heading: -Math.PI / 2 },
  gondola: { x: -420, y: -2196, heading: -0.095 },
  summit: { x: 418, y: -2232, heading: Math.PI },
} as const;

declare global {
  interface Window {
    mountainScene: {
      mount(kind: "WebGPU" | "Canvas 2D"): Promise<string>;
      render(scene: keyof typeof MOUNTAIN_SCENES, mode: CameraMode): { z: number; surfaces: number; boxes: number };
      map(full: boolean): void;
    };
  }
}

const game = makeGame("street-ace", 1527, "free-run");
const stream = new CityStream();
let renderer: Renderer;
window.mountainScene = {
  async mount(kind) {
    const canvas = document.createElement("canvas");
    canvas.id = "mountain-fixture";
    canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;z-index:9999";
    document.body.append(canvas);
    renderer = kind === "Canvas 2D" ? new Canvas2DRenderer(canvas)
      : (await createWebGPURenderer(canvas, () => { throw new Error("Mountain fixture device failed"); }, () => false))!;
    if (!renderer) throw new Error("Mountain fixture adapter unavailable");
    return renderer.kind;
  },
  render(scene, mode) {
    const spot = MOUNTAIN_SCENES[scene];
    const sample = nearestRoadProjection(spot, spot.heading);
    game.x = sample.point.x; game.y = sample.point.y; game.z = (sample.point.z ?? 0) + 0.64;
    game.heading = spot.heading; game.elapsed = 40;
    game.roadMotion.grounded = true; game.roadMotion.roadId = null;
    game.roadMotion.pitch = 0; game.roadMotion.roll = 0;
    for (let i = 0; i < 45; i += 1) stepVehicleRoadContact(game, 1 / 60, game.z);
    const onFoot = scene === "gondola";
    const focus = onFoot ? { ...spot, z: terrainHeightAt(spot.x, spot.y) } : game;
    game.player = onFoot ? { kind: "walking", location: { kind: "city" },
      actor: makeWalkingActor({ ...focus, heading: spot.heading, vx: 0, vy: 0, speed: 0 }) } : { kind: "driving" };
    const world = stream.update(focus.x, focus.y, mode === "fixed" ? 1 : 3);
    const camera = { x: focus.x, y: focus.y, heading: game.heading, mode, zoom: 1, onFoot,
      boom: mode === "chase-high" || mode === "chase-low" ? chaseCameraPreset(mode).distance : 0,
      heightOffset: focus.z };
    if (mode === "chase-high" || mode === "chase-low") camera.boom = cameraBoomLimit(camera, world, camera.boom, chaseCameraPreset(mode).height);
    renderer.render(game, camera, 40, world, buildNavigationPlan(game, { x: -36, y: -2160 }, game.heading));
    return { z: focus.z, surfaces: world.surfaces?.length ?? 0, boxes: world.boxes.length };
  },
  map(full) {
    const host = document.createElement("div");
    host.id = "mountain-map-fixture";
    host.style.cssText = "position:fixed;inset:0;z-index:10000;background:#101820;padding:16px;overflow:auto";
    if (!full) host.style.cssText += ";inset:20px auto auto 20px;width:260px;height:260px";
    document.body.append(host);
    const hud = makeHud(game, buildNavigationPlan(game, { x: -36, y: -2160 }, game.heading));
    createRoot(host).render(createElement(GpsMap, { hud, full }));
  },
};
