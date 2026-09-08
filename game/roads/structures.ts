import { BONE, INK, MAT_ADOBE, MAT_BUILDING, MAT_ROAD, MAT_SIGN, STEEL, YELLOW } from "../config";
import type { Box, Collider, SurfaceQuad, Vec3 } from "../model";
import { compiledSpecialRoad, isRoadSurface, roadSurfaceIndex, type SpecialRoadSegment } from "../road-network";
import { roadDistance, sampleRoad } from "./geometry";
import { ROAD_SURFACE_HEIGHT } from "./contact";
import { inElevatedTerrain, naturalWorldHeight } from "../terrain/region-forms";
import { terrainHeightAt } from "../terrain/surface";
import { watercourseAt } from "../terrain/watercourses";
import { inCopperTerrain } from "../terrain/copper-forms";

type RoadStructure = { boxes: Box[]; colliders: Collider[]; surfaces: SurfaceQuad[] };
const cache = new Map<string, RoadStructure>();
const empty: RoadStructure = { boxes: [], colliders: [], surfaces: [] };
const DECK_THICKNESS = 0.7;

/** Visual structure and collision are compiled together from the swept deck. */
export function roadStructure(segment: SpecialRoadSegment): RoadStructure {
  if (Math.max(segment.a.z ?? 0, segment.b.z ?? 0) < 1) return empty;
  const midpointX = (segment.a.x + segment.b.x) / 2, midpointY = (segment.a.y + segment.b.y) / 2;
  const river = watercourseAt(midpointX, midpointY);
  const ground = Math.min(naturalWorldHeight(midpointX, midpointY), river && river.distance < 12 ? river.height - 2.5 : Infinity);
  const mountainRoad = inElevatedTerrain(midpointX, midpointY);
  const copper = inCopperTerrain(midpointX, midpointY);
  if (mountainRoad && (Math.min(segment.a.z ?? 0, segment.b.z ?? 0) - ground) < 2.5) return empty;
  const cached = cache.get(segment.id);
  if (cached) return cached;
  const geometry = compiledSpecialRoad(segment.pathId)!;
  const a = geometry.sections[segment.index], b = geometry.sections[segment.index + 1];
  const output: RoadStructure = { boxes: [], colliders: [], surfaces: [] };
  const edge = (section: typeof a, side: number, offset = 0): Vec3 => ({
    x: section.center.x + section.lateral.x * (section.halfWidth + offset) * side,
    y: section.center.y + section.lateral.y * (section.halfWidth + offset) * side,
    z: section.center.z + section.lateral.z * (section.halfWidth + offset) * side + ROAD_SURFACE_HEIGHT,
  });
  const leftA = edge(a, -1), leftB = edge(b, -1), rightA = edge(a, 1), rightB = edge(b, 1);
  const bottom = (point: Vec3): Vec3 => ({ ...point, z: point.z - DECK_THICKNESS });
  output.surfaces.push(
    { corners: [leftA, leftB, bottom(leftB), bottom(leftA)], color: STEEL, material: MAT_ROAD },
    { corners: [rightB, rightA, bottom(rightA), bottom(rightB)], color: STEEL, material: MAT_ROAD },
    { corners: [bottom(rightA), bottom(rightB), bottom(leftB), bottom(leftA)], color: INK, material: MAT_ROAD },
  );
  const yaw = Math.atan2(b.center.y - a.center.y, b.center.x - a.center.x);
  const planarLength = Math.hypot(b.center.x - a.center.x, b.center.y - a.center.y);
  output.colliders.push({
    id: `road-deck:${segment.id}`, x: (a.center.x + b.center.x) / 2, y: (a.center.y + b.center.y) / 2,
    yaw, halfX: planarLength / 2 + 0.02, halfY: Math.max(a.halfWidth, b.halfWidth),
    baseZ: Math.min(a.center.z, b.center.z) + ROAD_SURFACE_HEIGHT - DECK_THICKNESS,
    height: Math.abs(b.center.z - a.center.z) + DECK_THICKNESS,
    roadDeck: { a: { ...a.center, z: a.center.z + ROAD_SURFACE_HEIGHT }, b: { ...b.center, z: b.center.z + ROAD_SURFACE_HEIGHT }, thickness: DECK_THICKNESS },
  });
  if (Math.min(a.center.z, b.center.z) > 1.4) for (const side of [-1, 1]) {
    const first = edge(a, side, 0.35), last = edge(b, side, 0.35);
    const middle = { x: (first.x + last.x) / 2, y: (first.y + last.y) / 2, z: (first.z + last.z) / 2 };
    const mergeOpening = roadSurfaceIndex.query(middle, mountainRoad ? 4 : 1.5).some((projection) => (
      projection.roadId !== segment.pathId && projection.surfaceDistance < (mountainRoad ? 4 : 1.5)
      && Math.abs(projection.point.z + ROAD_SURFACE_HEIGHT - middle.z) < (mountainRoad ? 3 : 0.9)
    ));
    if (mergeOpening) continue;
    const length = roadDistance(first, last);
    const railYaw = Math.atan2(last.y - first.y, last.x - first.x);
    const tilt = -Math.atan2(last.z - first.z, Math.hypot(last.x - first.x, last.y - first.y));
    output.boxes.push({ ...middle, z: middle.z + 0.48, sx: length + 0.08, sy: 0.38, sz: 0.96,
      yaw: railYaw, tilt, color: copper ? [0.8, 0.61, 0.41, 1] : BONE, material: copper ? MAT_ADOBE : MAT_BUILDING, screenLift: middle.z });
    output.boxes.push({ ...middle, z: middle.z + 1, sx: length + 0.08, sy: 0.42, sz: 0.1,
      yaw: railYaw, tilt, color: copper ? [0.58, 0.3, 0.2, 1] : YELLOW, material: MAT_SIGN, screenLift: middle.z });
    output.colliders.push({ id: `road-rail:${segment.id}:${side}`, x: middle.x, y: middle.y,
      yaw: railYaw, halfX: Math.hypot(last.x - first.x, last.y - first.y) / 2 + 0.04, halfY: 0.19,
      baseZ: Math.min(first.z, last.z), height: Math.abs(last.z - first.z) + 0.96 });
  }
  const pierDistance = Math.ceil((a.distance + 0.01) / 48) * 48;
  if (pierDistance <= b.distance) for (const side of [-1, 1]) {
    const sample = sampleRoad(geometry, pierDistance, side * (Math.min(a.halfWidth, b.halfWidth) - 1));
    const point = sample.point;
    const base = terrainHeightAt(point.x, point.y);
    const height = point.z + ROAD_SURFACE_HEIGHT - DECK_THICKNESS - base;
    if (height < 2 || isRoadSurface({ x: point.x, y: point.y, z: base }, 2)) continue;
    output.boxes.push({ ...point, z: base + height / 2, ...(base ? { screenLift: base } : {}), sx: 1.25, sy: 1.25, sz: height,
      yaw: 0, color: copper ? [0.56, 0.39, 0.29, 1] : STEEL, material: copper ? MAT_ADOBE : MAT_BUILDING });
    output.colliders.push({ id: `road-pier:${segment.pathId}:${pierDistance}:${side}`,
      x: point.x, y: point.y, halfX: 0.625, halfY: 0.625, height, ...(base ? { baseZ: base } : {}) });
  }
  cache.set(segment.id, output);
  return output;
}
