import type { Vec2 } from "./model";
import { sampleRoadCurve, roadDistance, type RoadControlPoint } from "./roads/geometry";
import { atRoadElevation, drapeRegionalRoad, inElevatedTerrain } from "./terrain/region-forms";
import { CEDAR_ROADS } from "./cedar-layout";

import type { RoadPathDefinition } from "./roads/types";
export type { RoadKind, GridConnectionMode, RoadPathDefinition } from "./roads/types";

export type RoundaboutDefinition = {
  id: string;
  center: Vec2;
  radius: number;
  islandHalfSize: number;
};

const point = (x: number, y: number, z?: number): RoadControlPoint => z === undefined ? { x, y } : { x, y, z };

function samePoint(a: RoadControlPoint, b: RoadControlPoint) {
  return roadDistance(a, b) < 0.01;
}

function catmullRomPath(controls: readonly RoadControlPoint[], closed = false, targetSpacing = 15) {
  const samples = sampleRoadCurve({ kind: "catmull-rom", points: controls, closed },
    { maxSegmentLength: targetSpacing, maxChordError: 0.08 });
  if (!controls.some((point) => inElevatedTerrain(point.x, point.y))) return samples;
  const lifted = drapeRegionalRoad(closed ? [...samples, samples[0]] : samples);
  if (closed) lifted.pop();
  return lifted;
}

function rampPath(start: RoadControlPoint, controlA: RoadControlPoint, controlB: RoadControlPoint, end: RoadControlPoint) {
  // De Casteljau preserves the interchange's XY curve while a flat merge apron
  // keeps the climbing lane clear of the beltway underside before it joins.
  const mix = (a: RoadControlPoint, b: RoadControlPoint): RoadControlPoint => ({ x: a.x + (b.x - a.x) * 0.35, y: a.y + (b.y - a.y) * 0.35 });
  const q0 = mix(start, controlA), q1 = mix(controlA, controlB), q2 = mix(controlB, end);
  const r0 = mix(q0, q1), r1 = mix(q1, q2), join = mix(r0, r1);
  const upper = (p: RoadControlPoint) => ({ ...p, z: BELTWAY_ELEVATION });
  return sampleRoadCurve({ kind: "bezier", points: [upper(start), upper(q0), upper(r0), upper(join), upper(r1), { ...q2, z: 0 }, { ...end, z: 0 }] },
    { maxSegmentLength: 8, maxChordError: 0.06 });
}

function roundaboutPath(center: Vec2, radius: number, segments = 20) {
  // Decreasing angles make the legal circulation match right-hand traffic in
  // the game's +Y-south coordinate system.
  return Array.from({ length: segments }, (_, index) => {
    const angle = -(index / segments) * Math.PI * 2;
    return point(
      center.x + Math.cos(angle) * radius,
      center.y + Math.sin(angle) * radius,
    );
  });
}

const auroraControls = [
  point(-648, -432), point(-504, -324), point(-360, -252),
  point(-216, -144), point(-72, -108), point(72, -108),
  point(216, 36), point(360, 252), point(504, 324), point(648, 432),
] as const;

const crosstownControls = [
  point(-648, 396), point(-504, 324), point(-360, 252),
  point(-216, 180), point(-108, 36), point(72, -72),
  point(252, -72), point(288, -288), point(504, -324), point(648, -396),
] as const;

const harborControls = [
  point(-684, 468), point(-540, 432), point(-396, 396),
  point(-216, 432), point(-36, 504), point(144, 540),
  point(324, 504), point(504, 432), point(684, 468),
] as const;

export const BELTWAY_ELEVATION = 8;
const beltwayControls = [
  point(0, -576), point(324, -540), point(504, -396),
  point(576, -72), point(576, 72), point(504, 396),
  point(324, 540), point(0, 576), point(-324, 540),
  point(-504, 396), point(-576, 72), point(-576, -72),
  point(-504, -396), point(-324, -540),
].map((control) => ({ ...control, z: BELTWAY_ELEVATION }));

