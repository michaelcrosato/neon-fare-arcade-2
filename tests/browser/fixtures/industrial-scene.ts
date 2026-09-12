import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { Canvas2DRenderer } from "../../../app/canvas2d-renderer";
import { createWebGPURenderer } from "../../../app/webgpu-renderer";
import { GpsMap } from "../../../app/gps-map";
import { makeGame } from "../../../game/state";
import { makeHud } from "../../../game/hud";
import { CityStream } from "../../../game/world";
import { nearestRoadProjection } from "../../../game/road-network";
import { buildNavigationPlan } from "../../../game/navigation";
import { defaultCameraBoom } from "../../../game/config";
import { groundAt, stepVehicleRoadContact } from "../../../game/vehicle-road-contact";
import { cameraBoomLimit, chaseCameraEyeHeight } from "../../../game/render/camera";
import { controlledPose, findTaxiExitPose } from "../../../game/player";
import { containingRegionForPosition } from "../../../game/regions";
import type { Camera, CameraMode, Renderer } from "../../../game/model";

export const INDUSTRIAL_SCENES = {
  gate: { x: -1764, y: 936, heading: -.4 },
  foundry: { x: -1404, y: 1008, heading: Math.PI / 2 },
  refinery: { x: -1296, y: 1390, heading: Math.PI / 2 },
  port: { x: -1888, y: 1350, heading: Math.PI },
  shipyard: { x: -1990, y: 1840, heading: Math.PI },
  salvage: { x: -1386, y: 1944, heading: Math.PI / 2 },
  freight: { x: -1638, y: 1440, heading: Math.PI / 2 },
  breakwater: { x: -1980, y: 2268, heading: Math.PI },
  "coast-seam": { x: -1728, y: 790, heading: Math.PI / 2 },
  "copper-seam": { x: -790, y: 1368, heading: Math.PI },
} as const;

const game = makeGame("street-ace", 1527, "free-run"), stream = new CityStream();
let renderer: Renderer, failed = false;
window.industrialScene = {
  async mount(kind) {
    const canvas = document.createElement("canvas");
    canvas.id = "industrial-fixture";
    canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100dvh;z-index:9999";
    document.body.append(canvas);
    renderer = kind === "Canvas 2D" ? new Canvas2DRenderer(canvas)
      : (await createWebGPURenderer(canvas, () => { failed = true; }, () => false))!;
    if (!renderer) throw new Error("Industrial fixture could not create " + kind);
    return renderer.kind;
  },
  render(scene, mode, walking = false) {
    const spot = INDUSTRIAL_SCENES[scene];
    // The dry dock has a public quay inside its continuous campus.
    const point = scene === "shipyard" ? spot : nearestRoadProjection(spot, spot.heading).point;
    game.x = point.x; game.y = point.y; game.z = groundAt(point).height;
    game.heading = spot.heading; game.elapsed = 40; game.fareDispatchEnabled = false;
    game.roadMotion.grounded = true; game.roadMotion.roadId = null;
    game.roadMotion.pitch = 0; game.roadMotion.roll = 0;
    for (let i = 0; i < 45; i++) stepVehicleRoadContact(game, 1 / 60, game);
    const world = stream.update(game.x, game.y, 3);
    const exitPose = walking ? findTaxiExitPose(game, world) : null;
    if (walking && !exitPose) throw new Error("The shipyard must provide a clear taxi exit");
    game.player = walking ? { kind: "walking", location: { kind: "city" }, actor: exitPose! } : { kind: "driving" };
    const focus = controlledPose(game);
    const scale = walking ? 1 : 4;
    const camera: Camera = { x: focus.x, y: focus.y, heading: focus.heading, mode, zoom: 1, onFoot: walking,
      mobile: matchMedia("(max-width: 820px), (pointer: coarse)").matches,
      distanceScale: scale, boom: defaultCameraBoom(mode, scale), heightOffset: focus.z ?? 0 };
    if (mode === "chase-high" || mode === "chase-low") camera.boom = cameraBoomLimit(camera, world, camera.boom, chaseCameraEyeHeight(camera));
    const plan = buildNavigationPlan(game, { x: -1152, y: 1296 }, game.heading);
    renderer.render(game, camera, 40, world, plan);
    return { z: game.z, region: containingRegionForPosition(game.x, game.y)?.id, boxes: world.boxes.length,
      surfaces: (world.surfaces?.length ?? 0) + (world.landscapeSurfaces?.length ?? 0), failed };
  },
  map(full) {
    document.getElementById("industrial-map-fixture")?.remove();
    const host = document.createElement("div");
    host.id = "industrial-map-fixture";
    host.style.cssText = "position:fixed;inset:0;z-index:10000;background:#101820;padding:16px;overflow:auto";
    if (!full) host.style.cssText += ";inset:20px auto auto 20px;width:260px;height:260px";
    document.body.append(host);
    const hud = makeHud(game, buildNavigationPlan(game, { x: -1152, y: 1296 }, game.heading));
    createRoot(host).render(createElement(GpsMap, { hud, full }));
  },
};

declare global {
  interface Window {
    industrialScene: {
      mount(kind: "WebGPU" | "Canvas 2D"): Promise<string>;
      render(scene: keyof typeof INDUSTRIAL_SCENES, mode: CameraMode, walking?: boolean): {
        z: number; region?: string; boxes: number; surfaces: number; failed: boolean;
      };
      map(full: boolean): void;
    };
  }
}
