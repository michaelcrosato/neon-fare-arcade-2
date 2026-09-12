import { MAT_GENERIC, MAT_LAMP, MAT_SIDEWALK, MAT_VEHICLE, MAT_WINDOW } from "./config";
import type { Color, LotContext, LotKind, VenueKind } from "./model";
import { blockRandom } from "./random";
import { facetedBoulder } from "./architecture";
import { ironwakeAnchorForBlock, ironwakeAreaAt, ironwakeGridStreetEnabled, ironwakeHasStreet, ironwakeIsWater, ironwakeShoreXAt } from "./industrial-layout";
import { WORKS, worksBeam, worksBox, worksContainer, worksGantryTile, worksHall, worksPipeRack, worksRound,
  worksShipSlice, worksSign, worksSolid, worksStack, worksTank, worksWreck } from "./industrial-assets";

export { IRONWAKE_ANCHORS, ironwakeAnchorForBlock } from "./industrial-layout";
const CONTAINERS = [WORKS.teal, WORKS.orange, WORKS.rust, WORKS.amber, WORKS.cream] as const;

export function industrialLotForBlock(bx: number, by: number): LotKind {
  const anchor = ironwakeAnchorForBlock(bx, by);
  if (anchor) return anchor.definition.lot;
  const x = bx * 36 + 18, y = by * 36 + 18;
  if ([-12, 0, 12].some(dx => [-12, 0, 12].some(dy => ironwakeIsWater(x + dx, y + dy)))) return "works-ocean";
  const random = blockRandom(bx, by, 0x170a4e), roll = random();
  if (!ironwakeHasStreet(bx, by)) return roll < .6 ? "works-verge" : y > 1872 ? "works-scrap-lot" : "works-rail-yard";
  if (roll < .09) return "works-utility";
  const area = ironwakeAreaAt(x, y);
  if (area === "BLACKLINE REFINERY") return roll < .68 ? "works-tank-farm" : "works-machine-shop";
  if (area === "MAGNET KING BADLANDS") return roll < .66 ? "works-scrap-lot" : "works-machine-shop";
  if (x < -1764) return roll < .7 ? "works-container-yard" : "works-warehouse";
  return roll < .4 ? "works-warehouse" : roll < .7 ? "works-machine-shop" : "works-rail-yard";
}

export function industrialPortalSpecs(lot: LotKind, centerX: number, centerY: number, bx: number, by: number) {
  const anchor = ironwakeAnchorForBlock(bx, by);
  if (anchor) {
    const p = anchor.definition.portal;
    return p.tileX === anchor.tileX && p.tileY === anchor.tileY
      ? [{ suffix: "public-gate", kind: p.kind, label: anchor.definition.label, x: centerX + p.x, y: centerY + p.y, heading: p.heading }] : [];
  }
  const door: Partial<Record<LotKind, { kind: VenueKind; label: string }>> = {
    "works-warehouse": { kind: "warehouse", label: "IRONWAKE DISTRIBUTION" },
    "works-machine-shop": { kind: "garage", label: "RIVET & RATCHET" },
  };
  const spec = door[lot];
  return spec && by % 3 === 0 && ironwakeHasStreet(bx, by)
    ? [{ suffix: "dispatch", ...spec, x: centerX, y: centerY - 9.5, heading: -Math.PI / 2 }] : [];
}

function pad(ctx: LotContext, width = 24, depth = 24, tone: Color = WORKS.concrete) {
  worksBox(ctx, ctx.centerX, ctx.centerY, .17, width, depth, .2, tone, MAT_SIDEWALK);
}

function office(ctx: LotContext, word: string, tone: Color = WORKS.teal) {
  const x = ctx.centerX, y = ctx.centerY;
  pad(ctx);
  worksBox(ctx, x, y + 3.5, 3.4, 21, 12, 6.3, tone);
  worksSolid(ctx, "public-office", x, y + 3.5, 21, 12, 6.6);
  worksBox(ctx, x, y - 2.55, 3.4, 17, .2, 2.5, WORKS.glass, MAT_WINDOW);
  worksBox(ctx, x, y + 3.5, 6.7, 22, 13, .45, WORKS.cream);
  worksSign(ctx, word, x, y - 2.85, 6.9, 22);
  for (const dx of [-10, 10]) {
    worksBox(ctx, x + dx, y - 10.5, .85, .7, .7, 1.4, WORKS.amber);
    worksSolid(ctx, "gate-bollard", x + dx, y - 10.5, .7, .7, 1.55);
  }
}

