import type { WorldPoint } from "../model";
import type { RoadControlPoint } from "../roads/geometry";
import {
  drapeNorthstarRoad,
  inNorthstarTerrain,
  naturalTerrainHeight,
  northstarRoadHeight,
} from "./northstar-forms";
import { copperNaturalHeight, copperRoadHeight, inCopperTerrain } from "./copper-forms";
import { coastNaturalHeight, coastRoadHeight, inCoastTerrain } from "./coast-forms";
import { cityNaturalHeight, cityRoadHeight, inCityTerrain, drapeCityRoad } from "./city-forms";

/** Dependency-neutral dispatch: road compilation must never import final terrain. */
export function inElevatedTerrain(x: number, y: number) {
  return inCityTerrain(x, y) || inNorthstarTerrain(x, y) || inCopperTerrain(x, y) || inCoastTerrain(x, y);
}

export function roadDesignHeight(x: number, y: number) {
  return inCityTerrain(x, y) ? cityRoadHeight(x, y) : inCoastTerrain(x, y) ? coastRoadHeight(x, y) : inCopperTerrain(x, y) ? copperRoadHeight(x, y) : northstarRoadHeight(x, y);
}

export function naturalWorldHeight(x: number, y: number) {
  return inCityTerrain(x, y) ? cityNaturalHeight(x, y) : inCoastTerrain(x, y) ? coastNaturalHeight(x, y) : inCopperTerrain(x, y) ? copperNaturalHeight(x, y) : naturalTerrainHeight(x, y);
}

export function atRoadElevation<T extends WorldPoint>(point: T): T {
  return inElevatedTerrain(point.x, point.y) ? { ...point, z: roadDesignHeight(point.x, point.y) } : point;
}

export function drapeRegionalRoad(points: readonly RoadControlPoint[]) {
  if (points.every(point => inCityTerrain(point.x, point.y))) return drapeCityRoad(points);
  return drapeNorthstarRoad(points).map(atRoadElevation);
}
