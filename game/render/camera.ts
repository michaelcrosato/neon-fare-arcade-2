import { cameraDistanceScale, chaseCameraPreset } from "../config";
import type { Camera, CameraMode, Hud, WorldView } from "../model";
import { terrainHeightAt } from "../terrain/surface";

type PlayerMode = Hud["playerMode"];

export const MOBILE_CAB_SCREEN_Y = 0.75;
export const MOBILE_CAB_ANCHOR_Z = 1;

/** Interiors use their authored cutaway, while every exterior activity keeps
 * the player's selected perspective. */
export function effectiveCameraMode(playerMode: PlayerMode, selectedMode: CameraMode): CameraMode {
  return playerMode === "interior" ? "fixed" : selectedMode;
}

export function shouldRenderTaxi(playerMode: PlayerMode, cameraMode: CameraMode) {
  return playerMode !== "interior" && (playerMode !== "driving" || cameraMode !== "cab");
}

export function shouldRenderPlayerAvatar(playerMode: PlayerMode, cameraMode: CameraMode) {
  return playerMode !== "driving" && cameraMode !== "cab";
}

export function mat4Multiply(a: Float32Array, b: Float32Array) {
  const out = new Float32Array(16);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      out[column * 4 + row] =
        a[row] * b[column * 4] +
        a[4 + row] * b[column * 4 + 1] +
        a[8 + row] * b[column * 4 + 2] +
        a[12 + row] * b[column * 4 + 3];
    }
  }
  return out;
}

export function lookAt(
  eye: [number, number, number],
  center: [number, number, number],
  up: [number, number, number] = [0, 0, 1],
) {
  let zx = eye[0] - center[0];
  let zy = eye[1] - center[1];
  let zz = eye[2] - center[2];
  let length = Math.hypot(zx, zy, zz) || 1;
  zx /= length;
  zy /= length;
  zz /= length;
  let xx = up[1] * zz - up[2] * zy;
  let xy = up[2] * zx - up[0] * zz;
  let xz = up[0] * zy - up[1] * zx;
  length = Math.hypot(xx, xy, xz) || 1;
  xx /= length;
  xy /= length;
  xz /= length;
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;
  return new Float32Array([
    xx, yx, zx, 0,
    xy, yy, zy, 0,
    xz, yz, zz, 0,
    -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
    -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
    -(zx * eye[0] + zy * eye[1] + zz * eye[2]),
    1,
  ]);
}

export function orthoZO(
  left: number,
  right: number,
  bottom: number,
  top: number,
  near: number,
  far: number,
) {
  const out = new Float32Array(16);
  out[0] = 2 / (right - left);
  out[5] = 2 / (top - bottom);
  out[10] = 1 / (near - far);
  out[12] = -(right + left) / (right - left);
  out[13] = -(top + bottom) / (top - bottom);
  out[14] = near / (near - far);
  out[15] = 1;
  return out;
}

export function perspectiveZO(
  fovy: number,
  aspect: number,
  near: number,
  far: number,
) {
  const out = new Float32Array(16);
  const f = 1 / Math.tan(fovy / 2);
  out[0] = -f / aspect;
  out[5] = f;
  out[10] = far / (near - far);
  out[11] = -1;
  out[14] = (far * near) / (near - far);
  return out;
}

export type PerspectiveSkyView = {
  fovY: number;
  pitch: number;
};

/** Raise the mobile eye enough to keep the usual road horizon as the cab moves down.
 * The height stays linear along the boom so collision shortening remains valid. */
export function chaseCameraEyeHeight(camera: Camera, boom = camera.boom) {
  if (camera.mode !== "chase-high" && camera.mode !== "chase-low") return 0;
  const preset = chaseCameraPreset(camera.mode, camera.onFoot);
  if (!camera.mobile || camera.onFoot) return 1.65 + (preset.height - 1.65) * boom / preset.distance;
  const requested = preset.distance * cameraDistanceScale(camera.distanceScale);
  const originalHeight = 1.65 + (preset.height - 1.65) * requested / preset.distance;
  const originalPitch = Math.atan2(originalHeight - preset.targetZ, requested + preset.lookAhead);
  const boostMix = Math.max(0, Math.min(1, (1 - camera.zoom) / 0.12));
  const fovY = (preset.fov + boostMix * 9) * Math.PI / 180;
  const cabAngle = originalPitch + Math.atan((2 * MOBILE_CAB_SCREEN_Y - 1) * Math.tan(fovY / 2));
  const requestedHeight = MOBILE_CAB_ANCHOR_Z + requested * Math.tan(cabAngle);
  return 1.65 + (requestedHeight - 1.65) * boom / requested;
}

