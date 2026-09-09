import type { Box, Color, LotContext, MaterialId, MeshFace, Vec2, Vec3 } from "./model";
import { MAT_BUILDING, MAT_FOLIAGE, MAT_GENERIC, MAT_SIGN, MAT_TIMBER, MAT_WINDOW } from "./config";
import { facetedBoulder, gabledRoof, taperedSpire } from "./architecture";

const CREAM: Color = [0.98, 0.93, 0.78, 1];
const TIMBER: Color = [0.48, 0.31, 0.19, 1];
const GLASS: Color = [0.27, 0.66, 0.73, 1];

/** Pure mesh builders; the world places these on its shared terrain afterward. */
export function coastBeam(a: Vec3, b: Vec3, width: number, color: Color = TIMBER, material: MaterialId = MAT_TIMBER): Box {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2,
    sx: Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z), sy: width, sz: width,
    yaw: Math.atan2(b.y - a.y, b.x - a.x), tilt: -Math.atan2(b.z - a.z, Math.hypot(b.x - a.x, b.y - a.y)), color, material };
}

function face(ctx: LotContext, corners: MeshFace["corners"], color: Color, material: MaterialId = MAT_BUILDING, groundAnchor?: Vec2) {
  ctx.surfaces?.push({ corners, color, material, kind: "architecture", ...(groundAnchor ? { groundAnchor } : {}) });
}

export function coastPalm(ctx: LotContext, x: number, y: number, scale = 1, solid = false) {
  const anchor = { x, y }, lean = ((Math.abs(x + y) % 13) - 6) * 0.11;
  const rings = [0, 0.38, 0.72, 1].map(t => Array.from({ length: 6 }, (_, side) => {
    const angle = side * Math.PI / 3, radius = (0.33 - 0.15 * t) * scale;
    return { x: x + lean * t * t * scale + Math.cos(angle) * radius,
      y: y + 0.7 * t * t * scale + Math.sin(angle) * radius, z: t * 10.8 * scale };
  }));
  for (let tier = 0; tier < 3; tier += 1) for (let side = 0; side < 6; side += 1) {
    const next = (side + 1) % 6;
    face(ctx, [rings[tier][side], rings[tier][next], rings[tier + 1][next], rings[tier + 1][side]],
      tier % 2 ? [0.62, 0.48, 0.29, 1] : TIMBER, MAT_TIMBER, anchor);
  }
  const crown = { x: x + lean * scale, y: y + 0.7 * scale, z: 10.8 * scale };
  for (let leaf = 0; leaf < 7; leaf += 1) {
    const angle = leaf * Math.PI * 2 / 7 + x * 0.07, nx = Math.cos(angle), ny = Math.sin(angle);
    const mid = { x: crown.x + nx * 2.1 * scale, y: crown.y + ny * 2.1 * scale, z: crown.z + (leaf % 2 ? 0.6 : 0.2) * scale };
    const tip = { x: crown.x + nx * 4.1 * scale, y: crown.y + ny * 4.1 * scale, z: crown.z - (1.7 + leaf % 3 * 0.4) * scale };
    const left = { x: mid.x - ny * 0.58 * scale, y: mid.y + nx * 0.58 * scale, z: mid.z };
    const right = { x: mid.x + ny * 0.58 * scale, y: mid.y - nx * 0.58 * scale, z: mid.z };
    const color: Color = leaf % 2 ? [0.17, 0.49, 0.3, 1] : [0.32, 0.61, 0.33, 1];
    for (const corners of [[crown, left, tip], [crown, tip, right]] as const) {
      face(ctx, [...corners], color, MAT_FOLIAGE, anchor);
      face(ctx, [...corners].reverse() as unknown as MeshFace["corners"], color, MAT_FOLIAGE, anchor);
    }
  }
  if (solid) ctx.colliders.push({ id: `coast-palm:${ctx.blockX}:${ctx.blockY}:${x}:${y}`, x, y,
    halfX: 0.38 * scale, halfY: 0.38 * scale, height: 10 * scale, groundAnchor: anchor });
}

