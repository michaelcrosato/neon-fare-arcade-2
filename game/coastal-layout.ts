import { ROAD_HALF, ROAD_SPACING } from "./config";

/** A continuous shore, independent of rotating procedural lots. */
export const COAST_SHORE_X = -60 * ROAD_SPACING;
export const COAST_DRIVE_X = -56 * ROAD_SPACING;
export const COAST_PROMENADE_EAST_X = COAST_DRIVE_X - ROAD_HALF;
export const COAST_LAND_MIN_BLOCK_X = -60;

export function coastShoreXAt(y: number) {
  return COAST_SHORE_X + 27 * Math.sin(y / 145) + 14 * Math.sin(y / 61);
}

export const COAST_CANALS = [-1872, -1836, -1800].map(x => ({ x, minY: 342, maxY: 504, halfWidth: 4.5, height: 0.24 }));
export const coastCanalBlock = (blockX: number, blockY: number) => blockX >= -53 && blockX <= -50 && blockY >= 9 && blockY <= 13;
export const COAST_PIER = { minX: -2340, maxX: -2052, y: -18, halfWidth: 9, deckHeight: 0.64 } as const;
export const COAST_WHEEL = { x: -2295, y: -18, z: 26, radius: 18 } as const;

export function onCoastPier(x: number, y: number) {
  return x >= COAST_PIER.minX && x <= COAST_PIER.maxX && Math.abs(y - COAST_PIER.y) <= COAST_PIER.halfWidth;
}

export function coastCanalDistance(x: number, y: number) {
  return Math.min(...COAST_CANALS.map(canal => Math.hypot(x - canal.x, Math.max(canal.minY - y, 0, y - canal.maxY))));
}
