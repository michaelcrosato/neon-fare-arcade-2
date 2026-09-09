import { MAT_BUILDING, MAT_GENERIC, MAT_SIGN, MAT_TIMBER, MAT_WATER, MAT_WINDOW, WHITE } from "./config";
import type { Box, CityChunk, Color, Vec2 } from "./model";
import { coastBeam } from "./coast-assets";
import { COAST_CANALS, COAST_PIER, COAST_WHEEL, coastShoreXAt } from "./coastal-layout";
import { coastRoadHeight } from "./terrain/coast-forms";
import { terrainHeightAt } from "./terrain/surface";
import { roadSurfaceIndex } from "./road-network";
import { ROAD_SURFACE_HEIGHT } from "./roads/contact";

const owns = (x: number, y: number, cx: number, cy: number) => Math.floor((x + 72) / 144) === cx && Math.floor((y + 72) / 144) === cy;
const CREAM: Color = [0.98, 0.93, 0.78, 1];
const CORAL: Color = [0.96, 0.36, 0.29, 1];
const MINT: Color = [0.34, 0.78, 0.7, 1];
type SceneryChunk = Pick<CityChunk, "boxes" | "surfaces" | "colliders" | "surfaceRegions">;

/** Canal water, banks, and bridge undersides all have matching solid intervals. */
export function addCoastScenery(chunk: SceneryChunk, cx: number, cy: number) {
  for (const [index, canal] of COAST_CANALS.entries()) {
    const { x, halfWidth, height } = canal;
    for (let y = canal.minY + 9; y < canal.maxY; y += 18) {
      if (!owns(x, y, cx, cy)) continue;
      const id = `coast-canal:${index}:${y}`;
      chunk.surfaces?.push({ corners: [{ x: x - halfWidth, y: y - 9, z: height }, { x: x + halfWidth, y: y - 9, z: height },
        { x: x + halfWidth, y: y + 9, z: height }, { x: x - halfWidth, y: y + 9, z: height }],
      color: [0.15, 0.61, 0.64, 1], material: MAT_WATER, kind: "architecture" });
      chunk.surfaceRegions.push({ id, kind: "water", x, y, halfX: halfWidth, halfY: 9, yaw: 0 });
      chunk.colliders.push({ id, x, y, halfX: halfWidth, halfY: 9, baseZ: -2, height: 2.6 });
      for (const side of [-1, 1]) {
        // Bank tops meet the physical terrain. Break walls at every road crossing.
        const bankX = x + side * 8.5;
        for (const dy of [-6, 0, 6]) {
          const py = y + dy, top = terrainHeightAt(bankX, py);
          if (roadSurfaceIndex.query({ x: bankX, y: py }, 3).some(road => road.surfaceDistance < 2)) continue;
          chunk.boxes.push({ x: bankX, y: py, z: (top - 1.4) / 2, sx: 0.45, sy: 6.05, sz: top + 1.4,
            yaw: 0, color: CREAM, material: MAT_BUILDING, screenLift: -1.4 });
          chunk.colliders.push({ id: `${id}:bank:${side}:${dy}`, x: bankX, y: py, halfX: 0.225, halfY: 3,
            baseZ: -1.4, height: top + 1.4 });
          chunk.boxes.push({ x: bankX + side * 1.1, y: py, z: top + 0.04, sx: 1.8, sy: 6, sz: 0.08,
            yaw: 0, color: [0.84, 0.69, 0.5, 1], material: MAT_TIMBER, screenLift: top });
        }
      }
    }
    for (const y of [360, 432, 504]) {
      if (!owns(x, y, cx, cy)) continue;
      const z = coastRoadHeight(x, y) + ROAD_SURFACE_HEIGHT, span = 19;
      chunk.boxes.push({ x, y, z: z - 0.34, sx: span, sy: 12, sz: 0.6, yaw: 0, color: CREAM, material: MAT_BUILDING, screenLift: z - 0.64 });
      chunk.colliders.push({ id: `coast-bridge:${index}:${y}`, x, y, halfX: span / 2, halfY: 6, baseZ: z - 0.6, height: 0.6,
        roadDeck: { a: { x: x - span / 2, y, z }, b: { x: x + span / 2, y, z }, thickness: 0.6 } });
      for (const side of [-1, 1]) {
        const py = y + side * 6.65;
        // A crossing curve needs the same clear merge opening as the main roads.
        if (roadSurfaceIndex.query({ x, y: py, z }, 2).some(road => !road.roadId.startsWith("street-") && road.surfaceDistance < 2)) continue;
        chunk.boxes.push({ x, y: py, z: z + 0.8, sx: span, sy: 0.2, sz: 0.2, yaw: 0, color: MINT, material: MAT_SIGN, screenLift: z });
        for (const dx of [-8, -4, 0, 4, 8]) chunk.boxes.push({ x: x + dx, y: py, z: z + 0.4,
          sx: 0.2, sy: 0.2, sz: 0.8, yaw: 0, color: CREAM, material: MAT_BUILDING, screenLift: z });
        chunk.colliders.push({ id: `coast-bridge-rail:${index}:${y}:${side}`, x, y: py, halfX: span / 2, halfY: 0.15, baseZ: z, height: 1 });
      }
    }
  }
  if (owns(COAST_WHEEL.x, COAST_WHEEL.y, cx, cy)) {
    const wheel = COAST_WHEEL;
    // Twin A-frames stand outside the uninterrupted central walking lane.
    for (const side of [-1, 1]) for (const dx of [-5, 5]) {
      const foot = { x: wheel.x + dx, y: wheel.y + side * 7, z: COAST_PIER.deckHeight };
      for (let section = 0; section < 6; section += 1) {
        const h = (wheel.z - foot.z) / 6, t = (section + 0.5) / 6;
        chunk.colliders.push({ id: `coast-wheel-foot:${side}:${dx}:${section}`, x: foot.x, y: foot.y + (wheel.y - foot.y) * t,
          halfX: 0.35, halfY: 7 / 12 + 0.35, baseZ: foot.z + section * h, height: h });
      }
    }
  }
}

