import type { Vec2 } from "./model";

export const REACH_BOUNDS = { minX: 792, maxX: 2376, minY: 792, maxY: 3384 } as const;
export const REACH_SHORE_STEP = 4.5;
export const REACH_WATER_Z = -0.22;

/** West bay and east ocean share one authored, south-tapering landform. */
const SHORE_PROFILE = [
  { y: 792, west: 792, east: 2376 },
  { y: 936, west: 792, east: 2358 },
  { y: 1080, west: 882, east: 2340 },
  { y: 1224, west: 1080, east: 2334 },
  { y: 1440, west: 1368, east: 2286 },
  { y: 1728, west: 1512, east: 2250 },
  { y: 2016, west: 1584, east: 2214 },
  { y: 2376, west: 1602, east: 2142 },
  { y: 2700, west: 1530, east: 2028 },
  { y: 2952, west: 1512, east: 1908 },
  { y: 3132, west: 1530, east: 1836 },
  { y: 3222, west: 1593, east: 1773 },
  { y: 3285, west: 1683, east: 1683 },
] as const;

export const REACH_RECLAIMED_SHORES = [
  { id: "west-abutment", minX: 792, maxX: 906, minY: 1926, maxY: 1962 },
  { id: "marine-stadium", minX: 1485, maxX: 1656, minY: 1872, maxY: 1980 },
  { id: "yacht-club", minX: 1476, maxX: 1665, minY: 2673, maxY: 2790 },
] as const;

const smooth = (value: number) => value * value * (3 - 2 * value);

export function reachShoreAt(y: number) {
  if (y <= SHORE_PROFILE[0].y) return { west: 792, east: 2376 };
  const last = SHORE_PROFILE[SHORE_PROFILE.length - 1];
  if (y >= last.y) return { west: last.west, east: last.east };
  for (let i = 1; i < SHORE_PROFILE.length; i += 1) {
    const a = SHORE_PROFILE[i - 1], b = SHORE_PROFILE[i];
    if (y > b.y) continue;
    const t = smooth((y - a.y) / (b.y - a.y));
    return { west: a.west + (b.west - a.west) * t, east: a.east + (b.east - a.east) * t };
  }
  return { west: last.west, east: last.east };
}

/** Narrow horizontal shore bands are identical in meshes, collision, and GPS. */
export function reachLandIntervalsAt(y: number): Array<{ min: number; max: number }> {
  const sampleY = Math.floor(y / REACH_SHORE_STEP) * REACH_SHORE_STEP + REACH_SHORE_STEP / 2;
  const intervals: Array<{ min: number; max: number }> = [];
  if (sampleY <= 3285) {
    const shore = reachShoreAt(sampleY);
    if (shore.east > shore.west) intervals.push({ min: shore.west, max: shore.east });
  }
  for (const shore of REACH_RECLAIMED_SHORES) {
    if (sampleY >= shore.minY && sampleY < shore.maxY) intervals.push({ min: shore.minX, max: shore.maxX });
  }
  intervals.sort((a, b) => a.min - b.min);
  const merged: typeof intervals = [];
  for (const interval of intervals) {
    const previous = merged[merged.length - 1];
    if (previous && previous.max >= interval.min) previous.max = Math.max(previous.max, interval.max);
    else merged.push({ ...interval });
  }
  return merged;
}

export function reachIsLandAt(x: number, y: number, margin = 0) {
  return [-margin, 0, margin].every(dy => reachLandIntervalsAt(y + dy)
    .some(interval => x - margin >= interval.min && x + margin <= interval.max));
}

export function reachIsPromenadeAt(x: number, y: number, margin = 0) {
  const east = reachShoreAt(y).east;
  return x >= east - 66 - margin && x <= east - 59 + margin;
}

export function reachBlockIsDry(blockX: number, blockY: number, margin = 18) {
  return reachIsLandAt(blockX * 36 + 18, blockY * 36 + 18, margin);
}

export function reachAreaAt(x: number, y: number) {
  if (!reachIsLandAt(x, y)) return x < reachShoreAt(y).west ? "MIRAGE BAY" : "TURQUOISE ATLANTIC";
  if (y >= 2940) return "SUNDIAL POINT";
  if (y >= 2304) return "MOONWATER KEYS";
  if (y <= 1296) return "CALLE LUNA";
  return x >= 1980 ? "OCEAN RIBBON" : "MIRAGE BAY";
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.02;
const between = (value: number, a: number, b: number) => value >= a - 0.02 && value <= b + 0.02;
const on72 = (value: number) => Math.abs(value / 72 - Math.round(value / 72)) < 0.001;

/** District streets stop at the shore; authored roads join them into a circuit. */
export function reachGridStreetEnabled(point: Vec2, axis: "vertical" | "horizontal") {
  // Physics and traffic query lane positions as well as street centerlines.
  const x = axis === "vertical" ? Math.round(point.x / 36) * 36 : point.x;
  const y = axis === "horizontal" ? Math.round(point.y / 36) * 36 : point.y;
  if (axis === "horizontal" && near(y, 792)) return true;
  if (axis === "horizontal" && near(y, 1944) && between(x, 792, 864)) return true;
  // A shoreline street occupies a complete 36-unit segment, including its
  // junction ends. Do not draw or enable a fragment that runs into the bay.
  const start = Math.floor((axis === "vertical" ? y : x) / 36) * 36;
  if (![start, start + 18, start + 36].every(along => axis === "vertical"
    ? reachIsLandAt(x, along, 7) : reachIsLandAt(along, y, 7))) return false;
  if (between(x, 864, 1764) && between(y, 864, 1224)) {
    return axis === "vertical" ? on72(x) || near(x, 900) || near(x, 1260)
      : on72(y) || near(y, 1044) || near(y, 1116) || near(y, 1188);
  }
  if (between(x, 1620, 1980) && between(y, 1368, 2160)) {
    return axis === "vertical" ? on72(x) || near(x, 1620) : on72(y);
  }
  if (between(x, 1980, 2160) && between(y, 1368, 2160)) {
    return axis === "vertical" ? near(x, 2016) || near(x, 2088)
      : on72(y) || near(y, 1800);
  }
  if (axis === "horizontal") return (near(y, 1296) && between(x, 1872, 2124))
    || (near(y, 1404) && between(x, 1728, 2124))
    || (near(y, 1476) && between(x, 1692, 2016))
    || (near(y, 2268) && between(x, 1692, 2016))
    || (near(y, 2232) && between(x, 1836, 1980))
    || (near(y, 2448) && between(x, 1692, 1944))
    || (near(y, 2592) && between(x, 1656, 1872))
    || (near(y, 2844) && between(x, 1620, 1836))
    || (near(y, 2700) && between(x, 1476, 1764))
    || (near(y, 2772) && between(x, 1548, 1692))
    || (near(y, 3132) && between(x, 1620, 1728))
    || (near(y, 3204) && between(x, 1620, 1728));
  return (near(x, 2016) && between(y, 1296, 1368))
    || (near(x, 1728) && between(y, 2160, 2304))
    || (near(x, 1656) && between(y, 2664, 2808))
    || (near(x, 1692) && between(y, 3096, 3204));
}
