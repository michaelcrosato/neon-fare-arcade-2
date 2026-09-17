import { cameraDistanceScale, chaseCameraPreset } from "../config";
import { localPoint } from "../math";
import type { Camera, Game } from "../model";
import { isDriving, isInterior } from "../player";
import { CAB_EYE_HEIGHT, cabViewMatrix } from "./cab-camera";
import { chaseCameraEyeHeight, lookAt, mat4Multiply, MOBILE_CAB_ANCHOR_Z, orthoZO, perspectiveSkyView, perspectiveZO } from "./camera";

export function requestedChaseBoom(camera: Camera) {
  if (camera.mode !== "chase-high" && camera.mode !== "chase-low") return 0;
  return chaseCameraPreset(camera.mode, camera.onFoot).distance * cameraDistanceScale(camera.distanceScale);
}

export function cameraFraming(game: Game, camera: Camera, aspect = 1) {
  const scale = isInterior(game) ? 1 : cameraDistanceScale(camera.distanceScale);
  if (camera.mode === "fixed") {
    const halfHeight = 20 * scale / camera.zoom;
    let x = camera.x, y = camera.y, z = camera.heightOffset;
    if (camera.mobile && isDriving(game)) {
      const forwardX = Math.cos(camera.heading), forwardY = Math.sin(camera.heading);
      const basis = lookAt([25, 25, 29], [0, 0, 0]);
      const screenX = -(basis[0] * forwardX + basis[4] * forwardY) / aspect;
      const screenY = basis[1] * forwardX + basis[5] * forwardY;
      // Shift toward the cab's projected heading, including left/right travel.
      // The cab stays a quarter-screen from the trailing edge at every zoom.
      const lead = halfHeight * 0.5 / Math.max(Math.abs(screenX), Math.abs(screenY));
      x += forwardX * lead;
      y += forwardY * lead;
      z += MOBILE_CAB_ANCHOR_Z;
    }
    return {
      eye: [x + 25 * scale, y + 25 * scale, z + 29 * scale] as [number, number, number],
      target: [x, y, z] as [number, number, number],
      orthoHalfHeight: halfHeight,
    };
  }
  if (camera.mode === "cab") {
    const eye = localPoint(camera.x, camera.y, camera.heading, 0.02, -0.46);
    const target = localPoint(camera.x, camera.y, camera.heading, 26, -0.32);
    const eyeZ = (isDriving(game) ? CAB_EYE_HEIGHT : 1.52) + camera.heightOffset;
    const targetZ = (isDriving(game) ? 1.35 : 1.15) + camera.heightOffset;
    return {
      eye: [eye.x, eye.y, eyeZ] as [number, number, number],
      target: [target.x, target.y, targetZ] as [number, number, number],
      orthoHalfHeight: null as number | null,
    };
  }
  const preset = chaseCameraPreset(camera.mode, camera.onFoot);
  const forwardX = Math.cos(camera.heading);
  const forwardY = Math.sin(camera.heading);
  const height = chaseCameraEyeHeight(camera) + camera.heightOffset;
  return {
    eye: [camera.x - forwardX * camera.boom, camera.y - forwardY * camera.boom, height] as [number, number, number],
    target: [
      camera.x + forwardX * preset.lookAhead,
      camera.y + forwardY * preset.lookAhead,
      camera.mobile && isDriving(game)
        ? height - (camera.boom + preset.lookAhead) * Math.tan(perspectiveSkyView(camera)!.pitch)
        : preset.targetZ + camera.heightOffset,
    ] as [number, number, number],
    orthoHalfHeight: null as number | null,
  };
}

/**
 * `nearOverride` only exists so shadow cascades can slice the same camera
 * frustum. Every renderer still draws with the default near plane.
 */
export function viewProjection(
  game: Game,
  camera: Camera,
  aspect: number,
  drawDistance: number,
  nearOverride?: number,
) {
  const framing = cameraFraming(game, camera, aspect);
  let projection: Float32Array;
  let view: Float32Array;
  if (camera.mode === "fixed") {
    const halfHeight = framing.orthoHalfHeight!;
    const scale = isInterior(game) ? 1 : cameraDistanceScale(camera.distanceScale);
    projection = orthoZO(halfHeight * aspect, -halfHeight * aspect, -halfHeight, halfHeight,
      nearOverride ?? 0.1, nearOverride === undefined ? 140 * scale : Math.min(drawDistance, 140 * scale));
    view = lookAt(framing.eye, framing.target);
  } else if (camera.mode === "cab") {
    projection = perspectiveZO(perspectiveSkyView(camera)!.fovY, aspect, nearOverride ?? 0.08, drawDistance);
    view = cabViewMatrix(game, camera);
  } else {
    projection = perspectiveZO(perspectiveSkyView(camera)!.fovY, aspect, nearOverride ?? 0.15, drawDistance);
    view = lookAt(framing.eye, framing.target);
  }
  return mat4Multiply(projection, view);
}

/**
 * The near/far planes and screen-space extents a renderer actually projects
 * with. Screen-space effects have to reconstruct view positions from depth, and
 * duplicating these constants is how they drift out of sync with the matrices.
 */
export function cameraDepthRange(game: Game, camera: Camera, aspect: number, drawDistance: number) {
  if (camera.mode === "fixed") {
    const scale = isInterior(game) ? 1 : cameraDistanceScale(camera.distanceScale);
    const halfHeight = 20 * scale / camera.zoom;
    return {
      orthographic: true,
      near: 0.1,
      far: 140 * scale,
      halfWidth: halfHeight * aspect,
      halfHeight,
    };
  }
  const tanHalfHeight = Math.tan(perspectiveSkyView(camera)!.fovY / 2);
  return {
    orthographic: false,
    near: camera.mode === "cab" ? 0.08 : 0.15,
    far: drawDistance,
    halfWidth: tanHalfHeight * aspect,
    halfHeight: tanHalfHeight,
  };
}

export function projectWorldPoint(matrix: Float32Array, x: number, y: number, z: number, width: number, height: number) {
  const w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
  const depth = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14];
  if (w <= 0 || depth < 0 || depth > w) return null;
  return {
    x: ((matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) / w + 1) * width / 2,
    y: (1 - (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) / w) * height / 2,
  };
}
