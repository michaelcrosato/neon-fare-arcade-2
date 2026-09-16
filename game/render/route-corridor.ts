import { DISPLAY_METERS_PER_WORLD_UNIT } from "../config";
import type { Box } from "../model";
import type { NavigationSettings } from "../navigation-policy";

/** Dots and columns together keep the existing route's actor budget. */
export const ROUTE_GUIDE_BUDGET = 120;

/** Extrude each existing lane dash vertically, preserving its exact XY footprint. */
export function routeCorridorBoxes(dashes: readonly Box[], settings: Readonly<NavigationSettings>): Box[] {
  const height = settings.corridorHeightMeters / DISPLAY_METERS_PER_WORLD_UNIT;
  return dashes.map(dash => ({
    ...dash,
    z: dash.z + height / 2,
    screenLift: undefined,
    sz: height,
    pitch: 0,
    tilt: 0,
    color: [dash.color[0], dash.color[1], dash.color[2], settings.corridorOpacity],
  }));
}
