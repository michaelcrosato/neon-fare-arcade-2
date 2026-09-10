import type { DistrictKind, LotContext, LotKind } from "./model";
import { MAT_BUILDING, MAT_LAMP, MAT_ROAD, MAT_SIGN, MAT_TIMBER, MAT_WATER, MAT_WINDOW } from "./config";
import { cityGreenAt } from "./city-layout";
import { cityBench, cityBox, cityCanopy, cityGable, cityHipRoof, cityLight, cityParkedCar,
  citySawtoothRoof, cityShell, citySign, citySolid, cityTree, cityWindows,
  CITY_BRICK, CITY_CORAL, CITY_CREAM, CITY_GLASS, CITY_GOLD, CITY_INK, CITY_STONE, CITY_TEAL } from "./city-assets";

/** City frontages retain their semantic door positions while the architecture changes. */
export function buildCityLot(ctx: LotContext, lot: LotKind, district: DistrictKind) {
  const x = ctx.centerX, y = ctx.centerY;
  const facade = district === "market" || district === "townhomes" ? CITY_BRICK
    : district === "industrial" ? CITY_STONE : ctx.random() > .5 ? CITY_CREAM : CITY_TEAL;
  switch (lot) {
    case "tower": {
      const height = 22 + Math.floor(ctx.random() * 14);
      cityShell(ctx, "tower", x, y, 15, 16, height, facade);
      cityWindows(ctx, x, y, 15, 16, 3, height - 1.5);
      cityBox(ctx, x, y, height + 1.3, 10, 11, 2.6, CITY_STONE);
      cityHipRoof(ctx, x, y, height + 2.6, 10.5, 11.5, 3.7);
      cityBox(ctx, x, y, height + 5.7, .35, .35, 4, CITY_GOLD, MAT_LAMP);
      for (const side of [-1, 1]) cityBox(ctx, x + side * 6.7, y - 8.1, height / 2, .42, .2, height - 1, CITY_GOLD, MAT_SIGN);
      cityBox(ctx, x - 2.2, y - 8.1, 1.55, 2.2, .16, 3.1, CITY_INK);
      cityCanopy(ctx, "lobby-canopy", x - 2.2, y - 8.8, 4.8, 2, 3.65, CITY_TEAL);
      citySolid(ctx, "crown", x, y, 10, 11, 6.3, height);
      break;
    }
    case "office":
      cityShell(ctx, "office", x, y + 3, 15, 13, 11.5, facade);
      cityWindows(ctx, x, y + 3, 15, 13, 2.6, 10.3);
      citySawtoothRoof(ctx, x, y + 3, 11.5, 15.4, 13.4, 1.7, 2);
      cityCanopy(ctx, "entry", x + .5, y - 4, 6, 2, 3.8, CITY_CORAL);
      cityTree(ctx, "court-tree", x - 8.5, y - 6, .8);
      break;
    case "apartment":
      cityShell(ctx, "apartments", x - 1, y + 1, 18, 16, 13, CITY_BRICK);
      cityWindows(ctx, x - 1, y + 1, 18, 16, 3, 11.8);
      cityHipRoof(ctx, x - 1, y + 1, 13, 18.6, 16.6, 2.5);
      for (const level of [4, 7, 10]) cityBox(ctx, x - 1, y - 7.3, level, 15.5, 1, .2, CITY_CREAM);
      cityCanopy(ctx, "lobby", x - 5.4, y - 7.7, 3.5, 1.9, 3.65, CITY_GOLD);
      break;
    case "shops":
      for (const [index, offset] of [-7.1, 0, 7.1].entries()) {
        const height = 5.2 + index * .8;
        cityShell(ctx, `shop-${index}`, x + offset, y + 6.1, 6.4, 8.5, height, index === 1 ? CITY_CREAM : facade);
        cityBox(ctx, x + offset, y + 1.8, 1.8, 4.6, .09, 2.8, CITY_GLASS, MAT_WINDOW);
        cityBox(ctx, x + offset, y + 1.75, 4.2, 5.5, .25, .8, index === 1 ? CITY_CORAL : CITY_TEAL, MAT_SIGN);
        cityCanopy(ctx, `awning-${index}`, x + offset, y + 1.3, 6, 1.9, 4.8, index === 1 ? CITY_CORAL : CITY_GOLD);
      }
      break;
    case "diner":
      cityShell(ctx, "diner", x, y + 5.5, 16, 7.5, 4.4, CITY_CREAM);
      cityWindows(ctx, x, y + 5.5, 16, 7.5, 1, 3.5);
      cityCanopy(ctx, "diner-roof", x, y + 4.8, 18.3, 11, 4.5, CITY_CORAL);
      citySign(ctx, x - 9.3, y + 6, CITY_TEAL, 6.5);
      cityBench(ctx, x + 4, y + 5);
      break;
    case "townhouses":
      for (const [index, offset] of [-6, 0, 6].entries()) {
        cityShell(ctx, `row-${index}`, x + offset, y + 3, 5.8, 10, 6.6, index === 1 ? CITY_CREAM : CITY_BRICK);
        cityGable(ctx, x + offset, y + 3, 6.6, 6, 10.5, 2.2, CITY_INK);
        cityBox(ctx, x + offset, y - 2.05, 4.6, 3.8, .12, 1.4, CITY_GLASS, MAT_WINDOW);
        cityBox(ctx, x + offset, y - 2.08, 1.4, 1.4, .13, 2.8, CITY_TEAL);
      }
      cityTree(ctx, "street-tree", x - 9, y - 7, .7);
      break;
    case "homes":
      cityShell(ctx, "home", x - 4, y - .5, 9, 12, 4.6, facade);
      cityGable(ctx, x - 4, y - .5, 4.6, 9.6, 12.6, 3, CITY_INK);
      cityWindows(ctx, x - 4, y - .5, 9, 12, 1.2, 3.7);
      cityShell(ctx, "garage", x + 7, y + 4, 5, 7, 3.5, CITY_STONE);
      cityGable(ctx, x + 7, y + 4, 3.5, 5.5, 7.5, 1.5);
      cityBox(ctx, x + 7, y + .45, 1.5, 3.8, .15, 2.8, CITY_INK);
      cityTree(ctx, "garden-tree", x + 7, y - 7, .65);
      break;
    case "gas":
      cityShell(ctx, "fuel-store", x + 6.7, y + 4.8, 7, 6.4, 4.2, CITY_CREAM);
      cityBox(ctx, x + 6.7, y + 1.55, 1.8, 5.6, .12, 2.8, CITY_GLASS, MAT_WINDOW);
      cityCanopy(ctx, "fuel-canopy", x - 4.5, y, 10, 13, 4.7, CITY_GOLD);
      for (const offset of [-3.7, 3.7]) {
        cityBox(ctx, x - 4.5, y + offset, 1, 1.2, 1.8, 2, CITY_TEAL);
        cityBox(ctx, x - 4.5, y + offset - .92, 1.4, .7, .08, .55, CITY_INK);
        citySolid(ctx, `pump-${offset}`, x - 4.5, y + offset, 1.2, 1.8, 2);
      }
      citySign(ctx, x + 9, y + 8, CITY_CORAL, 6);
      break;
    case "carwash":
      cityShell(ctx, "wash-office", x + 5.5, y + 5, 7, 7.6, 4, CITY_CREAM);
      cityBox(ctx, x + 5.5, y + 1.15, 1.8, 5.4, .1, 2.5, CITY_GLASS, MAT_WINDOW);
      for (const offset of [-8, -2]) {
        cityBox(ctx, x + offset, y + 3, 2, .5, 12, 4, CITY_TEAL);
        citySolid(ctx, `wash-wall-${offset}`, x + offset, y + 3, .5, 12, 4);
      }
      cityCanopy(ctx, "wash-roof", x - 5, y + 3, 7, 13, 4.3, CITY_TEAL);
      cityBox(ctx, x - 5, y - 3.4, 3.5, 5.6, .25, .9, CITY_GOLD, MAT_SIGN);
      break;
    case "warehouse":
    case "factory": {
      const factory = lot === "factory", centerY = y + (factory ? 3.5 : 3.9);
      const depth = factory ? 12.4 : 14, height = factory ? 10 : 7;
      cityShell(ctx, lot, x, centerY, 20, depth, height, factory ? CITY_BRICK : CITY_STONE);
      citySawtoothRoof(ctx, x, centerY, height, 20.4, depth + .4, 2.2);
      for (const offset of [-6, 0, 6]) cityBox(ctx, x + offset, centerY - depth / 2 - .06, 2.4, 4, .1, 4.2, CITY_TEAL, MAT_WINDOW);
      citySolid(ctx, "shed-roof", x, centerY, 20, depth, 2.2, height);
      if (factory) for (const offset of [-7, 7]) {
        cityBox(ctx, x + offset, y + 7, 10, 1.1, 1.1, 20, CITY_INK);
        cityBox(ctx, x + offset, y + 7, 18.5, 1.25, 1.25, 1.2, CITY_CORAL, MAT_SIGN);
      }
      break;
    }
    case "motel":
      cityShell(ctx, "motel-lobby", x + 7, y - 1.2, 6, 6, 4.5, CITY_CREAM);
      cityWindows(ctx, x + 7, y - 1.2, 6, 6, 1, 3.7);
      cityShell(ctx, "motel-rooms", x - 3, y + 5.5, 13, 7, 6, facade);
      cityGable(ctx, x - 3, y + 5.5, 6, 13.5, 7.5, 1.8, CITY_CORAL);
      for (const offset of [-7, -3, 1]) cityBox(ctx, x + offset, y + 1.94, 2.8, 2.2, .1, 3.3, CITY_GLASS, MAT_WINDOW);
      citySign(ctx, x - 9, y - 7, CITY_TEAL, 6.8);
      break;
    case "civic":
      cityShell(ctx, "civic-hall", x, y + 5, 16, 9, 8, CITY_CREAM);
      cityHipRoof(ctx, x, y + 5, 8, 17, 10, 3, CITY_TEAL);
      cityCanopy(ctx, "portico", x, y - .8, 10, 3, 4.3, CITY_STONE);
      for (const side of [-1, 1]) {
        cityBox(ctx, x + side * 4, y - 1.6, 2.1, .65, .65, 4.2, CITY_CREAM);
        citySolid(ctx, `column-${side}`, x + side * 4, y - 1.6, .65, .65, 4.2);
      }
      cityTree(ctx, "civic-tree", x - 8, y - 7, .8);
      break;
    case "market":
      cityShell(ctx, "market-hall", x, y + 7.25, 18, 7, 6.4, CITY_BRICK);
      citySawtoothRoof(ctx, x, y + 7.25, 6.4, 18.5, 7.5, 1.8, 3);
      cityBox(ctx, x, y + 3.7, 2.2, 14, .1, 3.6, CITY_GLASS, MAT_WINDOW);
      cityCanopy(ctx, "market-awning", x, y + 3.5, 18, 3, 4.8, CITY_GOLD);
      cityBench(ctx, x - 6, y + 8);
      cityBench(ctx, x + 6, y + 8);
      break;
    case "plaza":
      cityShell(ctx, "kiosk", x + 7.6, y + 2, 4.3, 5, 3.8, CITY_TEAL);
      cityHipRoof(ctx, x + 7.6, y + 2, 3.8, 5, 5.8, 1.5, CITY_GOLD);
      cityBox(ctx, x - 3, y, .5, 3.8, 3.8, 1, CITY_STONE);
      cityBox(ctx, x - 3, y, 3.2, 1.8, 1.8, 4.5, CITY_CORAL, MAT_BUILDING, Math.PI / 4);
      cityHipRoof(ctx, x - 3, y, 5.5, 3.8, 3.8, 2.5, CITY_GOLD);
      citySolid(ctx, "plaza-sculpture", x - 3, y, 4, 4, 8);
      cityBench(ctx, x - 6, y + 7);
      cityTree(ctx, "plaza-tree", x - 8, y - 7, .85);
      break;
    case "marina":
    case "boardwalk": {
      const arcade = lot === "boardwalk", officeX = x + (arcade ? 6.8 : 7.3), officeY = y - (arcade ? 4.6 : 4);
      cityShell(ctx, "harbor-office", officeX, officeY, 6, 6, 4.8, CITY_CREAM);
      cityGable(ctx, officeX, officeY, 4.8, 6.5, 6.5, 2.1, CITY_TEAL);
      cityWindows(ctx, officeX, officeY, 6, 6, 1.2, 3.9);
      const waterX = x - 4, waterY = y + 3, width = 12, depth = 13;
      cityBox(ctx, waterX, waterY, .06, width, depth, .1, CITY_GLASS, MAT_WATER);
      ctx.surfaceRegions.push({ id: `city-water:${ctx.blockX}:${ctx.blockY}`, kind: "water", x: waterX, y: waterY,
        halfX: width / 2, halfY: depth / 2, yaw: 0 });
      citySolid(ctx, "harbor-water", waterX, waterY, width, depth, 1.6);
      for (const side of [-1, 1]) cityBox(ctx, waterX + side * 6.4, waterY, .18, .7, depth + .7, .2, CITY_STONE, MAT_TIMBER);
      cityBox(ctx, waterX, waterY - 6.9, .18, width + 1.5, .7, .2, CITY_STONE, MAT_TIMBER);
      citySign(ctx, x + 8.6, y + 7.5, arcade ? CITY_CORAL : CITY_TEAL, 5.8);
      break;
    }
    case "construction":
      for (const side of [-1, 1]) {
        cityBox(ctx, x + side * 7, y + 3, 4, 1, 12, 8, CITY_STONE);
        citySolid(ctx, `frame-${side}`, x + side * 7, y + 3, 1, 12, 8);
      }
      cityBox(ctx, x, y + 3, 8, 15, 12, .4, CITY_STONE);
      cityBox(ctx, x - 7, y + 6, 10, .7, .7, 20, CITY_GOLD, MAT_SIGN);
      cityBox(ctx, x, y + 6, 18, 20, .65, .7, CITY_GOLD, MAT_SIGN);
      cityBox(ctx, x + 8, y + 6, 14, .1, .1, 8, CITY_INK);
      citySolid(ctx, "crane-base", x - 7, y + 6, 1, 1, 20);
      cityParkedCar(ctx, "work-van", x + 5.5, y - 7, CITY_CORAL);
      break;
    case "playground":
      cityBox(ctx, x, y, .05, 16, 16, .05, CITY_TEAL, MAT_ROAD);
      for (const side of [-1, 1]) {
        cityBox(ctx, x + side * 8.4, y, 2.5, .2, .2, 5, CITY_INK);
        cityBox(ctx, x + side * 8.4, y, 4.5, .12, 2, 1.3, CITY_CREAM);
        citySolid(ctx, `court-post-${side}`, x + side * 8.4, y, .25, .25, 5);
      }
      cityBench(ctx, x, y + 9);
      cityTree(ctx, "court-tree", x - 8.5, y - 8.5, .7);
      break;
    case "park": {
      const open = cityGreenAt(x, y);
      for (const [index, [dx, dy]] of [[-7, -6], [6, 7], [-6, 7]].entries()) {
        cityTree(ctx, `green-${index}`, x + dx, y + dy, (open ? 1.05 : .75) + ctx.random() * .18);
      }
      if (!open || (ctx.blockX + ctx.blockY) % 3 === 0) cityBench(ctx, x + 3, y - 6);
      break;
    }
    default: throw new Error(`Unsupported city lot ${lot}`);
  }
  if (!cityGreenAt(x, y) && lot !== "park" && lot !== "construction") cityLight(ctx, x + 10, y + 10);
}
