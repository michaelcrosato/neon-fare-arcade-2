import {
  BLOCKS_PER_CHUNK,
  DISTRICT_LABELS,
  DESTINATION_ART_CELL_COUNT,
  FARE_DROPOFF_RADIUS,
  FARE_PICKUP_RADIUS,
  FARE_STOP_RULES,
  FARES_PER_CYCLE,
  MAX_FARE_TRIP_DISTANCE,
  MAX_FLAT_REGIONAL_FARE_TRIP_DISTANCE,
  MAX_REGIONAL_FARE_TRIP_DISTANCE,
  MIN_FARE_HANDOFF_DISTANCE,
  MIN_REGIONAL_FARE_TRIP_DISTANCE,
  REGIONAL_FARE_DESTINATION_DEPTH,
  ROAD_HALF,
  ROAD_SPACING,
  TAXI_START,
  WORLD_BLOCK_MAX_X,
  WORLD_BLOCK_MAX_Y,
  WORLD_BLOCK_MIN_X,
  WORLD_BLOCK_MIN_Y,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./config";
import { circleHitsBuilding, taxiNearBuilding, overlapsHeight } from "./collision";
import { clamp, distance, nearestRoadX, nearestRoadY } from "./math";
import type {
  CityChunk,
  Collider,
  Job,
  SurfaceRegion,
  Vec2,
  WorldView,
  WorldPoint,
} from "./model";
import { buildGpsRoute, routeLength } from "./route-geometry";
import {
  SPECIAL_ROAD_SEGMENTS,
  isRoadJunctionPoint,
  isRoadSurface,
  nearestRoadProjection,
} from "./road-network";
import { gridStreetPointEnabled } from "./road-topology";
import { districtForPosition, generateCityChunk } from "./world";
import {
  chunkCoordinateForBlock as owningChunkCoordinateForBlock,
  containingRegionForPosition,
  isActiveBlock,
  isPlayablePoint,
  nearestActiveChunk,
  regionForBlock,
  regionRoadBounds,
  regionalPlaceName,
  type WorldRegion,
} from "./regions";

import { atTerrainElevation, terrainHeightAt, terrainSupport } from "./terrain/surface";
import { inElevatedTerrain } from "./terrain/region-forms";

type CurbSide = "north" | "east" | "south" | "west";

type CurbCandidate = {
  id: string;
  blockX: number;
  blockY: number;
  side: CurbSide;
  slot: number;
  zone: WorldPoint;
};

export type FareStopPlacement = {
  id: string;
  zone: WorldPoint;
  approach: WorldPoint;
  approachHeading: number;
  blockX: number;
  blockY: number;
  district: ReturnType<typeof districtForPosition>;
  label: string;
  artCell: number;
};

export type FareStopPlacementReport = {
  safe: boolean;
  roadOverlap: number;
  colliderOverlap: number;
  waterOverlap: number;
  blockedOverlap: number;
  openGround: number;
  centerOnRoad: boolean;
  centerInCollider: boolean;
  centerInWater: boolean;
  withinWorld: boolean;
  venueClear: boolean;
  junctionClear: boolean;
  passengerClear: boolean;
  approach: WorldPoint;
  approachHeading: number;
  approachDistance: number;
  approachOnRoad: boolean;
  approachClear: boolean;
  roadKind: ReturnType<typeof nearestRoadProjection>["kind"];
};

const SIDES: readonly CurbSide[] = ["north", "east", "south", "west"];
const ALONG_SLOTS = [-FARE_STOP_RULES.alongLimit, 0, FARE_STOP_RULES.alongLimit] as const;
const CURB_INSET = FARE_DROPOFF_RADIUS * 0.3;
const placementChunkCache = new Map<string, CityChunk>();
const placementReportCache = new Map<string, FareStopPlacementReport>();

function stableHash(value: string, seed = 0x811c9dc5) {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  return (hash ^ (hash >>> 16)) >>> 0;
}

function chunkForBlock(blockX: number, blockY: number) {
  const candidateX = owningChunkCoordinateForBlock(blockX);
  const candidateY = owningChunkCoordinateForBlock(blockY);
  const { cx, cy } = nearestActiveChunk(candidateX, candidateY);
  const key = `${cx},${cy}`;
  let chunk = placementChunkCache.get(key);
  if (!chunk) {
    chunk = generateCityChunk(cx, cy);
    placementChunkCache.set(key, chunk);
  }
  return chunk;
}

function pointInCollider(point: WorldPoint, collider: Collider) {
  if (!overlapsHeight(collider, point.z ?? terrainHeightAt(point.x, point.y), 2.4, point.x, point.y)) return false;
  const dx = point.x - collider.x, dy = point.y - collider.y;
  const c = Math.cos(collider.yaw ?? 0), s = Math.sin(collider.yaw ?? 0);
  return Math.abs(c * dx + s * dy) <= collider.halfX && Math.abs(-s * dx + c * dy) <= collider.halfY;
}

export function pointInSurfaceRegion(point: Vec2, region: SurfaceRegion) {
  const dx = point.x - region.x;
  const dy = point.y - region.y;
  const cosine = Math.cos(region.yaw);
  const sine = Math.sin(region.yaw);
  const localX = dx * cosine + dy * sine;
  const localY = -dx * sine + dy * cosine;
  return Math.abs(localX) <= region.halfX && Math.abs(localY) <= region.halfY;
}

/** Deterministic area estimate over a circular logical objective zone. */
export function sampledDiskFraction(
  radius: number,
  predicate: (offset: Vec2) => boolean,
  sampleGrid: number = FARE_STOP_RULES.sampleGrid,
) {
  let inside = 0;
  let matched = 0;
  for (let row = 0; row < sampleGrid; row += 1) {
    const y = ((row + 0.5) / sampleGrid * 2 - 1) * radius;
    for (let column = 0; column < sampleGrid; column += 1) {
      const x = ((column + 0.5) / sampleGrid * 2 - 1) * radius;
      if (x * x + y * y > radius * radius) continue;
      inside += 1;
      if (predicate({ x, y })) matched += 1;
    }
  }
  return inside === 0 ? 0 : matched / inside;
}

function samplePlacementDisk(
  zone: WorldPoint,
  radius: number,
  inCollider: (point: Vec2) => boolean,
  inWater: (point: Vec2) => boolean,
) {
  let inside = 0;
  let road = 0;
  let collider = 0;
  let water = 0;
  let blocked = 0;
  let open = 0;
  const sampleGrid = FARE_STOP_RULES.sampleGrid;
  for (let row = 0; row < sampleGrid; row += 1) {
    const offsetY = ((row + 0.5) / sampleGrid * 2 - 1) * radius;
    for (let column = 0; column < sampleGrid; column += 1) {
      const offsetX = ((column + 0.5) / sampleGrid * 2 - 1) * radius;
      if (offsetX * offsetX + offsetY * offsetY > radius * radius) continue;
      const point = { x: zone.x + offsetX, y: zone.y + offsetY };
      const onRoad = isRoadSurface(point);
      const hitsCollider = inCollider(point);
      const hitsWater = inWater(point);
      inside += 1;
      if (onRoad) road += 1;
      if (hitsCollider) collider += 1;
      if (hitsWater) water += 1;
      if (hitsCollider || hitsWater) blocked += 1;
      if (!onRoad && !hitsCollider && !hitsWater) open += 1;
    }
  }
  const fraction = (count: number) => inside === 0 ? 0 : count / inside;
  return {
    roadOverlap: fraction(road),
    colliderOverlap: fraction(collider),
    waterOverlap: fraction(water),
    blockedOverlap: fraction(blocked),
    openGround: fraction(open),
  };
}

function placementWorld(chunk: CityChunk): WorldView {
  return {
    key: `fare-placement:${chunk.key}`,
    boxes: chunk.boxes,
    colliders: chunk.colliders,
    chunks: [chunk],
    interactions: chunk.interactions,
  };
}

function junctionDistance(point: Vec2, heading: number) {
  const horizontal = Math.abs(Math.cos(heading)) >= Math.abs(Math.sin(heading));
  const progress = horizontal ? point.x : point.y;
  return Math.abs(progress - (horizontal ? nearestRoadX(progress) : nearestRoadY(progress)));
}

export function analyzeFareStopPlacement(
  zone: WorldPoint,
  radius = FARE_DROPOFF_RADIUS,
): FareStopPlacementReport {
  zone = atTerrainElevation(zone);
  const blockX = Math.floor(zone.x / ROAD_SPACING);
  const blockY = Math.floor(zone.y / ROAD_SPACING);
  const chunk = chunkForBlock(blockX, blockY);
  const world = placementWorld(chunk);
  const waterRegions = chunk.surfaceRegions;
  const inCollider = (point: Vec2) => chunk.colliders.some((collider) => pointInCollider(point, collider));
  const inWater = (point: Vec2) => waterRegions.some((region) => pointInSurfaceRegion(point, region));
  const {
    roadOverlap,
    colliderOverlap,
    waterOverlap,
    blockedOverlap,
    openGround,
  } = samplePlacementDisk(zone, radius, inCollider, inWater);
  const projection = nearestRoadProjection(zone);
  const deltaX = zone.x - projection.point.x;
  const deltaY = zone.y - projection.point.y;
  const centerDistance = Math.hypot(deltaX, deltaY);
  const normal = centerDistance > 1e-6
    ? { x: deltaX / centerDistance, y: deltaY / centerDistance }
    : { x: -Math.sin(projection.tangentYaw), y: Math.cos(projection.tangentYaw) };
  const approachOffset = Math.max(0, projection.halfWidth - FARE_STOP_RULES.taxiRoadInset);
  const approach: WorldPoint = {
    x: projection.point.x + normal.x * approachOffset,
    y: projection.point.y + normal.y * approachOffset,
    ...(inElevatedTerrain(zone.x, zone.y) ? { z: (projection.point.z ?? 0) + 0.64 } : {}),
  };
  const approachDistance = distance(zone, approach);
  const tangent = { x: Math.cos(projection.tangentYaw), y: Math.sin(projection.tangentYaw) };
  const approachSamples = [-2.5, 0, 2.5].map((along) => ({
    x: approach.x + tangent.x * along,
    y: approach.y + tangent.y * along,
    ...(approach.z !== undefined ? { z: approach.z } : {}),
  }));
  const approachOnRoad = approachSamples.every((point) => isRoadSurface(point));
  const approachClear = approachSamples.every((point) => (
    !taxiNearBuilding(
      world,
      point.x,
      point.y,
      projection.tangentYaw,
      FARE_STOP_RULES.taxiClearance,
      point.z,
    )
  ));
  const centerOnRoad = isRoadSurface(zone);
  const centerInCollider = inCollider(zone);
  const centerInWater = inWater(zone);
  const withinWorld = isPlayablePoint(zone.x, zone.y, radius);
  const venueClear = chunk.interactions.every((interaction) => (
    interaction.kind !== "venue-entrance"
    || distance(zone, interaction) > radius + interaction.radius + 0.75
  ));
  const junctionClear = projection.kind === "street"
    ? junctionDistance(projection.point, projection.tangentYaw) >= FARE_STOP_RULES.junctionClearance
    : [-FARE_STOP_RULES.junctionClearance, 0, FARE_STOP_RULES.junctionClearance].every((along) => (
        !isRoadJunctionPoint({
          x: projection.point.x + tangent.x * along,
          y: projection.point.y + tangent.y * along,
        })
      ));
  const passengerClear = !centerOnRoad
    && !centerInWater
    && !circleHitsBuilding(
      world,
      zone.x,
      zone.y,
      FARE_STOP_RULES.passengerClearance,
    );
  const terrainAccessible = !inElevatedTerrain(zone.x, zone.y)
    || (Math.abs((zone.z ?? 0) - (approach.z ?? 0)) < 1.5
      && terrainSupport(zone).normal.z > 0.8);
  const safe = withinWorld
    && terrainAccessible
    && !centerOnRoad
    && !centerInCollider
    && !centerInWater
    && roadOverlap >= FARE_STOP_RULES.minRoadOverlap
    && roadOverlap <= FARE_STOP_RULES.maxRoadOverlap
    && colliderOverlap < FARE_STOP_RULES.maxColliderOverlap
    && waterOverlap < FARE_STOP_RULES.maxWaterOverlap
    && blockedOverlap < FARE_STOP_RULES.maxBlockedOverlap
    && openGround >= FARE_STOP_RULES.minOpenGround
    && venueClear
    && junctionClear
    && passengerClear
    && approachOnRoad
    && approachClear
    && approachDistance <= radius - 0.35;

  return {
    safe,
    roadOverlap,
    colliderOverlap,
    waterOverlap,
    blockedOverlap,
    openGround,
    centerOnRoad,
    centerInCollider,
    centerInWater,
    withinWorld,
    venueClear,
    junctionClear,
    passengerClear,
    approach,
    approachHeading: projection.tangentYaw,
    approachDistance,
    approachOnRoad,
    approachClear,
    roadKind: projection.kind,
  };
}

function curbCandidate(blockX: number, blockY: number, side: CurbSide, slot: number): CurbCandidate {
  const left = blockX * ROAD_SPACING;
  const top = blockY * ROAD_SPACING;
  const centerX = left + ROAD_SPACING / 2;
  const centerY = top + ROAD_SPACING / 2;
  const curbOffset = ROAD_HALF + CURB_INSET;
  const along = ALONG_SLOTS[slot];
  const zone = side === "north"
    ? { x: centerX + along, y: top + curbOffset }
    : side === "south"
      ? { x: centerX + along, y: top + ROAD_SPACING - curbOffset }
      : side === "west"
        ? { x: left + curbOffset, y: centerY + along }
        : { x: left + ROAD_SPACING - curbOffset, y: centerY + along };
  return {
    id: `curb:${blockX}:${blockY}:${side[0]}:${slot}`,
    blockX,
    blockY,
    side,
    slot,
    zone,
  };
}

function candidateAdjacentGridRoadEnabled(candidate: CurbCandidate) {
  const horizontal = candidate.side === "north" || candidate.side === "south";
  const roadPoint = horizontal
    ? { x: candidate.zone.x, y: nearestRoadY(candidate.zone.y) }
    : { x: nearestRoadX(candidate.zone.x), y: candidate.zone.y };
  return gridStreetPointEnabled(roadPoint, horizontal ? "horizontal" : "vertical");
}

const REGIONAL_ROADSIDE_IDS = new Set([
  "northstar-highway",
  "spruce-gorge-viaduct",
  "pinehook-loop",
  "mirror-lake-road",
  "silver-run-switchbacks",
  "sundown-highway",
  "copper-loop",
  "arroyo-road",
  "painted-canyon-drive",
  "saguaro-trail",
  "cinder-cone-loop",
  "canyon-rim-road",
  "cypress-causeway",
  "lantern-bay-loop",
  "blackwater-trace",
  "stormwall-levee-road",
  "pacific-coast-drive", "sunset-boulevard", "citrus-scenic-loop", "mariposa-drive",
]);

function regionalRoadsideCandidates() {
  const candidates: CurbCandidate[] = [];
  for (const segment of SPECIAL_ROAD_SEGMENTS) {
    if (!REGIONAL_ROADSIDE_IDS.has(segment.pathId) || segment.index % 3 !== 1) continue;
    const tangentYaw = Math.atan2(segment.b.y - segment.a.y, segment.b.x - segment.a.x);
    const midpoint = {
      x: (segment.a.x + segment.b.x) / 2,
      y: (segment.a.y + segment.b.y) / 2,
    };
    for (const sideSign of [-1, 1] as const) {
      const offset = segment.halfWidth + CURB_INSET;
      const zone = {
        x: midpoint.x - Math.sin(tangentYaw) * sideSign * offset,
        y: midpoint.y + Math.cos(tangentYaw) * sideSign * offset,
      };
      const horizontal = Math.abs(Math.cos(tangentYaw)) >= Math.abs(Math.sin(tangentYaw));
      candidates.push({
        id: `roadside:${segment.pathId}:${segment.index}:${sideSign > 0 ? "r" : "l"}`,
        blockX: Math.floor(zone.x / ROAD_SPACING),
        blockY: Math.floor(zone.y / ROAD_SPACING),
        side: horizontal
          ? sideSign > 0 ? "south" : "north"
          : sideSign > 0 ? "west" : "east",
        slot: segment.index % ALONG_SLOTS.length,
        zone,
      });
    }
  }
  return candidates;
}

const REGIONAL_ROADSIDE_CANDIDATES = regionalRoadsideCandidates();

function blockBounds(anchor: Vec2, radius: number) {
  return {
    minX: clamp(Math.floor((anchor.x - radius) / ROAD_SPACING), WORLD_BLOCK_MIN_X + 1, WORLD_BLOCK_MAX_X - 1),
    maxX: clamp(Math.floor((anchor.x + radius) / ROAD_SPACING), WORLD_BLOCK_MIN_X + 1, WORLD_BLOCK_MAX_X - 1),
    minY: clamp(Math.floor((anchor.y - radius) / ROAD_SPACING), WORLD_BLOCK_MIN_Y + 1, WORLD_BLOCK_MAX_Y - 1),
    maxY: clamp(Math.floor((anchor.y + radius) / ROAD_SPACING), WORLD_BLOCK_MIN_Y + 1, WORLD_BLOCK_MAX_Y - 1),
  };
}

function rankedCandidates(seed: number, role: string, anchor: Vec2, radius: number) {
  const bounds = blockBounds(anchor, radius);
  const candidates: Array<CurbCandidate & { rank: number }> = [];
  for (let blockX = bounds.minX; blockX <= bounds.maxX; blockX += 1) {
    for (let blockY = bounds.minY; blockY <= bounds.maxY; blockY += 1) {
      if (!isActiveBlock(blockX, blockY)) continue;
      for (const side of SIDES) {
        for (let slot = 0; slot < ALONG_SLOTS.length; slot += 1) {
          const candidate = curbCandidate(blockX, blockY, side, slot);
          if (!candidateAdjacentGridRoadEnabled(candidate)) continue;
          candidates.push({
            ...candidate,
            rank: stableHash(`${role}:${candidate.id}`, seed),
          });
        }
      }
    }
  }
  for (const candidate of REGIONAL_ROADSIDE_CANDIDATES) {
    if (distance(candidate.zone, anchor) > radius || !isPlayablePoint(candidate.zone.x, candidate.zone.y)) continue;
    candidates.push({
      ...candidate,
      rank: stableHash(`${role}:${candidate.id}`, seed),
    });
  }
  return candidates.sort((left, right) => left.rank - right.rank || left.id.localeCompare(right.id));
}

/** Targeted regional dispatches rank one cell, not the eventual full 3×3 world. */
function rankedCandidatesForRegion(seed: number, role: string, region: WorldRegion) {
  const minBlockX = region.chunkMinX * BLOCKS_PER_CHUNK - BLOCKS_PER_CHUNK / 2;
  const maxBlockX = region.chunkMaxX * BLOCKS_PER_CHUNK + BLOCKS_PER_CHUNK / 2 - 1;
  const minBlockY = region.chunkMinY * BLOCKS_PER_CHUNK - BLOCKS_PER_CHUNK / 2;
  const maxBlockY = region.chunkMaxY * BLOCKS_PER_CHUNK + BLOCKS_PER_CHUNK / 2 - 1;
  const candidates: Array<CurbCandidate & { rank: number }> = [];
  for (let blockX = minBlockX; blockX <= maxBlockX; blockX += 1) {
    for (let blockY = minBlockY; blockY <= maxBlockY; blockY += 1) {
      if (regionForBlock(blockX, blockY)?.id !== region.id) continue;
      for (const side of SIDES) {
        for (let slot = 0; slot < ALONG_SLOTS.length; slot += 1) {
          const candidate = curbCandidate(blockX, blockY, side, slot);
          if (!candidateAdjacentGridRoadEnabled(candidate)) continue;
          candidates.push({
            ...candidate,
            rank: stableHash(`${role}:${candidate.id}`, seed),
          });
        }
      }
    }
  }
  for (const candidate of REGIONAL_ROADSIDE_CANDIDATES) {
    if (regionForBlock(candidate.blockX, candidate.blockY)?.id !== region.id) continue;
    candidates.push({
      ...candidate,
      rank: stableHash(`${role}:${candidate.id}`, seed),
    });
  }
  return candidates.sort((left, right) => left.rank - right.rank || left.id.localeCompare(right.id));
}

function streetRouteDistance(start: Vec2, target: Vec2) {
  return routeLength(buildGpsRoute(start, target));
}

function stopCode(blockX: number, blockY: number, side: CurbSide, slot: number) {
  const eastWest = `${blockX < 0 ? "W" : "E"}${String(Math.abs(blockX)).padStart(2, "0")}`;
  const northSouth = `${blockY < 0 ? "N" : "S"}${String(Math.abs(blockY)).padStart(2, "0")}`;
  return `${eastWest}-${northSouth}${side[0].toUpperCase()}${slot + 1}`;
}

function asPlacement(candidate: CurbCandidate, radius: number): FareStopPlacement | null {
  const cacheKey = `${candidate.id}:${radius}`;
  let report = placementReportCache.get(cacheKey);
  if (!report) {
    report = analyzeFareStopPlacement(candidate.zone, radius);
    placementReportCache.set(cacheKey, report);
  }
  if (!report.safe) return null;
  const district = districtForPosition(candidate.zone.x, candidate.zone.y);
  const code = stopCode(candidate.blockX, candidate.blockY, candidate.side, candidate.slot);
  return {
    id: candidate.id,
    zone: atTerrainElevation({ ...candidate.zone }),
    approach: { ...report.approach },
    approachHeading: report.approachHeading,
    blockX: candidate.blockX,
    blockY: candidate.blockY,
    district,
    label: `${regionalPlaceName(candidate.zone.x, candidate.zone.y) ?? DISTRICT_LABELS[district]} · ${code}`,
    // Coast imagery must not reshuffle the existing regions' destination art.
    artCell: district === "coastal"
      ? 24 + stableHash(`destination-art:${candidate.id}`) % (DESTINATION_ART_CELL_COUNT - 24)
      : stableHash(`destination-art:${candidate.id}`) % 24,
  };
}

function previousStopIds(previousJobs: readonly Job[]) {
  return new Set(previousJobs.flatMap((job) => [job.pickupStopId, job.dropoffStopId]));
}

function previousStopPoints(previousJobs: readonly Job[]) {
  return previousJobs.flatMap((job) => [job.pickup, job.dropoff]);
}

function avoidsPreviousStops(
  stop: FareStopPlacement,
  ids: ReadonlySet<string>,
  points: readonly Vec2[],
) {
  return !ids.has(stop.id)
    && points.every((point) => distance(point, stop.zone) >= FARE_STOP_RULES.previousStopClearance);
}

function addRankedStops(
  output: FareStopPlacement[],
  candidates: readonly CurbCandidate[],
  radius: number,
  accept: (stop: FareStopPlacement) => boolean,
  targetCount = FARES_PER_CYCLE,
) {
  const selectedIds = new Set(output.map((stop) => stop.id));
  for (const candidate of candidates) {
    if (selectedIds.has(candidate.id)) continue;
    const stop = asPlacement(candidate, radius);
    if (!stop || !accept(stop)) continue;
    output.push(stop);
    selectedIds.add(stop.id);
    if (output.length === targetCount) return;
  }
}

function candidateBelongsToRegion(candidate: CurbCandidate, region: WorldRegion) {
  return regionForBlock(candidate.blockX, candidate.blockY)?.id === region.id;
}

function stopBelongsToRegion(stop: FareStopPlacement, region: WorldRegion) {
  return containingRegionForPosition(stop.zone.x, stop.zone.y)?.id === region.id;
}

function candidatesInRegion(
  candidates: readonly CurbCandidate[],
  region: WorldRegion | null,
) {
  return region
    ? candidates.filter((candidate) => candidateBelongsToRegion(candidate, region))
    : candidates;
}

function openingPickupOffset(origin: Vec2, heading: number, point: Vec2) {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  return {
    forward: dx * Math.cos(heading) + dy * Math.sin(heading),
    right: -dx * Math.sin(heading) + dy * Math.cos(heading),
  };
}

function selectPickupStops(
  seed: number,
  anchor: Vec2,
  previousJobs: readonly Job[],
  openingHeading: number | null,
  region: WorldRegion | null,
  targetCount = FARES_PER_CYCLE,
  nearbyPickupCount = 1,
) {
  const previousIds = previousStopIds(previousJobs);
  const previousPoints = previousStopPoints(previousJobs);
  const output: FareStopPlacement[] = [];
  const minimumAnchorDistance = previousJobs.length > 0 ? MIN_FARE_HANDOFF_DISTANCE : 0;
  if (openingHeading !== null) {
    const opening = candidatesInRegion(rankedCandidates(
      seed,
      "pickup-opening",
      anchor,
      FARE_STOP_RULES.openingSearchRadius,
    ), region);
    addRankedStops(output, opening, FARE_PICKUP_RADIUS, (stop) => {
      const zoneOffset = openingPickupOffset(anchor, openingHeading, stop.zone);
      const approachOffset = openingPickupOffset(anchor, openingHeading, stop.approach);
      return (!region || stopBelongsToRegion(stop, region))
        && zoneOffset.forward >= FARE_STOP_RULES.openingForwardMin
        && zoneOffset.forward <= FARE_STOP_RULES.openingForwardMax
        && zoneOffset.right >= FARE_STOP_RULES.openingRightMin
        && zoneOffset.right <= FARE_STOP_RULES.openingRightMax
        && approachOffset.forward > 0
        && streetRouteDistance(anchor, stop.approach) <= FARE_STOP_RULES.openingRouteMax;
    }, 1);
    if (output.length === 0) {
      throw new Error("Procedural fare placement could not find a visible opening pickup");
    }
  } else {
    const nearby = candidatesInRegion(
      rankedCandidates(seed, "pickup-nearby", anchor, FARE_STOP_RULES.nearbyPickupRadius),
      region,
    );
    addRankedStops(output, nearby, FARE_PICKUP_RADIUS, (stop) => {
      const routeDistance = streetRouteDistance(anchor, stop.approach);
      return (!region || stopBelongsToRegion(stop, region))
        && routeDistance >= minimumAnchorDistance
        && routeDistance <= FARE_STOP_RULES.nearbyPickupRadius
        && avoidsPreviousStops(stop, previousIds, previousPoints)
        && output.every((selected) => distance(selected.zone, stop.zone) >= ROAD_SPACING);
    }, Math.min(targetCount, nearbyPickupCount));
  }

  if (output.length === targetCount) return output;

  const radii = [
    FARE_STOP_RULES.serviceRadius,
    FARE_STOP_RULES.serviceRadius * 1.5,
    Math.max(WORLD_WIDTH, WORLD_HEIGHT),
  ];
  for (const searchRadius of radii) {
    const candidates = candidatesInRegion(
      rankedCandidates(seed, `pickup:${searchRadius}`, anchor, searchRadius),
      region,
    );
    addRankedStops(output, candidates, FARE_PICKUP_RADIUS, (stop) => {
      const routeDistance = streetRouteDistance(anchor, stop.approach);
      return (!region || stopBelongsToRegion(stop, region))
        && routeDistance >= minimumAnchorDistance
        && routeDistance <= Math.max(FARE_STOP_RULES.serviceRadius * 2, searchRadius)
        && avoidsPreviousStops(stop, previousIds, previousPoints)
        && output.every((selected) => distance(selected.zone, stop.zone) >= ROAD_SPACING);
    }, targetCount);
    if (output.length === targetCount) return output;
  }
  throw new Error(`Procedural fare placement could not find ${targetCount} safe pickup curbs`);
}

function selectDestinationStops(
  seed: number,
  anchor: Vec2,
  pickups: readonly FareStopPlacement[],
  previousJobs: readonly Job[],
  region: WorldRegion | null,
  targetCount = FARES_PER_CYCLE,
) {
  const previousIds = previousStopIds(previousJobs);
  const previousPoints = previousStopPoints(previousJobs);
  const pickupIds = new Set(pickups.map((stop) => stop.id));
  const output: FareStopPlacement[] = [];
  const radii = [
    FARE_STOP_RULES.destinationRadius,
    FARE_STOP_RULES.destinationRadius * 1.5,
    Math.max(WORLD_WIDTH, WORLD_HEIGHT),
  ];
  for (const searchRadius of radii) {
    const candidates = candidatesInRegion(
      rankedCandidates(seed, `dropoff:${searchRadius}`, anchor, searchRadius),
      region,
    );
    addRankedStops(output, candidates, FARE_DROPOFF_RADIUS, (stop) => (
      !pickupIds.has(stop.id)
      && (!region || stopBelongsToRegion(stop, region))
      && avoidsPreviousStops(stop, previousIds, previousPoints)
      && pickups.every((pickup) => {
        const routeDistance = streetRouteDistance(pickup.approach, stop.approach);
        return routeDistance >= MIN_FARE_HANDOFF_DISTANCE
          && routeDistance <= MAX_FARE_TRIP_DISTANCE;
      })
      && output.every((selected) => distance(selected.zone, stop.zone) >= ROAD_SPACING)
    ), targetCount);
    if (output.length === targetCount) return output;
  }
  throw new Error(`Procedural fare placement could not find ${targetCount} safe destination curbs`);
}

function shuffled<T>(values: readonly T[], seed: number) {
  const output = [...values];
  let state = seed >>> 0;
  const random = () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [output[index], output[swap]] = [output[swap], output[index]];
  }
  return output;
}