const northstarHighwayControls = [
  point(0, -792), point(0, -864), point(72, -972), point(216, -1008),
  point(432, -1080), point(396, -1224), point(216, -1296), point(144, -1404),
  point(144, -1512), point(72, -1620), point(0, -1728), point(-144, -1872),
  point(-36, -1980), point(-36, -2124), point(-36, -2160),
] as const;

const pinehookLoopControls = [
  point(-144, -1404), point(-288, -1404), point(-468, -1440), point(-576, -1512),
  point(-648, -1620), point(-648, -1746), point(-612, -1836), point(-468, -1908),
  point(-324, -1872), point(-324, -1764), point(-360, -1620), point(-252, -1512),
  point(-144, -1476), point(-108, -1458), point(-108, -1422),
] as const;

const mirrorLakeRoadControls = [
  point(360, -1728), point(612, -1728), point(684, -1872),
  point(612, -2016), point(360, -2016), point(288, -1872),
] as const;

const silverRunControls = [
  point(-36, -1980), point(252, -1980), point(360, -2016), point(432, -2034),
  point(468, -2052), point(468, -2088), point(432, -2106), point(252, -2124),
  point(144, -2142), point(90, -2160), point(72, -2180), point(90, -2200), point(144, -2214),
  point(252, -2232), point(432, -2232), point(486, -2250), point(516, -2268),
  point(516, -2304), point(480, -2322), point(324, -2322), point(216, -2304),
  point(72, -2322), point(-144, -2322), point(-216, -2250), point(-216, -2196),
  point(-144, -2160), point(-36, -2160),
] as const;

const gorgeViaductControls = [
  point(-324, -1764), point(-216, -1782), point(-108, -1782), point(0, -1764),
  point(144, -1764), point(288, -1728), point(360, -1728),
] as const;

const sundownHighwayControls = [
  point(0, 828), point(0, 900), point(-36, 972), point(-216, 1116),
  point(-432, 1224), point(-468, 1368), point(-432, 1476), point(-252, 1548),
  point(-36, 1692), point(108, 1800), point(252, 1872), point(360, 1944),
  point(396, 2052), point(360, 2160), point(180, 2268), point(36, 2340), point(-144, 2304),
] as const;

const copperLoopControls = [
  point(-180, 1296), point(-396, 1260), point(-612, 1368), point(-684, 1512),
  point(-612, 1620), point(-540, 1728), point(-324, 1728), point(-144, 1584), point(-108, 1404),
] as const;

const arroyoRoadControls = [
  point(252, 1368), point(468, 1296), point(684, 1404), point(720, 1584),
  point(576, 1764), point(360, 1800), point(216, 1656), point(180, 1476),
] as const;

const paintedCanyonControls = [
  point(108, 1800), point(-72, 1836), point(-252, 1908), point(-432, 1980),
  point(-468, 2160), point(-360, 2268), point(-144, 2304), point(72, 2268),
  point(252, 2268), point(468, 2304), point(612, 2196), point(648, 1980),
  point(540, 1836), point(360, 1800),
] as const;

const saguaroTrailControls = [
  point(-36, 972), point(144, 1008), point(324, 1080), point(468, 1098),
  point(576, 1098), point(684, 1224), point(684, 1368), point(684, 1404),
] as const;

const cinderConeControls = [
  point(-216, 1116), point(-396, 1008), point(-576, 1008),
  point(-684, 1152), point(-648, 1296), point(-612, 1368),
] as const;

const canyonRimControls = [
  point(-468, 2160), point(-360, 2232), point(-216, 2232), point(-72, 2232),
  point(72, 2160), point(180, 2052), point(360, 1944),
] as const;

const cypressCausewayControls = [
  point(1368, 792), point(1368, 900), point(1440, 1008),
  point(1512, 1116), point(1440, 1224), point(1512, 1332),
  point(1584, 1440), point(1656, 1512),
] as const;

