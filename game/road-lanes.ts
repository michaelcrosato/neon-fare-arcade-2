import type { WorldPoint } from "./model";
import { nearestRoadProjection, roadSurfaceIndex } from "./road-network";
import { ROAD_SURFACE_HEIGHT } from "./roads/contact";
import { groundAt } from "./vehicle-road-contact";

export type RoadLanePose = {
  x: number; y: number; z: number; pavementZ: number;
  heading: number; pitch: number; roll: number; roadId: string | null;
};

/** Right-hand traffic lane, sampled on the actual ribbon rather than offsetting a live taxi route. */
export function roadLanePose(point: WorldPoint, travelHeading: number): RoadLanePose {
  const projection = nearestRoadProjection(point, travelHeading);
  const heading = projection.tangentYaw + (Math.cos(projection.tangentYaw - travelHeading) < 0 ? Math.PI : 0);
  const offset = Math.min(2.25, projection.halfWidth * .45);
  const x = projection.point.x - Math.sin(heading) * offset;
  const y = projection.point.y + Math.cos(heading) * offset;
  const samples = roadSurfaceIndex.query({ x, y, z: projection.point.z ?? 0 }, .05, heading)
    .filter(sample => sample.surfaceDistance <= .025 && Math.abs(sample.point.z - (projection.point.z ?? 0)) < 4);
  const sample = samples.find(sample => sample.roadId === projection.roadId || sample.roadId.startsWith(`${projection.roadId}:`)) ?? samples[0];
  const contact = sample ? { height: sample.point.z + ROAD_SURFACE_HEIGHT, normal: sample.normal, roadId: sample.roadId }
    : groundAt({ x, y, z: projection.point.z ?? 0 }, .85, null, heading);
  const { normal } = contact, c = Math.cos(heading), s = Math.sin(heading);
  return { x, y, z: contact.height, pavementZ: sample ? contact.height : ROAD_SURFACE_HEIGHT,
    heading, roadId: contact.roadId,
    pitch: Math.atan2(normal.x * c + normal.y * s, normal.z),
    roll: Math.atan2(normal.x * s - normal.y * c, normal.z) };
}
