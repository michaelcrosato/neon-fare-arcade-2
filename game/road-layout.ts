import type { Vec2 } from "./model";

export type RoadKind =
  | "boulevard"
  | "parkway"
  | "highway"
  | "ramp"
  | "roundabout";

export type GridConnectionMode = "crossings" | "explicit" | "none";

export type RoadPathDefinition = {
  id: string;
  name: string;
  kind: RoadKind;
  halfWidth: number;
  lanes: number;
  /** Lower values make fast roads attractive without changing physical distance. */
  travelWeight: number;
  points: readonly Vec2[];
  closed?: boolean;
  oneWay?: boolean;
  connectGrid: GridConnectionMode;
  junctions: readonly Vec2[];
};

export type RoundaboutDefinition = {
  id: string;
  center: Vec2;
  radius: number;
  islandHalfSize: number;
};

const point = (x: number, y: number): Vec2 => ({ x, y });

function samePoint(a: Vec2, b: Vec2) {
  return Math.hypot(a.x - b.x, a.y - b.y) < 0.01;
}

function catmullRomPath(
  controls: readonly Vec2[],
  closed = false,
  targetSpacing = 15,
) {
  const output: Vec2[] = [];
  const segmentCount = closed ? controls.length : controls.length - 1;
  for (let index = 0; index < segmentCount; index += 1) {
    const p1 = controls[index];
    const p2 = controls[(index + 1) % controls.length];
    const p3 = controls[(index + 2) % controls.length] ?? controls[controls.length - 1];
    const startControl = closed
      ? controls[(index - 1 + controls.length) % controls.length]
      : controls[Math.max(0, index - 1)];
    const endControl = closed ? p3 : controls[Math.min(controls.length - 1, index + 2)];
    const steps = Math.max(2, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / targetSpacing));
    for (let step = 0; step < steps; step += 1) {
      const t = step / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      output.push({
        x: 0.5 * (
          2 * p1.x
          + (-startControl.x + p2.x) * t
          + (2 * startControl.x - 5 * p1.x + 4 * p2.x - endControl.x) * t2
          + (-startControl.x + 3 * p1.x - 3 * p2.x + endControl.x) * t3
        ),
        y: 0.5 * (
          2 * p1.y
          + (-startControl.y + p2.y) * t
          + (2 * startControl.y - 5 * p1.y + 4 * p2.y - endControl.y) * t2
          + (-startControl.y + 3 * p1.y - 3 * p2.y + endControl.y) * t3
        ),
      });
    }
  }
  if (!closed) output.push({ ...controls[controls.length - 1] });
  return output;
}

