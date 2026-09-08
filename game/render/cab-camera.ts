import { localPoint } from "../math";
import type { Camera, Game } from "../model";
import { isDriving } from "../player";
import { lookAt } from "./camera";
import { crownVehiclePointPose, crownVehicleUpVector } from "./scene";

/** The rolling cabin owns the eye only while the player is inside the taxi. */
export function cabViewMatrix(game: Game, camera: Camera) {
  if (isDriving(game) && game.drivingModel === "simulation") {
    const eye = crownVehiclePointPose(game, 0.02, -0.46, 1.52 + camera.heightOffset);
    const target = crownVehiclePointPose(game, 26, -0.32, 1.15 + camera.heightOffset);
    return lookAt(
      [eye.x, eye.y, eye.z],
      [target.x, target.y, target.z],
      crownVehicleUpVector(game),
    );
  }
  const eye = localPoint(camera.x, camera.y, camera.heading, 0.02, -0.46);
  const target = localPoint(camera.x, camera.y, camera.heading, 26, -0.32);
  return lookAt(
    [eye.x, eye.y, 1.52 + camera.heightOffset],
    [target.x, target.y, 1.15 + camera.heightOffset],
  );
}
