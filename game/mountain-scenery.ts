import { BONE, CYAN, INK, MAT_GENERIC, MAT_STONE, MAT_TIMBER, MAT_WATER, MAT_WINDOW, RED, WHITE } from "./config";
import type { Box, CityChunk, Color, Vec2, Vec3 } from "./model";
import { gabledRoof } from "./architecture";
import { structuralBeam } from "./roads/mountain-structures";
import { terrainHeightAt } from "./terrain/surface";
import { MIRROR_SPILLWAY } from "./terrain/watercourses";

export const NORTHSTAR_GONDOLA = {
  lower: { x: -18, y: -2232, z: 140 },
  upper: { x: -396, y: -2196, z: 233 },
  cabinCount: 8,
  cycleSeconds: 90,
} as const;

const mix = (a: Vec3, b: Vec3, t: number): Vec3 => ({ x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
const owns = (point: Vec2, cx: number, cy: number) => Math.floor((point.x + 72) / 144) === cx && Math.floor((point.y + 72) / 144) === cy;
let cableSupports: Vec3[] | null = null;

export function gondolaSupports() {
  cableSupports ??= Array.from({ length: 5 }, (_, i) => {
    const point = mix(NORTHSTAR_GONDOLA.lower, NORTHSTAR_GONDOLA.upper, i / 4);
    return i === 0 || i === 4 ? point : { ...point, z: Math.max(point.z, terrainHeightAt(point.x, point.y) + 29) };
  });
  return cableSupports;
}

export function gondolaCablePoint(progress: number, side = 1): Vec3 {
  const t = Math.max(0, Math.min(1, progress));
  const supports = gondolaSupports(), index = Math.min(3, Math.floor(t * 4));
  const point = mix(supports[index], supports[index + 1], t * 4 - index);
  // Five supports divide the cable into four shallow catenary-like spans.
  const span = (t * 4) % 1;
  return { x: point.x + 0.095 * side * 2.6, y: point.y + 0.995 * side * 2.6,
    z: point.z - 2.8 * Math.sin(span * Math.PI) };
}

export function gondolaStationEave(tower: 0 | 4) {
  const end = tower === 0 ? 0 : 1;
  // The incoming cable may already be climbing within the station footprint.
  const outside = end + (tower === 0 ? 12 : -12) / 378;
  return Math.max(gondolaCablePoint(end).z, gondolaCablePoint(outside).z) + 1.4;
}

export function addMountainScenery(chunk: Pick<CityChunk, "boxes" | "surfaces" | "colliders" | "surfaceRegions">, cx: number, cy: number) {
  for (let segment = 1; segment < MIRROR_SPILLWAY.length; segment += 1) {
    const start = MIRROR_SPILLWAY[segment - 1], end = MIRROR_SPILLWAY[segment];
    const length = Math.hypot(end.x - start.x, end.y - start.y), steps = Math.ceil(length / 12);
    const nx = -(end.y - start.y) / length, ny = (end.x - start.x) / length;
    const width = segment < 3 ? 5.5 : 4.2;
    for (let i = 0; i < steps; i += 1) {
      const a = mix(start, end, i / steps), b = mix(start, end, (i + 1) / steps), center = mix(a, b, 0.5);
      if (!owns(center, cx, cy)) continue;
      const leftA = { ...a, x: a.x - nx * width, y: a.y - ny * width }, leftB = { ...b, x: b.x - nx * width, y: b.y - ny * width };
      const rightA = { ...a, x: a.x + nx * width, y: a.y + ny * width }, rightB = { ...b, x: b.x + nx * width, y: b.y + ny * width };
      chunk.surfaces?.push({ corners: [leftA, leftB, rightB, rightA], color: [0.12, 0.57, 0.62, 1], material: MAT_WATER, kind: "architecture" });
      const yaw = Math.atan2(end.y - start.y, end.x - start.x), halfX = length / steps / 2;
      chunk.surfaceRegions.push({ id: `spillway:${segment}:${i}`, kind: "water", ...center, halfX, halfY: width, yaw });
      chunk.colliders.push({ id: `spillway:${segment}:${i}`, x: center.x, y: center.y, yaw,
        halfX, halfY: width, baseZ: Math.min(a.z, b.z) - 3, height: Math.abs(a.z - b.z) + 4.1 });
    }
  }
  for (let tower = 0; tower <= 4; tower += 1) {
    const point = gondolaSupports()[tower];
    if (!owns(point, cx, cy)) continue;
    const base = terrainHeightAt(point.x, point.y), height = point.z - base;
    for (const side of [-1, 1]) {
      const foot = { x: point.x + side, y: point.y, z: base };
      chunk.boxes.push(structuralBeam(foot, { ...point, x: point.x + side * 0.35 }, 0.65, [0.4, 0.46, 0.42, 1]));
      chunk.boxes.push({ ...foot, z: base + 0.5, sx: 2.4, sy: 2.4, sz: 1, yaw: 0, color: BONE, material: MAT_STONE, screenLift: base });
      chunk.colliders.push({ id: `gondola-pylon:${tower}:${side}`, x: foot.x, y: foot.y, halfX: 0.6, halfY: 0.45, height, baseZ: base });
    }
    chunk.boxes.push(structuralBeam({ ...point, y: point.y - 4.6 }, { ...point, y: point.y + 4.6 }, 0.5, INK));
    if (tower === 0 || tower === 4) {
      const eave = gondolaStationEave(tower), wallHeight = eave - base;
      chunk.boxes.push({ ...point, z: base - 0.06, sx: 18, sy: 16, sz: 0.2, yaw: 0, color: BONE, material: MAT_STONE, screenLift: base });
      for (const side of [-1, 1]) {
        chunk.boxes.push({ ...point, y: point.y + side * 7, z: base + wallHeight / 2,
          sx: 18, sy: 0.8, sz: wallHeight, yaw: 0, color: [0.42, 0.24, 0.13, 1], material: MAT_TIMBER, screenLift: base });
        chunk.colliders.push({ id: `gondola-station:${tower}:wall:${side}`, x: point.x, y: point.y + side * 7,
          halfX: 9, halfY: 0.4, height: wallHeight, baseZ: base });
      }
      chunk.colliders.push({ id: `gondola-station:${tower}:ceiling`, x: point.x, y: point.y,
        halfX: 11, halfY: 10, height: 1, baseZ: eave });
      for (const face of gabledRoof(point.x, point.y, eave, 20, 22, 5.5, RED, BONE)) {
        const vertices = face.corners.map(p => ({ x: point.x - (p.y - point.y), y: point.y + (p.x - point.x), z: p.z }));
        face.corners = vertices.length === 3 ? [vertices[0], vertices[1], vertices[2]]
          : [vertices[0], vertices[1], vertices[2], vertices[3]];
        chunk.surfaces?.push(face);
      }
    }
  }
  for (let i = 0; i < 64; i += 1) for (const side of [-1, 1]) {
    const a = gondolaCablePoint(i / 64, side), b = gondolaCablePoint((i + 1) / 64, side);
    if (owns(mix(a, b, 0.5), cx, cy)) chunk.boxes.push(structuralBeam(a, b, 0.13, INK));
  }
}

/** Shared dynamic actors for both renderers; no animation lives in world generation. */
export function mountainAnimatedBoxes(seconds: number, focus: Vec2): Box[] {
  const boxes: Box[] = [];
  const colors: readonly Color[] = [RED, [0.96, 0.57, 0.12, 1], CYAN];
  if (Math.abs(focus.x + 200) < 530 && Math.abs(focus.y + 2214) < 450) {
    for (let i = 0; i < NORTHSTAR_GONDOLA.cabinCount; i += 1) {
      const cycle = (seconds / NORTHSTAR_GONDOLA.cycleSeconds + i / NORTHSTAR_GONDOLA.cabinCount) % 1;
      const progress = cycle < 0.5 ? cycle * 2 : (1 - cycle) * 2, side = cycle < 0.5 ? 1 : -1;
      const point = gondolaCablePoint(progress, side), yaw = Math.atan2(36, -378);
      const screenLift = point.z - 5;
      boxes.push({ ...point, z: point.z - 0.9, sx: 0.2, sy: 0.2, sz: 1.8, yaw, color: INK, material: MAT_GENERIC, screenLift });
      boxes.push({ ...point, z: point.z - 3.15, sx: 3.5, sy: 2.8, sz: 2.7, yaw, color: colors[i % colors.length], material: MAT_GENERIC, screenLift });
      boxes.push({ ...point, z: point.z - 2.8, sx: 3.56, sy: 2.86, sz: 1.15, yaw, color: [0.12, 0.43, 0.5, 1], material: MAT_WINDOW, screenLift });
      boxes.push({ ...point, z: point.z - 1.7, sx: 3.8, sy: 3.1, sz: 0.28, yaw, color: BONE, material: MAT_GENERIC, screenLift });
    }
  }
  if (Math.hypot(focus.x - 275, focus.y + 1912) < 330) for (let i = 0; i < 16; i += 1) {
    const t = (seconds * 0.42 + i / 16) % 1;
    const point = mix(MIRROR_SPILLWAY[2], MIRROR_SPILLWAY[3], t);
    boxes.push({ x: point.x, y: point.y + Math.sin(i * 7.3) * 2.9, z: point.z + 0.5,
      sx: 1.4, sy: 0.3, sz: 0.2, yaw: 0.15, color: WHITE, material: MAT_GENERIC, screenLift: point.z });
  }
  return boxes;
}
