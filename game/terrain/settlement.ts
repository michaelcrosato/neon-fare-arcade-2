import { northstarGridStreetEnabled, northstarRoadHeight, inNorthstarTerrain } from "./northstar-forms";
import { copperGridStreetEnabled, copperRoadHeight, inCopperTerrain } from "./copper-forms";
import { coastGridStreetEnabled, coastRoadHeight, inCoastTerrain } from "./coast-forms";
import { cityRoadHeight, inCityTerrain } from "./city-forms";
import { cityGreenAt } from "../city-layout";
import { landmarkTileForBlock } from "../landmarks";
import { blockRandom } from "../math";

/** Flat building plots follow their service lane; wilderness remains unoccupied. */
export function northstarSettlementPlan(blockX: number, blockY: number) {
  const x = blockX * 36 + 18, y = blockY * 36 + 18;
  if (!inNorthstarTerrain(x, y)) return null;
  const sides = [
    { x, y: y - 18, axis: "horizontal" as const },
    { x: x + 18, y, axis: "vertical" as const },
    { x, y: y + 18, axis: "horizontal" as const },
    { x: x - 18, y, axis: "vertical" as const },
  ];
  const orientation = sides.findIndex((point) => northstarGridStreetEnabled(point, point.axis));
  return orientation < 0 ? null : { x, y, floor: northstarRoadHeight(x, y), orientation };
}

export function copperSettlementPlan(blockX: number, blockY: number) {
  const x = blockX * 36 + 18, y = blockY * 36 + 18;
  if (!inCopperTerrain(x, y)) return null;
  const sides = [
    { x, y: y - 18, axis: "horizontal" as const },
    { x: x + 18, y, axis: "vertical" as const },
    { x, y: y + 18, axis: "horizontal" as const },
    { x: x - 18, y, axis: "vertical" as const },
  ];
  const orientation = sides.findIndex((point) => copperGridStreetEnabled(point, point.axis));
  return orientation < 0 ? null : { x, y, floor: copperRoadHeight(x, y), orientation };
}

export function regionalSettlementPlan(blockX: number, blockY: number) {
  return northstarSettlementPlan(blockX, blockY) ?? copperSettlementPlan(blockX, blockY) ?? coastSettlementPlan(blockX, blockY) ?? citySettlementPlan(blockX, blockY);
}

export function citySettlementPlan(blockX: number, blockY: number) {
  const x = blockX * 36 + 18, y = blockY * 36 + 18;
  if (!inCityTerrain(x, y)) return null;
  const landmark = landmarkTileForBlock(blockX, blockY);
  if (!landmark && cityGreenAt(x, y)) return null;
  const orientation = landmark?.definition.orientation ?? Math.floor(blockRandom(blockX, blockY, 0x0a71e)() * 4);
  const front = [{ x, y: y - 18 }, { x: x + 18, y }, { x, y: y + 18 }, { x: x - 18, y }][orientation];
  return { x, y, orientation, floor: cityRoadHeight(landmark ? x : front.x, landmark ? y : front.y) };
}

export function coastSettlementPlan(blockX: number, blockY: number) {
  const x = blockX * 36 + 18, y = blockY * 36 + 18;
  if (!inCoastTerrain(x, y) || x < -2016) return null;
  const sides = [{ x, y: y - 18, axis: "horizontal" as const }, { x: x + 18, y, axis: "vertical" as const },
    { x, y: y + 18, axis: "horizontal" as const }, { x: x - 18, y, axis: "vertical" as const }];
  const orientation = sides.findIndex((point) => coastGridStreetEnabled(point, point.axis));
  return orientation < 0 ? null : { x, y, floor: coastRoadHeight(x, y), orientation };
}
