import type { WorldPoint } from "../model";
import type { RoadControlPoint } from "../roads/geometry";
import {
  drapeNorthstarRoad,
  inNorthstarTerrain,
  naturalTerrainHeight,
  northstarRoadHeight,
} from "./northstar-forms";
import { copperNaturalHeight, copperRoadHeight, inCopperTerrain } from "./copper-forms";

/** Dependency-neutral dispatch: road compilation must never import final terrain. */
export function inElevatedTerrain(x: number, y: number) {
  return inNorthstarTerrain(x, y) || inCopperTerrain(x, y);
}

export function roadDesignHeight(x: number, y: number) {
  return inCopperTerrain(x, y) ? copperRoadHeight(x, y) : northstarRoadHeight(x, y);
}

export function naturalWorldHeight(x: number, y: number) {
  return inCopperTerrain(x, y) ? copperNaturalHeight(x, y) : naturalTerrainHeight(x, y);
}

export function atRoadElevation<T extends WorldPoint>(point: T): T {
  return inElevatedTerrain(point.x, point.y) ? { ...point, z: roadDesignHeight(point.x, point.y) } : point;
}

export function drapeRegionalRoad(points: readonly RoadControlPoint[]) {
  return drapeNorthstarRoad(points).map(atRoadElevation);
}