function bezierPath(
  start: Vec2,
  controlA: Vec2,
  controlB: Vec2,
  end: Vec2,
  steps = 9,
) {
  return Array.from({ length: steps + 1 }, (_, index) => {
    const t = index / steps;
    const inverse = 1 - t;
    return {
      x: inverse ** 3 * start.x
        + 3 * inverse ** 2 * t * controlA.x
        + 3 * inverse * t ** 2 * controlB.x
        + t ** 3 * end.x,
      y: inverse ** 3 * start.y
        + 3 * inverse ** 2 * t * controlA.y
        + 3 * inverse * t ** 2 * controlB.y
        + t ** 3 * end.y,
    };
  });
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

const beltwayControls = [
  point(0, -576), point(324, -540), point(504, -396),
  point(576, -72), point(576, 72), point(504, 396),
  point(324, 540), point(0, 576), point(-324, 540),
  point(-504, 396), point(-576, 72), point(-576, -72),
  point(-504, -396), point(-324, -540),
] as const;

const northstarHighwayControls = [
  point(0, -792), point(0, -828), point(72, -936), point(144, -1080),
  point(216, -1188), point(216, -1332), point(144, -1476), point(72, -1620),
  point(144, -1764), point(0, -1908), point(-180, -2052), point(216, -2196),
  point(216, -2304),
] as const;

const pinehookLoopControls = [
  point(-288, -1512), point(-360, -1440), point(-576, -1512), point(-684, -1692),
  point(-684, -1908), point(-540, -2016), point(-324, -1944), point(-252, -1728),
] as const;

const mirrorLakeRoadControls = [
  point(360, -1728), point(612, -1728), point(684, -1872),
  point(612, -2016), point(360, -2016), point(288, -1872),
] as const;

const silverRunControls = [
  point(216, -1908), point(360, -2016), point(108, -2088),
  point(324, -2160), point(108, -2232), point(324, -2304), point(144, -2340),
] as const;

const sundownHighwayControls = [
  point(0, 828), point(-36, 936), point(-180, 1080),
  point(-360, 1188), point(-468, 1332), point(-432, 1476), point(-252, 1584),
  point(-36, 1692), point(180, 1800), point(360, 1944), point(432, 2088),
  point(324, 2232), point(108, 2340),
] as const;

const copperLoopControls = [
  point(-180, 1296), point(-396, 1260), point(-612, 1368), point(-684, 1548),
  point(-576, 1692), point(-324, 1728), point(-144, 1584), point(-108, 1404),
] as const;

const arroyoRoadControls = [
  point(252, 1368), point(468, 1296), point(684, 1404), point(720, 1584),
  point(576, 1764), point(360, 1800), point(216, 1656), point(180, 1476),
] as const;

const paintedCanyonControls = [
  point(540, 1836), point(396, 1908), point(576, 2016),
  point(324, 2088), point(540, 2196), point(252, 2268), point(396, 2340),
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

const pacificDriveControls = [point(-2016, -756), point(-2016, -360), point(-2016, 0), point(-2016, 360), point(-2016, 756)] as const;
const sunsetBoulevardControls = [point(-828, 0), point(-1008, 0), point(-1152, -72), point(-1296, -144), point(-1440, -72), point(-1584, 0), point(-1800, 0), point(-2016, 0)] as const;
const citrusScenicControls = [point(-1908, -612), point(-1656, -684), point(-1404, -612), point(-1296, -432), point(-1512, -360), point(-1728, -396)] as const;
const mariposaDriveControls = [point(-2016, 576), point(-1800, 648), point(-1584, 612), point(-1368, 504), point(-1152, 576), point(-828, 576)] as const;

export const ROUNDABOUTS: readonly RoundaboutDefinition[] = [
  { id: "apex-circle", center: point(216, -216), radius: 18, islandHalfSize: 8.2 },
  { id: "market-circle", center: point(-360, 288), radius: 18, islandHalfSize: 8.2 },
];

const ramp = (
  id: string,
  name: string,
  start: Vec2,
  controlA: Vec2,
  controlB: Vec2,
  end: Vec2,
): RoadPathDefinition => ({
  id,
  name,
  kind: "ramp",
  halfWidth: 5.1,
  lanes: 2,
  travelWeight: 0.78,
  points: bezierPath(start, controlA, controlB, end),
  connectGrid: "explicit",
  junctions: [start, end],
});

export const SPECIAL_ROADS: readonly RoadPathDefinition[] = [
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
    junctions: northstarHighwayControls,
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
    junctions: pinehookLoopControls,
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
    junctions: mirrorLakeRoadControls,
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
    junctions: silverRunControls,
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
    junctions: sundownHighwayControls,
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
    junctions: copperLoopControls,
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
    junctions: arroyoRoadControls,
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
    junctions: paintedCanyonControls,
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
    connectGrid: "crossings", junctions: pacificDriveControls,
  },
  {
    id: "sunset-boulevard", name: "SUNSET BOULEVARD", kind: "parkway",
    halfWidth: 7, lanes: 2, travelWeight: 0.76,
    points: catmullRomPath(sunsetBoulevardControls, false, 12),
    connectGrid: "crossings", junctions: sunsetBoulevardControls,
  },
  {
    id: "citrus-scenic-loop", name: "CITRUS SCENIC LOOP", kind: "parkway",
    halfWidth: 6, lanes: 2, travelWeight: 0.86,
    points: catmullRomPath(citrusScenicControls, true, 12), closed: true,
    connectGrid: "crossings", junctions: citrusScenicControls,
  },
  {
    id: "mariposa-drive", name: "MARIPOSA DRIVE", kind: "parkway",
    halfWidth: 6, lanes: 2, travelWeight: 0.84,
    points: catmullRomPath(mariposaDriveControls, false, 12),
    connectGrid: "crossings", junctions: mariposaDriveControls,
  },
  ramp(
    "northwest-inner-ramp", "NORTHWEST INTERCHANGE",
    point(-504, -396), point(-468, -378), point(-468, -342), point(-504, -324),
  ),
  ramp(
    "northwest-outer-ramp", "NORTHWEST INTERCHANGE",
    point(-504, -396), point(-540, -378), point(-540, -342), point(-504, -324),
  ),
  ramp(
    "northeast-inner-ramp", "NORTHEAST INTERCHANGE",
    point(504, -396), point(468, -378), point(468, -342), point(504, -324),
  ),
  ramp(
    "northeast-outer-ramp", "NORTHEAST INTERCHANGE",
    point(504, -396), point(540, -378), point(540, -342), point(504, -324),
  ),
  ramp(
    "southwest-inner-ramp", "SOUTHWEST INTERCHANGE",
    point(-504, 396), point(-468, 378), point(-468, 342), point(-504, 324),
  ),
  ramp(
    "southwest-outer-ramp", "SOUTHWEST INTERCHANGE",
    point(-504, 396), point(-540, 378), point(-540, 342), point(-504, 324),
  ),
  ramp(
    "southeast-inner-ramp", "SOUTHEAST INTERCHANGE",
    point(504, 396), point(468, 378), point(468, 342), point(504, 324),
  ),
  ramp(
    "southeast-outer-ramp", "SOUTHEAST INTERCHANGE",
    point(504, 396), point(540, 378), point(540, 342), point(504, 324),
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

export function isRoadJunctionDefinition(road: RoadPathDefinition, candidate: Vec2) {
  return road.junctions.some((junction) => samePoint(junction, candidate));
}