const lanternBayLoopControls = [
  point(1152, 1188), point(1368, 1116), point(1584, 1188),
  point(1692, 1368), point(1656, 1584), point(1476, 1692),
  point(1260, 1656), point(1116, 1476),
] as const;

const blackwaterTraceControls = [
  point(1728, 1116), point(1908, 1008), point(2160, 1080),
  point(2304, 1260), point(2268, 1476), point(2088, 1620),
  point(1872, 1584), point(1764, 1404),
] as const;

const stormwallLeveeControls = [
  point(792, 1728), point(972, 1728), point(1152, 1800),
  point(1368, 1872), point(1584, 1944), point(1800, 2052),
  point(2016, 2124), point(2196, 2232), point(2304, 2304),
] as const;

const pacificDriveControls = [point(-1980, -684), point(-2032, -540), point(-1998, -330), point(-2016, -144),
  point(-2016, 0), point(-2016, 180), point(-1998, 360), point(-2016, 540), point(-1944, 648)] as const;
const sunsetBoulevardControls = [point(-828, 0), point(-936, 0), point(-1116, -18), point(-1296, -108),
  point(-1476, -54), point(-1656, 0), point(-1836, 0), point(-2016, 0)] as const;
const citrusScenicControls = [point(-1980, -684), point(-1836, -720), point(-1620, -666), point(-1476, -720),
  point(-1260, -684), point(-1134, -540), point(-1260, -432), point(-1476, -468), point(-1656, -396), point(-1854, -468), point(-1872, -612)] as const;
const mariposaDriveControls = [point(-1944, 648), point(-1728, 576), point(-1512, 612), point(-1332, 576),
  point(-1152, 648), point(-1008, 576), point(-828, 576)] as const;
const palisadesControls = [point(-1998, -330), point(-1912, -366), point(-1764, -336), point(-1692, -216), point(-1656, 0)] as const;
const laurelCanyonControls = [point(-1116, -18), point(-1026, -180), point(-1170, -270), point(-1300, -288),
  point(-1260, -378), point(-1134, -432), point(-1134, -540)] as const;
const canalCruiseControls = [point(-1998, 360), point(-1908, 324), point(-1764, 288), point(-1620, 288),
  point(-1584, 432), point(-1728, 540), point(-1872, 504), point(-1836, 432), point(-1998, 396)] as const;

export const ROUNDABOUTS: readonly RoundaboutDefinition[] = [
  { id: "apex-circle", center: point(216, -216), radius: 18, islandHalfSize: 8.2 },
  { id: "market-circle", center: point(-360, 288), radius: 18, islandHalfSize: 8.2 },
];

const ramp = (
  id: string,
  name: string,
  start: RoadControlPoint,
  controlA: RoadControlPoint,
  controlB: RoadControlPoint,
  end: RoadControlPoint,
): RoadPathDefinition => ({
  id,
  name,
  kind: "ramp",
  halfWidth: 5.1,
  lanes: 2,
  travelWeight: 0.78,
  points: rampPath(start, controlA, controlB, end),
  connectGrid: "explicit",
  junctions: [{ ...start, z: BELTWAY_ELEVATION }, { ...end, z: 0 }],
});