function fence(ctx: LotContext, side: "north" | "south" | "west" | "east", gap = false) {
  const horizontal = side === "north" || side === "south", sign = side === "north" || side === "west" ? -1 : 1;
  const x = ctx.centerX + (horizontal ? 0 : sign * 11.5), y = ctx.centerY + (horizontal ? sign * 11.5 : 0);
  for (const offset of gap ? [-8.5, 8.5] : [0]) {
    const px = x + (horizontal ? offset : 0), py = y + (horizontal ? 0 : offset), length = gap ? 6 : 24;
    worksBox(ctx, px, py, 1.35, horizontal ? length : .24, horizontal ? .24 : length, 2.5, WORKS.steel, MAT_GENERIC);
    worksBox(ctx, px, py, 2.7, horizontal ? length : .38, horizontal ? .38 : length, .22, WORKS.amber);
    worksSolid(ctx, "fence", px, py, horizontal ? length : .3, horizontal ? .3 : length, 2.9);
  }
}

function containers(ctx: LotContext, sparse = false) {
  const x = ctx.centerX, y = ctx.centerY;
  for (const dx of [-6.5, 6.5]) for (let tier = 0; tier < (sparse ? 1 : 3); tier++) {
    worksContainer(ctx, x + dx, y + 3, .4 + tier * 3.6, CONTAINERS[(Math.abs(ctx.blockX + ctx.blockY) + tier + (dx > 0 ? 1 : 0)) % CONTAINERS.length], 17);
  }
  for (const dx of [-6.5, 6.5]) worksSolid(ctx, "container-stack", x + dx, y + 3, 5.5, 17, sparse ? 4 : 11.4);
}

function distillation(ctx: LotContext, tall = false) {
  const x = ctx.centerX, y = ctx.centerY, height = tall ? 43 : 24;
  worksRound(ctx, x, y + 3, [[.3, 3.2], [height - 2, 3.2], [height, 1.8], [height + 1, .3]], WORKS.silver, 8);
  worksSolid(ctx, "distillation-column", x, y + 3, 6.5, 6.5, height + 1);
  for (const z of [height * .33, height * .66, height - 3]) {
    worksRound(ctx, x, y + 3, [[z, 4.8], [z + .4, 4.8]], WORKS.steel, 8);
    worksRound(ctx, x, y + 3, [[z + 1.4, 4.8], [z + 1.65, 4.8]], WORKS.amber, 8);
  }
  worksBox(ctx, x - 4, y + 3, height / 2, .45, .6, height, WORKS.amber);
  for (const side of [-1, 1]) {
    worksBox(ctx, x + side * 9, y + 3, 8, 1.2, 1.2, 15, WORKS.teal);
    worksSolid(ctx, "refinery-pump", x + side * 9, y + 3, 1.2, 1.2, 15.5);
    ctx.boxes.push(worksBeam({ x: x + side * 9, y: y + 3, z: 14 }, { x, y: y + 3, z: 18 }, .9, WORKS.amber));
  }
}

function railYard(ctx: LotContext, wagons = true) {
  const x = ctx.centerX, y = ctx.centerY;
  pad(ctx, 24, 35.95, WORKS.dark);
  for (const dx of [-7, 7]) {
    for (const side of [-1, 1]) worksBox(ctx, x + dx + side * 1.4, y, .4, .22, 36, .23, WORKS.silver);
    for (let tie = -15; tie <= 15; tie += 6) worksBox(ctx, x + dx, y + tie, .22, 4.4, .65, .2, WORKS.brick);
    if (!wagons) continue;
    worksBox(ctx, x + dx, y + 1, 2.8, 4.4, 20, 3.8, dx < 0 ? WORKS.rust : WORKS.teal);
    worksBox(ctx, x + dx, y + 1, 4.85, 4.6, 20.3, .4, WORKS.dark);
    worksSolid(ctx, "freight-wagon", x + dx, y + 1, 4.6, 20.3, 5.1);
    for (const end of [-7, 7]) worksBox(ctx, x + dx, y + 1 + end, .85, 5, 1.8, 1.4, WORKS.dark);
  }
}

