import type { Box, Color, LotContext, MaterialId, MeshFace, Vec2, Vec3 } from "./model";
import { MAT_ADOBE, MAT_CACTUS, MAT_FOLIAGE, MAT_GENERIC, MAT_SANDSTONE, MAT_TIMBER, MAT_WINDOW } from "./config";

const GREEN: Color = [0.24, 0.43, 0.24, 1];
const LIME: Color = [0.47, 0.56, 0.29, 1];
const BLOOM: Color = [0.92, 0.22, 0.36, 1];

/** Pure geometry: regional lot builders cannot depend on the road/terrain graph. */
export function copperBeam(a: Vec3, b: Vec3, width: number, color: Color, material: MaterialId = MAT_TIMBER): Box {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2,
    sx: Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z), sy: width, sz: width,
    yaw: Math.atan2(b.y - a.y, b.x - a.x), tilt: -Math.atan2(b.z - a.z, Math.hypot(b.x - a.x, b.y - a.y)), color, material };
}

function ringFaces(rings: readonly (readonly Vec3[])[], color: Color, material: MaterialId, groundAnchor?: Vec2): MeshFace[] {
  const faces: MeshFace[] = [], count = rings[0].length;
  for (let ring = 1; ring < rings.length; ring += 1) for (let side = 0; side < count; side += 1) {
    const next = (side + 1) % count;
    faces.push({ corners: [rings[ring - 1][side], rings[ring - 1][next], rings[ring][next], rings[ring][side]],
      color, material, kind: "architecture", ...(groundAnchor ? { groundAnchor } : {}) });
  }
  const cap = rings[rings.length - 1];
  for (let side = 1; side < count - 1; side += 1) faces.push({ corners: [cap[0], cap[side], cap[side + 1]], color, material,
    kind: "architecture", ...(groundAnchor ? { groundAnchor } : {}) });
  return faces;
}

export function desertColumn(x: number, y: number, z: number, radius: number, height: number, color: Color,
  sides = 7, material: MaterialId = MAT_CACTUS, groundAnchor?: Vec2): MeshFace[] {
  const ring = (base: number, scale: number) => Array.from({ length: sides }, (_, i) => ({
    x: x + Math.cos(i / sides * Math.PI * 2) * radius * scale,
    y: y + Math.sin(i / sides * Math.PI * 2) * radius * scale, z: base }));
  return ringFaces([ring(z, 0.9), ring(z + height, 0.76)], color, material, groundAnchor);
}

export function desertSaguaro(ctx: LotContext, x: number, y: number, scale = 1, solid = false) {
  const anchor = { x, y }, height = 5.8 * scale, radius = 0.42 * scale;
  ctx.surfaces?.push(...desertColumn(x, y, 0, radius, height, GREEN, 7, MAT_CACTUS, anchor));
  const angle = ctx.random() * Math.PI * 2;
  for (const side of [-1, 1]) {
    if (side === 1 && ctx.random() < 0.32) continue;
    const ax = x + Math.cos(angle) * side * 1.35 * scale, ay = y + Math.sin(angle) * side * 1.35 * scale;
    const shoulder = height * (side > 0 ? 0.55 : 0.4);
    const elbow = copperBeam({ x, y, z: shoulder }, { x: ax, y: ay, z: shoulder + 0.25 * scale }, 0.5 * scale, GREEN, MAT_CACTUS);
    ctx.boxes.push({ ...elbow, groundAnchor: anchor });
    ctx.surfaces?.push(...desertColumn(ax, ay, shoulder, 0.29 * scale, height * 0.31, GREEN, 6, MAT_CACTUS, anchor));
  }
  if (solid) ctx.colliders.push({ id: `saguaro:${ctx.blockX}:${ctx.blockY}:${x}:${y}`, x, y,
    halfX: radius, halfY: radius, height, groundAnchor: anchor });
}

export function desertAgave(ctx: LotContext, x: number, y: number, color: Color = [0.36, 0.58, 0.54, 1]) {
  for (let leaf = 0; leaf < 7; leaf += 1) {
    const angle = leaf * Math.PI * 2 / 7, nx = Math.cos(angle), ny = Math.sin(angle);
    const a = { x: x - ny * 0.18, y: y + nx * 0.18, z: 0.18 }, b = { x: x + ny * 0.18, y: y - nx * 0.18, z: 0.18 };
    const tip = { x: x + nx * 1.15, y: y + ny * 1.15, z: 0.75 + leaf % 3 * 0.22 };
    ctx.surfaces?.push({ corners: [a, b, tip], color, material: MAT_CACTUS, kind: "architecture", groundAnchor: { x, y } },
      { corners: [tip, b, a], color, material: MAT_CACTUS, kind: "architecture", groundAnchor: { x, y } });
  }
}

