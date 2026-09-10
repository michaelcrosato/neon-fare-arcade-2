import { CITY_LANDMARKS } from "./landmarks";
import type { WorldPoint } from "./model";

export const CITY_LIMIT = 792;
export const CITY_GREENS = [
  { id: "starfall-park", name: "STARFALL HEIGHTS", minX: -324, maxX: 180, minY: -756, maxY: -576 },
  { id: "commons-greenway", name: "WEST COMMONS", minX: -756, maxX: -576, minY: -540, maxY: 432 },
  { id: "skyline-gardens", name: "SKYLINE GARDENS", minX: 612, maxX: 756, minY: -180, maxY: 360 },
  { id: "titan-gardens", name: "TITAN GARDENS", minX: -252, maxX: 144, minY: 540, maxY: 756 },
] as const;

export function cityGreenAt(x: number, y: number) {
  return CITY_GREENS.find(green => x > green.minX + .02 && x < green.maxX - .02
    && y > green.minY + .02 && y < green.maxY - .02) ?? null;
}

/** Most of the lattice remains; destinations and the four gateways keep access. */
export function cityGridStreetEnabled({ x, y }: WorldPoint, axis: "vertical" | "horizontal") {
  const green = cityGreenAt(x, y);
  if (!green) return true;
  if (axis === "vertical" && Math.abs(x) < .02) return true;
  if (green.id === "starfall-park" && axis === "horizontal" && Math.abs(y + 648) < .02) return true;
  for (const landmark of CITY_LANDMARKS) {
    const left = landmark.originX * 36, right = (landmark.originX + landmark.width) * 36;
    const top = landmark.originY * 36, bottom = (landmark.originY + landmark.height) * 36;
    if (axis === "vertical" && (Math.abs(x - left) < .02 || Math.abs(x - right) < .02)
      && y >= top - .02 && y <= bottom + .02) return true;
    if (axis === "horizontal" && (Math.abs(y - top) < .02 || Math.abs(y - bottom) < .02)
      && x >= left - .02 && x <= right + .02) return true;
  }
  return false;
}

export function cityAreaAt(x: number, y: number) {
  const green = cityGreenAt(x, y);
  if (green) return green.name;
  if (y < -396 && x < 216) return "STARFALL HEIGHTS";
  if (y < -180 && x >= 216) return "REDLINE WORKS";
  if (x < -252 && y > -180) return "INK QUARTER";
  if (x > 288 && y > 324) return "REDLINE HARBOR";
  if (y > 180 && x < 252) return "TITAN RISE";
  return "NEON CORE";
}