export type FareStopPairOptions = {
  /** Explicit rolling-market origin; normal cycles continue from the last dropoff. */
  anchor?: Vec2;
  count?: number;
  /** Number of pickups guaranteed inside the local nearby-search radius. */
  nearbyPickupCount?: number;
};

/** Finite, seeded selection over procedural curb slots derived from city bounds. */
export function createProceduralFareStopPairs(
  seed: number,
  previousJobs: readonly Job[] = [],
  openingPickup = false,
  region: WorldRegion | null = null,
  options: FareStopPairOptions = {},
) {
  const count = options.count ?? FARES_PER_CYCLE;
  if (count < 1 || count > FARES_PER_CYCLE) {
    throw new Error(`Fare stop-pair count ${count} is outside the six-slot contract`);
  }
  const anchor = options.anchor ?? previousJobs.at(-1)?.dropoffApproach ?? (region?.id === "copper-mesa" ? {
    // An initial desert market starts around its connected service town. Live
    // rolling markets continue from the actual previous dropoff above.
    x: 0, y: 1332, z: 24,
  } : {
    x: TAXI_START.x,
    y: TAXI_START.y,
  });
  const pickups = selectPickupStops(
    stableHash("pickup-stream", seed),
    anchor,
    previousJobs,
    openingPickup ? TAXI_START.heading : null,
    region,
    count,
    options.nearbyPickupCount ?? 1,
  );
  const destinations = selectDestinationStops(
    stableHash("dropoff-stream", seed),
    anchor,
    pickups,
    previousJobs,
    region,
    count,
  );
  const pairedDestinations = shuffled(destinations, stableHash("pairing-stream", seed));
  return pickups.map((pickup, index) => ({ pickup, dropoff: pairedDestinations[index] }));
}

