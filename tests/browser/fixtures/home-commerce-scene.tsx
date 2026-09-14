import { createRef, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Canvas2DRenderer } from "../../../app/canvas2d-renderer";
import { createWebGPURenderer } from "../../../app/webgpu-renderer";
import { GameCommerceProvider } from "../../../app/game-commerce";
import { VehicleRepairOffer, VehicleRepairProvider } from "../../../app/vehicle-repair";
import { ShoppingPanel, HomeFurnishings } from "../../../app/shopping-panel";
import { GameStageHud } from "../../../app/game-stage-hud";
import { useCareer } from "../../../app/use-career";
import { presentSimulationEvents } from "../../../app/runtime/present-simulation-events";
import { TouchDriving } from "../../../app/runtime/touch-driving";
import { applyCareerRunBonuses } from "../../../game/career";
import { storeEntrance, homeEntrance, cityFuelEntrance } from "../../../game/shopping-routes";
import { interiorWorld } from "../../../game/interiors";
import { stepExploration, sceneWorld } from "../../../game/exploration";
import { stepRepairLot, recordVehicleContacts } from "../../../game/vehicle-damage";
import { makeFuel } from "../../../game/fuel";
import { makeGame } from "../../../game/state";
import { makeHud } from "../../../game/hud";
import { CityStream } from "../../../game/world";
import { buildNavigationPlan } from "../../../game/navigation";
import type { StoreId } from "../../../game/brands";
import type { Camera, Hud, Modal, Renderer, WorldPoint } from "../../../game/model";

const game = makeGame("street-ace", 191, "free-run", "arcade", "accord-v6");
game.traffic = []; game.fareDispatchEnabled = false;
const gameRef = { current: game }, stream = new CityStream(), noop = () => {};
const taxiExitRef = createRef<HTMLButtonElement>(), touchDriving = new TouchDriving();
const camera: Camera = { x: 0, y: 0, heading: 0, zoom: 1, mode: "fixed", boom: 14, distanceScale: 1, heightOffset: 0 };
let renderer: Renderer, api: ReturnType<typeof useCareer>, modal: Modal = null, showHud = false;
let update: (hud: Hud) => void = noop;
let city = stream.update(game.x, game.y, 1);
const host = document.createElement("main"); host.className = "arcade-shell mode-playing";
host.innerHTML = '<section class="game-stage" style="position:fixed;inset:0;width:100vw;height:100vh"><canvas class="game-canvas is-active"></canvas><div class="fixture-overlays"></div></section>';
document.body.append(host);
const root = createRoot(host.querySelector(".fixture-overlays")!);

