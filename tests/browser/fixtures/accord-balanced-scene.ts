import { Canvas2DRenderer } from "../../../app/canvas2d-renderer";
import { createWebGPURenderer } from "../../../app/webgpu-renderer";
import { makeGame } from "../../../game/state";
import type { DrivingModel, Renderer, WorldView } from "../../../game/model";

const canvas = document.createElement("canvas");
canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh";
document.body.append(canvas);
let renderer: Renderer;
const game = makeGame("street-ace", 18, "free-run", "arcade", "accord-v6");
Object.assign(game, { x: 6000, y: 0, z: 0, heading: 0, traffic: [], fareDispatchEnabled: false });
const world: WorldView = { key: "accord-balanced", colliders: [], chunks: [], interactions: [], boxes: [
  { x: 6000, y: 0, z: -.12, sx: 100, sy: 100, sz: .2, yaw: 0, color: [.18, .27, .25, 1] },
] };
const fixture = {
  async mount(kind: "WebGPU" | "Canvas 2D") {
    renderer = kind === "Canvas 2D" ? new Canvas2DRenderer(canvas)
      : (await createWebGPURenderer(canvas, () => { throw new Error("Accord GPU failed"); }, () => false))!;
    if (!renderer) throw new Error("Accord adapter unavailable");
  },
  draw(detail: "classic" | "detailed", model: DrivingModel, heading = 0, steering = 0, roll = 0) {
    Object.assign(game, { drivingModel: model, heading, steering });
    game.simulationVehicle.bodyRoll = roll;
    renderer.resize();
    renderer.render(game, { x: game.x, y: game.y, heightOffset: .7, heading: 0, mode: "fixed", zoom: 7, distanceScale: 1, boom: 0, vehicleDetail: detail },
      0, world, { route: [], departureYaw: 0, travelHeading: 0, requiresUTurn: false, turnCue: null });
  },
};
declare global { interface Window { accordBalancedScene: typeof fixture } }
window.accordBalancedScene = fixture;
