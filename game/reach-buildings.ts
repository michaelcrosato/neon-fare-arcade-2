import type { Color, LotContext, LotKind } from "./model";
import { MAT_BUILDING, MAT_GENERIC, MAT_LAMP, MAT_ROAD, MAT_SIDEWALK, MAT_SIGN, MAT_WINDOW } from "./config";
import { gabledRoof } from "./architecture";
import type { ReachAnchor } from "./reach-destinations";
import { REACH_CYAN, REACH_GLASS, REACH_INK, REACH_IVORY, REACH_LILAC, REACH_NEON, REACH_PALETTE,
  REACH_PEACH, REACH_SEAFOAM, REACH_SHELL, reachBox as box, reachFace as face, reachLawn,
  reachNeonWord, reachPalm, reachPool, reachRoundVolume, reachSolid as solid, reachUmbrella, reachYacht } from "./reach-assets";

export function reachDecoBuilding(ctx: LotContext, x: number, y: number, tone: Color, variant: number, height = 15) {
  const width = 17 + variant % 3, depth = 14;
  box(ctx, x, y + 2, height / 2 + .18, width, depth, height, tone);
  solid(ctx, "deco-body", x, y + 2, width, depth, height + .2);
  // A rounded projecting corner, window eyebrows, and stepped roof caps are
  // actual geometry, visible in cab view as well as from above.
  reachRoundVolume(ctx, x + width / 2 - 2, y - 3, [{ z: .2, radius: 2.8 }, { z: height + .2, radius: 2.8 }], tone);
  const floors = Math.max(2, Math.min(5, Math.floor(height / 4)));
  for (let floor = 1; floor <= floors; floor += 1) {
    const z = 1 + floor * (height - 2) / floors;
    box(ctx, x - 1, y - 5.05, z - 1.2, width - 4, .1, 1.65, REACH_GLASS, MAT_WINDOW);
    box(ctx, x - 1, y - 5.6, z - .2, width - 2.5, 1.35, .28, REACH_IVORY);
    box(ctx, x - width / 2 - .04, y + 2, z - 1.2, .1, depth - 2, 1.7, REACH_GLASS, MAT_WINDOW);
    box(ctx, x + width / 2 + .04, y + 3, z - 1.2, .1, depth - 3, 1.7, REACH_GLASS, MAT_WINDOW);
    box(ctx, x, y + 9.05, z - 1.2, width - 3, .1, 1.7, REACH_GLASS, MAT_WINDOW);
  }
  box(ctx, x, y + 2, height + .35, width + .7, depth + .6, .45, REACH_IVORY);
  box(ctx, x, y + 2, height + 1, width * .68, depth + .6, 1, tone);
  box(ctx, x, y + 2, height + 1.85, width * .34, depth + .6, .75, REACH_IVORY);
  box(ctx, x - width / 2 + 1.1, y - 5.45, height * .6, 1.6, .55, height + 3, REACH_INK, MAT_SIGN);
  box(ctx, x - width / 2 + 1.1, y - 5.77, height * .6, .26, .06, height + 1.5, variant % 2 ? REACH_CYAN : REACH_NEON, MAT_LAMP);
  if (variant % 3 === 0) for (const [index, letter] of [..."HOTEL"].entries()) {
    reachNeonWord(ctx, letter, x - width / 2 + 1.1, y - 5.81, height + 1 - index * 1.5, .23, REACH_CYAN);
  }
  // Nautical porthole on the rounded corner, framed by an ivory ring.
  for (let side = 0; side < 10; side++) {
    const a = side * Math.PI / 5, b = (side + 1) * Math.PI / 5;
    const circle = (angle: number, radius: number) => ({ x: x + width / 2 - 2 + Math.cos(angle) * radius,
      y: y - 5.84, z: height - 1.9 + Math.sin(angle) * radius });
    face(ctx, [circle(a, 1), circle(b, 1), circle(b, .7), circle(a, .7)], REACH_IVORY);
    face(ctx, [circle(a, .7), circle(b, .7), { x: x + width / 2 - 2, y: y - 5.83, z: height - 1.9 }], REACH_GLASS, MAT_WINDOW);
  }
  box(ctx, x, y - 8.2, 3.8, 8.5, 5.4, .38, REACH_IVORY);
  box(ctx, x, y - 10.7, 3.76, 8.5, .16, .2, REACH_NEON, MAT_LAMP);
  for (const side of [-1, 1]) {
    box(ctx, x + side * 3.8, y - 9.7, 1.8, .22, .22, 3.6, REACH_SEAFOAM);
    solid(ctx, "canopy-post", x + side * 3.8, y - 9.7, .22, .22, 3.6);
  }
}