export function coastSage(ctx: LotContext, x: number, y: number, scale = 1, flowers = false) {
  const color: Color = flowers ? [0.47, 0.56, 0.4, 1] : [0.49, 0.6, 0.47, 1];
  ctx.surfaces?.push(...facetedBoulder({ x, y, z: 0 }, 2.5 * scale, 1.7 * scale, 1.1 * scale, color)
    .map(surface => ({ ...surface, material: MAT_FOLIAGE })));
  if (flowers) for (let i = 0; i < 3; i += 1) ctx.boxes.push({ x: x + (i - 1) * 0.48 * scale, y,
    z: (0.7 + i % 2 * 0.3) * scale, sx: 0.44, sy: 0.42, sz: 0.22, yaw: i,
    color: [0.69, 0.38, 0.72, 1], material: MAT_FOLIAGE, groundAnchor: { x, y } });
}

export function coastCypress(ctx: LotContext, x: number, y: number, scale = 1) {
  ctx.boxes.push({ x, y, z: scale * 2, sx: 0.3, sy: 0.3, sz: scale * 4, yaw: 0,
    color: TIMBER, material: MAT_TIMBER, groundAnchor: { x, y } });
  ctx.surfaces?.push(...taperedSpire({ x, y, z: scale }, scale * 1.25, scale * 7.2,
    [0.18, 0.34, 0.24, 1], 7, MAT_FOLIAGE, { x, y }));
}

export function coastMissionRoof(ctx: LotContext, x: number, y: number, z: number, width: number, depth: number) {
  ctx.surfaces?.push(...gabledRoof(x, y, z, width, depth, Math.min(2.1, width * 0.16),
    [0.72, 0.31, 0.2, 1], CREAM));
  for (const side of [-1, 1]) ctx.boxes.push({ x: x + side * width / 2, y, z, sx: 0.22, sy: depth, sz: 0.3,
    yaw: 0, color: [0.51, 0.23, 0.16, 1], material: MAT_TIMBER });
}

export function coastArcade(ctx: LotContext, x: number, y: number, width = 14) {
  const spacing = width / 3, radius = spacing / 2 - 0.35, spring = 2.3;
  for (let bay = 0; bay < 3; bay += 1) {
    const center = x + (bay - 1) * spacing;
    for (let segment = 0; segment < 7; segment += 1) {
      const angle = segment / 7 * Math.PI, next = (segment + 1) / 7 * Math.PI;
      const point = (a: number, r: number, dy: number) => ({ x: center + Math.cos(a) * r, y: y + dy, z: spring + Math.sin(a) * r });
      const a = point(angle, radius, -0.3), b = point(next, radius, -0.3), c = point(next, radius + 0.4, -0.3), d = point(angle, radius + 0.4, -0.3);
      face(ctx, [a, b, c, d], CREAM);
      face(ctx, [{ ...d, y: y + 0.3 }, { ...c, y: y + 0.3 }, { ...b, y: y + 0.3 }, { ...a, y: y + 0.3 }], CREAM);
      face(ctx, [a, { ...a, y: y + 0.3 }, { ...b, y: y + 0.3 }, b], [0.75, 0.67, 0.5, 1]);
      const minX = Math.min(a.x, b.x, c.x, d.x), maxX = Math.max(a.x, b.x, c.x, d.x);
      const baseZ = Math.min(a.z, b.z), top = Math.max(c.z, d.z);
      ctx.colliders.push({ id: `coast-arch:${ctx.blockX}:${ctx.blockY}:${bay}:${segment}`, x: (minX + maxX) / 2, y,
        halfX: (maxX - minX) / 2, halfY: 0.3, baseZ, height: top - baseZ });
    }
  }
  for (let column = 0; column < 4; column += 1) {
    const px = x + (column - 1.5) * spacing;
    ctx.boxes.push({ x: px, y, z: spring / 2, sx: 0.6, sy: 0.7, sz: spring, yaw: 0, color: CREAM, material: MAT_BUILDING });
    ctx.colliders.push({ id: `coast-arcade:${ctx.blockX}:${ctx.blockY}:${column}`, x: px, y, halfX: 0.3, halfY: 0.35, height: spring });
  }
}

