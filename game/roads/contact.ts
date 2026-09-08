import type { WorldPoint } from "../model";
import type { RoadSpatialIndex } from "./spatial-index";

/** Authored centerlines describe the deck base; the asphalt top is 0.64 above it. */
export const ROAD_SURFACE_HEIGHT = 0.64;
export type GroundContact = {
  height: number;
  roadId: string | null;
  normal: { x: number; y: number; z: number };
};

/**
 * Highest supporting surface reachable from this height. A bridge above the
 * actor is never a candidate. During a fall, pass the previous height so a fast
 * descent catches a crossed deck instead of tunnelling through it.
 */
export function groundContact(index: RoadSpatialIndex, point: WorldPoint, stepHeight = 0, preferredRoadId?: string | null, terrain?: GroundContact): GroundContact {
  const ceiling = (point.z ?? 0) + stepHeight + 1e-5;
  let contact: GroundContact = terrain ?? { height: 0, roadId: null, normal: { x: 0, y: 0, z: 1 } };
  let preferred: GroundContact | null = null;
  for (const sample of index.query(point, 0.05)) {
    const height = sample.point.z + ROAD_SURFACE_HEIGHT;
    if (sample.surfaceDistance > 0.025 || height > ceiling) continue;
    if (sample.roadId === preferredRoadId && (!preferred || height > preferred.height)) {
      preferred = { height, roadId: sample.roadId, normal: sample.normal };
    }
    if (height < contact.height || (Math.abs(height - contact.height) < 1e-6 && contact.roadId !== null)) continue;
    contact = { height, roadId: sample.roadId, normal: sample.normal };
  }
  return preferred && contact.height - preferred.height > 0.04 ? preferred : contact;
}