function scrap(ctx: LotContext, high = false) {
  const x = ctx.centerX, y = ctx.centerY;
  for (const dx of [-7, 7]) for (const dy of [-4, 7]) {
    const height = high ? 3 : 2, offset = (ctx.random() - .5) * 2;
    for (let tier = 0; tier < height; tier++) worksWreck(ctx, x + dx + (tier % 2 ? .3 : -.3), y + dy + offset, .2 + tier * 1.65,
      [WORKS.rust, WORKS.teal, WORKS.cream, WORKS.amber][(Math.abs(ctx.blockX + ctx.blockY) + tier + (dy > 0 ? 1 : 0)) % 4], (ctx.random() - .5) * .6);
    worksSolid(ctx, "scrap-tower", x + dx, y + dy + offset, 5.8, 4.6, 2 + (height - 1) * 1.65);
  }
  for (let pile = 0; pile < 2; pile++) ctx.surfaces?.push(...facetedBoulder({ x: x + (pile ? 1 : -1), y: y + 5, z: .1 },
    3, 4, 2.5, pile ? WORKS.rust : WORKS.dark));
}

function portCrane(ctx: LotContext, tileY: number) {
  const x = ctx.centerX, y = ctx.centerY;
  worksBox(ctx, x, y, 40, 5, 36, 3, WORKS.teal);
  worksBox(ctx, x, y, 41.8, 5.6, 36, .35, WORKS.amber);
  for (const side of [-1, 1]) for (let bay = -1; bay <= 1; bay++) ctx.boxes.push(worksBeam(
    { x: x + side * 2.6, y: y + bay * 12 - 6, z: 39 }, { x: x + side * 2.6, y: y + bay * 12 + 6, z: 41.1 }, .25, WORKS.amber));
  worksSolid(ctx, "port-crane-boom", x, y, 5.6, 36, 3.5, 38.5);
  if (tileY !== 2) return;
  for (const side of [-1, 1]) {
    worksBox(ctx, x + side * 10, y - 3, 19.4, 2, 2, 38, WORKS.teal);
    worksSolid(ctx, "port-crane-leg", x + side * 10, y - 3, 2, 2, 40);
    ctx.boxes.push(worksBeam({ x: x + side * 10, y: y - 3, z: 32 }, { x, y, z: 40 }, 1.8, WORKS.teal));
    worksBox(ctx, x + side * 10, y - 3, 1.4, 4, 11, 2, WORKS.dark);
  }
  worksBox(ctx, x, y - 8, 48, 2.5, 2.5, 15, WORKS.teal);
  ctx.boxes.push(worksBeam({ x, y: y - 8, z: 55 }, { x, y: y + 17, z: 41 }, .3, WORKS.silver));
  worksBox(ctx, x + 5, y + 8, 36.7, 6, 7, 4, WORKS.amber);
  worksBox(ctx, x + 5, y + 4.4, 37, 4.9, .2, 2, WORKS.glass, MAT_WINDOW);
}

