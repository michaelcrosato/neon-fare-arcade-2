import { Canvas2DRenderer } from "../../../app/canvas2d-renderer";
import { createWebGPURenderer } from "../../../app/webgpu-renderer";
import { makeGame } from "../../../game/state";
import { CityStream } from "../../../game/world";
import { nearestRoadProjection } from "../../../game/road-network";
import { buildNavigationPlan } from "../../../game/navigation";
import { chaseCameraPreset } from "../../../game/config";
import { groundAt, stepVehicleRoadContact } from "../../../game/vehicle-road-contact";
import { cameraBoomLimit } from "../../../game/render/camera";
import type { CameraMode, Renderer } from "../../../game/model";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { GpsMap } from "../../../app/gps-map";
import { makeHud } from "../../../game/hud";
import { makeWalkingActor } from "../../../game/player";

export const COAST_SCENES = {
  gateway: { x: -900, y: 72, heading: Math.PI },
  shore: { x: -2016, y: 40, heading: -Math.PI / 2 },
  pier: { x: -2232, y: -18, heading: Math.PI },
  bluff: { x: -1780, y: -343, heading: Math.PI },
  canyon: { x: -1200, y: -286, heading: 0 },
  citrus: { x: -1260, y: -665, heading: Math.PI },
  town: { x: -1638, y: 72, heading: Math.PI / 2 },
  canals: { x: -1836, y: 432, heading: Math.PI / 2 },
  studio: { x: -1476, y: 360, heading: Math.PI / 2 },
  bowl: { x: -1692, y: 360, heading: Math.PI / 2 },
  aquarium: { x: -1926, y: 216, heading: Math.PI / 2 },
  club: { x: -1854, y: -288, heading: Math.PI / 2 },
  surf: { x: -1962, y: 432, heading: Math.PI / 2 },
  rescue: { x: -1962, y: -612, heading: Math.PI / 2 },
  viewpoint: { x: -1314, y: -630, heading: Math.PI },
} as const;

declare global {
  interface Window {
    coastScene: {
      mount(kind: "WebGPU" | "Canvas 2D"): Promise<string>;
      render(scene: keyof typeof COAST_SCENES, mode: CameraMode): { z: number; surfaces: number; boxes: number };
      map(full: boolean): void;
    };
  }
}

const game = makeGame("street-ace", 1527, "free-run");
const stream = new CityStream();
let renderer: Renderer;
window.coastScene = {
  async mount(kind) {
    const canvas = document.createElement("canvas");
    canvas.id = "coast-fixture";
    canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;z-index:9999";
    document.body.append(canvas);
    renderer = kind === "Canvas 2D" ? new Canvas2DRenderer(canvas)
      : (await createWebGPURenderer(canvas, () => { throw new Error("Coast fixture device failed"); }, () => false))!;
    if (!renderer) throw new Error("Coast fixture adapter unavailable");
    return renderer.kind;
  },
  render(scene, mode) {
    const spot = COAST_SCENES[scene];
    const sample = nearestRoadProjection(spot, spot.heading);
    game.x = sample.point.x; game.y = sample.point.y; game.z = (sample.point.z ?? 0) + 0.64;
    game.heading = spot.heading; game.elapsed = 40;
    game.roadMotion.grounded = true; game.roadMotion.roadId = null;
    game.roadMotion.pitch = 0; game.roadMotion.roll = 0;
    for (let i = 0; i < 45; i += 1) stepVehicleRoadContact(game, 1 / 60, game.z);
    const onFoot = scene === "viewpoint" || scene === "pier";
    const focus = onFoot ? { ...spot, z: groundAt(spot).height } : game;
    game.player = onFoot ? { kind: "walking", location: { kind: "city" },
      actor: makeWalkingActor({ ...focus, heading: spot.heading, vx: 0, vy: 0, speed: 0 }) } : { kind: "driving" };
    const world = stream.update(focus.x, focus.y, mode === "fixed" ? 1 : 3);
    const camera = { x: focus.x, y: focus.y, heading: game.heading, mode, zoom: 1, onFoot,
      boom: mode === "chase-high" || mode === "chase-low" ? chaseCameraPreset(mode, onFoot).distance : 0,
      heightOffset: focus.z };
    if (mode === "chase-high" || mode === "chase-low") camera.boom = cameraBoomLimit(camera, world, camera.boom, chaseCameraPreset(mode, onFoot).height);
    renderer.render(game, camera, 40, world, buildNavigationPlan(game, { x: -1638, y: 72 }, game.heading));
    return { z: focus.z, surfaces: world.surfaces?.length ?? 0, boxes: world.boxes.length };
  },
  map(full) {
    const host = document.createElement("div");
    host.id = "coast-map-fixture";
    host.style.cssText = "position:fixed;inset:0;z-index:10000;background:#101820;padding:16px;overflow:auto";
    if (!full) host.style.cssText += ";inset:20px auto auto 20px;width:260px;height:260px";
    document.body.append(host);
    const hud = makeHud(game, buildNavigationPlan(game, { x: -1638, y: 72 }, game.heading));
    createRoot(host).render(createElement(GpsMap, { hud, full }));
  },
};