export function coastGlassHouse(ctx: LotContext, x: number, y: number) {
  ctx.boxes.push({ x, y: y + 3, z: 2.8, sx: 18, sy: 10, sz: 4.7, yaw: 0, color: CREAM, material: MAT_BUILDING },
    { x, y: y - 2.08, z: 2.8, sx: 15.7, sy: 0.17, sz: 3.5, yaw: 0, color: GLASS, material: MAT_WINDOW },
    { x, y: y - 3.5, z: 0.43, sx: 22, sy: 5, sz: 0.45, yaw: 0, color: TIMBER, material: MAT_TIMBER });
  for (const dx of [-7.5, -3, 2, 7.5]) ctx.boxes.push({ x: x + dx, y: y - 2.22, z: 2.8, sx: 0.22, sy: 0.3, sz: 3.7,
    yaw: 0, color: TIMBER, material: MAT_TIMBER });
  // Two opposing folded roof planes give the house a butterfly silhouette.
  for (const side of [-1, 1]) {
    const innerA = { x, y: y - 3.5, z: 5.1 }, innerB = { x, y: y + 9, z: 5.1 };
    const outerA = { x: x + side * 11.5, y: y - 3.5, z: 7 }, outerB = { ...outerA, y: y + 9 };
    face(ctx, side > 0 ? [innerA, outerA, outerB, innerB] : [outerA, innerA, innerB, outerB], CREAM);
    face(ctx, side > 0 ? [innerB, outerB, outerA, innerA] : [outerB, innerB, innerA, outerA], TIMBER, MAT_TIMBER);
    // Clerestory glass closes the space under the folded roof.
    const wallX = x + side * 9, edgeZ = 5.1 + 1.9 * 9 / 11.5;
    for (const py of [y - 2, y + 8]) {
      const pane = [{ x, y: py, z: 5.1 }, { x: wallX, y: py, z: 5.1 }, { x: wallX, y: py, z: edgeZ }] as const;
      face(ctx, py < y ? [pane[2], pane[1], pane[0]] : [...pane], GLASS, MAT_WINDOW);
    }
  }
  ctx.boxes.push({ x: x - 7, y: y + 4, z: 5.3, sx: 2.2, sy: 2.6, sz: 8, yaw: 0, color: [0.65, 0.52, 0.4, 1], material: MAT_BUILDING });
  ctx.colliders.push({ id: `coast-glass-house:${ctx.blockX}:${ctx.blockY}`, x, y: y + 3, halfX: 9, halfY: 5, height: 7.5 });
}

export function coastGoogieRoof(ctx: LotContext, x: number, y: number, z: number, width: number, depth: number, color: Color = CREAM) {
  const a = { x: x - width / 2, y: y - depth / 2, z: z + 2.2 }, b = { x: x + width / 2, y: y - depth / 2, z: z + 0.3 };
  const c = { x: x + width / 2, y: y + depth / 2, z }, d = { x: x - width / 2, y: y + depth / 2, z: z + 1.2 };
  face(ctx, [a, b, c, d], color);
  face(ctx, [d, c, b, a], [0.75, 0.56, 0.35, 1], MAT_TIMBER);
  ctx.boxes.push(coastBeam(a, b, 0.28, [1, 0.42, 0.3, 1], MAT_SIGN));
  ctx.colliders.push({ id: `coast-canopy:${ctx.blockX}:${ctx.blockY}:${x}:${y}`, x, y,
    halfX: width / 2, halfY: depth / 2, baseZ: z, height: 2.2 });
}

export function coastDecoBody(ctx: LotContext, x: number, y: number, width: number, depth: number, height: number, color: Color, accent: Color) {
  const bevel = 1.6, hx = width / 2, hy = depth / 2;
  const ring = [[-hx + bevel, -hy], [hx - bevel, -hy], [hx, -hy + bevel], [hx, hy - bevel],
    [hx - bevel, hy], [-hx + bevel, hy], [-hx, hy - bevel], [-hx, -hy + bevel]].map(([dx, dy]) => ({ x: x + dx, y: y + dy, z: 0.4 }));
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    face(ctx, [a, b, { ...b, z: height }, { ...a, z: height }], color);
    ctx.boxes.push(coastBeam({ ...a, z: height - 0.25 }, { ...b, z: height - 0.25 }, 0.2, accent, MAT_SIGN));
  }
  for (let i = 1; i < 7; i += 1) face(ctx, [{ ...ring[0], z: height }, { ...ring[i], z: height }, { ...ring[i + 1], z: height }], CREAM);
  ctx.boxes.push({ x, y: y - hy - 0.07, z: height * 0.45, sx: width - 3.5, sy: 0.16, sz: height * 0.38,
    yaw: 0, color: GLASS, material: MAT_WINDOW });
  ctx.colliders.push({ id: `coast-deco:${ctx.blockX}:${ctx.blockY}`, x, y, halfX: hx, halfY: hy, height });
}

