import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { createRef } from "react";
import { Canvas2DRenderer } from "../../../app/canvas2d-renderer";
import { createWebGPURenderer } from "../../../app/webgpu-renderer";
import { GameSessionOverlays } from "../../../app/game-session-overlays";
import { GameStageHud } from "../../../app/game-stage-hud";
import { TouchDriving } from "../../../app/runtime/touch-driving";
import { presentNavigationDistance } from "../../../app/runtime/navigation-distance";
import { makeGame } from "../../../game/state";
import { makeHud } from "../../../game/hud";
import { recoverToRoad } from "../../../game/recovery";
import { roadLanePose } from "../../../game/road-lanes";
import { CityStream } from "../../../game/world";
import { buildNavigationPlan } from "../../../game/navigation";
import { defaultCameraBoom } from "../../../game/config";
import { towTruckBoxes } from "../../../game/render/tow-truck";
import type { Camera, CameraMode, NavigationPlan, Renderer } from "../../../game/model";

const game = makeGame("street-ace", 901, "free-run");
game.traffic = [];
const stream = new CityStream();
let renderer: Renderer;
const host = document.createElement("main");
host.className = "arcade-shell mode-playing";
host.innerHTML = '<section id="guidance-fixture" class="game-stage" style="position:fixed;inset:0;width:100vw;height:100vh"><canvas class="game-canvas is-active"></canvas><div class="navigation-distance" role="img" aria-label="Road guidance" hidden><span></span><strong></strong><small></small></div><div class="fixture-overlays"></div></section>';
document.body.append(host);
const canvas = host.querySelector("canvas")!;
const badge = host.querySelector<HTMLDivElement>(".navigation-distance")!;
const root = createRoot(host.querySelector(".fixture-overlays")!);
const noop = () => {};
const touchDriving = new TouchDriving();
const taxiExitRef = createRef<HTMLButtonElement>();

function draw(kind: "turn" | "uturn" | "tow", mode: CameraMode, age = .2) {
  if (kind !== "tow") {
    game.towRecovery = null;
    Object.assign(game, roadLanePose({ x: 0, y: -24, z: 0 }, -Math.PI / 2), { elapsed: 40, onboard: true });
  } else game.elapsed = (game.towRecovery?.startedAt ?? 40) + age;
  const camera: Camera = { x: game.x, y: game.y, heightOffset: game.z, heading: game.heading,
    mode, zoom: 1, boom: defaultCameraBoom(mode, 1), onFoot: false, distanceScale: 1 };
  const route = [{ x: game.x, y: game.y, z: game.z }, { x: 0, y: -36, z: 0 }, { x: 36, y: -36, z: 0 }];
  const plan: NavigationPlan = kind === "tow" ? buildNavigationPlan(game, { x: 0, y: -1404, z: 44 }, game.heading)
    : { route, departureYaw: -Math.PI / 2, travelHeading: -Math.PI / 2, requiresUTurn: kind === "uturn",
      turnCue: kind === "uturn" ? null : { point: route[1], incomingYaw: -Math.PI / 2, yaw: 0, kind: "right", distance: 12 } };
  const world = stream.update(game.x, game.y, mode === "fixed" ? 1 : 3);
  renderer.render(game, camera, 0, world, plan);
  const hud = makeHud(game, plan, world);
  flushSync(() => root.render(<><GameStageHud mode="playing" hud={hud} cameraMode={mode} rendererKind={renderer.kind}
    fareImpact={null} courierImpact={null} dockedFareCards={[]} onOpenFareDeck={noop} onOpenMap={noop}
    onCycleCamera={noop} onPulseInteraction={noop} onSetMode={noop} onTouch={noop}
    touchDriving={touchDriving} taxiExitRef={taxiExitRef} />
    <GameSessionOverlays mode="playing" hud={hud} cameraMode={mode} cameraDistanceScale={1}
    careerBank={0} fareCards={[]} diagnosticsActive={false} diagnosticsNotice="" muted={true}
    onToggleMute={noop} onOpenMap={noop} onSetCameraMode={noop} onSetCameraDistanceScale={noop} onSetMode={noop} onOpenHow={noop} onOpenOptions={noop}
    onFinishRun={noop} onToggleFareDispatch={noop} onRequestStartRun={noop} onOpenScores={noop} onCopyDiagnostics={noop} onRecover={noop} /></>));
  presentNavigationDistance(badge, game, camera, 0, plan, innerWidth, innerHeight);
  const truck = towTruckBoxes(game);
  return { fare: game.fare, z: game.z, truck: truck.length ? { x: truck[0].x, y: truck[0].y } : null, badge: badge.textContent };
}

declare global { interface Window { guidanceScene: {
  mount(kind: "WebGPU" | "Canvas 2D"): Promise<string>;
  draw: typeof draw;
  rescue(): { cost: number; z: number };
} } }
window.guidanceScene = {
  async mount(kind) {
    renderer = kind === "Canvas 2D" ? new Canvas2DRenderer(canvas)
      : (await createWebGPURenderer(canvas, () => { throw new Error("Guidance fixture device failed"); }, () => false))!;
    if (!renderer) throw new Error("Guidance fixture adapter unavailable");
    return renderer.kind;
  },
  draw,
  rescue() {
    Object.assign(game, { x: -270, y: -1770, z: 5, heading: 0, fare: 250, elapsed: 40, towRecovery: null });
    const recovery = recoverToRoad(game);
    if (!recovery) throw new Error("Canyon rescue failed");
    return { cost: recovery.cost, z: game.z };
  },
};