function renderScene() {
  if (!renderer) return;
  renderer.resize(); renderer.render(game, camera, game.elapsed, sceneWorld(game, city), buildNavigationPlan(game, { x: game.x + 200, y: game.y, z: game.z }, game.heading));
}
function close() { modal = null; draw(); }
function navigate(point: WorldPoint) { game.customDestination = { x: point.x, y: point.y, z: point.z }; }
function Overlay() {
  const career = useCareer();
  useEffect(() => { api = career; }, [career]);
  const [hud, setHud] = useState(() => makeHud(game));
  useEffect(() => { update = setHud; return () => { update = noop; }; }, []);
  useEffect(() => { if (career.ready) applyCareerRunBonuses(game, career.careerRef.current); }, [career.ready, career.careerRef]);
  return <GameCommerceProvider api={career} gameRef={gameRef} hud={hud} mode="playing" modal={modal} setHud={setHud} checkpoint={renderScene} onNavigate={navigate} onClose={close}>
    <VehicleRepairProvider gameRef={gameRef} hud={hud} mode="playing" modal={modal} setHud={setHud} checkpoint={renderScene}>
      {modal ? <div className="modal-backdrop"><section className="comic-modal" role="dialog" aria-label="Commerce fixture" style={{ width: "min(940px, calc(100vw - 24px))" }}>
        {modal === "shop" ? <ShoppingPanel onClose={close} /> : modal === "home" ? <><HomeFurnishings /><button className="primary-small" onClick={close}>BACK TO THE APARTMENT</button></> : <><VehicleRepairOffer inline /><button onClick={close}>BACK TO STREET</button></>}
      </section></div> : showHud && <GameStageHud mode="playing" hud={hud} cameraMode={camera.mode} fareImpact={null} courierImpact={null} dockedFareCards={[]}
        onOpenFareDeck={noop} onOpenMap={noop} onCycleCamera={noop} onPulseInteraction={noop} onSetMode={noop} onTouch={noop} touchDriving={touchDriving} taxiExitRef={taxiExitRef} />}
    </VehicleRepairProvider>
  </GameCommerceProvider>;
}
function draw() { renderScene(); flushSync(() => { root.render(<Overlay />); update(makeHud(game)); }); return state(); }
function state() { return { ready: api?.ready ?? false, career: api?.careerRef.current, fuel: game.fuel.litres, fare: game.fare, furniture: game.homeFurnishings, boxes: sceneWorld(game, city).boxes.length, modal, destination: game.customDestination }; }
function scene(id: StoreId | "home" | "gas", inside = true) {
  const entry = id === "home" ? homeEntrance() : id === "gas" ? cityFuelEntrance() : storeEntrance(id);
  modal = null; showHud = false;
  game.x = entry.x + Math.cos(entry.heading) * 7; game.y = entry.y + Math.sin(entry.heading) * 7; game.z = entry.z ?? 0;
  game.vx = 0; game.vy = 0; game.speed = 0; game.heading = entry.heading + Math.PI;
  city = stream.update(entry.x, entry.y, 1);
  game.player = { kind: "walking", actor: { x: entry.x, y: entry.y, z: entry.z, heading: entry.heading + Math.PI, vx: 0, vy: 0, speed: 0 }, location: { kind: "city" } };
  if (inside) {
    game.interactionHeld = false;
    stepExploration(game, { up: false, down: false, left: false, right: false, boost: false, interact: true }, 1 / 60, city);
    if (game.player.location.kind !== "interior") throw new Error(`Cannot enter ${id}`);
    Object.assign(camera, { x: 0, y: 0, heightOffset: 0, mode: "fixed", heading: 0, zoom: 1, onFoot: true });
  } else {
    game.player.actor.x += Math.cos(entry.heading) * 6; game.player.actor.y += Math.sin(entry.heading) * 6;
    Object.assign(camera, { x: game.player.actor.x, y: game.player.actor.y, heightOffset: game.z, heading: game.heading, mode: "chase-low", boom: 9, zoom: 1, onFoot: true });
  }
  return draw();
}
function counter() {
  if (game.player.kind !== "walking" || game.player.location.kind !== "interior") throw new Error("Enter first");
  const venue = game.player.location.venue, world = interiorWorld(venue, game.homeFurnishings);
  const action = world.interactions.find(entry => entry.kind === "service")!;
  Object.assign(game.player.actor, { x: action.x, y: action.y, heading: action.heading });
  game.interactionHeld = false;
  const events = stepExploration(game, { up: false, down: false, left: false, right: false, boost: false, interact: true }, 1 / 60, city);
  presentSimulationEvents(events, { game: () => game, tone: noop, announce: noop, warmPassengerArt: noop, triggerFareImpact: noop, triggerCourierImpact: noop, setHomeNotice: noop, setGasNotice: noop, setCourierNotice: noop, setHud: update, openModal: next => { modal = next; } });
  return draw();
}
const fixture = {
  async mount(kind: "WebGPU" | "Canvas 2D") {
    const canvas = host.querySelector("canvas")!;
    renderer = kind === "Canvas 2D" ? new Canvas2DRenderer(canvas) : (await createWebGPURenderer(canvas, () => { throw new Error("Commerce fixture GPU failed"); }, () => false))!;
    if (!renderer) throw new Error("Adapter unavailable"); return draw();
  }, scene, counter, state, close,
  fuel(litres = 30, damage = false) {
    const entry = cityFuelEntrance(); scene("gas", false); game.player = { kind: "driving" };
    if (entry.kind !== "venue-entrance" || !entry.serviceLot) throw new Error("Fuel lot missing");
    game.x = entry.serviceLot!.x; game.y = entry.serviceLot!.y; game.fuel = makeFuel("accord-v6", litres); game.fare = 40;
    stepRepairLot(game, city, 1); if (damage) recordVehicleContacts(game, ["fixture-bump"]);
    showHud = true; return draw();
  },
  leaveLot() { game.x += 100; stepRepairLot(game, city, 1); return draw(); },
  save() { api.saveFuel(game); return state(); },
};
declare global { interface Window { homeCommerceScene: typeof fixture } }
window.homeCommerceScene = fixture;
