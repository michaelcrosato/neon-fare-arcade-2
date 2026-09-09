import { sampleRoadCurve } from "./roads/geometry";
import type { RoadPathDefinition } from "./roads/types";

function reachRoad(id: string, name: string, coordinates: readonly (readonly [number, number, number?])[],
  closed = false, halfWidth = 7.2): RoadPathDefinition {
  const controls = coordinates.map(([x, y, z]) => ({ x, y, z: z ?? 0 }));
  return { id, name, kind: "parkway", halfWidth, lanes: 2, travelWeight: 0.85,
    points: sampleRoadCurve({ kind: "catmull-rom", points: controls, closed }, { maxSegmentLength: 9, maxChordError: 0.04 })
      .map(point => ({ ...point, z: Math.max(0, point.z ?? 0) })),
    closed, connectGrid: "crossings", junctions: controls };
}

/** Four existing traffic route IDs survive the regional redesign. */
export const REACH_ROADS: readonly RoadPathDefinition[] = [
  reachRoad("cypress-causeway", "PALM REACH BOULEVARD", [[1368, 792], [1368, 936], [1440, 1080], [1656, 1296],
    [1800, 1476], [1872, 1800], [1836, 2124], [1800, 2376], [1728, 2700], [1692, 2952]], false, 8.2),
  reachRoad("lantern-bay-loop", "CALLE LUNA", [[936, 972], [1152, 864], [1512, 900], [1764, 1044],
    [1764, 1188], [1512, 1224], [1224, 1188], [1008, 1116]], true),
  reachRoad("blackwater-trace", "OCEAN RIBBON", [[1764, 1044], [2016, 1152], [2124, 1332], [2160, 1512],
    [2124, 1800], [2124, 2016], [2016, 2268], [1944, 2412], [1836, 2664], [1764, 2916]]),
  reachRoad("stormwall-levee-road", "MIRAGE BAY CAUSEWAY", [[792, 1944], [864, 1944], [972, 1908, 6],
    [1044, 1800, 9], [1188, 1728, 9], [1404, 1728, 6], [1656, 1728], [1872, 1728], [2130, 1728]], false, 8),
  reachRoad("mirage-bay-drive", "MIRAGE BAY DRIVE", [[1800, 1476], [1656, 1512], [1656, 1728], [1692, 1980],
    [1728, 2232], [1800, 2376], [1944, 2232], [1980, 1944], [1980, 1584]], true),
  reachRoad("flamingo-parkway", "FLAMINGO PARKWAY", [[1764, 1188], [1908, 1260], [1980, 1404], [2124, 1332]]),
  reachRoad("moonwater-drive", "MOONWATER DRIVE", [[1800, 2376], [1656, 2484], [1656, 2700], [1656, 2916], [1584, 3024]]),
  reachRoad("sundial-point-loop", "SUNDIAL POINT LOOP", [[1692, 2952], [1584, 3024], [1584, 3132], [1620, 3204],
    [1728, 3204], [1800, 3096], [1764, 2916]], true, 6.4),
];

export const REACH_ROAD_IDS = new Set(REACH_ROADS.map(road => road.id));
