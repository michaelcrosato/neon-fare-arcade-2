import { MAT_ADOBE, MAT_GENERIC, MAT_SANDSTONE, MAT_STONE, MAT_TIMBER, MAT_WATER, WHITE } from "./config";
import type { Box, CityChunk, Color, MeshFace, Vec2, Vec3 } from "./model";
import { copperBeam } from "./copper-assets";
import { terrainHeightAt } from "./terrain/surface";
import { COPPER_RIVER } from "./terrain/watercourses";
import { sampleSpecialRoad, specialRoadLength } from "./road-network";

const owns = (point: Vec2, cx: number, cy: number) => Math.floor((point.x + 72) / 144) === cx && Math.floor((point.y + 72) / 144) === cy;
const RUST: Color = [0.66, 0.29, 0.18, 1];
const TURQUOISE: Color = [0.08, 0.57, 0.59, 1];
export const COPPER_WINDMILLS = [{ x: -340, y: 2032 }, { x: -390, y: 1418 }] as const;

export function copperArchPose() {
  return sampleSpecialRoad("cinder-cone-loop", specialRoadLength("cinder-cone-loop") * 0.64)!;
}

export function copperRockArch(): { surfaces: MeshFace[]; colliders: NonNullable<CityChunk["colliders"]> } {
  const pose = copperArchPose(), center = pose.point, yaw = pose.heading + Math.PI / 2;
  const across = { x: Math.cos(yaw), y: Math.sin(yaw) }, along = { x: -across.y, y: across.x };
  const point = (width: number, z: number, side: number): Vec3 => ({ x: center.x + across.x * width + along.x * side * 4,
    y: center.y + across.y * width + along.y * side * 4, z: center.z + z });
  const surfaces: MeshFace[] = [], colliders: CityChunk["colliders"] = [];
  const face = (corners: MeshFace["corners"], color: Color) => surfaces.push({ corners, color, material: MAT_SANDSTONE, kind: "architecture" });
  for (let wedge = 0; wedge < 12; wedge += 1) {
    const a = wedge * Math.PI / 12, b = (wedge + 1) * Math.PI / 12;
    const ia = [9.5 * Math.cos(a), 4 + 12 * Math.sin(a)], ib = [9.5 * Math.cos(b), 4 + 12 * Math.sin(b)];
    const oa = [14 * Math.cos(a), 4 + 19 * Math.sin(a)], ob = [14 * Math.cos(b), 4 + 19 * Math.sin(b)];
    const color: Color = wedge % 3 === 0 ? [0.86, 0.57, 0.34, 1] : RUST;
    const front = [point(ia[0], ia[1], -1), point(ib[0], ib[1], -1), point(ob[0], ob[1], -1), point(oa[0], oa[1], -1)] as const;
    const back = [point(ia[0], ia[1], 1), point(ib[0], ib[1], 1), point(ob[0], ob[1], 1), point(oa[0], oa[1], 1)] as const;
    face(front, color); face([back[3], back[2], back[1], back[0]], color);
    face([front[0], back[0], back[1], front[1]], color);
    face([front[3], front[2], back[2], back[3]], color);
    const minX = Math.min(ia[0], ib[0], oa[0], ob[0]), maxX = Math.max(ia[0], ib[0], oa[0], ob[0]);
    const minZ = Math.min(ia[1], ib[1]), maxZ = Math.max(oa[1], ob[1]);
    const middle = point((minX + maxX) / 2, 0, 0);
    colliders.push({ id: `copper-arch:${wedge}`, x: middle.x, y: middle.y, yaw,
      halfX: (maxX - minX) / 2, halfY: 4, baseZ: center.z + minZ, height: maxZ - minZ });
  }
  for (const side of [-1, 1]) {
    const middle = point(side * 11.75, 0, 0), base = Math.min(center.z - 0.4, terrainHeightAt(middle.x, middle.y));
    const top = center.z + 4;
    const corners = [-1, 1].flatMap(depth => [point(side * 9.5, base - center.z, depth), point(side * 14, base - center.z, depth)]);
    const upper = corners.map(p => ({ ...p, z: top }));
    for (const [a, b] of [[0, 1], [1, 3], [3, 2], [2, 0]]) face([corners[a], corners[b], upper[b], upper[a]], RUST);
    colliders.push({ id: `copper-arch:foot:${side}`, x: middle.x, y: middle.y, yaw, halfX: 2.25, halfY: 4, baseZ: base, height: top - base });
  }
  return { surfaces, colliders };
}

