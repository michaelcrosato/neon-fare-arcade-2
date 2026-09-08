import { MAT_ADOBE } from "../config";
import type { Vec3 } from "../model";
import { compiledSpecialRoad, type SpecialRoadSegment } from "../road-network";
import { copperBeam } from "../copper-assets";
import { inCopperTerrain } from "../terrain/copper-forms";
import { terrainHeightAt } from "../terrain/surface";
import { watercourseAt } from "../terrain/watercourses";
import type { StructuralGeometry } from "./mountain-structures";

/** Sandstone retaining walls and rust-red arch ribs make the canyon bridges legible. */
export function copperRoadStructures(segment: SpecialRoadSegment): StructuralGeometry {
  const output: StructuralGeometry = { boxes: [], surfaces: [], colliders: [] };
  const x = (segment.a.x + segment.b.x) / 2, y = (segment.a.y + segment.b.y) / 2;
  if (!inCopperTerrain(x, y)) return output;
  const road = compiledSpecialRoad(segment.pathId)!;
  const a = road.sections[segment.index], b = road.sections[segment.index + 1];
  const river = watercourseAt(x, y);
  for (const side of [-1, 1]) {
    const edge = (section: typeof a): Vec3 => ({ x: section.center.x + section.lateral.x * section.halfWidth * side,
      y: section.center.y + section.lateral.y * section.halfWidth * side, z: section.center.z + 0.6 });
    const first = edge(a), last = edge(b), ga = terrainHeightAt(first.x, first.y), gb = terrainHeightAt(last.x, last.y);
    if (first.z - ga > 0.5 || last.z - gb > 0.5) {
      const lowA = { ...first, z: Math.max(ga, first.z - 3.5) }, lowB = { ...last, z: Math.max(gb, last.z - 3.5) };
      output.surfaces.push({ corners: side === 1 ? [last, first, lowA, lowB] : [first, last, lowB, lowA],
        color: [0.64, 0.43, 0.29, 1], material: MAT_ADOBE, kind: "architecture" });
    }
    if (!river || river.distance > 36 || (first.z + last.z) / 2 - river.height < 22) continue;
    const rib = (section: typeof a): Vec3 => ({ ...edge(section), z: section.center.z - 5 - 12 * Math.sin((section.distance % 96) / 96 * Math.PI) });
    const p = rib(a), q = rib(b), beam = copperBeam(p, q, 0.9, [0.59, 0.24, 0.15, 1]);
    output.boxes.push({ ...beam, screenLift: Math.min(p.z, q.z) });
    output.colliders.push({ id: `canyon-rib:${segment.id}:${side}`, x: beam.x, y: beam.y, yaw: beam.yaw,
      halfX: Math.hypot(q.x - p.x, q.y - p.y) / 2, halfY: 0.45, baseZ: Math.min(p.z, q.z) - 0.45,
      height: Math.abs(q.z - p.z) + 0.9, roadDeck: { a: { ...p, z: p.z + 0.45 }, b: { ...q, z: q.z + 0.45 }, thickness: 0.9 } });
    if (Math.floor(a.distance / 16) !== Math.floor(b.distance / 16)) {
      output.boxes.push({ ...copperBeam(q, { ...last, z: last.z - 0.5 }, 0.35, [0.59, 0.24, 0.15, 1]), screenLift: q.z });
    }
  }
  return output;
}
