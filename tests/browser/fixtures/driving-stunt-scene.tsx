import { createRef } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Canvas2DRenderer } from "../../../app/canvas2d-renderer";
import { createWebGPURenderer } from "../../../app/webgpu-renderer";
import { GameStageHud } from "../../../app/game-stage-hud";
import { GameSessionOverlays } from "../../../app/game-session-overlays";
import { TouchDriving } from "../../../app/runtime/touch-driving";
import { defaultCameraBoom, FIXED_DT } from "../../../game/config";
import { makeHud } from "../../../game/hud";
import { buildNavigationPlan } from "../../../game/navigation";
import { stepGame } from "../../../game/simulation";
import { makeSimulationVehicleState } from "../../../game/simulation-vehicle";
import { makeGame } from "../../../game/state";
import { groundAt, makeVehicleRoadMotion } from "../../../game/vehicle-road-contact";
import { CityStream } from "../../../game/world";
import type { Camera, DrivingModel, InputState, Mode, Renderer } from "../../../game/model";

let game = makeGame("street-ace", 12, "free-run");
let renderer: Renderer;
const stream = new CityStream();
const host = document.createElement("main");
host.className = "arcade-shell mode-playing";
host.innerHTML = '<section class="game-stage" style="position:fixed;inset:0;width:100vw;height:100vh"><canvas class="game-canvas is-active"></canvas><div class="fixture-overlays"></div></section>';
document.body.append(host);
const canvas = host.querySelector("canvas")!;
const root = createRoot(host.querySelector(".fixture-overlays")!);
const touchDriving = new TouchDriving(), taxiExitRef = createRef<HTMLButtonElement>();
const noop = () => {};
const idle: InputState = { up: false, down: false, left: false, right: false, boost: false };

function tick(input = idle) {
  stepGame(game, input, FIXED_DT, stream.update(game.x, game.y, 1), () => 1);
}

function draw(mode: Mode = "playing") {
  host.className = `arcade-shell mode-${mode}`;
  const camera: Camera = { x: game.x, y: game.y, heightOffset: game.z, heading: game.heading,
    mode: "chase-high", zoom: 1, boom: defaultCameraBoom("chase-high", 1), distanceScale: 1 };
  const world = stream.update(game.x, game.y, 3);
  const plan = buildNavigationPlan(game, { x: 0, y: -216, z: 0 }, game.heading);
  renderer.render(game, camera, game.elapsed, world, plan);
  const hud = makeHud(game, plan, world);
  flushSync(() => root.render(<><GameStageHud mode={mode} hud={hud} cameraMode="chase-high" rendererKind={renderer.kind}
    fareImpact={null} courierImpact={null} dockedFareCards={[]} onOpenFareDeck={noop} onOpenMap={noop}
    onCycleCamera={noop} onPulseInteraction={noop} onSetMode={noop} onTouch={noop}
    touchDriving={touchDriving} taxiExitRef={taxiExitRef} />
    <GameSessionOverlays mode={mode} hud={hud} cameraMode="chase-high" cameraDistanceScale={1}
      careerBank={0} fareCards={[]} diagnosticsActive={false} diagnosticsNotice="" muted={true}
      onToggleMute={noop} onOpenMap={noop} onSetCameraMode={noop} onSetCameraDistanceScale={noop}
      onSetMode={noop} onOpenHow={noop} onOpenOptions={noop} onFinishRun={noop} onToggleFareDispatch={noop}
      onRequestStartRun={noop} onOpenScores={noop} onCopyDiagnostics={noop} onRecover={noop} /></>));
  return hud.stunts;
}

function resetPose() {
  game.traffic = []; game.x = 0; game.y = 0; game.heading = 0;
  game.vx = 40; game.vy = 0; game.speed = 40;
  game.z = groundAt(game, 1).height;
  game.roadMotion = makeVehicleRoadMotion();
  game.simulationVehicle = makeSimulationVehicleState();
}

const fixture = {
  async mount(kind: "WebGPU" | "Canvas 2D", model: DrivingModel) {
    game = makeGame("street-ace", 12, "free-run", model);
    renderer = kind === "Canvas 2D" ? new Canvas2DRenderer(canvas)
      : (await createWebGPURenderer(canvas, () => { throw new Error("Stunt fixture GPU failed"); }, () => false))!;
    if (!renderer) throw new Error("Stunt fixture adapter unavailable");
    return renderer.kind;
  },
  drift() {
    resetPose(); game.vy = 16; game.speed = Math.hypot(game.vx, game.vy);
    for (let i = 0; i < 18; i++) tick({ ...idle, up: true, right: true });
    return draw();
  },
  finishDrift() {
    for (let i = 0; i < 300 && game.stunts.drift.active; i++) tick({ ...idle, down: true });
    return draw();
  },
  takeoff() {
    resetPose(); game.roadMotion.verticalSpeed = 8;
    tick();
    return draw();
  },
  land() {
    for (let i = 0; i < 180 && !game.roadMotion.grounded; i++) tick();
    return draw();
  },
  summary(mode: "paused" | "ended") { return draw(mode); },
};
declare global { interface Window { drivingStuntScene: typeof fixture } }
window.drivingStuntScene = fixture;
