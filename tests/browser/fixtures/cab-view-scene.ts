import { Canvas2DRenderer } from "../../../app/canvas2d-renderer";
import { createWebGPURenderer } from "../../../app/webgpu-renderer";
import { makeGame } from "../../../game/state";
import { MAT_MARKER } from "../../../game/config";
import type { DrivingModel, Renderer, VehicleId, WorldView } from "../../../game/model";

const canvas = document.createElement("canvas");
canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh";
document.body.append(canvas);
let renderer: Renderer;
const game = makeGame("street-ace", 18, "free-run");
Object.assign(game, { x: 6000, y: 0, z: 0, heading: 0, traffic: [], fareDispatchEnabled: false });
// A uniformly colored wall fills the view. Any car part would obscure it.
// This isolated position has no pedestrians, traffic or other scene actors.
const world: WorldView = { key: "cab-visibility", colliders: [], chunks: [], interactions: [], boxes: [
  { x: 6020, y: 0, z: 0, sx: 1, sy: 1000, sz: 1000, yaw: 0, color: [.16, .85, .7, 1], material: MAT_MARKER },
] };
const fixture = {
  async mount(kind: "WebGPU" | "Canvas 2D") {
    renderer = kind === "Canvas 2D" ? new Canvas2DRenderer(canvas)
      : (await createWebGPURenderer(canvas, () => { throw new Error("Cab fixture GPU failed"); }, () => false))!;
    if (!renderer) throw new Error("Cab fixture adapter unavailable");
  },
  draw(vehicleId: VehicleId, drivingModel: DrivingModel, vehicleDetail: "classic" | "detailed", roll = 0) {
    Object.assign(game, { vehicleId, drivingModel }); game.simulationVehicle.bodyRoll = roll;
    renderer.resize();
    renderer.render(game, { x: game.x, y: game.y, heightOffset: game.z, heading: 0, mode: "cab", zoom: 1, boom: 0, vehicleDetail }, 0, world,
      { route: [], departureYaw: 0, travelHeading: 0, requiresUTurn: false, turnCue: null });
  },
};
declare global { interface Window { cabViewScene: typeof fixture } }
window.cabViewScene = fixture;
