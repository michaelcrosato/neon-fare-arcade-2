import { ROAD_HALF, ROAD_SPACING } from "./config";

/** A continuous shore, independent of rotating procedural lots. */
export const COAST_SHORE_X = -60 * ROAD_SPACING;
export const COAST_DRIVE_X = -56 * ROAD_SPACING;
export const COAST_PROMENADE_EAST_X = COAST_DRIVE_X - ROAD_HALF;
export const COAST_LAND_MIN_BLOCK_X = -60;
