import type { Camera, Game } from "@/game/model";
import { localPoint } from "@/game/math";
import { nearestInteraction } from "@/game/interactions";
import { roadPosePoint } from "@/game/render/road-pose";
import { crownVehiclePointPose, taxiRoadPose } from "@/game/render/scene";
import { projectWorldPoint, viewProjection } from "@/game/render/view-projection";

/** Keep the context action outside the passenger door, away from the steering thumb. */
export function presentTaxiExitAction(element: HTMLButtonElement, game: Game, camera: Camera, width: number, height: number) {
  if (nearestInteraction(game)?.kind !== "exit-taxi") {
    element.style.visibility = "hidden";
    return;
  }
  const pose = taxiRoadPose(game);
  const point = (right: number) => roadPosePoint(pose, game.drivingModel === "simulation"
    ? crownVehiclePointPose(game, -0.35, right, 1.15)
    : { ...localPoint(game.x, game.y, game.heading, -0.35, right), z: 1.15 });
  const door = point(1.15), center = point(0);
  const matrix = viewProjection(game, camera, width / height, 1200);
  const screen = camera.mode === "cab"
    // The exterior door is behind the first-person camera; use the passenger's right.
    ? { x: width * .68, y: height * .62 }
    : projectWorldPoint(matrix, door.x, door.y, door.z, width, height);
  if (!screen) {
    element.style.visibility = "hidden";
    return;
  }
  const centerScreen = projectWorldPoint(matrix, center.x, center.y, center.z, width, height);
  const right = camera.mode === "cab" || screen.x >= (centerScreen?.x ?? width / 2);
  element.dataset.side = right ? "right" : "left";
  const left = Math.max(12, Math.min(width - element.offsetWidth - 12, right ? screen.x + 14 : screen.x - element.offsetWidth - 14));
  const maxTop = height - element.offsetHeight - (camera.mobile ? 116 : 12);
  let top = Math.max(Math.min(camera.mobile ? 136 : 12, maxTop), Math.min(maxTop, screen.y - element.offsetHeight / 2));
  // The passenger side shares the screen with the pedals; keep both actions reachable.
  const pedals = camera.mobile ? element.parentElement?.querySelector<HTMLElement>(".mobile-pedals") : null;
  if (pedals && left + element.offsetWidth > pedals.offsetLeft && left < pedals.offsetLeft + pedals.offsetWidth) {
    top = Math.min(top, pedals.offsetTop - element.offsetHeight - 26);
  }
  element.style.left = camera.mobile
    ? `clamp(var(--mobile-left), ${left}px, calc(100% - var(--mobile-right) - ${element.offsetWidth}px))`
    : `${left}px`;
  // Rotation can resize the HUD before the next rendered frame updates the door.
  element.style.top = camera.mobile
    ? `clamp(min(136px, calc(100% - ${element.offsetHeight + 116}px)), ${top}px, calc(100% - ${element.offsetHeight + 116}px))`
    : `${top}px`;
  element.style.visibility = "visible";
  return { x: left, y: top, width: element.offsetWidth, height: element.offsetHeight };
}
