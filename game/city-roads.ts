import { atRoadElevation, drapeRegionalRoad } from "./terrain/region-forms";
import { sampleRoadCurve, type RoadControlPoint } from "./roads/geometry";
import type { RoadPathDefinition } from "./roads/types";

function drive(id: string, name: string, coordinates: readonly (readonly [number, number])[], closed = false): RoadPathDefinition {
  const controls: RoadControlPoint[] = coordinates.map(([x, y]) => ({ x, y }));
  const samples = sampleRoadCurve({ kind: "catmull-rom", points: controls, closed },
    { maxSegmentLength: 12, maxChordError: .08 });
  const points = drapeRegionalRoad(closed ? [...samples, samples[0]] : samples);
  if (closed) points.pop();
  return { id, name, kind: "parkway", halfWidth: 6.3, lanes: 2, travelWeight: .9,
    points, closed, connectGrid: "crossings", junctions: controls.map(atRoadElevation) };
}

export const CITY_ROADS: readonly RoadPathDefinition[] = [
  drive("starfall-drive", "STARFALL SCENIC DRIVE", [
    [-360, -540], [-360, -648], [-288, -720], [-144, -720], [36, -720],
    [144, -684], [144, -612], [72, -576], [0, -576],
  ]),
  drive("commons-greenway", "COMMONS GREENWAY", [
    [-720, -540], [-702, -360], [-684, -180], [-720, 36],
    [-648, 144], [-666, 324], [-576, 432],
  ]),
  drive("skyline-garden-drive", "SKYLINE GARDEN DRIVE", [
    [612, -180], [684, -144], [720, -36], [648, 108], [684, 252], [612, 360],
  ]),
  drive("titan-garden-loop", "TITAN GARDEN LOOP", [
    [0, 540], [96, 612], [96, 702], [0, 756], [-144, 720], [-216, 612], [-144, 540],
  ], true),
];

export const CITY_SCENIC_ROAD_IDS = new Set(CITY_ROADS.map(road => road.id));