export function addCopperScenery(chunk: Pick<CityChunk, "boxes" | "surfaces" | "colliders" | "surfaceRegions">, cx: number, cy: number) {
  for (let i = 1; i < COPPER_RIVER.length; i += 1) {
    const a = COPPER_RIVER[i - 1], b = COPPER_RIVER[i], center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
    if (!owns(center, cx, cy)) continue;
    const length = Math.hypot(b.x - a.x, b.y - a.y), nx = -(b.y - a.y) / length, ny = (b.x - a.x) / length, width = 6.8;
    chunk.surfaces?.push({ corners: [{ ...a, x: a.x - nx * width, y: a.y - ny * width }, { ...b, x: b.x - nx * width, y: b.y - ny * width },
      { ...b, x: b.x + nx * width, y: b.y + ny * width }, { ...a, x: a.x + nx * width, y: a.y + ny * width }],
      color: [0.09, 0.59, 0.58, 1], material: MAT_WATER, kind: "architecture" });
    const yaw = Math.atan2(b.y - a.y, b.x - a.x);
    chunk.surfaceRegions.push({ id: `copper-river:${i}`, kind: "water", ...center, halfX: length / 2, halfY: width, yaw });
    chunk.colliders.push({ id: `copper-river:${i}`, x: center.x, y: center.y, yaw, halfX: length / 2,
      halfY: width, baseZ: Math.min(a.z, b.z) - 3, height: Math.abs(a.z - b.z) + 4.1 });
  }
  const arch = copperArchPose();
  if (owns(arch.point, cx, cy)) {
    const structure = copperRockArch();
    chunk.surfaces?.push(...structure.surfaces);
    chunk.colliders.push(...structure.colliders);
  }
  for (const [index, mill] of COPPER_WINDMILLS.entries()) {
    if (!owns(mill, cx, cy)) continue;
    const base = terrainHeightAt(mill.x, mill.y), top = base + 11;
    for (const side of [-1, 1]) {
      const foot = { x: mill.x + side * 1.8, y: mill.y, z: base };
      chunk.boxes.push({ ...copperBeam(foot, { ...mill, z: top }, 0.3, [0.45, 0.39, 0.3, 1]), screenLift: base });
    }
    for (const h of [3, 6, 9]) chunk.boxes.push({ x: mill.x, y: mill.y, z: base + h, sx: 3.6 * (1 - h / 12), sy: 0.22,
      sz: 0.2, yaw: 0, color: RUST, material: MAT_TIMBER, screenLift: base });
    chunk.colliders.push({ id: `copper-windmill:${index}`, ...mill, halfX: 1.8, halfY: 0.4, height: 11, baseZ: base });
    chunk.boxes.push({ x: mill.x + 4, y: mill.y, z: base + 1, sx: 4, sy: 3, sz: 2, yaw: 0,
      color: TURQUOISE, material: MAT_ADOBE, screenLift: base });
    chunk.colliders.push({ id: `copper-water-tank:${index}`, x: mill.x + 4, y: mill.y, halfX: 2, halfY: 1.5, baseZ: base, height: 2 });
  }
}