export function perspectiveSkyView(
  camera: Camera,
  nominalBoom = false,
): PerspectiveSkyView | null {
  if (camera.mode === "fixed") return null;
  const boostMix = Math.max(0, Math.min(1, (1 - camera.zoom) / 0.12));
  if (camera.mode === "cab") {
    return {
      fovY: (70 + boostMix * 11) * Math.PI / 180,
      pitch: Math.atan2(1.52 - 1.15, 26 - 0.25),
    };
  }
  const preset = chaseCameraPreset(camera.mode, camera.onFoot);
  const boom = nominalBoom ? preset.distance : camera.boom;
  const eyeHeight = chaseCameraEyeHeight(camera, boom);
  const fovY = (preset.fov + boostMix * 9) * Math.PI / 180;
  return {
    fovY,
    // Solve the cab's screen position from the actual shortened boom and FOV.
    // A fixed world-space look-ahead drifts back to center as the player zooms out.
    pitch: camera.mobile && !camera.onFoot
      ? Math.atan2(eyeHeight - MOBILE_CAB_ANCHOR_Z, boom)
        - Math.atan((2 * MOBILE_CAB_SCREEN_Y - 1) * Math.tan(fovY / 2))
      : Math.atan2(eyeHeight - preset.targetZ, boom + preset.lookAhead),
  };
}

export function cameraBoomLimit(
  camera: Camera,
  world: WorldView,
  distance: number,
  height: number,
) {
  const heightOffset = camera.heightOffset ?? 0;
  const forwardX = Math.cos(camera.heading);
  const forwardY = Math.sin(camera.heading);
  const start: [number, number, number] = [camera.x, camera.y, 1.65 + heightOffset];
  const end: [number, number, number] = [
    camera.x - forwardX * distance,
    camera.y - forwardY * distance,
    height + heightOffset,
  ];
  let nearest = 1;

  if (!world.key.startsWith("interior:")) {
    const samples = Math.ceil(distance / 0.5);
    for (let i = 1; i <= samples; i += 1) {
      const t = i / samples;
      const x = start[0] + (end[0] - start[0]) * t;
      const y = start[1] + (end[1] - start[1]) * t;
      if (terrainHeightAt(x, y) + 0.45 >= start[2] + (end[2] - start[2]) * t) {
        nearest = Math.max(0, (i - 1) / samples);
        break;
      }
    }
  }

  for (const collider of world.colliders) {
    const cosine = Math.cos(collider.yaw ?? 0), sine = Math.sin(collider.yaw ?? 0);
    const local = (point: [number, number, number]) => [
      cosine * (point[0] - collider.x) + sine * (point[1] - collider.y),
      -sine * (point[0] - collider.x) + cosine * (point[1] - collider.y), point[2],
    ];
    const localStart = local(start), localEnd = local(end);
    const mins = [-collider.halfX - 0.32, -collider.halfY - 0.32, collider.baseZ ?? 0];
    const maxs = [collider.halfX + 0.32, collider.halfY + 0.32, (collider.baseZ ?? 0) + collider.height + 0.35];
    let enter = 0;
    let exit = 1;
    let hit = true;
    for (let axis = 0; axis < 3; axis += 1) {
      const delta = localEnd[axis] - localStart[axis];
      if (Math.abs(delta) < 0.0001) {
        if (localStart[axis] < mins[axis] || localStart[axis] > maxs[axis]) hit = false;
        continue;
      }
      const first = (mins[axis] - localStart[axis]) / delta;
      const second = (maxs[axis] - localStart[axis]) / delta;
      enter = Math.max(enter, Math.min(first, second));
      exit = Math.min(exit, Math.max(first, second));
      if (enter > exit) hit = false;
    }
    if (hit && exit >= 0 && enter <= 1) {
      nearest = Math.min(nearest, Math.max(0, enter - 0.035));
    }
  }

  return Math.max(2.4, distance * nearest);
}