function anchorLot(ctx: LotContext, anchor: NonNullable<ReturnType<typeof ironwakeAnchorForBlock>>) {
  const { definition: a, tileX, tileY } = anchor, x = ctx.centerX, y = ctx.centerY;
  const portal = a.portal.tileX === tileX && a.portal.tileY === tileY;
  if (portal) {
    if (a.id === "shift-change-diner") {
      office(ctx, "SHIFT", WORKS.silver);
      worksBox(ctx, x, y - 2.9, 5.6, 22, .25, .3, WORKS.orange, MAT_LAMP);
      for (let stool = -2; stool <= 2; stool++) worksBox(ctx, x + stool * 3.3, y - 5.6, 1, 1.3, 1.3, .2, WORKS.rust);
    } else office(ctx, a.id === "vulcan-foundry" ? "VULCAN" : a.id === "blackline-refinery" ? "REFINERY"
      : a.id === "leviathan-drydock" ? "LEVIATHAN" : a.id === "magnet-salvage" ? "MAGNET KING" : a.id === "ironwake-container-port" ? "PORT"
        : a.id === "freight-exchange" ? "DISPATCH" : a.id === "ironwake-truck-stop" ? "FUEL" : a.id === "breakwater-watch" ? "WATCH" : "IRON GATE");
    return;
  }
  if (a.id === "ironwake-gate") {
    pad(ctx, 25, 30);
    if (tileY === 0) {
      for (const dx of [-12, 12]) {
        worksBox(ctx, x + dx, y, 6.5, 1.8, 2.2, 13, WORKS.steel);
        worksSolid(ctx, "checkpoint-post", x + dx, y, 1.8, 2.2, 13);
      }
      worksBox(ctx, x, y, 12.2, 27, 2.5, 2.4, WORKS.amber);
      worksSolid(ctx, "checkpoint-header", x, y, 27, 2.5, 2.4, 11);
      worksSign(ctx, "IRONWAKE", x, y - 1.4, 12.2, 26);
    } else {
      worksBox(ctx, x, y, .45, 8, 26, .35, WORKS.steel);
      for (const dx of [-5.5, 5.5]) worksBox(ctx, x + dx, y, .45, .5, 27, .4, WORKS.amber);
      worksBox(ctx, x + 10, y + 5, 2, 3, 5, 3.7, WORKS.teal);
      worksSolid(ctx, "weighbridge-console", x + 10, y + 5, 3, 5, 3.9);
    }
  } else if (a.id === "vulcan-foundry") {
    if (tileY >= 1 && tileY <= 3 && tileX < 4) worksHall(ctx, x + (tileX === 0 ? 3 : 0), y, tileX === 0 ? 29.98 : 35.98, 35.98, 18, WORKS.brick, true);
    else if (tileX >= 4 && tileY >= 1) {
      worksRound(ctx, x, y, [[.3, 9], [8, 9], [19, 6], [27, 7.5], [30, 3.2]], WORKS.rust, 8);
      worksSolid(ctx, "blast-furnace", x, y, 18, 18, 31);
      worksStack(ctx, x + 8, y + 8, tileY === 2 ? 68 : 42, 2.1);
      for (const side of [-1, 1]) ctx.boxes.push(worksBeam({ x: x + side * 10, y: y - 9, z: 1 }, { x: x + side * 5, y, z: 24 }, 1.4, WORKS.dark));
    } else if (tileY === 4) worksPipeRack(ctx, "x", 9);
    else railYard(ctx, tileX % 2 === 0);
  } else if (a.id === "blackline-refinery") {
    if (tileY === 0 || tileY === 3) worksPipeRack(ctx, "x", 8.5);
    else if (tileX === 0 || tileX >= 5) worksTank(ctx, x, y, tileY % 2 ? 11 : 9, 12 + tileY % 3 * 3);
    else if (tileY === 5 && (tileX === 2 || tileX === 4)) {
      worksStack(ctx, x, y, 66, 1.5, false);
      for (const dx of [-7, 7]) for (const dy of [-7, 7]) {
        worksBox(ctx, x + dx, y + dy, 18, .6, .6, 36, WORKS.steel);
        worksSolid(ctx, "flare-support", x + dx, y + dy, .6, .6, 36);
        ctx.boxes.push(worksBeam({ x: x + dx, y: y + dy, z: 2 }, { x, y, z: 57 }, .4, WORKS.steel));
      }
    } else distillation(ctx, tileX === 2 || tileX === 3);
  } else if (a.id === "ironwake-container-port") {
    if (tileY === 4 && tileX >= 1 && tileX <= 6) worksShipSlice(ctx, tileX - 1, 6, "x");
    if ((tileX === 2 || tileX === 6) && tileY >= 2 && tileY <= 4) portCrane(ctx, tileY);
    if (ironwakeIsWater(x, y)) return;
    if (tileY === 2 && (tileX === 2 || tileX === 6)) return;
    if (tileX >= 7 || tileY === 1 || tileY === 7 || tileY === 8) containers(ctx, tileY === 1);
    if (tileY === 1 || tileY === 8) for (const dx of [-12, 12]) {
      worksBox(ctx, x + dx, y, 1.1, 1.4, 1.4, 1.6, WORKS.amber);
      worksSolid(ctx, "quay-bollard", x + dx, y, 1.4, 1.4, 1.9);
    }
  } else if (a.id === "leviathan-drydock") {
    if (tileX === 2 && tileY >= 1 && tileY <= 7) worksShipSlice(ctx, tileY - 1, 7, "y", true);
    if (tileX <= 4 && (tileY === 2 || tileY === 6)) worksGantryTile(ctx, tileX);
    if (ironwakeIsWater(x, y)) return;
    if (tileX === 0 || tileX === 4) {
      for (const side of [-1, 1]) worksBox(ctx, x + side * 4, y, .36, .24, 36, .2, WORKS.silver);
    } else if (tileX >= 5 && tileY >= 2 && tileY <= 6) {
      if (tileY % 3 === 0) worksHall(ctx, x, y + 1, 23, 21, 12, WORKS.teal);
      else containers(ctx, true);
    } else if (tileY === 0 || tileY === 8) containers(ctx, true);
  } else if (a.id === "magnet-salvage") {
    if (tileX === 3 && tileY === 3) {
      worksBox(ctx, x, y, 1.3, 20, 14, 2, WORKS.dark);
      worksBox(ctx, x, y, 5.5, 18, 12, 2.4, WORKS.amber);
      worksSolid(ctx, "car-crusher", x, y, 20, 14, 7);
      for (const dx of [-8, 8]) for (const dy of [-5, 5]) worksBox(ctx, x + dx, y + dy, 3.5, .9, .9, 5, WORKS.silver);
      worksWreck(ctx, x, y, 2.4, WORKS.rust);
    } else if (tileX === 6 && tileY === 3) {
      worksBox(ctx, x, y, 1.6, 13, 9, 2.8, WORKS.dark);
      worksBox(ctx, x, y, 5, 8, 7, 4, WORKS.amber);
      worksSolid(ctx, "magnet-crane", x, y, 13, 9, 8);
      ctx.boxes.push(worksBeam({ x, y, z: 7 }, { x: x - 10, y, z: 23 }, 2, WORKS.amber));
      ctx.boxes.push(worksBeam({ x: x - 10, y, z: 23 }, { x: x - 2, y: y - 10, z: 28 }, 1.5, WORKS.amber));
    } else if ((tileY + tileX) % 5 === 0) {
      ctx.surfaces?.push(...facetedBoulder({ x, y: y + 3, z: .15 }, 19, 18, 7.5, WORKS.rust));
      ctx.surfaces?.push(...facetedBoulder({ x: x + 3, y, z: 2 }, 11, 13, 7, WORKS.dark));
      for (let rib = 0; rib < 5; rib++) worksBox(ctx, x - 6 + rib * 3, y + 3, 4 + rib % 2, 7, .7, .55,
        rib % 2 ? WORKS.silver : WORKS.teal, MAT_GENERIC, rib * .7, .4);
      worksWreck(ctx, x - 4, y - 3, 2.5, WORKS.cream, .5);
      worksSolid(ctx, "scrap-heap", x, y + 3, 21, 21, 10);
    } else scrap(ctx, tileX % 3 === 0);
  } else if (a.id === "freight-exchange") railYard(ctx);
  else if (a.id === "breakwater-watch") {
    if (tileX === 0 && tileY === 1) {
      worksRound(ctx, x, y, [[.2, 5.5], [22, 4.2], [23, 6], [27, 6], [29, 2]], WORKS.cream, 8);
      worksRound(ctx, x, y, [[24, 6.04], [26, 6.04]], WORKS.glass, 8, MAT_WINDOW);
      worksSolid(ctx, "harbor-watchtower", x, y, 11, 11, 29);
      worksBox(ctx, x, y, 31, .6, .6, 5, WORKS.dark);
      worksBox(ctx, x, y, 33.8, 1, 1, .8, WORKS.orange, MAT_LAMP);
    } else { pad(ctx); for (const dx of [-8, 8]) worksBox(ctx, x + dx, y, .8, 6, 1.4, .5, WORKS.cream); }
  } else if (a.id === "ironwake-truck-stop") {
    pad(ctx);
    worksBox(ctx, x, y, 6, 25, 23, .65, WORKS.amber);
    worksSolid(ctx, "fuel-canopy", x, y, 25, 23, .7, 5.65);
    for (const dx of [-8, 8]) {
      worksBox(ctx, x + dx, y, 3, .6, .6, 5.8, WORKS.steel);
      worksBox(ctx, x + dx, y - 3, 1.4, 1.6, 1.3, 2.4, WORKS.rust);
      worksSolid(ctx, "fuel-island", x + dx, y - 1, 2, 6, 6);
    }
  } else if (a.id === "shift-change-diner") {
    pad(ctx); worksBox(ctx, x, y + 4, 1.8, 16, 6, 2.7, WORKS.rust, MAT_VEHICLE);
    worksSolid(ctx, "parked-hauler", x, y + 4, 16, 6, 3.5);
  } else office(ctx, "CREW", WORKS.brick);

  // The public curb remains open; fence segments sit inside each owned tile.
  if (!ironwakeIsWater(x, y) && ["vulcan-foundry", "blackline-refinery", "magnet-salvage"].includes(a.id)) {
    if (tileY === 0) fence(ctx, "north", true);
    if (tileY === a.height - 1) fence(ctx, "south");
  }
}

