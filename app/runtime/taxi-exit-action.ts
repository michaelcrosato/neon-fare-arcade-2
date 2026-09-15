import type { Camera, Game } from "@/game/model";
import { localPoint } from "@/game/math";
import { nearestInteraction } from "@/game/interactions";
import { roadPosePoint } from "@/game/render/road-pose";
import { crownVehiclePointPose, taxiRoadPose } from "@/game/render/scene";
import { projectWorldPoint, viewProjection } from "@/game/render/view-projection";

/** Keep the context action beside the physical driver door in both renderers. */
export function presentTaxiExitAction(element: HTMLButtonElement, game: Game, camera: Camera, width: number, height: number) {
  if (nearestInteraction(game)?.kind !== "exit-taxi") {
    element.style.visibility = "hidden";
    return;
  }
  const bodyPoint = game.drivingModel === "simulation"
    ? crownVehiclePointPose(game, -0.35, -1.15, 1.15)
    : { ...localPoint(game.x, game.y, game.heading, -0.35, -1.15), z: 1.15 };
  const door = roadPosePoint(taxiRoadPose(game), bodyPoint);
  const screen = camera.mode === "cab"
    // The exterior door is behind the first-person camera; use its left side.
    ? { x: width * .32, y: height * .62 }
    : projectWorldPoint(viewProjection(game, camera, width / height, 1200), door.x, door.y, door.z, width, height);
  if (!screen) {
    element.style.visibility = "hidden";
    return;
  }
  const left = Math.max(12, Math.min(width - element.offsetWidth - 12, screen.x - element.offsetWidth - 14));
  const top = Math.max(camera.mobile ? 136 : 12, Math.min(height - element.offsetHeight - (camera.mobile ? 116 : 12), screen.y - element.offsetHeight / 2));
  element.style.left = camera.mobile
    ? `clamp(var(--mobile-left), ${left}px, calc(100% - var(--mobile-right) - ${element.offsetWidth}px))`
    : `${left}px`;
  // Rotation can resize the HUD before the next rendered frame updates the door.
  element.style.top = camera.mobile
    ? `clamp(136px, ${top}px, calc(100% - ${element.offsetHeight + 116}px))`
    : `${top}px`;
  element.style.visibility = "visible";
  return { x: left, y: top, width: element.offsetWidth, height: element.offsetHeight };
}
