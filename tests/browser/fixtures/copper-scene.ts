import { Canvas2DRenderer } from "../../../app/canvas2d-renderer";
import { createWebGPURenderer } from "../../../app/webgpu-renderer";
import { makeGame } from "../../../game/state";
import { CityStream } from "../../../game/world";
import { nearestRoadProjection, sampleSpecialRoad, specialRoadLength } from "../../../game/road-network";
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

export const COPPER_SCENES = {
  gateway: { x: 0, y: 936, heading: Math.PI / 2 },
  saguaro: { x: 324, y: 1080, heading: 0.25 },
  arch: { x: -678, y: 1220, heading: Math.PI / 2 },
  town: { x: 36, y: 1332, heading: Math.PI },
  motel: { x: -432, y: 1404, heading: 0 },
  airpark: { x: -540, y: 1692, heading: 0 },
  mesa: { x: 300, y: 1930, heading: -2.3 },
  canyon: { x: -72, y: 2280, heading: 0 },
  salt: { x: 648, y: 1980, heading: -Math.PI / 2 },
  visitor: { x: -216, y: 2196, heading: Math.PI / 2 },
} as const;

declare global {
  interface Window {
    copperScene: {
      mount(kind: "WebGPU" | "Canvas 2D"): Promise<string>;
      render(scene: keyof typeof COPPER_SCENES, mode: CameraMode): { z: number; surfaces: number; boxes: number };
      map(full: boolean): void;
    };
  }
}

const game = makeGame("street-ace", 1527, "free-run");
const stream = new CityStream();
let renderer: Renderer;
window.copperScene = {
  async mount(kind) {
    const canvas = document.createElement("canvas");
    canvas.id = "copper-fixture";
    canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;z-index:9999";
    document.body.append(canvas);
    renderer = kind === "Canvas 2D" ? new Canvas2DRenderer(canvas)
      : (await createWebGPURenderer(canvas, () => { throw new Error("Copper fixture device failed"); }, () => false))!;
    if (!renderer) throw new Error("Copper fixture adapter unavailable");
    return renderer.kind;
  },
  render(scene, mode) {
    const arch = sampleSpecialRoad("cinder-cone-loop", specialRoadLength("cinder-cone-loop") * 0.64 - 36)!;
    const spot = scene === "arch" ? { ...arch.point, heading: arch.heading } : COPPER_SCENES[scene];
    const sample = nearestRoadProjection(spot, spot.heading);
    game.x = sample.point.x; game.y = sample.point.y; game.z = (sample.point.z ?? 0) + 0.64;
    game.heading = spot.heading; game.elapsed = 40;
    game.roadMotion.grounded = true; game.roadMotion.roadId = null;
    game.roadMotion.pitch = 0; game.roadMotion.roll = 0;
    for (let i = 0; i < 45; i += 1) stepVehicleRoadContact(game, 1 / 60, game);
    const onFoot = scene === "visitor";
    const focus = onFoot ? { ...spot, z: terrainHeightAt(spot.x, spot.y) } : game;
    game.player = onFoot ? { kind: "walking", location: { kind: "city" },
      actor: makeWalkingActor({ ...focus, heading: spot.heading, vx: 0, vy: 0, speed: 0 }) } : { kind: "driving" };
    const world = stream.update(focus.x, focus.y, mode === "fixed" ? 1 : 3);
    const camera = { x: focus.x, y: focus.y, heading: game.heading, mode, zoom: 1, onFoot,
      boom: mode === "chase-high" || mode === "chase-low" ? chaseCameraPreset(mode).distance : 0,
      heightOffset: focus.z };
    if (mode === "chase-high" || mode === "chase-low") camera.boom = cameraBoomLimit(camera, world, camera.boom, chaseCameraPreset(mode).height);
    renderer.render(game, camera, 40, world, buildNavigationPlan(game, { x: -216, y: 2196 }, game.heading));
    return { z: focus.z, surfaces: world.surfaces?.length ?? 0, boxes: world.boxes.length };
  },
  map(full) {
    const host = document.createElement("div");
    host.id = "copper-map-fixture";
    host.style.cssText = "position:fixed;inset:0;z-index:10000;background:#101820;padding:16px;overflow:auto";
    if (!full) host.style.cssText += ";inset:20px auto auto 20px;width:260px;height:260px";
    document.body.append(host);
    const hud = makeHud(game, buildNavigationPlan(game, { x: -216, y: 2196 }, game.heading));
    createRoot(host).render(createElement(GpsMap, { hud, full }));
  },
};