/** Slow wind, moving blades, airborne color and small wildlife reward a detour. */
export function copperAnimatedBoxes(seconds: number, focus: Vec2): Box[] {
  const boxes: Box[] = [];
  if (focus.y < 730 || focus.y > 2450 || Math.abs(focus.x) > 850) return boxes;
  for (const mill of COPPER_WINDMILLS) {
    if (Math.hypot(focus.x - mill.x, focus.y - mill.y) > 400) continue;
    const z = terrainHeightAt(mill.x, mill.y) + 11;
    for (let blade = 0; blade < 10; blade += 1) {
      const angle = seconds * 0.58 + blade * Math.PI / 5;
      const tip = { x: mill.x + Math.cos(angle) * 2.9, y: mill.y - 0.45, z: z + Math.sin(angle) * 2.9 };
      boxes.push({ ...copperBeam({ ...mill, y: mill.y - 0.45, z }, tip, 0.45, [0.73, 0.76, 0.68, 1], MAT_GENERIC), screenLift: z - 3 });
    }
  }
  for (let i = 0; i < 3; i += 1) {
    const x = -110 + i * 195 + Math.sin(seconds * 0.018 + i) * 28, y = 1485 + i * 110 + Math.cos(seconds * 0.023 + i) * 19;
    if (Math.hypot(focus.x - x, focus.y - y) > 750) continue;
    const z = 145 + i * 20 + Math.sin(seconds * 0.12 + i) * 3;
    const colors: readonly Color[] = [RUST, TURQUOISE, [0.98, 0.68, 0.23, 1], WHITE];
    const levels = [[-7, 1.3], [-4, 3.8], [0, 5.5], [4, 4.8], [7, 2.5]];
    for (let side = 0; side < 8; side += 1) for (let ring = 1; ring < levels.length; ring += 1) {
      const angle = side * Math.PI / 4, [az, ar] = levels[ring - 1], [bz, br] = levels[ring];
      const a = { x: x + Math.cos(angle) * ar, y: y + Math.sin(angle) * ar, z: z + az };
      const b = { x: x + Math.cos(angle) * br, y: y + Math.sin(angle) * br, z: z + bz };
      const panel = copperBeam(a, b, (ar + br) * Math.sin(Math.PI / 8), colors[(side + i) % colors.length], MAT_GENERIC);
      boxes.push({ ...panel, sz: 0.22, screenLift: z - 10 });
    }
    boxes.push({ x, y, z: z - 10, sx: 1.8, sy: 1.5, sz: 1.3, yaw: 0, color: [0.52, 0.34, 0.19, 1], material: MAT_TIMBER, screenLift: z - 10.7 });
    boxes.push({ x, y, z: z + 7.03, sx: 4.6, sy: 4.6, sz: 0.15, yaw: Math.PI / 8, color: colors[i], material: MAT_GENERIC, screenLift: z - 10 });
    for (const side of [-1, 1]) boxes.push({ ...copperBeam({ x: x + side * 0.7, y, z: z - 9.5 }, { x: x + side * 1.1, y, z: z - 6.5 }, 0.08, RUST), screenLift: z - 10 });
  }
  const runway = { x: -480, y: 1622 }, base = terrainHeightAt(runway.x, runway.y);
  if (Math.hypot(focus.x - runway.x, focus.y - runway.y) < 400) {
    boxes.push({ ...runway, z: base + 5, sx: 0.16, sy: 0.16, sz: 10, yaw: 0, color: WHITE, material: MAT_STONE, screenLift: base });
    for (let i = 0; i < 5; i += 1) boxes.push({ x: runway.x + 0.35 + i * 0.55, y: runway.y + Math.sin(seconds * 2 + i * 0.5) * i * 0.09,
      z: base + 9.6 - i * 0.13, sx: 0.6, sy: 0.8 - i * 0.1, sz: 0.7 - i * 0.1,
      yaw: 0.05 * Math.sin(seconds * 2), color: i % 2 ? WHITE : RUST, material: MAT_GENERIC, screenLift: base + 9 });
  }
  for (const [index, spot] of [{ x: 285, y: 1082 }, { x: -568, y: 1699 }, { x: 548, y: 1157 }].entries()) {
    if (Math.hypot(focus.x - spot.x, focus.y - spot.y) > 220) continue;
    const phase = seconds * 0.5 + index * 2, x = spot.x + Math.sin(phase) * 4, y = spot.y;
    const z = terrainHeightAt(x, y), direction = Math.cos(phase) > 0 ? 1 : -1;
    boxes.push({ x, y, z: z + 0.48, sx: 0.8, sy: 0.3, sz: 0.42, yaw: 0, color: [0.39, 0.29, 0.22, 1], material: MAT_GENERIC, screenLift: z },
      { x: x + direction * 0.45, y, z: z + 0.84, sx: 0.28, sy: 0.24, sz: 0.33, yaw: 0, color: [0.27, 0.24, 0.21, 1], material: MAT_GENERIC, screenLift: z },
      { x: x + direction * 0.68, y, z: z + 0.81, sx: 0.28, sy: 0.13, sz: 0.12, yaw: 0, color: [0.87, 0.62, 0.31, 1], material: MAT_GENERIC, screenLift: z },
      { x: x - direction * 0.65, y, z: z + 0.5, sx: 0.85, sy: 0.2, sz: 0.18, yaw: 0, tilt: -direction * 0.25, color: [0.26, 0.24, 0.21, 1], material: MAT_GENERIC, screenLift: z });
  }
  return boxes;
}
