import type { Box, LotContext, MeshFace } from "./model";
import { MAT_FOLIAGE } from "./config";
import { blockRandom } from "./random";
import { PALM_REACH_ANCHORS } from "./reach-destinations";
import { buildReachAnchor, buildReachBuilding } from "./reach-buildings";
import { wetlandLotForBlock, wetlandLotOrientation } from "./palm-reach";
import { specialRoadIntersectsSquare } from "./road-network";
import { boxSurfaceFaces } from "./render/surfaces";

let skyline: Map<string, MeshFace[]> | null = null;

/** Far silhouettes reuse the real buildings and disappear when their chunks load. */
export function reachDistantBuildings(loaded: ReadonlySet<string>) {
  if (!skyline) {
    skyline = new Map();
    const build = (bx: number, by: number, anchor?: typeof PALM_REACH_ANCHORS[number]) => {
      const x = bx * 36 + 18, y = by * 36 + 18, boxes: Box[] = [], surfaces: MeshFace[] = [];
      const ctx: LotContext = { boxes, surfaces, colliders: [], surfaceRegions: [], centerX: x, centerY: y,
        blockX: bx, blockY: by, random: blockRandom(bx, by, 0x1a90) };
      if (anchor) buildReachAnchor(ctx, anchor, bx - anchor.originX, by - anchor.originY);
      else buildReachBuilding(ctx, "reach-condo", Math.floor(blockRandom(bx, by, 0xa47dec0)() * 30));
      const angle = anchor ? 0 : wetlandLotOrientation(bx, by) * Math.PI / 2;
      const faces = boxes.filter(box => box.sz >= 2 && box.z + box.sz / 2 > 20 && box.sx * box.sy > 10)
        .flatMap(box => boxSurfaceFaces({ ...box, x: x + (box.x - x) * Math.cos(angle) - (box.y - y) * Math.sin(angle),
          y: y + (box.x - x) * Math.sin(angle) + (box.y - y) * Math.cos(angle), yaw: box.yaw + angle }));
      faces.push(...surfaces.filter(face => face.material !== MAT_FOLIAGE && face.corners.some(p => p.z > 20)));
      const key = `${Math.floor((bx + 2) / 4)},${Math.floor((by + 2) / 4)}`;
      skyline!.set(key, [...(skyline!.get(key) ?? []), ...faces]);
    };
    for (let bx = 44; bx <= 59; bx++) for (let by = 36; by <= 62; by++) {
      if (wetlandLotForBlock(bx, by) !== "reach-condo" || specialRoadIntersectsSquare({ x: bx * 36 + 18, y: by * 36 + 18 }, 12, 1.5)) continue;
      build(bx, by);
    }
    for (const anchor of PALM_REACH_ANCHORS.filter(a => ["bayou-belle", "gulfwatch-station", "blackwater-shipyard"].includes(a.id))) {
      for (let x = 0; x < anchor.width; x++) for (let y = 0; y < anchor.height; y++) build(anchor.originX + x, anchor.originY + y, anchor);
    }
  }
  return [...skyline].flatMap(([key, faces]) => loaded.has(key) ? [] : faces);
}