export function coastBandShell(ctx: LotContext, x: number, y: number, radius = 10) {
  for (let i = 0; i < 12; i += 1) {
    const a = i / 12 * Math.PI, b = (i + 1) / 12 * Math.PI;
    const front = (angle: number) => ({ x: x + Math.cos(angle) * radius, y: y - 3.5, z: 1.2 + Math.sin(angle) * radius * 0.75 });
    const back = (angle: number) => ({ x: x + Math.cos(angle) * radius * 0.65, y: y + 4, z: 1.2 + Math.sin(angle) * radius * 0.55 });
    face(ctx, [front(a), front(b), back(b), back(a)], i % 3 ? CREAM : [0.58, 0.83, 0.8, 1]);
    face(ctx, [back(a), back(b), front(b), front(a)], [0.46, 0.7, 0.72, 1]);
    face(ctx, [{ x, y: y + 4, z: 1.2 }, back(a), back(b)], [0.46, 0.7, 0.72, 1]);
    ctx.boxes.push(coastBeam(front(a), back(a), 0.17, CREAM, MAT_GENERIC));
    const corners = [front(a), front(b), back(a), back(b)];
    const minX = Math.min(...corners.map(p => p.x)), maxX = Math.max(...corners.map(p => p.x));
    const baseZ = Math.min(...corners.map(p => p.z)), top = Math.max(...corners.map(p => p.z));
    ctx.colliders.push({ id: `coast-shell-roof:${ctx.blockX}:${ctx.blockY}:${i}`, x: (minX + maxX) / 2, y: y + 0.25,
      halfX: (maxX - minX) / 2, halfY: 3.75, baseZ, height: Math.max(0.2, top - baseZ) });
  }
  ctx.colliders.push({ id: `coast-band-shell:${ctx.blockX}:${ctx.blockY}`, x, y: y + 4, halfX: radius * 0.65, halfY: 0.3, height: 1.2 + radius * 0.55 });
}

export function coastUmbrella(ctx: LotContext, x: number, y: number, color: Color) {
  ctx.boxes.push({ x, y, z: 1.3, sx: 0.12, sy: 0.12, sz: 2.6, yaw: 0, color: TIMBER, material: MAT_TIMBER });
  for (let wedge = 0; wedge < 8; wedge += 1) {
    const point = (angle: number) => ({ x: x + Math.cos(angle) * 2.5, y: y + Math.sin(angle) * 2.5, z: 2.3 });
    const a = point(wedge * Math.PI / 4), b = point((wedge + 1) * Math.PI / 4), top = { x, y, z: 3.1 };
    face(ctx, [a, b, top], wedge % 2 ? CREAM : color, MAT_GENERIC);
    face(ctx, [top, b, a], CREAM, MAT_GENERIC);
  }
  ctx.colliders.push({ id: `coast-umbrella:${ctx.blockX}:${ctx.blockY}:${x}`, x, y, halfX: 0.12, halfY: 0.12, height: 2.6 });
}

export function coastAquariumRoof(ctx: LotContext, x: number, y: number, z: number) {
  const point = (angle: number, dy: number) => ({ x: x + Math.cos(angle) * 9, y: y + dy, z: z + Math.sin(angle) * 3.5 });
  for (let panel = 0; panel < 12; panel += 1) {
    const a = panel * Math.PI / 12, b = (panel + 1) * Math.PI / 12;
    face(ctx, [point(a, -4.5), point(a, 4.5), point(b, 4.5), point(b, -4.5)], GLASS, MAT_WINDOW);
    for (const side of [-1, 1]) face(ctx, [{ x, y: y + side * 4.5, z }, point(a, side * 4.5), point(b, side * 4.5)], GLASS, MAT_WINDOW);
    if (panel % 3 === 0) ctx.boxes.push(coastBeam(point(a, -4.6), point(a, 4.6), 0.2, CREAM, MAT_GENERIC));
  }
}
