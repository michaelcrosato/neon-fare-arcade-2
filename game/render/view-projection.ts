import { cameraDistanceScale, chaseCameraPreset } from "../config";
import { localPoint } from "../math";
import type { Camera, Game } from "../model";
import { isDriving, isInterior } from "../player";
import { CAB_EYE_HEIGHT, cabViewMatrix } from "./cab-camera";
import { lookAt, mat4Multiply, orthoZO, perspectiveSkyView, perspectiveZO } from "./camera";

export function requestedChaseBoom(camera: Camera) {
  if (camera.mode !== "chase-high" && camera.mode !== "chase-low") return 0;
  return chaseCameraPreset(camera.mode, camera.onFoot).distance * cameraDistanceScale(camera.distanceScale);
}

export function cameraFraming(game: Game, camera: Camera) {
  const scale = isInterior(game) ? 1 : cameraDistanceScale(camera.distanceScale);
  if (camera.mode === "fixed") {
    return {
      eye: [camera.x + 25 * scale, camera.y + 25 * scale, 29 * scale + camera.heightOffset] as [number, number, number],
      target: [camera.x, camera.y, camera.heightOffset] as [number, number, number],
      orthoHalfHeight: 20 * scale / camera.zoom,
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
  const height = 1.65 + (preset.height - 1.65) * camera.boom / preset.distance + camera.heightOffset;
  return {
    eye: [camera.x - forwardX * camera.boom, camera.y - forwardY * camera.boom, height] as [number, number, number],
    target: [
      camera.x + forwardX * preset.lookAhead,
      camera.y + forwardY * preset.lookAhead,
      preset.targetZ + camera.heightOffset,
    ] as [number, number, number],
    orthoHalfHeight: null as number | null,
  };
}

export function viewProjection(game: Game, camera: Camera, aspect: number, drawDistance: number) {
  const framing = cameraFraming(game, camera);
  let projection: Float32Array;
  let view: Float32Array;
  if (camera.mode === "fixed") {
    const halfHeight = framing.orthoHalfHeight!;
    const scale = isInterior(game) ? 1 : cameraDistanceScale(camera.distanceScale);
    projection = orthoZO(halfHeight * aspect, -halfHeight * aspect, -halfHeight, halfHeight, 0.1, 140 * scale);
    view = lookAt(framing.eye, framing.target);
  } else if (camera.mode === "cab") {
    projection = perspectiveZO(perspectiveSkyView(camera)!.fovY, aspect, 0.08, drawDistance);
    view = cabViewMatrix(game, camera);
  } else {
    projection = perspectiveZO(perspectiveSkyView(camera)!.fovY, aspect, 0.15, drawDistance);
    view = lookAt(framing.eye, framing.target);
  }
  return mat4Multiply(projection, view);
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