export function desertOcotillo(ctx: LotContext, x: number, y: number, scale = 1) {
  for (let stalk = 0; stalk < 5; stalk += 1) {
    const angle = stalk * 1.256 + x, height = (2.7 + stalk % 3 * 0.55) * scale;
    const tip = { x: x + Math.cos(angle) * scale * 0.95, y: y + Math.sin(angle) * scale * 0.95, z: height };
    ctx.boxes.push({ ...copperBeam({ x, y, z: 0 }, tip, 0.095 * scale, GREEN, MAT_CACTUS), groundAnchor: { x, y } });
    ctx.boxes.push({ ...tip, sx: 0.19, sy: 0.19, sz: 0.4, yaw: angle, color: BLOOM, material: MAT_GENERIC, groundAnchor: { x, y } });
  }
}

export function desertBarrel(ctx: LotContext, x: number, y: number, scale = 1) {
  ctx.surfaces?.push(...desertColumn(x, y, 0, 0.68 * scale, 1.55 * scale, LIME, 8, MAT_CACTUS, { x, y }));
  for (let i = 0; i < 5; i += 1) ctx.boxes.push({ x: x + Math.cos(i * 1.26) * 0.3 * scale,
    y: y + Math.sin(i * 1.26) * 0.3 * scale, z: 1.52 * scale, sx: 0.18, sy: 0.18, sz: 0.18,
    yaw: i, color: [1, 0.65, 0.22, 1], material: MAT_GENERIC, groundAnchor: { x, y } });
}

export function desertPaloVerde(ctx: LotContext, x: number, y: number, scale = 1) {
  const anchor = { x, y };
  ctx.boxes.push({ ...copperBeam({ x, y, z: 0 }, { x: x + 0.3, y, z: 3.4 * scale }, 0.32 * scale, LIME), groundAnchor: anchor });
  for (let branch = 0; branch < 5; branch += 1) {
    const angle = branch * 1.26, tip = { x: x + Math.cos(angle) * 2.3 * scale, y: y + Math.sin(angle) * 2.3 * scale, z: (3.4 + branch % 2 * 0.6) * scale };
    ctx.boxes.push({ ...copperBeam({ x, y, z: 2 * scale }, tip, 0.18 * scale, LIME), groundAnchor: anchor });
    ctx.boxes.push({ ...tip, sx: 3.1 * scale, sy: 1.6 * scale, sz: 0.6 * scale, yaw: angle,
      color: branch % 2 ? [0.67, 0.68, 0.28, 1] : LIME, material: MAT_FOLIAGE, groundAnchor: anchor });
  }
}

export function stratifiedRock(ctx: LotContext, x: number, y: number, radius: number, height: number) {
  const sides = 7, rings = [0, 0.28, 0.58, 0.86, 1].map((t, index) => Array.from({ length: sides }, (_, side) => {
    const angle = side * Math.PI * 2 / sides;
    const width = radius * (1 - t * 0.5) * (1 + 0.09 * Math.sin(side * 8 + index));
    return { x: x + Math.cos(angle) * width + t * 0.3, y: y + Math.sin(angle) * width * 0.76, z: t * height };
  }));
  const faces = ringFaces(rings, [0.74, 0.4, 0.27, 1], MAT_SANDSTONE, { x, y });
  for (let i = 0; i < faces.length; i += 1) faces[i].color = Math.floor(i / sides) % 2 ? [0.86, 0.58, 0.38, 1] : [0.7, 0.33, 0.24, 1];
  ctx.surfaces?.push(...faces);
  ctx.colliders.push({ id: `copper-rock:${ctx.blockX}:${ctx.blockY}:${x}:${y}`, x, y,
    halfX: radius * 0.9, halfY: radius * 0.7, height, groundAnchor: { x, y } });
}