function tower(ctx: LotContext, variant: number) {
  const { centerX: x, centerY: y } = ctx;
  const height = 29 + variant % 5 * 7;
  const tone = variant % 2 ? REACH_SEAFOAM : REACH_LILAC;
  box(ctx, x, y + 2, height / 2, 18, 16, height, REACH_GLASS, MAT_WINDOW);
  solid(ctx, "bay-tower", x, y + 2, 18, 16, height);
  for (let floor = 3; floor < height; floor += 4.7) {
    box(ctx, x, y + 2, floor, 19.4, 17.4, .55, tone);
  }
  for (const side of [-1, 1]) box(ctx, x + side * 8.3, y + 2, height / 2, .5, 17, height, REACH_IVORY);
  for (let tier = 0; tier < 3; tier += 1) box(ctx, x, y + 2, height + tier * 2,
    17 - tier * 4, 15 - tier * 3, 2.1, tier % 2 ? REACH_GLASS : tone, tier % 2 ? MAT_WINDOW : MAT_BUILDING);
  box(ctx, x, y - 6.8, height + 3, 8, .2, .28, REACH_NEON, MAT_LAMP);
  box(ctx, x, y - 8.5, 3.5, 10, 5.8, .5, REACH_IVORY);
}

function courtyard(ctx: LotContext, variant: number) {
  const { centerX: x, centerY: y } = ctx, tone = REACH_PALETTE[variant % REACH_PALETTE.length];
  for (const side of [-1, 1]) {
    box(ctx, x + side * 7, y + 2, 3.2, 5.5, 18, 6.2, tone);
    box(ctx, x + side * 7, y + 2, 6.4, 6.2, 18.6, .5, REACH_IVORY);
    box(ctx, x + side * 4.2, y + 2, 3.6, .1, 13, 2, REACH_GLASS, MAT_WINDOW);
    solid(ctx, "courtyard-wing", x + side * 7, y + 2, 5.5, 18, 6.5);
  }
  box(ctx, x, y + 10, 3.2, 9, 3.5, 6.2, tone);
  solid(ctx, "courtyard-rear", x, y + 10, 9, 3.5, 6.5);
  reachPool(ctx, x, y + 4.7, 5, 5);
  reachPalm(ctx, x - 10.5, y - 10.5, .7);
}

function cafe(ctx: LotContext, variant: number, records = false) {
  const { centerX: x, centerY: y } = ctx, tone = REACH_PALETTE[variant % REACH_PALETTE.length];
  box(ctx, x, y + 3, 3.7, 20, 14, 7.2, tone);
  solid(ctx, "cafe", x, y + 3, 20, 14, 7.4);
  box(ctx, x, y + 3, 7.5, 21, 15, .55, REACH_IVORY);
  for (let bay = 0; bay < 3; bay += 1) {
    const bx = x + (bay - 1) * 6;
    box(ctx, bx, y - 4.07, 2.4, 4.5, .12, 3.6, REACH_GLASS, MAT_WINDOW);
    box(ctx, bx, y - 5.2, 4.4, 5.4, 2.7, .35, bay % 2 ? REACH_IVORY : REACH_NEON, MAT_SIGN);
  }
  reachNeonWord(ctx, records ? "FM86" : "CAFE", x, y - 4.12, 5.3, .27, records ? REACH_CYAN : REACH_NEON);
  for (const side of [-1, 1]) {
    reachUmbrella(ctx, x + side * 8.5, y - 9, REACH_SHELL, .7);
    box(ctx, x + side * 8.5, y - 9, .8, 1.5, 1.5, .16, REACH_IVORY, MAT_GENERIC);
  }
}

