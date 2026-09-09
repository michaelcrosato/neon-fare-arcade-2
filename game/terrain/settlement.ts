import { northstarGridStreetEnabled, northstarRoadHeight, inNorthstarTerrain } from "./northstar-forms";
import { copperGridStreetEnabled, copperRoadHeight, inCopperTerrain } from "./copper-forms";
import { coastGridStreetEnabled, coastRoadHeight, inCoastTerrain } from "./coast-forms";

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
  return northstarSettlementPlan(blockX, blockY) ?? copperSettlementPlan(blockX, blockY) ?? coastSettlementPlan(blockX, blockY);
}

export function coastSettlementPlan(blockX: number, blockY: number) {
  const x = blockX * 36 + 18, y = blockY * 36 + 18;
  if (!inCoastTerrain(x, y) || x < -2016) return null;
  const sides = [{ x, y: y - 18, axis: "horizontal" as const }, { x: x + 18, y, axis: "vertical" as const },
    { x, y: y + 18, axis: "horizontal" as const }, { x: x - 18, y, axis: "vertical" as const }];
  const orientation = sides.findIndex((point) => coastGridStreetEnabled(point, point.axis));
  return orientation < 0 ? null : { x, y, floor: coastRoadHeight(x, y), orientation };
}
