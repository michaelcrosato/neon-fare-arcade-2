import { localPoint } from "../math";
import type { Camera, Game } from "../model";
import { isDriving } from "../player";
import { lookAt } from "./camera";
import { crownVehiclePointPose, crownVehicleUpVector, taxiRoadPose } from "./scene";
import { roadPosePoint, roadPoseVector } from "./road-pose";

export const CAB_EYE_HEIGHT = 1.72;
const CAB_LOOK_HEIGHT = 1.35;

/** The rolling cabin owns the eye only while the player is inside the taxi. */
export function cabViewMatrix(game: Game, camera: Camera) {
  if (isDriving(game) && game.drivingModel === "simulation") {
    const pose = taxiRoadPose(game);
    const suspensionOffset = camera.heightOffset - pose.z;
    const eye = roadPosePoint(pose, crownVehiclePointPose(game, 0.02, -0.46, CAB_EYE_HEIGHT + suspensionOffset));
    const target = roadPosePoint(pose, crownVehiclePointPose(game, 26, -0.32, CAB_LOOK_HEIGHT + suspensionOffset));
    const cabinUp = crownVehicleUpVector(game);
    const up = roadPoseVector(pose, { x: cabinUp[0], y: cabinUp[1], z: cabinUp[2] });
    return lookAt(
      [eye.x, eye.y, eye.z],
      [target.x, target.y, target.z],
      [up.x, up.y, up.z],
    );
  }
  const eye = localPoint(camera.x, camera.y, camera.heading, 0.02, -0.46);
  const target = localPoint(camera.x, camera.y, camera.heading, 26, -0.32);
  if (isDriving(game)) {
    const pose = taxiRoadPose(game);
    const suspensionOffset = camera.heightOffset - pose.z;
    const roadEye = roadPosePoint(pose, { ...eye, z: CAB_EYE_HEIGHT + suspensionOffset });
    const roadTarget = roadPosePoint(pose, { ...target, z: CAB_LOOK_HEIGHT + suspensionOffset });
    const up = roadPoseVector(pose, { x: 0, y: 0, z: 1 });
    return lookAt([roadEye.x, roadEye.y, roadEye.z], [roadTarget.x, roadTarget.y, roadTarget.z], [up.x, up.y, up.z]);
  }
  return lookAt(
    [eye.x, eye.y, 1.52 + camera.heightOffset],
    [target.x, target.y, 1.15 + camera.heightOffset],
  );
}
