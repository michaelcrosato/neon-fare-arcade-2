import { INK, BONE, MAT_GENERIC, MAT_STONE, MAT_TIMBER, STEEL } from "../config";
import type { Box, Collider, MeshFace, Vec3 } from "../model";
import { compiledSpecialRoad, type SpecialRoadSegment } from "../road-network";
import { inNorthstarTerrain } from "../terrain/northstar-forms";
import { terrainHeightAt } from "../terrain/surface";
import { roadStripQuad } from "../render/surfaces";

export type StructuralGeometry = { boxes: Box[]; surfaces: MeshFace[]; colliders: Collider[] };

export function structuralBeam(a: Vec3, b: Vec3, width: number, color = STEEL): Box {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2,
    sx: Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z), sy: width, sz: width,
    yaw: Math.atan2(b.y - a.y, b.x - a.x), tilt: -Math.atan2(b.z - a.z, Math.hypot(b.x - a.x, b.y - a.y)),
    color, material: MAT_GENERIC, screenLift: Math.min(a.z, b.z) };
}

/** Retaining faces, an open-sided avalanche gallery, and the gorge's steel ribs. */
export function mountainRoadStructures(segment: SpecialRoadSegment): StructuralGeometry {
  const output: StructuralGeometry = { boxes: [], surfaces: [], colliders: [] };
  const x = (segment.a.x + segment.b.x) / 2, y = (segment.a.y + segment.b.y) / 2;
  if (!inNorthstarTerrain(x, y)) return output;
  const road = compiledSpecialRoad(segment.pathId)!;
  const a = road.sections[segment.index], b = road.sections[segment.index + 1];
  const edge = (section: typeof a, side: number, extra = 0): Vec3 => ({
    x: section.center.x + section.lateral.x * (section.halfWidth + extra) * side,
    y: section.center.y + section.lateral.y * (section.halfWidth + extra) * side,
    z: section.center.z + 0.6,
  });
  for (const side of [-1, 1]) {
    const first = edge(a, side), last = edge(b, side);
    const groundA = terrainHeightAt(first.x, first.y), groundB = terrainHeightAt(last.x, last.y);
    if (first.z - groundA > 0.7 || last.z - groundB > 0.7) {
      const bottomA = { ...first, z: Math.max(groundA, first.z - 4) }, bottomB = { ...last, z: Math.max(groundB, last.z - 4) };
      output.surfaces.push({ corners: side === 1 ? [last, first, bottomA, bottomB] : [first, last, bottomB, bottomA],
        color: [0.34, 0.38, 0.36, 1], material: MAT_STONE, kind: "architecture" });
    }
    if (segment.pathId === "spruce-gorge-viaduct" && x > -300 && x < -30) {
      const rib = (section: typeof a) => {
        const point = edge(section, side, -0.45);
        point.z -= 4 + Math.sin((section.distance % 72) / 72 * Math.PI) * 10;
        return point;
      };
      output.boxes.push(structuralBeam(rib(a), rib(b), 1.1, [0.14, 0.3, 0.31, 1]));
    }
  }
  if (segment.pathId !== "northstar-highway" || y > -1152 || y < -1248) return output;
  const left = -Math.max(a.halfWidth, b.halfWidth) - 2.2, right = -left;
  output.surfaces.push(roadStripQuad(a, b, left, right, 9.5, BONE, MAT_STONE));
  const underside = roadStripQuad(a, b, left, right, 8.9, [0.3, 0.23, 0.14, 1], MAT_TIMBER);
  output.surfaces.push({ ...underside, corners: [...underside.corners].reverse() as unknown as MeshFace["corners"] });
  const yaw = Math.atan2(b.center.y - a.center.y, b.center.x - a.center.x);
  output.colliders.push({ id: `gallery-roof:${segment.id}`, x, y, yaw,
    halfX: Math.hypot(b.center.x - a.center.x, b.center.y - a.center.y) / 2 + 0.03, halfY: right,
    baseZ: Math.min(a.center.z, b.center.z) + 8.9, height: Math.abs(a.center.z - b.center.z) + 0.6,
    roadDeck: { a: { ...a.center, z: a.center.z + 9.5 }, b: { ...b.center, z: b.center.z + 9.5 }, thickness: 0.6 } });
  if (Math.floor(a.distance / 12) !== Math.floor(b.distance / 12)) {
    for (const side of [-1, 1]) {
      const point = edge(b, side, 1.25);
      output.boxes.push({ ...point, z: point.z + 4.1, sx: 0.8, sy: 0.8, sz: 8.2, yaw,
        color: BONE, material: MAT_STONE, screenLift: point.z });
      output.colliders.push({ id: `gallery-pillar:${segment.id}:${side}`, x: point.x, y: point.y,
        halfX: 0.4, halfY: 0.4, yaw, height: 8.2, baseZ: point.z });
    }
    output.boxes.push(structuralBeam({ ...edge(b, -1, 1.5), z: b.center.z + 8.8 },
      { ...edge(b, 1, 1.5), z: b.center.z + 8.8 }, 0.4, INK));
  }
  return output;
}
