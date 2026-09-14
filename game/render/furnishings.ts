import { BONE, CYAN, INK, LEAF, MAT_BUILDING, MAT_SIGN, PAPER, RED, STEEL, YELLOW } from "../config";
import type { Box, Collider, Color } from "../model";
import { FURNISHINGS, type FurnishingId } from "../furnishing-catalog";

/** Shared miniatures: the catalog and the furnished apartment show these same objects. */
export function furnishingModel(id: FurnishingId): Box[] {
  const boxes: Box[] = [];
  const box = (x: number, y: number, z: number, sx: number, sy: number, sz: number, color: Color, glow = false) => {
    boxes.push({ x, y, z, sx, sy, sz, yaw: 0, color, material: glow ? MAT_SIGN : MAT_BUILDING });
  };
  switch (id) {
    case "big-screen":
      box(0, 0, .65, 1.1, 4.5, .18, INK); box(0, 0, 1.6, .2, .4, 1.8, INK);
      box(0, 0, 2.5, .28, 4.4, 2.5, INK); box(.16, 0, 2.5, .05, 4, 2.1, CYAN, true); break;
    case "stereo":
      for (const y of [-.95, .95]) { box(0, y, 1.1, .8, .7, 1.5, INK); box(.42, y, 1.1, .06, .48, .68, YELLOW); }
      box(0, 0, .8, .9, 1, .5, STEEL); box(.47, 0, .85, .05, .65, .13, CYAN, true); break;
    case "washer":
      box(0, 0, 1.6, 2.1, 2.1, 2.4, PAPER); box(0, -1.07, 1.45, 1.45, .08, 1.45, STEEL);
      box(0, -1.13, 1.45, 1.05, .08, 1.05, INK); box(0, -1.19, 1.45, .72, .06, .72, CYAN);
      box(.3, -1.1, 2.52, 1.1, .1, .16, INK); break;
    case "microwave":
      box(0, 0, 2.55, 1.8, 1.1, .95, PAPER); box(-.2, -.57, 2.55, 1.15, .1, .65, INK);
      box(-.2, -.64, 2.55, .95, .05, .45, CYAN); box(.62, -.57, 2.6, .15, .1, .42, INK); break;
    case "fridge":
      box(0, 0, 2.45, 2.3, 2.3, 4.1, STEEL); box(0, -1.2, 1.9, 2.2, .15, 2.8, PAPER);
      box(0, -1.2, 3.95, 2.2, .15, 1.2, PAPER); box(-.8, -1.32, 2.5, .13, .12, .95, INK);
      box(-.8, -1.32, 3.8, .13, .12, .55, INK); break;
    case "coffee-maker":
      box(0, 0, 2.55, .65, .8, 1.1, INK); box(0, -.05, 3.15, .8, .95, .18, RED);
      box(0, -.42, 2.36, .48, .4, .45, PAPER); box(0, -.45, 2.64, .4, .25, .08, INK); break;
    case "vacuum":
      box(0, 0, .6, 1.1, 1.1, .35, INK); box(0, .2, 1.3, .65, .7, 1.15, RED);
      box(0, .4, 2.3, .13, .15, 1.5, STEEL); box(0, .4, 3.05, .6, .2, .18, INK); break;
    case "pantry":
    case "bookcase": {
      const width = id === "pantry" ? 3 : 3.5;
      for (const x of [-width / 2, width / 2]) box(x, 0, 2.2, .2, 1, 3.6, BONE);
      for (const z of [.65, 1.7, 2.8, 3.9]) box(0, 0, z, width, 1, .14, BONE);
      for (const [x, z, color] of [[-.7, 1.15, RED], [.5, 2.25, CYAN], [-.4, 3.35, YELLOW]] as const) box(x, 0, z, .6, .7, .85, color);
      break;
    }
    case "floor-lamp":
      box(0, 0, .5, .85, .85, .13, INK); box(0, 0, 2, .13, .13, 3, STEEL);
      box(0, 0, 3.5, 1.4, 1.4, .7, YELLOW); box(0, 0, 3.9, 1, 1, .15, PAPER); break;
    case "rug":
      box(0, 0, .5, 8, 5.3, .03, INK);
      for (const side of [-1, 1]) box(side * 2, side * 1.3, .52, 3.8, 2.45, .02, YELLOW);
      break;
    case "plant":
      box(0, 0, .85, 1.3, 1.3, .8, RED); box(0, 0, 1.28, 1.5, 1.5, .16, BONE);
      box(0, 0, 2, .12, .12, 1.5, INK); box(-.35, 0, 2.35, 1, .8, .55, LEAF); box(.35, 0, 2.75, .8, 1, .65, LEAF); break;
    case "dining-set":
      box(0, 0, 1.8, 3.6, 2.7, .22, BONE); box(0, 0, 1.05, 1.2, 1, 1.5, INK);
      for (const side of [-1, 1]) { box(side * 2.3, 0, 1.05, 1, 1.2, .18, RED); box(side * 2.75, 0, 1.5, .15, 1.2, 1.1, RED); box(side * 2.3, 0, .7, .65, .75, .6, INK); }
      break;
    case "sofa":
      box(0, 0, .85, 5.6, 2.2, .8, INK); box(0, -.8, 1.55, 5.8, .5, 1.35, RED);
      for (const side of [-1, 1]) { box(side * 2.75, 0, 1.3, .55, 2.3, 1, RED); box(side * 1.25, .05, 1.35, 2.2, 1.45, .4, BONE); }
      break;
    case "bed-frame":
      box(0, 0, .65, 5.75, 7.6, .3, INK); box(0, -3.7, 1.7, 5.75, .35, 2.3, BONE);
      for (const x of [-2.4, 2.4]) box(x, 2.8, .5, .3, .3, .4, INK); break;
    case "side-table":
      box(0, 0, 1.3, 1.45, 1.45, .18, BONE); box(0, 0, .85, .65, .65, .9, INK);
      box(0, 0, 1.48, .5, .5, .16, CYAN); break;
  }
  // Appliances face into the room from its back wall; the catalog shares this view.
  if (["washer", "microwave", "fridge", "coffee-maker"].includes(id)) for (const part of boxes) part.y = -part.y;
  return boxes;
}

export function addHomeFurnishings(boxes: Box[], colliders: Collider[], placed: readonly FurnishingId[]) {
  for (const item of FURNISHINGS) {
    if (!placed.includes(item.id)) continue;
    const model = furnishingModel(item.id);
    boxes.push(...model.map(box => ({ ...box, x: box.x + item.x, y: box.y + item.y })));
    if (["rug", "bed-frame", "coffee-maker", "microwave"].includes(item.id)) continue;
    const minX = Math.min(...model.map(box => box.x - box.sx / 2)), maxX = Math.max(...model.map(box => box.x + box.sx / 2));
    const minY = Math.min(...model.map(box => box.y - box.sy / 2)), maxY = Math.max(...model.map(box => box.y + box.sy / 2));
    colliders.push({ id: `furnishing:${item.id}`, x: item.x + (minX + maxX) / 2, y: item.y + (minY + maxY) / 2,
      halfX: (maxX - minX) / 2, halfY: (maxY - minY) / 2, height: Math.max(...model.map(box => box.z + box.sz / 2)) });
  }
}