/** Chamfered plaster walls, inset windows, timber vigas and a proper parapet. */
export function adobeBuilding(ctx: LotContext, id: string, x: number, y: number, sx: number, sy: number, height: number,
  wall: Color = [0.88, 0.7, 0.49, 1], accent: Color = [0.06, 0.55, 0.56, 1]) {
  const hx = sx / 2, hy = sy / 2, c = 0.55;
  const plan = [[-hx + c, -hy], [hx - c, -hy], [hx, -hy + c], [hx, hy - c], [hx - c, hy], [-hx + c, hy], [-hx, hy - c], [-hx, -hy + c]];
  const rings = [0.15, height + 0.3].map(z => plan.map(([dx, dy]) => ({ x: x + dx, y: y + dy, z })));
  ctx.surfaces?.push(...ringFaces(rings, wall, MAT_ADOBE));
  const terra: Color = [wall[0] * 0.77, wall[1] * 0.72, wall[2] * 0.66, 1];
  for (const side of [-1, 1]) {
    ctx.boxes.push({ x, y: y + side * (hy - 0.15), z: height + 0.58, sx: sx - 0.35, sy: 0.5, sz: 0.55, yaw: 0, color: wall, material: MAT_ADOBE });
    ctx.boxes.push({ x: x + side * (hx - 0.15), y, z: height + 0.58, sx: 0.5, sy: sy - 0.35, sz: 0.55, yaw: 0, color: wall, material: MAT_ADOBE });
  }
  const windows = Math.max(1, Math.floor(sx / 5));
  for (let i = 0; i < windows; i += 1) {
    const wx = x + (i - (windows - 1) / 2) * 4.6;
    ctx.boxes.push({ x: wx, y: y - hy - 0.035, z: height * 0.52, sx: 2.3, sy: 0.15, sz: 1.65, yaw: 0, color: terra, material: MAT_ADOBE });
    ctx.boxes.push({ x: wx, y: y - hy - 0.12, z: height * 0.52, sx: 1.8, sy: 0.12, sz: 1.2, yaw: 0, color: accent, material: MAT_WINDOW });
    ctx.boxes.push({ x: wx, y: y - hy - 0.3, z: height * 0.52 - 0.88, sx: 2.5, sy: 0.7, sz: 0.18, yaw: 0, color: terra, material: MAT_ADOBE });
  }
  for (let dx = -hx + 1; dx < hx; dx += 2.5) ctx.boxes.push({ x: x + dx, y: y - hy - 0.25, z: height - 0.3,
    sx: 0.22, sy: 1.05, sz: 0.22, yaw: 0, color: [0.31, 0.2, 0.14, 1], material: MAT_TIMBER });
  ctx.colliders.push({ id: `${id}:${ctx.blockX}:${ctx.blockY}`, x, y, halfX: hx, halfY: hy, height: height + 0.7 });
}

/** Open plaster arches shade a pedestrian passage; posts and canopy are solid. */
export function adobeArcade(ctx: LotContext, x: number, y: number, width: number, bays: number) {
  const bay = width / bays, color: Color = [0.9, 0.69, 0.44, 1];
  for (let i = 0; i <= bays; i += 1) {
    const px = x - width / 2 + i * bay;
    ctx.boxes.push({ x: px, y, z: 2.5, sx: 0.55, sy: 0.8, sz: 5, yaw: 0, color, material: MAT_ADOBE });
    ctx.colliders.push({ id: `adobe-arcade:${ctx.blockX}:${ctx.blockY}:${i}`, x: px, y, halfX: 0.275, halfY: 0.4, height: 5 });
  }
  for (let i = 0; i < bays; i += 1) {
    const cx = x - width / 2 + (i + 0.5) * bay, radius = (bay - 0.55) / 2;
    for (let arc = 0; arc < 8; arc += 1) {
      const a = Math.PI - arc * Math.PI / 8, b = Math.PI - (arc + 1) * Math.PI / 8;
      const left = { x: cx + Math.cos(a) * radius, y: y - 0.4, z: 2.1 + Math.sin(a) * 2.4 };
      const right = { x: cx + Math.cos(b) * radius, y: y - 0.4, z: 2.1 + Math.sin(b) * 2.4 };
      const front = [left, right, { ...right, z: 5 }, { ...left, z: 5 }] as const;
      ctx.surfaces?.push({ corners: front, color, material: MAT_ADOBE, kind: "architecture" },
        { corners: [{ ...front[3], y: y + 0.4 }, { ...front[2], y: y + 0.4 }, { ...front[1], y: y + 0.4 }, { ...front[0], y: y + 0.4 }], color, material: MAT_ADOBE, kind: "architecture" },
        { corners: [right, left, { ...left, y: y + 0.4 }, { ...right, y: y + 0.4 }], color, material: MAT_ADOBE, kind: "architecture" });
    }
  }
  for (let dx = -width / 2; dx <= width / 2; dx += 1.5) ctx.boxes.push({ x: x + dx, y: y - 1.4, z: 5.1,
    sx: 0.28, sy: 3.8, sz: 0.25, yaw: 0, color: [0.41, 0.26, 0.15, 1], material: MAT_TIMBER });
  ctx.colliders.push({ id: `adobe-arcade-roof:${ctx.blockX}:${ctx.blockY}`, x, y: y - 1.4,
    halfX: width / 2, halfY: 1.9, baseZ: 4.95, height: 0.3 });
}
