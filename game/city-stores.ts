import type { LotContext } from "./model";
import { BRANDS, type StoreId } from "./brands";
import { MAT_SIGN, MAT_WINDOW } from "./config";
import { cityBox, cityShell, citySolid, CITY_CREAM, CITY_GLASS, CITY_INK, CITY_STONE } from "./city-assets";
import { brandSign } from "./render/brand-signs";

/** Broad, low retail boxes with a full-width branded fascia and a clear forecourt. */
export function buildBigBoxStore(ctx: LotContext, id: StoreId) {
  const x = ctx.centerX, y = ctx.centerY, brand = BRANDS[id];
  cityShell(ctx, `store-${id}`, x, y + 4.5, 22, 12.4, 7.8, id === "cost-go" ? CITY_STONE : brand.color);
  cityBox(ctx, x, y + 4.5, 8, 22.5, 12.9, .5, CITY_CREAM);
  cityBox(ctx, x, y - 1.78, 2, 20.4, .1, 3.4, CITY_GLASS, MAT_WINDOW);
  for (const offset of [-7.1, 0, 7.1]) {
    cityBox(ctx, x + offset, y - 1.86, 1.65, 2.5, .1, 3.2, CITY_INK);
    cityBox(ctx, x + offset, y - 1.93, 1.65, 2.2, .04, 2.9, CITY_GLASS, MAT_WINDOW);
  }
  brandSign(ctx, id, x, y - 1.92, 5.6, 20.5);
  for (const offset of [-7, -3.5, 3.5, 7]) cityBox(ctx, x + offset, y - 7.2, .035, .13, 5.4, .03, CITY_CREAM, MAT_SIGN);
  // Cart corral and warehouse roof plant give the chains a recognisable store silhouette.
  for (const side of [-1, 1]) cityBox(ctx, x + 9 + side * .65, y - 7.1, .7, .12, 3, 1.3, CITY_STONE);
  citySolid(ctx, "cart-corral", x + 9, y - 7.1, 1.5, 3, 1.3);
  for (const offset of [-5, 5]) { cityBox(ctx, x + offset, y + 6.5, 8.7, 3.2, 2.3, 1, CITY_STONE); cityBox(ctx, x + offset, y + 6.5, 9.25, 2.7, 1.8, .12, CITY_INK); }
}