function tennis(ctx: LotContext, roller = false) {
  const { centerX: x, centerY: y } = ctx;
  box(ctx, x, y, .12, 26, 28, .12, roller ? REACH_LILAC : REACH_SEAFOAM, MAT_ROAD);
  for (const side of [-1, 1]) {
    box(ctx, x + side * 9, y, .22, .18, 23, .05, REACH_IVORY, MAT_SIGN);
    box(ctx, x, y + side * 11.5, .22, 18.2, .18, .05, REACH_IVORY, MAT_SIGN);
  }
  if (roller) {
    for (const side of [-1, 1]) box(ctx, x + side * 6.5, y + side * 4, 1, 5, 1.2, .35, REACH_NEON, MAT_SIGN);
  } else {
    box(ctx, x, y, .8, 22, .08, 1.2, REACH_INK, MAT_GENERIC);
    box(ctx, x, y, 1.45, 22, .12, .08, REACH_IVORY);
    for (const side of [-1, 1]) solid(ctx, "net-post", x + side * 11, y, .3, .3, 1.6);
  }
}

export function buildReachBuilding(ctx: LotContext, lot: LotKind, variant: number) {
  const { centerX: x, centerY: y } = ctx;
  box(ctx, x, y, .09, 25, 25, .1, REACH_IVORY, MAT_SIDEWALK);
  if (lot === "reach-condo") tower(ctx, variant);
  else if (lot === "reach-courtyard") courtyard(ctx, variant);
  else if (lot === "reach-corner-cafe" || lot === "reach-record-shop") cafe(ctx, variant, lot === "reach-record-shop");
  else if (lot === "reach-tennis") tennis(ctx, variant % 2 === 0);
  else if (lot === "reach-pool-court") {
    reachPool(ctx, x, y + 2, 13, 17);
    for (const side of [-1, 1]) { reachUmbrella(ctx, x + side * 9.5, y + 4, REACH_LILAC); reachPalm(ctx, x + side * 9.5, y - 10, .7); }
  } else if (lot === "reach-gas-stop") {
    box(ctx, x, y + 7, 2.5, 19, 7, 5, REACH_SEAFOAM);
    solid(ctx, "fuel-store", x, y + 7, 19, 7, 5);
    box(ctx, x, y - 1, 5, 23, 13, .65, REACH_IVORY);
    box(ctx, x, y - 7.4, 5, 23, .2, .25, REACH_NEON, MAT_LAMP);
    for (const side of [-1, 1]) { box(ctx, x + side * 7, y - 1, 1.2, 2, 1, 2.2, REACH_NEON); solid(ctx, "pump", x + side * 7, y - 1, 2, 1, 2.4); }
  } else reachDecoBuilding(ctx, x, y, REACH_PALETTE[variant % REACH_PALETTE.length], variant,
    lot === "reach-motel" ? 7 : 11 + variant % 4 * 4);
}

function entrancePavilion(ctx: LotContext, anchor: ReachAnchor) {
  const p = anchor.portal, dx = Math.cos(p.heading), dy = Math.sin(p.heading);
  const x = ctx.centerX + p.x - dx * 7.8, y = ctx.centerY + p.y - dy * 7.8;
  const alongX = Math.abs(dx) > .5, width = alongX ? 9 : 13, depth = alongX ? 13 : 9;
  box(ctx, x, y, 3.6, width, depth, 7, REACH_IVORY);
  solid(ctx, "destination-entrance", x, y, width, depth, 7.2);
  box(ctx, x, y, 7.3, width + 1, depth + 1, .5, REACH_SHELL);
  box(ctx, x + dx * (alongX ? 4.6 : 0), y + dy * (alongX ? 0 : 4.6), 3.1,
    alongX ? .12 : 5, alongX ? 5 : .12, 4.8, REACH_GLASS, MAT_WINDOW);
  const short = anchor.id === "bayou-belle" ? "MIRAGE" : anchor.id === "sunkissed-motel" ? "SUN KISS"
    : anchor.id === "blackwater-shipyard" ? "FM86" : anchor.id === "twinwater-gate" ? "PALM" : "";
  if (short) reachNeonWord(ctx, short, x, y - depth / 2 - .13, 5.5, .34);
}

