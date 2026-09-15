import { MAT_VEHICLE } from "../config";
import type { MeshFace, Vec3 } from "../model";
import balanced from "./accord-balanced.json";

export type VehicleWheel = { pivot: Vec3; steers: boolean; faces: MeshFace[] };
export type VehicleSurfaceModel = { body: MeshFace[]; wheels: VehicleWheel[] };

/** The owner's Model B, with its original vertices, colors, winding and wheel pivots. */
export function accordBalancedModel(): VehicleSurfaceModel {
  const body: MeshFace[] = [], wheels = new Map<string, VehicleWheel>();
  for (const part of balanced.parts) {
    const [x, y, z] = part.position;
    const wheel = part.role === "wheel" || part.role === "steer-wheel";
    const faces: MeshFace[] = part.faces.map(indices => {
      const corners = indices.map(index => {
        const v = part.vertices[index];
        return { x: v[0] + (wheel ? 0 : x), y: v[1] + (wheel ? 0 : y), z: v[2] + (wheel ? 0 : z) };
      });
      if (corners.length !== 3 && corners.length !== 4) throw new Error("Accord face must be a triangle or quad");
      return { corners: corners.length === 3 ? [corners[0], corners[1], corners[2]] : [corners[0], corners[1], corners[2], corners[3]],
        color: [part.color[0], part.color[1], part.color[2], part.color[3]], material: MAT_VEHICLE, kind: "architecture" };
    });
    if (!wheel) body.push(...faces);
    else {
      const key = part.position.join(",");
      if (!wheels.has(key)) wheels.set(key, { pivot: { x, y, z }, steers: part.role === "steer-wheel", faces: [] });
      wheels.get(key)!.faces.push(...faces);
    }
  }
  return { body, wheels: [...wheels.values()] };
}