// Keep the complete landmark visible at the same distance as its moving cabins,
// including views from bluffs beyond the pier's loaded collision chunk.
function makeWheelFrame(): Box[] {
  const wheel = COAST_WHEEL, boxes: Box[] = [];
  for (const side of [-1, 1]) for (const dx of [-5, 5]) {
    const foot = { x: wheel.x + dx, y: wheel.y + side * 7, z: COAST_PIER.deckHeight };
    boxes.push({ ...coastBeam(foot, { ...wheel, x: wheel.x + dx }, 0.7, CREAM, MAT_BUILDING), screenLift: COAST_PIER.deckHeight });
  }
  boxes.push(coastBeam({ ...wheel, x: wheel.x - 6 }, { ...wheel, x: wheel.x + 6 }, 1.1, CORAL, MAT_SIGN));
  for (let segment = 0; segment < 32; segment += 1) for (const side of [-1, 1]) {
    const a = segment * Math.PI / 16, b = (segment + 1) * Math.PI / 16;
    boxes.push(coastBeam({ x: wheel.x + side * 2.3, y: wheel.y + Math.cos(a) * wheel.radius, z: wheel.z + Math.sin(a) * wheel.radius },
      { x: wheel.x + side * 2.3, y: wheel.y + Math.cos(b) * wheel.radius, z: wheel.z + Math.sin(b) * wheel.radius }, 0.3, side > 0 ? CORAL : MINT, MAT_SIGN));
  }
  return boxes;
}
const wheelFrame = makeWheelFrame();

