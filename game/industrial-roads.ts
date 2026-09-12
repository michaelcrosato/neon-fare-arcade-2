import { sampleRoadCurve } from "./roads/geometry";
import type { RoadPathDefinition } from "./roads/types";
import { atRoadElevation } from "./terrain/region-forms";

function freightRoad(id: string, name: string, coords: readonly (readonly [number, number])[], closed = false, halfWidth = 8): RoadPathDefinition {
  const controls = coords.map(([x, y]) => ({ x, y }));
  return { id, name, kind: "boulevard", halfWidth, lanes: 2, travelWeight: 0.8, closed,
    points: sampleRoadCurve({ kind: "catmull-rom", points: controls, closed }, { maxSegmentLength: 9, maxChordError: 0.04 }).map(atRoadElevation),
    junctions: controls.map(atRoadElevation), connectGrid: "crossings" };
}

export const IRONWAKE_ROADS: readonly RoadPathDefinition[] = [
  freightRoad("ironwake-freightway", "IRONWAKE FREIGHTWAY", [[-1728, 576], [-1728, 720], [-1728, 792], [-1728, 936],
    [-1656, 1188], [-1728, 1296], [-1728, 1584], [-1728, 1872], [-1656, 2088], [-1584, 2196], [-1728, 2304]], false, 8.5),
  freightRoad("copper-freight-link", "COPPER FREIGHT LINK", [[-612, 1368], [-720, 1368], [-792, 1368], [-936, 1368],
    [-1008, 1296], [-1152, 1296], [-1440, 1296], [-1728, 1296], [-1872, 1296]], false, 8.5),
  freightRoad("ironwake-quay-road", "QUAYSIDE HEAVY HAUL", [[-1728, 936], [-1944, 1008], [-2016, 1080], [-1944, 1152],
    [-1872, 1188], [-1872, 1296], [-1872, 1584], [-1872, 1872], [-1872, 2088], [-1944, 2160], [-2016, 2196]], false, 8),
  freightRoad("magnet-king-loop", "MAGNET KING LOOP", [[-1728, 1872], [-1584, 1872], [-1512, 1944], [-1512, 2196],
    [-1440, 2268], [-1152, 2268], [-1008, 2196], [-1008, 1944], [-1152, 1800], [-1440, 1800]], true, 7),
  freightRoad("breakwater-road", "BREAKWATER ROAD", [[-1872, 2088], [-1872, 2304], [-2016, 2304], [-2088, 2268], [-2088, 2196]], false, 6.2),
];
export const IRONWAKE_ROAD_IDS = new Set(IRONWAKE_ROADS.map(road => road.id));