export function buildIndustrialLot(ctx: LotContext, lot: LotKind) {
  const anchor = ironwakeAnchorForBlock(ctx.blockX, ctx.blockY);
  if (anchor) { anchorLot(ctx, anchor); return; }
  const x = ctx.centerX, y = ctx.centerY;
  if (lot === "works-ocean") return;
  if (lot === "works-verge") { buildIndustrialVerge(ctx, () => true); return; }
  pad(ctx);
  if (lot === "works-warehouse" || lot === "works-machine-shop") {
    worksHall(ctx, x, y + 3, 22, 16, lot === "works-warehouse" ? 10 : 7, lot === "works-warehouse" ? WORKS.teal : WORKS.rust);
    worksBox(ctx, x, y - 5.1, 2.6, 7, .2, 4.5, WORKS.dark);
    if (ctx.blockX % 4 === 0) worksSign(ctx, "RIVET", x, y - 5.4, 7.4, 15);
  } else if (lot === "works-tank-farm") worksTank(ctx, x, y + 2, 8, 11);
  else if (lot === "works-container-yard") containers(ctx);
  else if (lot === "works-scrap-lot") scrap(ctx);
  else if (lot === "works-rail-yard") railYard(ctx, ctx.blockY % 3 !== 0);
  else if (lot === "works-utility") {
    for (const dx of [-6, 6]) {
      worksBox(ctx, x + dx, y + 2, 2.7, 6, 8, 5, WORKS.steel);
      worksSolid(ctx, "transformer", x + dx, y + 2, 6, 8, 5.5);
      for (const dy of [-1, 4]) worksRound(ctx, x + dx, y + dy, [[5.2, .7], [7.5, .7]], WORKS.cream, 6);
    }
    fence(ctx, "north", true); fence(ctx, "south");
  }
}

