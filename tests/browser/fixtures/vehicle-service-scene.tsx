import { createRef, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Canvas2DRenderer } from "../../../app/canvas2d-renderer";
import { createWebGPURenderer } from "../../../app/webgpu-renderer";
import { GameStageHud } from "../../../app/game-stage-hud";
import { VehicleRepairOffer, VehicleRepairProvider } from "../../../app/vehicle-repair";
import { TouchDriving } from "../../../app/runtime/touch-driving";
import { presentTaxiExitAction } from "../../../app/runtime/taxi-exit-action";
import { defaultCameraBoom } from "../../../game/config";
import { makeHud } from "../../../game/hud";
import { buildNavigationPlan } from "../../../game/navigation";
import { makeGame } from "../../../game/state";
import { groundAt } from "../../../game/vehicle-road-contact";
import { makeVehicleDamage, recordVehicleContacts, stepRepairLot, vehicleRepairQuote } from "../../../game/vehicle-damage";
import type { Camera, CameraMode, DrivingModel, Hud, Modal, Renderer, VehicleId, WorldView } from "../../../game/model";

const game = makeGame("street-ace", 41, "free-run");
game.x = 0; game.y = 0; game.z = 0; game.heading = 0; game.traffic = [];
game.z = groundAt(game, .85).height; game.fareDispatchEnabled = false;
const gameRef = { current: game }, taxiExitRef = createRef<HTMLButtonElement>();
const touchDriving = new TouchDriving(), noop = () => {};
let renderer: Renderer, showHud = false, modal: Modal = null;
let exitRequests = 0;
let updateHud: (hud: Hud) => void = noop;
const station = { kind: "venue-entrance", id: "fixture-gas", x: 0, y: -6, z: 0, heading: 0, radius: 2.35,
  label: "GO-GO GAS", venue: { kind: "gas", id: "fixture-gas", label: "GO-GO GAS" }, serviceLot: { x: 0, y: 0, halfX: 8, halfY: 8 } } as const;
const world: WorldView = { key: "vehicle-service", colliders: [], chunks: [], interactions: [station], boxes: [
  { x: 0, y: 0, z: game.z - .18, sx: 100, sy: 100, sz: .3, yaw: 0, color: [.25, .29, .28, 1] },
  { x: 0, y: 0, z: game.z - .015, sx: 16, sy: 16, sz: .02, yaw: 0, color: [.53, .52, .44, 1] },
] };
const camera: Camera = { x: 0, y: 0, zoom: 5, distanceScale: 1, heading: 0, mode: "fixed", boom: 14, heightOffset: game.z, vehicleDetail: "detailed" };
const host = document.createElement("main");
host.className = "arcade-shell mode-playing";
host.innerHTML = '<section class="game-stage" style="position:fixed;inset:0;width:100vw;height:100vh"><canvas class="game-canvas is-active"></canvas><div class="fixture-overlays"></div></section>';
document.body.append(host);
const canvas = host.querySelector("canvas")!;
const root = createRoot(host.querySelector(".fixture-overlays")!);

function Overlay() {
  const [hud, setHud] = useState(() => makeHud(game));
  useEffect(() => { updateHud = setHud; return () => { updateHud = noop; }; }, []);
  return <VehicleRepairProvider gameRef={gameRef} hud={hud} mode="playing" modal={modal} setHud={setHud} checkpoint={noop}>
    {showHud && (modal === "gas" ? <div style={{ position: "absolute", inset: 20, zIndex: 60, overflow: "auto", pointerEvents: "auto" }}><VehicleRepairOffer inline /></div> : <GameStageHud mode="playing" hud={hud} cameraMode="fixed"
      fareImpact={null} courierImpact={null} dockedFareCards={[]} onOpenFareDeck={noop} onOpenMap={noop}
      onCycleCamera={noop} onPulseInteraction={() => { exitRequests++; }} onSetMode={noop} onTouch={noop} touchDriving={touchDriving} taxiExitRef={taxiExitRef} />)}
  </VehicleRepairProvider>;
}
function draw() {
  renderer.resize();
  const plan = buildNavigationPlan(game, { x: 0, y: -216, z: 0 }, game.heading);
  renderer.render(game, camera, game.elapsed, world, plan);
  flushSync(() => { root.render(<Overlay />); updateHud(makeHud(game, plan, world)); });
  if (taxiExitRef.current) presentTaxiExitAction(taxiExitRef.current, game, camera, innerWidth, innerHeight);
  return { damage: vehicleRepairQuote(game), fare: game.fare, message: game.message, exitRequests };
}
const fixture = {
  async mount(kind: "WebGPU" | "Canvas 2D") {
    renderer = kind === "Canvas 2D" ? new Canvas2DRenderer(canvas)
      : (await createWebGPURenderer(canvas, () => { throw new Error("Vehicle fixture GPU failed"); }, () => false))!;
    if (!renderer) throw new Error("Vehicle fixture adapter unavailable");
    await document.fonts.ready;
    return draw();
  },
  model(id: VehicleId, detail: "classic" | "detailed", heading = 0) {
    game.vehicleId = id; game.heading = heading; camera.vehicleDetail = detail;
    showHud = false; return draw();
  },
  presentation(id: VehicleId, model: DrivingModel, mode: CameraMode, heading = -Math.PI / 2, scale: 1 | 2 | 4 | 8 = 1) {
    game.vehicleId = id; game.drivingModel = model; game.heading = heading; game.message = "";
    game.speed = 0; game.vx = 0; game.vy = 0; game.damage = makeVehicleDamage();
    game.player = { kind: "driving" }; modal = null; showHud = true; exitRequests = 0;
    Object.assign(camera, { mode, heading, zoom: 1, distanceScale: scale, boom: defaultCameraBoom(mode, scale),
      mobile: matchMedia("(max-width: 820px), (pointer: coarse)").matches });
    return draw();
  },
  hit() { game.elapsed += .4; recordVehicleContacts(game, [[`fixture-impact:${game.damage.impacts}`, 60]]); return draw(); },
  redraw: draw,
  expire() { game.elapsed += 3.1; return draw(); },
  damage(fare = 100) {
    game.damage = makeVehicleDamage(); game.fare = fare; game.elapsed = 5; game.x = 0;
    game.vx = 0; game.vy = 0; game.speed = 0; game.player = { kind: "driving" }; modal = null;
    recordVehicleContacts(game, [["fender", 60], ["radiator", 60], ["bumper", 60]]);
    stepRepairLot(game, world, .8); showHud = true; camera.zoom = 1; return draw();
  },
  leave() { game.x = 20; stepRepairLot(game, world, .8); return draw(); },
  returnToLot() { game.x = 0; stepRepairLot(game, world, .8); return draw(); },
  inside() {
    game.player = { kind: "walking", actor: { x: 0, y: 0, z: 0, vx: 0, vy: 0, speed: 0, heading: 0 },
      location: { kind: "interior", venue: station.venue, returnPose: { x: 0, y: -6, heading: 0 } } };
    modal = "gas"; return draw();
  },
  state() { return { damage: vehicleRepairQuote(game), fare: game.fare, message: game.message }; },
};
declare global { interface Window { vehicleServiceScene: typeof fixture } }
window.vehicleServiceScene = fixture;
