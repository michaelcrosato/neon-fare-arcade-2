import { northstarGridStreetEnabled, northstarRoadHeight, inNorthstarTerrain } from "./northstar-forms";

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
