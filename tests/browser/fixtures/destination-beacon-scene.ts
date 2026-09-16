import { Canvas2DRenderer } from "../../../app/canvas2d-renderer";
import { createWebGPURenderer } from "../../../app/webgpu-renderer";
import { activePassengerJob, makeGame } from "../../../game/state";
import { buildNavigationPlan } from "../../../game/navigation";
import { chaseCameraPreset } from "../../../game/config";
import type { Camera, CameraMode, Renderer, WorldView } from "../../../game/model";

const game = makeGame("street-ace", 82, "free-run");
Object.assign(game, { x: 0, y: 0, z: 0, heading: 0, traffic: [] });
const canvas = document.createElement("canvas");
canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh";
document.body.append(canvas);
let renderer: Renderer;
const plan = buildNavigationPlan(game, { x: 72, y: 0, z: 0 }, 0);
const fixture = {
  async mount(kind: "WebGPU" | "Canvas 2D") {
    renderer = kind === "Canvas 2D" ? new Canvas2DRenderer(canvas)
      : (await createWebGPURenderer(canvas, () => { throw new Error("Beacon fixture GPU failed"); }, () => false))!;
    if (!renderer) throw new Error("Beacon fixture adapter unavailable");
  },
  render(mode: CameraMode, distance: number, visible: boolean, occluded = false, mobile = false, behind = false, custom = false) {
    // Keep the fare and route colors identical; only move the beam out of frame.
    activePassengerJob(game).dropoff = { x: distance, y: visible ? 0 : distance * 10 + 1000000, z: 0 };
    game.onboard = !custom;
    game.customDestination = custom ? { ...activePassengerJob(game).dropoff } : null;
    game.fareDispatchEnabled = !custom;
    const camera: Camera = { x: 0, y: 0, zoom: 1, distanceScale: 1, heading: behind ? Math.PI : 0, mode, mobile,
      heightOffset: 0, boom: mode === "chase-low" || mode === "chase-high" ? chaseCameraPreset(mode, false).distance : 0 };
    const world: WorldView = { key: occluded ? "wall" : "open", chunks: [], colliders: [], interactions: [], boxes: [
      { x: 0, y: 0, z: -.2, sx: 100, sy: 100, sz: .2, yaw: 0, color: [.25, .3, .28, 1] },
      ...(occluded ? [{ x: 20, y: 0, z: 150, sx: 2, sy: 500, sz: 400, yaw: 0, color: [.3, .3, .3, 1] as const }] : []),
    ] };
    renderer.resize(); renderer.render(game, camera, 0, world, plan);
  },
};
declare global { interface Window { destinationBeacon: typeof fixture } }
window.destinationBeacon = fixture;
