import type { Vec2 } from "./model";
import type { RoadPathDefinition } from "./roads/types";
import { sampleRoadCurve } from "./roads/geometry";

function neighborhoodRoad(id: string, name: string, coordinates: readonly (readonly [number, number])[], closed = false, halfWidth = 7.6): RoadPathDefinition {
  const controls = coordinates.map(([x, y]) => ({ x, y }));
  return { id, name, kind: "parkway", halfWidth, lanes: 2, travelWeight: 1,
    points: sampleRoadCurve({ kind: "catmull-rom", points: controls, closed }, { maxSegmentLength: 9, maxChordError: 0.04 }),
    closed, connectGrid: "crossings", junctions: controls };
}

export const CEDAR_COURTS = [
  { id: "oak-court", name: "OAK COURT", center: { x: 1512, y: -360 }, stem: [[1512, -216], [1512, -288], [1512, -351]] },
  { id: "hawthorn-court", name: "HAWTHORN COURT", center: { x: 2214, y: -540 }, stem: [[2232, -648], [2214, -600], [2214, -549]] },
  { id: "birch-court", name: "BIRCH COURT", center: { x: 1350, y: 540 }, stem: [[1260, 648], [1296, 576], [1341, 540]] },
] as const;

/** The eastern region is organized around collectors, neighborhood loops and courts. */
export const CEDAR_ROADS: readonly RoadPathDefinition[] = [
  neighborhoodRoad("cedar-avenue", "CEDAR AVENUE", [[828, 0], [936, 0], [1080, -36], [1260, -72], [1476, -72], [1656, -72], [1872, -36], [2088, 0], [2268, 0], [2376, 0]], false, 8.2),
  neighborhoodRoad("pine-ridge-loop", "PINE RIDGE LOOP", [[1080, -216], [1044, -432], [1152, -648], [1368, -684], [1584, -612], [1764, -432], [1728, -252], [1512, -216], [1296, -252]], true),
  neighborhoodRoad("bellwether-lane", "BELLWETHER LANE", [[1260, -72], [1224, -180], [1188, -324], [1188, -504], [1260, -540], [1404, -540], [1476, -612], [1584, -612]]),
  neighborhoodRoad("brookside-drive", "BROOKSIDE DRIVE", [[1116, 180], [1116, 432], [1260, 648], [1512, 684], [1800, 576], [1836, 432], [1836, 360], [1656, 252], [1368, 288], [1224, 216]], true),
  neighborhoodRoad("brookside-greenway", "BROOKSIDE GREENWAY", [[1116, 432], [1368, 432], [1548, 396], [1728, 396], [1836, 432]]),
  neighborhoodRoad("garden-end-loop", "GARDEN END LOOP", [[1908, -252], [1872, -468], [2016, -648], [2232, -648], [2304, -432], [2304, -144], [2196, 108], [1980, 108]], true),
  neighborhoodRoad("moonbeam-road", "MOONBEAM ROAD", [[1836, 432], [1944, 576], [2016, 432], [2124, 396], [2160, 396], [2268, 396], [2304, 396], [2376, 432]]),
  ...CEDAR_COURTS.flatMap((court) => [
    neighborhoodRoad(court.id, court.name, court.stem, false, 7),
    { id: `${court.id}-turnaround`, name: `${court.name} TURNAROUND`, kind: "parkway" as const,
      halfWidth: 7, lanes: 2, travelWeight: 1.1, closed: true, connectGrid: "crossings" as const,
      points: Array.from({ length: 32 }, (_, index) => ({ x: court.center.x + Math.cos(index * Math.PI / 16) * 9,
        y: court.center.y + Math.sin(index * Math.PI / 16) * 9 })),
      junctions: [court.stem[court.stem.length - 1]].map(([x, y]) => ({ x, y })) },
  ]),
];

const near = (a: number, b: number) => Math.abs(a - b) < 0.02;
const between = (value: number, a: number, b: number) => value >= a - 0.02 && value <= b + 0.02;
const on72 = (value: number) => Math.abs(value / 72 - Math.round(value / 72)) < 0.001;

/** Short town streets and destination approaches; the rest is served by the loops. */
export function cedarLocalStreetEnabled({ x, y }: Vec2, axis: "vertical" | "horizontal") {
  if (axis === "vertical" && (near(x, 792) || near(x, 2376))) return true;
  if (axis === "horizontal" && (near(y, -792) || near(y, 792))) return true;
  if (x <= 936.02) return axis === "horizontal" || on72(x);
  if (between(x, 1332, 1692) && between(y, -180, 180)) {
    return axis === "vertical" ? on72(x) || near(x, 1332) || near(x, 1692)
      : on72(y) || near(y, -180) || near(y, 180);
  }
  if (axis === "vertical") return (near(x, 1080) && between(y, -216, 180))
    || (near(x, 1116) && between(y, 144, 180))
    || (near(x, 1260) && between(y, -540, -504))
    || (near(x, 1584) && between(y, 396, 504))
    || (near(x, 1656) && between(y, 396, 504))
    || ((near(x, 2052) || near(x, 2088)) && between(y, -72, 0));
  return (near(y, 144) && between(x, 936, 1332))
    || (near(y, -504) && between(x, 1188, 1332))
    || (near(y, 360) && between(x, 936, 1116))
    || (near(y, 432) && between(x, 1548, 1836))
    || (near(y, 0) && between(x, 2052, 2124));
}
