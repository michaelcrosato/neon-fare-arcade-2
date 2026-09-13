import type { Camera, Game } from "../model";
import { cabViewMatrix } from "./cab-camera";
import { lookAt, perspectiveSkyView } from "./camera";
import { cameraFraming } from "./view-projection";

export const HORIZON_UNIFORM_FLOATS = 16;
export const HORIZON_UNIFORM_BYTES = HORIZON_UNIFORM_FLOATS * Float32Array.BYTES_PER_ELEMENT;

/** The panorama uses the same view basis as geometry, including cabin roll,
 * road pitch, walking and the collision-shortened mobile camera boom. */
export function horizonView(game: Game, camera: Camera, aspect: number, blend = 1) {
  const data = new Float32Array(HORIZON_UNIFORM_FLOATS);
  if (camera.mode === "fixed") { data[12] = 0; data[13] = blend; return data; }
  const framing = cameraFraming(game, camera, aspect);
  const view = camera.mode === "cab" ? cabViewMatrix(game, camera) : lookAt(framing.eye, framing.target);
  const tan = Math.tan(perspectiveSkyView(camera)!.fovY / 2);
  // The shared perspective projection mirrors X to respect the +y-south world.
  data.set([-view[0] * tan * aspect, -view[4] * tan * aspect, -view[8] * tan * aspect, 0], 0);
  data.set([view[1] * tan, view[5] * tan, view[9] * tan, 0], 4);
  data.set([-view[2], -view[6], -view[10], 0], 8);
  data.set([1, blend, 0, 0], 12);
  return data;
}

export function horizonTexturePoint(basis: Float32Array, x: number, y: number) {
  const dx = basis[8] + basis[0] * x + basis[4] * y;
  const dy = basis[9] + basis[1] * x + basis[5] * y;
  const dz = basis[10] + basis[2] * x + basis[6] * y;
  return { u: Math.atan2(dy, dx) / (2 * Math.PI) + .5, v: .5 - Math.atan2(dz, Math.hypot(dx, dy)) / Math.PI };
}