/** Tile-owned geometry meets across campus seams; entrances remain deliberately clear. */
export function buildReachAnchor(ctx: LotContext, anchor: ReachAnchor, tileX: number, tileY: number) {
  const { centerX: x, centerY: y } = ctx, portalTile = tileX === anchor.portal.tileX && tileY === anchor.portal.tileY;
  const left = tileX === 0 ? -11.7 : -18.02, right = tileX === anchor.width - 1 ? 11.7 : 18.02;
  const top = tileY === 0 ? -11.7 : -18.02, bottom = tileY === anchor.height - 1 ? 11.7 : 18.02;
  box(ctx, x + (left + right) / 2, y + (top + bottom) / 2, .055, right - left, bottom - top, .08, REACH_IVORY, MAT_SIDEWALK);
  if (portalTile) {
    entrancePavilion(ctx, anchor);
    reachPalm(ctx, x - 13, y - 12, 1);
    reachPalm(ctx, x + 13, y - 12, 1);
    return;
  }
  if (anchor.id === "bayou-belle") {
    if (tileY === 0) reachDecoBuilding(ctx, x, y, tileX === 1 ? REACH_IVORY : REACH_SHELL, tileX, tileX === 1 ? 39 : 26);
    else { reachPool(ctx, x, y, 22, 25); reachUmbrella(ctx, x - 14, y + 9, REACH_NEON); }
  } else if (anchor.id === "lantern-bay-market") {
    if (tileY === 0) cafe(ctx, tileX + 1);
    else for (const side of [-1, 1]) { reachUmbrella(ctx, x + side * 8, y, REACH_PEACH, 1.4); box(ctx, x + side * 8, y, 1.2, 5, 3, 2, REACH_SEAFOAM); }
  } else if (anchor.id === "stormwall-locks") {
    const leftZ = [17, 12, 8, 12][tileX], rightZ = [12, 8, 12, 17][tileX];
    face(ctx, [{ x: x - 18, y: y - 18, z: leftZ }, { x: x + 18, y: y - 18, z: rightZ },
      { x: x + 18, y: y + 18, z: rightZ }, { x: x - 18, y: y + 18, z: leftZ }], REACH_IVORY);
    face(ctx, [{ x: x - 18, y: y + 18, z: leftZ - .65 }, { x: x + 18, y: y + 18, z: rightZ - .65 },
      { x: x + 18, y: y - 18, z: rightZ - .65 }, { x: x - 18, y: y - 18, z: leftZ - .65 }], REACH_LILAC);
    for (let step = 0; step < 5; step += 1) {
      const height = 1.125 + step * .55;
      const seatLeft = Math.max(left + 1, -15.8 + step * 6), seatRight = Math.min(right - 1, -10.2 + step * 6);
      const seatTop = Math.max(top + 1, -15.5), seatBottom = Math.min(bottom - 1, 15.5);
      if (seatRight <= seatLeft) continue;
      const seatX = x + (seatLeft + seatRight) / 2, seatY = y + (seatTop + seatBottom) / 2;
      box(ctx, seatX, seatY, height / 2, seatRight - seatLeft, seatBottom - seatTop, height, step % 2 ? REACH_SEAFOAM : REACH_SHELL);
      solid(ctx, "stadium-bleacher", seatX, seatY, seatRight - seatLeft, seatBottom - seatTop, height);
    }
    solid(ctx, "stadium-roof", x, y, 36, 36, Math.abs(leftZ - rightZ) + .65, Math.min(leftZ, rightZ) - .65);
    if (tileX === 3) for (const side of [-1, 1]) { box(ctx, x + 12, y + side * 12, 7, .8, .8, 14, REACH_IVORY); solid(ctx, "stadium-column", x + 12, y + side * 12, .8, .8, 14); }
  } else if (anchor.id === "cypress-crown") {
    tennis(ctx, tileX === 1);
    reachPalm(ctx, x - 11, y - 11, 1);
    reachPalm(ctx, x + 11, y + 11, .9);
  } else if (anchor.id === "gulfwatch-station") {
    if (tileX === 1 && tileY === 0) {
      reachRoundVolume(ctx, x, y, [{ z: .2, radius: 5 }, { z: 2, radius: 5 }, { z: 32, radius: 2.8 }], REACH_IVORY);
      reachRoundVolume(ctx, x, y, [{ z: 31, radius: 3.8 }, { z: 32, radius: 3.8 }], REACH_SHELL);
      reachRoundVolume(ctx, x, y, [{ z: 32, radius: 2.9 }, { z: 36, radius: 2.9 }], REACH_GLASS, MAT_WINDOW);
      reachRoundVolume(ctx, x, y, [{ z: 36, radius: 4 }, { z: 39, radius: .3 }], REACH_INK);
      box(ctx, x, y, 34, 1.7, 1.7, 1.7, REACH_CYAN, MAT_LAMP);
      solid(ctx, "lighthouse", x, y, 8, 8, 38);
    } else { reachLawn(ctx, x, y, 34, 34); for (const side of [-1, 1]) { reachPalm(ctx, x + side * 10, y - 5, 1.1); box(ctx, x + side * 8, y + 10, .8, 7, 1.6, .4, REACH_SEAFOAM); } }
  } else if (anchor.id === "moonwater-marina") {
    for (const side of [-1, 1]) {
      reachPool(ctx, x + side * 7, y - 1, 10, 24);
      reachYacht(ctx, x + side * 7, y - 1, 1.4, 0, side < 0 ? REACH_IVORY : REACH_SHELL);
    }
    box(ctx, x, y - 1, .55, 2.3, 27, .45, REACH_PEACH, MAT_SIDEWALK);
  } else if (anchor.id === "blackwater-shipyard") {
    reachDecoBuilding(ctx, x, y, REACH_LILAC, tileX, tileX === 1 ? 23 : 13);
    if (tileX === 1 && tileY === 0) {
      box(ctx, x, y + 2, 38, .75, .75, 27, REACH_IVORY);
      for (let ring = 0; ring < 3; ring += 1) reachRoundVolume(ctx, x, y + 2,
        [{ z: 37 + ring * 4, radius: 3.5 - ring * .8 }, { z: 37.4 + ring * 4, radius: 3.5 - ring * .8 }], REACH_NEON, MAT_LAMP);
      reachNeonWord(ctx, "86", x, y - 5.3, 17, .8, REACH_CYAN);
    }
  } else if (anchor.id === "saint-lumina") {
    box(ctx, x, y, 4, 19, 25, 8, REACH_PEACH);
    solid(ctx, "chapel", x, y, 19, 25, 10);
    ctx.surfaces?.push(...gabledRoof(x, y, 8, 21, 27, 4, REACH_SHELL, REACH_IVORY));
    if (tileX === 1 && tileY === 0) { box(ctx, x + 7, y, 10, 4, 4, 20, REACH_IVORY); box(ctx, x + 7, y, 22, .5, .5, 5, REACH_NEON); box(ctx, x + 7, y, 23, 3, .5, .5, REACH_NEON); }
  } else if (anchor.id === "sunkissed-motel") { reachDecoBuilding(ctx, x, y, REACH_SEAFOAM, tileX, 9); }
}
