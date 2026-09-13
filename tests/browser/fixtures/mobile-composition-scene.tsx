import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { createRef } from "react";
import { MobileGameHud } from "../../../app/mobile-game-hud";
import { GameStageHud } from "../../../app/game-stage-hud";
import { Canvas2DRenderer } from "../../../app/canvas2d-renderer";
import { createWebGPURenderer } from "../../../app/webgpu-renderer";
import { presentNavigationDistance } from "../../../app/runtime/navigation-distance";
import { fareImpactObstacles, presentFareImpact } from "../../../app/runtime/fare-impact-layout";
import { TouchDriving } from "../../../app/runtime/touch-driving";
import { defaultCameraBoom, MAT_MARKER } from "../../../game/config";
import { makePickupFareImpact, makeDropoffFareImpact } from "../../../game/fare-presentation";
import { makeHud } from "../../../game/hud";
import type { Camera, CameraMode, FareImpact, Renderer } from "../../../game/model";
import { NavigationController } from "../../../game/navigation";
import { makeGame } from "../../../game/state";
import { CityStream } from "../../../game/world";
import { cameraBoomLimit, chaseCameraEyeHeight } from "../../../game/render/camera";
import { projectWorldPoint, viewProjection } from "../../../game/render/view-projection";
import { farePresentationBoxes, taxiBoxes } from "../../../game/render/scene";
import { vehicleDepartureArrowBoxes } from "../../../game/render/navigation-glyph";
import { boxSurfaceFaces } from "../../../game/render/surfaces";
import { markFarePickedUp, syncNearestFareTarget } from "../../../game/fare-selection";

const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
const canvasRef = createRef<HTMLCanvasElement>();
const badgeRef = createRef<HTMLDivElement>();
const fareRef = createRef<HTMLDivElement>();
const taxiExitRef = createRef<HTMLButtonElement>();
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
  const mobile = matchMedia("(max-width: 820px), (pointer: coarse)").matches;
  const input = { fareId: job.id, fareNumber: 1, rider: job.rider, destination: job.destination,
    destinationCard: job.destinationCard, runKind: game.runKind, bonusSeconds: 0 };
  const card: FareImpact = { ...(phase === "pickup"
    ? makePickupFareImpact({ ...input, artCell: job.passengerArtCell })
    : makeDropoffFareImpact({ ...input, artCell: job.destinationCard?.artCell ?? 0, fareAward: 120, stars: 5, tip: 24, multiplier: 1 })),
    id: phase === "pickup" ? 1 : 2, durationMs: 60000 };
  flushSync(() => root.render(<main className="arcade-shell mode-playing"><section className="game-stage">
    <canvas ref={canvasRef} className="game-canvas is-active" />
    <div ref={badgeRef} className="navigation-distance"><span /><strong /><small /></div>
    {mobile ? <MobileGameHud mode="playing" hud={hud} fareImpact={card} fareImpactRef={fareRef} courierImpact={null} touchDriving={touch}
      onPulseInteraction={noop} onSetMode={noop} onTouch={noop} />
      : <GameStageHud mode="playing" hud={hud} cameraMode={mode} rendererKind={backend} fareImpact={card}
        fareImpactRef={fareRef} courierImpact={null} dockedFareCards={[]} onOpenFareDeck={noop} onOpenMap={noop}
        onCycleCamera={noop} onPulseInteraction={noop} onSetMode={noop} onTouch={noop} touchDriving={touch} taxiExitRef={taxiExitRef} />}
  </section></main>));
  if (!renderer) {
    renderer = backend === "WebGPU"
      ? await createWebGPURenderer(canvasRef.current!, () => { failed = true; }, () => false)
      : new Canvas2DRenderer(canvasRef.current!);
    if (!renderer) throw new Error("Requested renderer could not initialize: " + backend);
  }
  const world = stream.update(game.x, game.y, 3);
  const camera: Camera = { x: game.x, y: game.y, heightOffset: game.z, heading, mode, mobile,
    boom: defaultCameraBoom(mode, scale), distanceScale: scale, zoom: 1 };
  if (mode === "chase-high" || mode === "chase-low") {
    camera.boom = cameraBoomLimit(camera, world, camera.boom, chaseCameraEyeHeight(camera));
  }
  let width = 0, height = 0;
  await document.fonts.ready;
  // Like the live frame loop, present the camera's labels and card together.
  for (let frame = 0; frame < 3; frame++) {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    renderer.resize();
    renderer.render(game, camera, 0, world, plan);
    ({ width, height } = canvasRef.current!.getBoundingClientRect());
    const navigationBadge = presentNavigationDistance(badgeRef.current!, game, camera, 0, plan, width, height);
    presentFareImpact(fareRef.current!, canvasRef.current!, game, camera, 0, plan, navigationBadge);
  }
  const cab = projectWorldPoint(viewProjection(game, camera, width / height, 1400), game.x, game.y, game.z + 1, width, height);
  const markerBoxes = farePresentationBoxes(game, 0).filter(box => box.material === MAT_MARKER);
  const matrix = viewProjection(game, camera, width / height, 1400);
  const arrowPoints = vehicleDepartureArrowBoxes(game, 0, plan, mode).flatMap(box => boxSurfaceFaces(box))
    .flatMap(face => face.corners).map(point => projectWorldPoint(matrix, point.x, point.y, point.z, width, height))
    .filter(point => point !== null);
  const cabPoints = (mode === "cab" ? [] : taxiBoxes(game, { includeGroundShadow: false })).flatMap(box => boxSurfaceFaces(box))
    .flatMap(face => face.corners).map(point => projectWorldPoint(matrix, point.x, point.y, point.z, width, height))
    .filter(point => point !== null);
  return { cab, width, height, failed, backend: renderer.kind, pickups: hud.availablePickups.length,
    arrowPoints, cabPoints,
    layout: { css: fareRef.current!.style.cssText, badge: badgeRef.current!.getBoundingClientRect().toJSON(),
      badgeHidden: badgeRef.current!.hidden, area: fareRef.current!.getBoundingClientRect().toJSON(),
      obstacles: fareImpactObstacles(game, camera, 0, plan, width, height), mode, scale, phase },
    centerBeacons: markerBoxes.filter(box => Math.hypot(box.x - (game.onboard ? job.dropoff.x : job.pickup.x), box.y - (game.onboard ? job.dropoff.y : job.pickup.y)) < 1).length };
}

declare global { interface Window { mobileComposition: { render: typeof render } } }
window.mobileComposition = { render };