export function buildIndustrialVerge(ctx: LotContext, clear: (x: number, y: number) => boolean) {
  const x = ctx.centerX, y = ctx.centerY;
  for (let i = 0; i < 2; i++) {
    const px = x + (ctx.random() - .5) * 20, py = y + (ctx.random() - .5) * 20;
    if (ironwakeIsWater(px, py) || !clear(px, py)) continue;
    worksBox(ctx, px, py, .65, 2.5, 2.5, 1, i ? WORKS.rust : WORKS.dark, MAT_GENERIC, ctx.random());
    worksSolid(ctx, "verge-scrap", px, py, 2.5, 2.5, 1.2);
  }
  const shore = ironwakeShoreXAt(y);
  if (shore > x - 18 && shore < x + 14 && clear(shore + 3, y)) {
    worksBox(ctx, shore + 3, y, .9, 1, 1, 1.5, WORKS.amber);
    worksSolid(ctx, "shore-bollard", shore + 3, y, 1, 1, 1.7);
  }
}

export function industrialPedestrianCount(bx: number, by: number) {
  if (!ironwakeHasStreet(bx, by)) return 0;
  const lot = industrialLotForBlock(bx, by);
  return lot === "works-warehouse" || lot === "works-machine-shop" ? 3 : 0;
}

export function industrialPedestrianPoint(bx: number, by: number, seconds: number, index: number) {
  if (index < 0 || index >= industrialPedestrianCount(bx, by)) return null;
  const x = bx * 36 + 18, y = by * 36 + 18;
  const sides = [{ x, y: y - 18, axis: "horizontal" as const, dx: 0, dy: -1 },
    { x: x + 18, y, axis: "vertical" as const, dx: 1, dy: 0 },
    { x, y: y + 18, axis: "horizontal" as const, dx: 0, dy: 1 },
    { x: x - 18, y, axis: "vertical" as const, dx: -1, dy: 0 }]
    .filter(p => ironwakeGridStreetEnabled(p, p.axis));
  if (!sides.length) return null;
  const side = sides[index % sides.length], walk = Math.sin(seconds * .13 + bx + by + index * 2) * 9;
  return { x: x + side.dx * 14.4 + (side.dy ? walk : 0), y: y + side.dy * 14.4 + (side.dx ? walk : 0), z: 0 };
}
