import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { createRef } from "react";
import { MobileGameHud } from "../../../app/mobile-game-hud";
import { Canvas2DRenderer } from "../../../app/canvas2d-renderer";
import { createWebGPURenderer } from "../../../app/webgpu-renderer";
import { presentNavigationDistance } from "../../../app/runtime/navigation-distance";
import { TouchDriving } from "../../../app/runtime/touch-driving";
import { defaultCameraBoom, MAT_MARKER } from "../../../game/config";
import { makeHud } from "../../../game/hud";
import type { Camera, CameraMode, FareImpact, Renderer } from "../../../game/model";
import { NavigationController } from "../../../game/navigation";
import { makeGame } from "../../../game/state";
import { CityStream } from "../../../game/world";
import { cameraBoomLimit, chaseCameraEyeHeight } from "../../../game/render/camera";
import { projectWorldPoint, viewProjection } from "../../../game/render/view-projection";
import { farePresentationBoxes } from "../../../game/render/scene";
import { vehicleDepartureArrowBoxes } from "../../../game/render/navigation-glyph";
import { boxSurfaceFaces } from "../../../game/render/surfaces";
import { markFarePickedUp, syncNearestFareTarget } from "../../../game/fare-selection";

const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
const canvasRef = createRef<HTMLCanvasElement>();
const badgeRef = createRef<HTMLDivElement>();
const touch = new TouchDriving();
const noop = () => {};
const games = {
  pickup: makeGame("street-ace", 704, "free-run"),
  dropoff: makeGame("street-ace", 704, "free-run"),
};
const completedJob = games.pickup.fareJobs[games.pickup.jobIndex];
for (const [phase, game] of Object.entries(games)) {
  const job = game.fareJobs[game.jobIndex];
  const position = phase === "pickup" ? job.pickupApproach : job.dropoffApproach;
  game.x = position.x; game.y = position.y; game.z = position.z ?? 0;
  game.countdown = 0; game.message = "";
  markFarePickedUp(game, game.jobIndex);
  game.onboard = phase === "pickup";
  if (!game.onboard) syncNearestFareTarget(game, true);
}
const stream = new CityStream();
let renderer: Renderer | null = null;
let failed = false;

async function render(mode: CameraMode, scale: 1 | 2 | 4 | 8, phase: "pickup" | "dropoff", backend: "WebGPU" | "Canvas 2D", heading = -Math.PI / 2) {
  const game = games[phase];
  game.heading = heading;
  const job = phase === "pickup" ? game.fareJobs[game.jobIndex] : completedJob;
  const plan = new NavigationController().update(game);
  const hud = makeHud(game, plan);
  const card: FareImpact = { id: phase === "pickup" ? 1 : 2, kind: phase, fareId: job.id, fareNumber: 1,
    artCell: phase === "pickup" ? job.passengerArtCell : job.destinationCard?.artCell ?? 0, durationMs: 60000,
    rider: job.rider, destination: job.destination, eyebrow: phase === "pickup" ? "NEW FARE" : "FARE COMPLETE",
    headline: phase === "pickup" ? "GET IN!" : "CLEAN DROP", detail: phase === "pickup" ? "+8 BOOST" : "+$120 FARE · +$24 TIP",
    destinationCard: phase === "dropoff" ? job.destinationCard : undefined };
  flushSync(() => root.render(<main className="arcade-shell mode-playing"><section className="game-stage">
    <canvas ref={canvasRef} className="game-canvas is-active" />
    <div ref={badgeRef} className="navigation-distance"><span /><strong /><small /></div>
    <MobileGameHud mode="playing" hud={hud} fareImpact={card} courierImpact={null} touchDriving={touch}
      onPulseInteraction={noop} onSetMode={noop} onTouch={noop} />
  </section></main>));
  if (!renderer) {
    renderer = backend === "WebGPU"
      ? await createWebGPURenderer(canvasRef.current!, () => { failed = true; }, () => false)
      : new Canvas2DRenderer(canvasRef.current!);
    if (!renderer) throw new Error("Requested renderer could not initialize: " + backend);
  }
  renderer.resize();
  const world = stream.update(game.x, game.y, 3);
  const camera: Camera = { x: game.x, y: game.y, heightOffset: game.z, heading, mode, mobile: true,
    boom: defaultCameraBoom(mode, scale), distanceScale: scale, zoom: 1 };
  if (mode === "chase-high" || mode === "chase-low") {
    camera.boom = cameraBoomLimit(camera, world, camera.boom, chaseCameraEyeHeight(camera));
  }
  renderer.render(game, camera, 0, world, plan);
  const { width, height } = canvasRef.current!.getBoundingClientRect();
  presentNavigationDistance(badgeRef.current!, game, camera, 0, plan, width, height);
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  const cab = projectWorldPoint(viewProjection(game, camera, width / height, 1400), game.x, game.y, game.z + 1, width, height);
  const markerBoxes = farePresentationBoxes(game, 0).filter(box => box.material === MAT_MARKER);
  const matrix = viewProjection(game, camera, width / height, 1400);
  const arrowPoints = vehicleDepartureArrowBoxes(game, 0, plan, mode).flatMap(box => boxSurfaceFaces(box))
    .flatMap(face => face.corners).map(point => projectWorldPoint(matrix, point.x, point.y, point.z, width, height))
    .filter(point => point !== null);
  return { cab, width, height, failed, backend: renderer.kind, pickups: hud.availablePickups.length,
    arrowPoints,
    centerBeacons: markerBoxes.filter(box => Math.hypot(box.x - (game.onboard ? job.dropoff.x : job.pickup.x), box.y - (game.onboard ? job.dropoff.y : job.pickup.y)) < 1).length };
}

declare global { interface Window { mobileComposition: { render: typeof render } } }
window.mobileComposition = { render };