/** Deterministic animation; it never changes drivable or walkable geometry. */
export function coastAnimatedBoxes(seconds: number, focus: Vec2): Box[] {
  const boxes: Box[] = [];
  if (focus.x > -750 || focus.x < -2460 || Math.abs(focus.y) > 850) return boxes;
  const wheel = COAST_WHEEL;
  if (Math.hypot(focus.x - wheel.x, focus.y - wheel.y) < 850) {
    boxes.push(...wheelFrame);
    for (let cabin = 0; cabin < 12; cabin += 1) {
      const angle = seconds * 0.07 + cabin * Math.PI / 6;
      const y = wheel.y + Math.cos(angle) * wheel.radius, z = wheel.z + Math.sin(angle) * wheel.radius;
      const color = cabin % 3 === 0 ? CORAL : cabin % 3 === 1 ? MINT : [0.98, 0.73, 0.24, 1] as Color;
      for (const side of [-1, 1]) boxes.push(coastBeam({ ...wheel, x: wheel.x + side * 2.3 }, { x: wheel.x + side * 2.3, y, z }, 0.16, CREAM, MAT_GENERIC));
      boxes.push({ x: wheel.x, y, z: z - 1.6, sx: 3.6, sy: 2.5, sz: 1.4, yaw: 0, color, material: MAT_GENERIC },
        { x: wheel.x, y, z: z + 0.1, sx: 3.9, sy: 2.8, sz: 0.2, yaw: 0, color: CREAM, material: MAT_GENERIC });
      for (const dx of [-1.6, 1.6]) boxes.push({ x: wheel.x + dx, y, z: z - 0.65, sx: 0.15, sy: 2.3, sz: 1.4, yaw: 0,
        color: [0.35, 0.72, 0.78, 1], material: MAT_WINDOW });
    }
  }
  for (let row = -780; row <= 780; row += 24) {
    if (Math.hypot(focus.x - coastShoreXAt(row), focus.y - row) > 420) continue;
    if (Math.abs(row - COAST_PIER.y) < 28) continue;
    for (let band = 0; band < 3; band += 1) {
      const travel = ((seconds * 1.4 + band * 12 + row * 0.03) % 36 + 36) % 36;
      const x = coastShoreXAt(row) - 5 - 36 + travel;
      const yaw = Math.atan2(24, coastShoreXAt(row + 12) - coastShoreXAt(row - 12));
      boxes.push({ x, y: row, z: 0.28 + Math.sin(travel / 36 * Math.PI) * 0.1, sx: 22, sy: 0.3 + travel / 48, sz: 0.07, yaw,
        color: [0.75 + travel / 180, 0.92, 0.86, 1], material: MAT_WATER });
    }
  }
  for (let boat = 0; boat < 3; boat += 1) {
    const x = -2320 + Math.sin(seconds * 0.02 + boat) * 18, y = -460 + boat * 420 + Math.cos(seconds * 0.016 + boat) * 32;
    if (Math.hypot(focus.x - x, focus.y - y) > 700) continue;
    const z = 0.65 + Math.sin(seconds + boat) * 0.1;
    boxes.push({ x, y, z, sx: 3.3, sy: 10, sz: 0.9, yaw: 0, color: CREAM, material: MAT_GENERIC },
      { x, y, z: z + 5, sx: 0.15, sy: 0.15, sz: 10, yaw: 0, color: CREAM, material: MAT_GENERIC });
    // A tapered sail built from narrow strips stays within the shared box protocol.
    for (let panel = 0; panel < 9; panel += 1) boxes.push({ x, y: y + (9 - panel) * 0.25, z: z + 1.5 + panel,
      sx: 0.12, sy: (9 - panel) * 0.5, sz: 1.02, yaw: 0, color: boat % 2 ? CORAL : WHITE, material: MAT_GENERIC });
  }
  for (let bird = 0; bird < 7; bird += 1) {
    const angle = seconds * 0.13 + bird * 0.9;
    const x = -2180 + Math.sin(angle) * (36 + bird * 6), y = -180 + bird * 77 + Math.cos(angle) * 24;
    if (Math.hypot(focus.x - x, focus.y - y) > 400) continue;
    const z = 11 + bird * 1.5 + Math.sin(seconds * 0.7 + bird);
    for (const side of [-1, 1]) boxes.push(coastBeam({ x, y, z }, { x: x + side * 1.2, y: y - 0.2,
      z: z + Math.sin(seconds * 3 + bird) * 0.45 }, 0.13, CREAM, MAT_GENERIC));
  }
  return boxes;
}