export const SPECIAL_ROADS: readonly RoadPathDefinition[] = [
  ...CEDAR_ROADS,
  {
    id: "aurora-boulevard",
    name: "AURORA BOULEVARD",
    kind: "boulevard",
    halfWidth: 9,
    lanes: 4,
    travelWeight: 0.82,
    points: catmullRomPath(auroraControls),
    connectGrid: "crossings",
    junctions: auroraControls,
  },
  {
    id: "crosstown-boulevard",
    name: "CROSSTOWN BOULEVARD",
    kind: "boulevard",
    halfWidth: 8.5,
    lanes: 4,
    travelWeight: 0.84,
    points: catmullRomPath(crosstownControls),
    connectGrid: "crossings",
    junctions: crosstownControls,
  },
  {
    id: "harbor-parkway",
    name: "HARBOR PARKWAY",
    kind: "parkway",
    halfWidth: 7,
    lanes: 2,
    travelWeight: 0.86,
    points: catmullRomPath(harborControls),
    connectGrid: "crossings",
    junctions: harborControls,
  },
  {
    id: "neon-beltway",
    name: "NEON BELTWAY",
    kind: "highway",
    halfWidth: 10.5,
    lanes: 4,
    travelWeight: 0.68,
    points: catmullRomPath(beltwayControls, true, 17),
    closed: true,
    connectGrid: "explicit",
    junctions: beltwayControls,
  },
  {
    id: "northstar-highway",
    name: "NORTHSTAR HIGHWAY",
    kind: "parkway",
    halfWidth: 7,
    lanes: 2,
    travelWeight: 0.74,
    points: catmullRomPath(northstarHighwayControls, false, 12),
    connectGrid: "crossings",
    junctions: northstarHighwayControls.map(atRoadElevation),
  },
  {
    id: "pinehook-loop",
    name: "PINEHOOK LOOP",
    kind: "parkway",
    halfWidth: 6.2,
    lanes: 2,
    travelWeight: 0.82,
    points: catmullRomPath(pinehookLoopControls, true, 12),
    closed: true,
    connectGrid: "crossings",
    junctions: pinehookLoopControls.map(atRoadElevation),
  },
  {
    id: "mirror-lake-road",
    name: "MIRROR LAKE ROAD",
    kind: "parkway",
    halfWidth: 6.2,
    lanes: 2,
    travelWeight: 0.82,
    points: catmullRomPath(mirrorLakeRoadControls, true, 12),
    closed: true,
    connectGrid: "crossings",
    junctions: mirrorLakeRoadControls.map(atRoadElevation),
  },
  {
    id: "silver-run-switchbacks",
    name: "SILVER RUN SWITCHBACKS",
    kind: "parkway",
    halfWidth: 6,
    lanes: 2,
    travelWeight: 0.86,
    points: catmullRomPath(silverRunControls, false, 10),
    connectGrid: "crossings",
    junctions: silverRunControls.map(atRoadElevation),
  },
  {
    id: "spruce-gorge-viaduct",
    name: "SPRUCE GORGE VIADUCT",
    kind: "parkway",
    halfWidth: 6.8,
    lanes: 2,
    travelWeight: 0.8,
    points: catmullRomPath(gorgeViaductControls, false, 10),
    connectGrid: "crossings",
    junctions: gorgeViaductControls.map(atRoadElevation),
  },
  {
    id: "sundown-highway",
    name: "SUNDOWN HIGHWAY",
    kind: "parkway",
    halfWidth: 7,
    lanes: 2,
    travelWeight: 0.74,
    points: catmullRomPath(sundownHighwayControls, false, 12),
    connectGrid: "crossings",
    junctions: sundownHighwayControls.map(atRoadElevation),
  },
  {
    id: "copper-loop",
    name: "COPPER LOOP",
    kind: "parkway",
    halfWidth: 6.2,
    lanes: 2,
    travelWeight: 0.82,
    points: catmullRomPath(copperLoopControls, true, 12),
    closed: true,
    connectGrid: "crossings",
    junctions: copperLoopControls.map(atRoadElevation),
  },
  {
    id: "arroyo-road",
    name: "ARROYO ROAD",
    kind: "parkway",
    halfWidth: 6.2,
    lanes: 2,
    travelWeight: 0.82,
    points: catmullRomPath(arroyoRoadControls, true, 12),
    closed: true,
    connectGrid: "crossings",
    junctions: arroyoRoadControls.map(atRoadElevation),
  },
  {
    id: "painted-canyon-drive",
    name: "PAINTED CANYON SCENIC DRIVE",
    kind: "parkway",
    halfWidth: 6,
    lanes: 2,
    travelWeight: 0.86,
    points: catmullRomPath(paintedCanyonControls, false, 10),
    connectGrid: "crossings",
    junctions: paintedCanyonControls.map(atRoadElevation),
  },
  {
    id: "saguaro-trail", name: "SAGUARO TRAIL", kind: "parkway", halfWidth: 6, lanes: 2,
    travelWeight: 0.86, points: catmullRomPath(saguaroTrailControls, false, 12),
    connectGrid: "crossings", junctions: saguaroTrailControls.map(atRoadElevation),
  },
  {
    id: "cinder-cone-loop", name: "CINDER CONE LOOP", kind: "parkway", halfWidth: 5.6, lanes: 2,
    travelWeight: 0.94, points: catmullRomPath(cinderConeControls, false, 10),
    connectGrid: "crossings", junctions: cinderConeControls.map(atRoadElevation),
  },
  {
    id: "canyon-rim-road", name: "CANYON RIM ROAD", kind: "parkway", halfWidth: 5.8, lanes: 2,
    travelWeight: 0.92, points: catmullRomPath(canyonRimControls, false, 10),
    connectGrid: "crossings", junctions: canyonRimControls.map(atRoadElevation),
  },
  {
    id: "cypress-causeway",
    name: "CYPRESS CAUSEWAY",
    kind: "parkway",
    halfWidth: 7,
    lanes: 2,
    travelWeight: 0.76,
    points: catmullRomPath(cypressCausewayControls, false, 11),
    connectGrid: "crossings",
    junctions: cypressCausewayControls,
  },
  {
    id: "lantern-bay-loop",
    name: "LANTERN BAY LOOP",
    kind: "parkway",
    halfWidth: 6.4,
    lanes: 2,
    travelWeight: 0.82,
    points: catmullRomPath(lanternBayLoopControls, true, 11),
    closed: true,
    connectGrid: "crossings",
    junctions: lanternBayLoopControls,
  },
  {
    id: "blackwater-trace",
    name: "BLACKWATER TRACE",
    kind: "parkway",
    halfWidth: 6.1,
    lanes: 2,
    travelWeight: 0.86,
    points: catmullRomPath(blackwaterTraceControls, true, 10),
    closed: true,
    connectGrid: "crossings",
    junctions: blackwaterTraceControls,
  },
  {
    id: "stormwall-levee-road",
    name: "STORMWALL LEVEE ROAD",
    kind: "parkway",
    halfWidth: 6.6,
    lanes: 2,
    travelWeight: 0.8,
    points: catmullRomPath(stormwallLeveeControls, false, 11),
    connectGrid: "crossings",
    junctions: stormwallLeveeControls,
  },
  {
    id: "pacific-coast-drive", name: "PACIFIC COAST DRIVE", kind: "parkway",
    halfWidth: 6, lanes: 2, travelWeight: 0.8,
    points: catmullRomPath(pacificDriveControls, false, 12),
    connectGrid: "crossings", junctions: pacificDriveControls.map(atRoadElevation),
  },
  {
    id: "sunset-boulevard", name: "SUNSET BOULEVARD", kind: "parkway",
    halfWidth: 7, lanes: 2, travelWeight: 0.76,
    points: catmullRomPath(sunsetBoulevardControls, false, 12),
    connectGrid: "crossings", junctions: sunsetBoulevardControls.map(atRoadElevation),
  },
  {
    id: "citrus-scenic-loop", name: "CITRUS SCENIC LOOP", kind: "parkway",
    halfWidth: 6, lanes: 2, travelWeight: 0.86,
    points: catmullRomPath(citrusScenicControls, true, 12), closed: true,
    connectGrid: "crossings", junctions: citrusScenicControls.map(atRoadElevation),
  },
  {
    id: "mariposa-drive", name: "MARIPOSA DRIVE", kind: "parkway",
    halfWidth: 6, lanes: 2, travelWeight: 0.84,
    points: catmullRomPath(mariposaDriveControls, false, 12),
    connectGrid: "crossings", junctions: mariposaDriveControls.map(atRoadElevation),
  },
  {
    id: "palisades-overlook-drive", name: "PALISADES OVERLOOK DRIVE", kind: "parkway",
    halfWidth: 6.4, lanes: 2, travelWeight: 0.92,
    points: catmullRomPath(palisadesControls, false, 10),
    connectGrid: "crossings", junctions: palisadesControls.map(atRoadElevation),
  },
  {
    id: "laurel-canyon-run", name: "LAUREL CANYON RUN", kind: "parkway",
    halfWidth: 6.5, lanes: 2, travelWeight: 0.9,
    points: catmullRomPath(laurelCanyonControls, false, 9),
    connectGrid: "crossings", junctions: laurelCanyonControls.map(atRoadElevation),
  },
  {
    id: "canal-cruise", name: "CANAL CRUISE", kind: "parkway",
    halfWidth: 6, lanes: 2, travelWeight: 0.95,
    points: catmullRomPath(canalCruiseControls, true, 10), closed: true,
    connectGrid: "crossings", junctions: canalCruiseControls.map(atRoadElevation),
  },
  ramp(
    "northwest-inner-ramp", "NORTHWEST INTERCHANGE",
    point(-504, -396), point(-468, -378), point(-468, -342), point(-504, -324),
  ),
  ramp(
    "northwest-outer-ramp", "NORTHWEST INTERCHANGE",
    point(-504, -396), point(-576, -378), point(-576, -342), point(-504, -324),
  ),
  ramp(
    "northeast-inner-ramp", "NORTHEAST INTERCHANGE",
    point(504, -396), point(468, -378), point(468, -342), point(504, -324),
  ),
  ramp(
    "northeast-outer-ramp", "NORTHEAST INTERCHANGE",
    point(504, -396), point(576, -378), point(576, -342), point(504, -324),
  ),
  ramp(
    "southwest-inner-ramp", "SOUTHWEST INTERCHANGE",
    point(-504, 396), point(-468, 378), point(-468, 342), point(-504, 324),
  ),
  ramp(
    "southwest-outer-ramp", "SOUTHWEST INTERCHANGE",
    point(-504, 396), point(-576, 378), point(-576, 342), point(-504, 324),
  ),
  ramp(
    "southeast-inner-ramp", "SOUTHEAST INTERCHANGE",
    point(504, 396), point(468, 378), point(468, 342), point(504, 324),
  ),
  ramp(
    "southeast-outer-ramp", "SOUTHEAST INTERCHANGE",
    point(504, 396), point(576, 378), point(576, 342), point(504, 324),
  ),
  ...ROUNDABOUTS.map<RoadPathDefinition>((definition) => {
    const { center, radius } = definition;
    const junctions = [
      point(center.x + radius, center.y),
      point(center.x, center.y - radius),
      point(center.x - radius, center.y),
      point(center.x, center.y + radius),
    ];
    return {
      id: definition.id,
      name: definition.id === "apex-circle" ? "APEX CIRCLE" : "MARKET CIRCLE",
      kind: "roundabout",
      halfWidth: 5.5,
      lanes: 1,
      travelWeight: 0.92,
      points: roundaboutPath(center, radius),
      closed: true,
      oneWay: true,
      connectGrid: "explicit",
      junctions,
    };
  }),
];

export function roadPathById(id: string) {
  return SPECIAL_ROADS.find((road) => road.id === id) ?? null;
}

export function isRoadJunctionDefinition(road: RoadPathDefinition, candidate: RoadControlPoint) {
  return road.junctions.some((junction) => samePoint(junction, candidate));
}
