import type { Box, Vec3 } from "../model";

export type RoadPose = { x: number; y: number; heading: number; z: number; pitch: number; roll: number };

/** Rotate a world vector through the road frame in the vehicle's local axes. */
export function roadPoseVector(pose: RoadPose, vector: Vec3): Vec3 {
  const c = Math.cos(pose.heading), s = Math.sin(pose.heading);
  const x = c * vector.x + s * vector.y;
  const y = -s * vector.x + c * vector.y;
  const cr = Math.cos(pose.roll), sr = Math.sin(pose.roll);
  const cp = Math.cos(pose.pitch), sp = Math.sin(pose.pitch);
  const rolledY = cr * y - sr * vector.z;
  const rolledZ = sr * y + cr * vector.z;
  const pitchedX = cp * x + sp * rolledZ;
  return { x: c * pitchedX - s * rolledY, y: s * pitchedX + c * rolledY, z: -sp * x + cp * rolledZ };
}

export function roadPosePoint(pose: RoadPose, point: Vec3): Vec3 {
  const rotated = roadPoseVector(pose, { x: point.x - pose.x, y: point.y - pose.y, z: point.z });
  return { x: pose.x + rotated.x, y: pose.y + rotated.y, z: pose.z + rotated.z };
}

/** Compose Euler frames, including the simulation cab's full rollover rotation. */
export function placeBoxesOnRoad(boxes: Box[], start: number, pose: RoadPose) {
  for (let index = start; index < boxes.length; index += 1) {
    const box = boxes[index];
    const c = Math.cos(box.yaw), s = Math.sin(box.yaw);
    const cp = Math.cos(box.tilt ?? 0), sp = Math.sin(box.tilt ?? 0);
    const cr = Math.cos(box.pitch ?? 0), sr = Math.sin(box.pitch ?? 0);
    const forward = roadPoseVector(pose, { x: c * cp, y: s * cp, z: -sp });
    const right = roadPoseVector(pose, { x: c * sp * sr - s * cr, y: s * sp * sr + c * cr, z: cp * sr });
    const up = roadPoseVector(pose, { x: c * sp * cr + s * sr, y: s * sp * cr - c * sr, z: cp * cr });
    const point = roadPosePoint(pose, box);
    box.x = point.x; box.y = point.y; box.z = point.z;
    box.yaw = Math.atan2(forward.y, forward.x);
    box.tilt = Math.asin(Math.max(-1, Math.min(1, -forward.z)));
    box.pitch = Math.atan2(right.z, up.z);
    box.screenLift = pose.z;
  }
}
