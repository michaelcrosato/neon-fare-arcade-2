import { Canvas2DRenderer } from "../../../app/canvas2d-renderer";
import { createWebGPURenderer } from "../../../app/webgpu-renderer";
import { makeGame } from "../../../game/state";
import { CityStream } from "../../../game/world";
import { sampleSpecialRoad, specialRoadLength } from "../../../game/road-network";
import { buildNavigationPlan } from "../../../game/navigation";
import { chaseCameraPreset } from "../../../game/config";
import { stepVehicleRoadContact } from "../../../game/vehicle-road-contact";
import { cameraBoomLimit } from "../../../game/render/camera";
import type { CameraMode, Renderer } from "../../../game/model";

// Bundled only by Playwright. This exercises production renderers and world
// data without adding a teleport/debug interface to the shipped game.
declare global {
  interface Window {
    roadScene: {
      mount(kind: "WebGPU" | "Canvas 2D"): Promise<string>;
      render(scene: "ramp" | "bridge" | "underpass", mode: CameraMode): { z: number; surfaces: number };
    };
  }
}

const game = makeGame("street-ace", 1527, "free-run");
const stream = new CityStream();
let renderer: Renderer;
window.roadScene = {
  async mount(kind) {
    const canvas = document.createElement("canvas");
    canvas.id = "elevation-fixture";
    canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;z-index:9999";
    document.body.append(canvas);
    renderer = kind === "Canvas 2D" ? new Canvas2DRenderer(canvas)
      : (await createWebGPURenderer(canvas, () => { throw new Error("WebGPU fixture device failed"); }, () => false))!;
    if (!renderer) throw new Error("WebGPU fixture adapter unavailable");
    return renderer.kind;
  },
  render(scene, mode) {
    const roadId = scene === "ramp" ? "northeast-inner-ramp" : "neon-beltway";
    const progress = scene === "ramp" ? specialRoadLength(roadId) / 2 : 0;
    const sample = sampleSpecialRoad(roadId, progress)!;
    game.x = sample.point.x; game.y = sample.point.y;
    game.z = scene === "underpass" ? 0 : sample.point.z + 0.64;
    game.heading = scene === "underpass" ? Math.PI / 2 : sample.heading + Math.PI;
    game.elapsed = 40;
    game.roadMotion.grounded = true;
    game.roadMotion.roadId = scene === "underpass" ? null : roadId;
    game.roadMotion.pitch = 0; game.roadMotion.roll = 0;
    for (let i = 0; i < 45; i += 1) stepVehicleRoadContact(game, 1 / 60, game);
    const target = scene === "underpass" ? { x: 0, y: -504 } : sampleSpecialRoad(roadId, Math.max(0, progress - 24))!.point;
    const world = stream.update(game.x, game.y, mode === "fixed" ? 1 : 3);
    const camera = { x: game.x, y: game.y, heading: game.heading, mode, zoom: 1,
      boom: mode === "chase-high" || mode === "chase-low" ? chaseCameraPreset(mode).distance : 0,
      heightOffset: game.z };
    if (mode === "chase-high" || mode === "chase-low") camera.boom = cameraBoomLimit(camera, world, camera.boom, chaseCameraPreset(mode).height);
    renderer.render(game, camera, 40, world, buildNavigationPlan(game, target, game.heading));
    return { z: game.z, surfaces: world.surfaces?.length ?? 0 };
  },
};
