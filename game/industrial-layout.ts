import type { LotKind, VenueKind, WorldPoint } from "./model";
import { coastShoreXAt } from "./coastal-layout";

export const IRONWAKE_BOUNDS = { minX: -2376, maxX: -792, minY: 792, maxY: 2376 } as const;
export const IRONWAKE_SHORE_STEP = 9;

export function inIronwake(x: number, y: number) {
  return x >= -2376 && x < -792 && y > 792 && y <= 2376;
}

/** Reclaimed quays and two finger piers border one continuous western sea. */
export function ironwakeShoreXAt(y: number) {
  if (y < 936) {
    const t = Math.max(0, Math.min(1, (y - 792) / 144));
    return coastShoreXAt(792) * (1 - t) - 2124 * t;
  }
  if (y >= 1188 && y < 1512) return (y >= 1224 && y < 1296) || y >= 1440 ? -2268 : -2016;
  return y >= 1656 && y < 2052 ? -2196 : -2124;
}

export const IRONWAKE_DRYDOCK = { minX: -2112, maxX: -2028, minY: 1728, maxY: 1980 } as const;

export function ironwakeWaterIntervalsAt(y: number) {
  const intervals: { min: number; max: number }[] = [{ min: IRONWAKE_BOUNDS.minX, max: ironwakeShoreXAt(y) }];
  if (y >= IRONWAKE_DRYDOCK.minY && y < IRONWAKE_DRYDOCK.maxY) {
    intervals.push({ min: IRONWAKE_DRYDOCK.minX, max: IRONWAKE_DRYDOCK.maxX });
  }
  return intervals;
}

export function ironwakeIsWater(x: number, y: number) {
  return inIronwake(x, y) && ironwakeWaterIntervalsAt(y).some(span => x < span.max && x >= span.min);
}

type WorksPortal = { tileX: number; tileY: number; kind: VenueKind; x: number; y: number; heading: number };
export type IronwakeAnchor = {
  id: string; label: string; originX: number; originY: number; width: number; height: number;
  lot: LotKind; portal: WorksPortal;
};
const front = (kind: VenueKind, tileX = 0, tileY = 0): WorksPortal =>
  ({ kind, tileX, tileY, x: 0, y: -9.5, heading: -Math.PI / 2 });

export const IRONWAKE_ANCHORS = [
  { id: "ironwake-gate", label: "IRONWAKE GATE", originX: -48, originY: 24, width: 2, height: 2, lot: "works-gate", portal: front("terminal", 1) },
  { id: "vulcan-foundry", label: "VULCAN STEELWORKS", originX: -42, originY: 28, width: 6, height: 5, lot: "works-foundry", portal: front("factory", 2) },
  { id: "ironwake-container-port", label: "IRONWAKE CONTAINER PORT", originX: -63, originY: 33, width: 11, height: 9, lot: "works-port", portal: front("warehouse", 10) },
  { id: "blackline-refinery", label: "BLACKLINE REFINERY", originX: -38, originY: 40, width: 8, height: 7, lot: "works-refinery", portal: front("factory", 3) },
  { id: "leviathan-drydock", label: "LEVIATHAN DRY DOCK", originX: -60, originY: 47, width: 8, height: 9, lot: "works-shipyard", portal: front("warehouse", 6) },
  { id: "magnet-salvage", label: "MAGNET KING SALVAGE", originX: -40, originY: 54, width: 9, height: 7, lot: "works-junkyard", portal: front("garage", 4) },
  { id: "freight-exchange", label: "FREIGHT EXCHANGE", originX: -46, originY: 40, width: 3, height: 3, lot: "works-freight", portal: front("terminal", 1) },
  { id: "shift-change-diner", label: "SHIFT CHANGE DINER", originX: -31, originY: 34, width: 2, height: 1, lot: "works-diner", portal: front("diner") },
  { id: "ironwake-truck-stop", label: "IRONWAKE TRUCK STOP", originX: -26, originY: 45, width: 2, height: 2, lot: "works-truck-stop", portal: front("gas") },
  { id: "breakwater-watch", label: "BREAKWATER WATCH", originX: -58, originY: 61, width: 2, height: 2, lot: "works-watch", portal: front("civic", 1) },
] as const satisfies readonly IronwakeAnchor[];

export function ironwakeAnchorForBlock(blockX: number, blockY: number) {
  for (const definition of IRONWAKE_ANCHORS) {
    const tileX = blockX - definition.originX, tileY = blockY - definition.originY;
    if (tileX >= 0 && tileY >= 0 && tileX < definition.width && tileY < definition.height) return { definition, tileX, tileY };
  }
  return null;
}

export function ironwakeAreaAt(x: number, y: number) {
  if (x < -1836) return y < 1584 ? "TIDAL FREIGHT PORT" : "LEVIATHAN SHIPYARDS";
  if (y >= 1872) return "MAGNET KING BADLANDS";
  if (x > -1440 && y >= 1404) return "BLACKLINE REFINERY";
  return y < 1260 ? "VULCAN WORKS" : "FREIGHT EXCHANGE";
}

const near = (v: number, line: number) => Math.abs(v - line) < 0.02;
const within = (v: number, a: number, b: number) => v >= a - 0.02 && v <= b + 0.02;

/** Freight avenues, anchor perimeter streets and a compact shift-change service strip. */
export function ironwakeGridStreetEnabled({ x, y }: WorldPoint, axis: "vertical" | "horizontal") {
  if (ironwakeIsWater(x, y) || x < -2196 || y < 828 || y > 2304 || x > -828) return false;
  for (const a of IRONWAKE_ANCHORS) {
    const left = a.originX * 36, top = a.originY * 36, right = left + a.width * 36, bottom = top + a.height * 36;
    if (axis === "horizontal" && (near(y, top) || near(y, bottom)) && within(x, left, right)) return true;
    if (axis === "vertical" && (near(x, left) || near(x, right)) && within(y, top, bottom)) return true;
  }
  if (within(x, -1152, -972) && within(y, 1188, 1296)) return true;
  if (axis === "vertical") return [-1872, -1728, -1584, -1440, -1296, -1152, -1008, -864].some(line => near(x, line)) && within(y, 936, 2304);
  return [936, 1008, 1188, 1296, 1440, 1584, 1728, 1872, 1944, 2196, 2304].some(line => near(y, line)) && within(x, -2016, -864);
}

export function ironwakeHasStreet(blockX: number, blockY: number) {
  const x = blockX * 36 + 18, y = blockY * 36 + 18;
  return [{ x, y: y - 18, axis: "horizontal" as const }, { x: x + 18, y, axis: "vertical" as const },
    { x, y: y + 18, axis: "horizontal" as const }, { x: x - 18, y, axis: "vertical" as const }]
    .some(p => ironwakeGridStreetEnabled(p, p.axis));
}