function selectRegionalDestinationStop(
  seed: number,
  pickup: Pick<FareStopPlacement, "id" | "approach">,
  origin: WorldRegion,
  target: WorldRegion,
  previousJobs: readonly Job[],
) {
  const previousIds = previousStopIds(previousJobs);
  const previousPoints = previousStopPoints(previousJobs);
  const output: FareStopPlacement[] = [];
  const candidates = rankedCandidatesForRegion(
    seed,
    `regional-dropoff:${target.id}`,
    target,
  );
  const originBounds = regionRoadBounds(origin);
  const targetBounds = regionRoadBounds(target);
  const maxDistance = [origin.id, target.id].some(id => id === "northstar-range" || id === "copper-mesa")
    ? MAX_REGIONAL_FARE_TRIP_DISTANCE : MAX_FLAT_REGIONAL_FARE_TRIP_DISTANCE;
  const originCenter = {
    x: (originBounds.minX + originBounds.maxX) / 2,
    y: (originBounds.minY + originBounds.maxY) / 2,
  };
  const targetCenter = {
    x: (targetBounds.minX + targetBounds.maxX) / 2,
    y: (targetBounds.minY + targetBounds.maxY) / 2,
  };
  const reachesInterior = (stop: FareStopPlacement) => {
    const eastWest = targetCenter.x > originCenter.x
      ? stop.zone.x >= targetBounds.minX + REGIONAL_FARE_DESTINATION_DEPTH
      : targetCenter.x < originCenter.x
        ? stop.zone.x <= targetBounds.maxX - REGIONAL_FARE_DESTINATION_DEPTH
        : true;
    const northSouth = targetCenter.y > originCenter.y
      ? stop.zone.y >= targetBounds.minY + REGIONAL_FARE_DESTINATION_DEPTH
      : targetCenter.y < originCenter.y
        ? stop.zone.y <= targetBounds.maxY - REGIONAL_FARE_DESTINATION_DEPTH
        : true;
    return eastWest && northSouth;
  };
  addRankedStops(output, candidates, FARE_DROPOFF_RADIUS, (stop) => {
    const routeDistance = streetRouteDistance(pickup.approach, stop.approach);
    return stop.id !== pickup.id
      && stopBelongsToRegion(stop, target)
      && reachesInterior(stop)
      && routeDistance >= MIN_REGIONAL_FARE_TRIP_DISTANCE
      && routeDistance <= maxDistance
      && avoidsPreviousStops(stop, previousIds, previousPoints);
  }, 1);
  return output[0] ?? null;
}

/**
 * Retarget an existing waiting passenger without moving their visible pickup.
 * This lets the final fare in a market become regional after fare five while
 * keeping the rider, ring, and curb the player has already seen in place.
 */
export function createRegionalFareDestinationStop(
  seed: number,
  pickup: Pick<Job, "pickupStopId" | "pickupApproach">,
  origin: WorldRegion,
  target: WorldRegion,
  previousJobs: readonly Job[] = [],
) {
  if (origin.id === target.id) return null;
  return selectRegionalDestinationStop(
    stableHash(`regional-dropoff-stream:${target.id}`, seed),
    { id: pickup.pickupStopId, approach: pickup.pickupApproach },
    origin,
    target,
    previousJobs,
  );
}
