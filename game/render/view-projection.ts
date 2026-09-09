import { chaseCameraPreset } from "../config";
import type { Camera, Game } from "../model";
import { cabViewMatrix } from "./cab-camera";
import { lookAt, mat4Multiply, orthoZO, perspectiveSkyView, perspectiveZO } from "./camera";

export function viewProjection(game: Game, camera: Camera, aspect: number, drawDistance: number) {
  const forwardX = Math.cos(camera.heading), forwardY = Math.sin(camera.heading);
  let projection: Float32Array;
  let view: Float32Array;
  if (camera.mode === "fixed") {
    const halfHeight = 20 / camera.zoom;
    projection = orthoZO(halfHeight * aspect, -halfHeight * aspect, -halfHeight, halfHeight, 0.1, 140);
    view = lookAt([camera.x + 25, camera.y + 25, 29 + camera.heightOffset], [camera.x, camera.y, camera.heightOffset]);
  } else if (camera.mode === "cab") {
    projection = perspectiveZO(perspectiveSkyView(camera)!.fovY, aspect, 0.08, drawDistance);
    view = cabViewMatrix(game, camera);
  } else {
    const preset = chaseCameraPreset(camera.mode, camera.onFoot);
    const height = 1.65 + (preset.height - 1.65) * camera.boom / preset.distance + camera.heightOffset;
    projection = perspectiveZO(perspectiveSkyView(camera)!.fovY, aspect, 0.15, drawDistance);
    view = lookAt(
      [camera.x - forwardX * camera.boom, camera.y - forwardY * camera.boom, height],
      [camera.x + forwardX * preset.lookAhead, camera.y + forwardY * preset.lookAhead, preset.targetZ + camera.heightOffset],
    );
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
