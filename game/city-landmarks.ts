import type { LotContext } from "./model";
import type { LandmarkTile } from "./landmarks";
import { MAT_BUILDING, MAT_LAMP, MAT_SIGN } from "./config";
import { observatoryDome } from "./architecture";
import { cityBox, cityCanopy, cityGable, cityHipRoof, citySawtoothRoof, citySolid,
  CITY_CREAM, CITY_GOLD, CITY_INK, CITY_TEAL } from "./city-assets";

/** Architectural crowns and shade structures give the retained city institutions new silhouettes. */
export function finishCityLandmark(ctx: LotContext, tile: LandmarkTile) {
  const x = ctx.centerX, y = ctx.centerY, { tileX, tileY } = tile;
  const roof = (dx: number, dy: number, z: number, width: number, depth: number, rise: number) => {
    cityHipRoof(ctx, x + dx, y + dy, z, width, depth, rise, CITY_TEAL);
    citySolid(ctx, `landmark-roof-${dx}-${dy}`, x + dx, y + dy, width, depth, rise, z);
  };
  switch (tile.definition.style) {
    case "marina-arcade":
    case "ink-market":
      citySawtoothRoof(ctx, x, y - 2.5, 6.9, 19, 10.3, 2.4);
      cityCanopy(ctx, "market-gallery", x, y + 5.1, 17, 3, 4, CITY_TEAL);
      break;
    case "apex-hotel":
      roof(1.5, 2.5, 22.5, 13, 13, 5.5);
      cityBox(ctx, x + 1.5, y + 2.5, 30, .45, .45, 5, CITY_GOLD, MAT_LAMP);
      cityCanopy(ctx, "hotel-portico", x + 1.5, y - 6.1, 10, 4, 4.2, CITY_TEAL);
      break;
    case "south-terminal":
      citySawtoothRoof(ctx, x + 3.5, y + 6.4, 5.8, 15.5, 7.7, 2, 2);
      break;
    case "rooftop-radio":
      roof(-1, 1, 14.4, 17, 15, 2.7);
      ctx.surfaces?.push(...observatoryDome({ x: x + 5.4, y: y + 1.4, z: 23 }, 2.4, CITY_CREAM));
      break;
    case "redline-pier":
      cityGable(ctx, x + 7.3, y - 4.8, 5.3, 6.1, 6.9, 3, CITY_INK);
      break;
    case "pulse-stadium": {
      const cy = y + (tileY === 0 ? -2 : 2);
      cityCanopy(ctx, `stadium-cover-${tileX}-${tileY}`, x, cy, 22, 8.5, 8, tileY ? CITY_TEAL : CITY_CREAM);
      break;
    }
    case "skyport-airport":
      if (tileY === 0 && tileX !== 1) cityGable(ctx, x, y + (tileX ? 1.2 : 3.1), tileX ? 7.4 : 6,
        20.5, tileX ? 17 : 11.3, tileX ? 4.3 : 2.2, CITY_TEAL);
      if (tileY === 1 && tileX === 2) roof(0, 2.5, 13.4, 11, 11, 2.7);
      break;
    case "nova-megamall":
      if (tileY === 0) citySawtoothRoof(ctx, x, y + (tileX ? 1.2 : 3.2), tileX ? 7.2 : 9.2, 19, tileX ? 16.5 : 12, 2.8);
      else if (tileX === 0) roof(0, 0, 15.5, 13.5, 13.5, 6);
      break;
    case "neon-titan":
      if (tileY === 0) {
        roof(7.6, 2.7, 3.8, 6.2, 6.2, 2.6);
        // Faceted head and raised torch complete the civic figure above its terrace.
        cityBox(ctx, x - 2, y + 2.5, 14, 2.5, 2.5, 2.6, CITY_CREAM, MAT_BUILDING);
        cityHipRoof(ctx, x + 4.1, y + 1, 14.5, 2.8, 2.8, 3.4, CITY_GOLD);
      }
      break;
    case "deep-blue-aquarium":
      if (tileY === 0) {
        if (tileX === 0) ctx.surfaces?.push(...observatoryDome({ x, y: y + 3.1, z: 9.7 }, 5.8, CITY_TEAL));
        else for (const dx of [-5.2, 5.2]) roof(dx, 1.5, 6.9, 8.5, 15, 3.3);
      }
      break;
    case "neon-general":
      if (tileX === 0 && tileY === 0) {
        roof(2, 2, 23, 17.5, 15, 4);
        cityBox(ctx, x + 2, y + 2, 28, .6, .6, 3, CITY_GOLD, MAT_SIGN);
      }
      break;
    case "apex-university":
      if (tileY === 0) cityGable(ctx, x, y + (tileX ? 1.5 : 3.1), tileX ? 6.9 : 10.2, 19, tileX ? 16 : 11.8, 4.4, CITY_INK);
      else if (tileX === 1) roof(0, 1, 15.6, 14, 14, 7);
      break;
    case "volt-expo":
      if (tileX !== 1) citySawtoothRoof(ctx, x, y + (tileX ? 1 : 2.8), tileX ? 8.7 : 8.2, 20, tileX ? 16 : 12.5, 3.4);
      break;
    case "starfall-observatory":
      if (tileX) cityBox(ctx, x, y + 1.5, 1.25, 15, 15, 2.5, CITY_CREAM, MAT_BUILDING);
      // The former stacked boxes become true hemispheres with a dark telescope slot.
      ctx.surfaces?.push(...observatoryDome({ x, y: y + (tileX ? 1.5 : 3.2), z: tileX ? 2.5 : 5.9 }, tileX ? 7.5 : 5.4, CITY_CREAM));
      citySolid(ctx, "observatory-shell", x, y + (tileX ? 1.5 : 3.2), tileX ? 13 : 9.5, tileX ? 13 : 9.5, tileX ? 10 : 11.3);
      if (tileX) cityBox(ctx, x + 2.5, y + 1.5, 9.2, 9.5, 1.1, 1.1, CITY_INK, MAT_BUILDING, -.42);
      break;
    case "lucky-88-casino":
      if (tileY === 0) roof(0, tileX ? 1 : 3.1, tileX ? 23 : 8.9, tileX ? 13 : 19, tileX ? 15 : 11.5, tileX ? 7 : 3.6);
      break;
  }
}
