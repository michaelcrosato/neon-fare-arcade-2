import { coastCanalBlock, COAST_PIER, onCoastPier } from "./coastal-layout";
import { addReachGround, reachLandscape } from "./reach-landscape";
import { REACH_ROAD_IDS } from "./reach-roads";
import { reachIsLandAt, reachIsPromenadeAt } from "./reach-layout";
import { reachPalm } from "./reach-assets";
import { CEDAR_ROADS, CEDAR_COURTS } from "./cedar-layout";
import { regionalSettlementPlan } from "./terrain/settlement";
import { mountainRoadStructures } from "./roads/mountain-structures";
import { copperRoadStructures } from "./roads/copper-structures";
import { addMountainScenery } from "./mountain-scenery";
import { addCopperScenery } from "./copper-scenery";
import { addCoastScenery } from "./coast-scenery";
import { northstarLandscape, copperLandscape, coastLandscape, cityLandscape } from "./terrain/landscape";
import type { MeshFace, Vec3 } from "./model";
import { inNorthstarTerrain } from "./terrain/northstar-forms";
import { inElevatedTerrain, atRoadElevation } from "./terrain/region-forms";
import { inCopperTerrain } from "./terrain/copper-forms";
import { inCoastTerrain } from "./terrain/coast-forms";
import { inCityTerrain, drapeCityRoad } from "./terrain/city-forms";
import { cityGreenAt } from "./city-layout";
import { buildCityLot } from "./city-buildings";
import { finishCityLandmark } from "./city-landmarks";
import { addCityPaving, buildCityVerge, groundCityFoundations } from "./city-ground";
import { regionalTerrainMesh, terrainHeightAt } from "./terrain/surface";
import { compileRoad } from "./roads/geometry";
import { compiledSpecialRoad } from "./road-network";
import { roadStripQuad, MAX_CHUNK_SURFACE_QUADS, MAX_STREAM_SURFACE_QUADS } from "./render/surfaces";
import { roadStructure } from "./roads/structures";
import {
  BLOCKS_PER_CHUNK,
  BLUE,
  BONE,
  BRICK,
  CACHE_RADIUS,
  CHUNK_MAX,
  CHUNK_SIZE,
  COLLISION_STREAM_RADIUS,
  CYAN,
  DISTANT_STREAM_RADIUS,
  DISTRICT_LABELS,
  GENERIC_LOT_CONTENT_SCALE,
  GRASS,
  INK,
  LEAF,
  LIME,
  MAT_BUILDING,
  MAT_FOLIAGE,
  MAT_GENERIC,
  MAT_GRASS,
  MAT_LAMP,
  MAT_PERSON,
  MAT_ROAD,
  MAT_ROUTE,
  MAT_SIDEWALK,
  MAT_SIGN,
  MAT_VEHICLE,
  MAT_WATER,
  MAT_WINDOW,
  MAX_CHUNK_BOXES,
  MAX_CHUNK_COLLIDERS,
  MAX_CHUNK_INTERACTIONS,
  MAX_STREAM_BOXES,
  MAX_STREAM_COLLIDERS,
  MAX_STREAM_INTERACTIONS,
  MUTED_RED,
  ORANGE,
  PAPER,
  PINK,
  RED,
  ROAD,
  ROAD_HALF,
  ROAD_SPACING,
  STREET_COMMERCE_MAX_BOXES_PER_SCENE,
  STREET_COMMERCE_MAX_SCENES_PER_CHUNK,
  STEEL,
  WHITE,
  WORLD_CHUNK_MAX_X,
  WORLD_CHUNK_MAX_Y,
  WORLD_ROAD_MAX_X,
  WORLD_ROAD_MAX_Y,
  YELLOW,
} from "./config";
import { obbOverlap } from "./collision";
import { landmarkTileForBlock, type LandmarkTile } from "./landmarks";
import { campusInternalEdgesForBlock, campusLocalPoint, campusTileForBlock } from "./campuses";
import { blockRandom, clamp, localPoint } from "./math";
import type {
  Box,
  CityChunk,
  Collider,
  Color,
  DistrictKind,
  LotContext,
  LotKind,
  VenueKind,
  WorldInteraction,
  WorldView,
} from "./model";
import { ROUNDABOUTS } from "./road-layout";
import {
  MESA_CREAM,
  MESA_GOLD,
  MESA_REDROCK,
  MESA_SAGUARO,
  MESA_SAND,
  MESA_TURQUOISE,
  buildDesertLot,
  buildDesertVerge,
  desertAnchorForBlock,
  desertLotForBlock,
  desertPortalSpecs,
} from "./desert";
import {
  RANGE_AMBER,
  RANGE_GROUND,
  RANGE_SPRUCE,
  RANGE_TIMBER,
  buildMountainLot,
  mountainAnchorForBlock,
  mountainLotForBlock,
  mountainPortalSpecs,
  buildMountainVerge,
} from "./mountain";
import {
  isActiveChunk,
  nearestActiveChunk,
  regionForBlock,
  regionForChunk,
  regionalPlaceName,
} from "./regions";
import {
  cedarStreetIndex,
  residentialAnchorForBlock,
  residentialLotForBlock,
  residentialPortalSpecs,
} from "./residential";
import { gridStreetSegmentEnabled } from "./road-topology";
import { buildResidentialLot } from "./residential-buildings";
import { cedarRoundVolume, cedarTree, CEDAR_CREAM as VALE_CREAM, CEDAR_AMBER as VALE_AMBER, CEDAR_GROUND as VALE_GROUND } from "./cedar-assets";
import {
  SPECIAL_ROAD_SEGMENTS,
  isRoadSurface,
  nearestSpecialRoadProjection,
  specialRoadIntersectsSquare,
} from "./road-network";
import {
  REACH_CREAM,
  REACH_CYPRESS,
  REACH_LANTERN,
  REACH_MINT,
  REACH_MOSS,
  REACH_MUD,
  REACH_REED,
  buildWetlandLot,
  wetlandAnchorForBlock,
  wetlandLotForBlock,
  wetlandPortalSpecs,
  wetlandLotOrientation,
  buildReachVerge,
} from "./wetland";
import {
  buildCoastalLot, buildCoastalVerge, coastalAnchorForBlock, coastalLotForBlock,
  coastalPortalSpecs, COAST_SAND, COAST_STUCCO, COAST_CORAL, COAST_MINT,
} from "./coastal";

export function districtForBlock(blockX: number, blockY: number): DistrictKind {
  if (regionForBlock(blockX, blockY)?.id === "cedar-vale") return "residential";
  if (regionForBlock(blockX, blockY)?.id === "northstar-range") return "mountain";
  if (regionForBlock(blockX, blockY)?.id === "copper-mesa") return "desert";
  if (regionForBlock(blockX, blockY)?.id === "cypress-reach") return "wetland";
  if (regionForBlock(blockX, blockY)?.id === "solana-coast") return "coastal";
  const radius = Math.max(Math.abs(blockX), Math.abs(blockY));
  if (blockX >= 8 && blockY >= 8) return "harbor";
  if (blockY <= -9 || (blockX >= 6 && blockY <= -4)) return "industrial";
  if (radius <= 4) return "downtown";
  if (blockX <= -8 && blockY >= -5) return "market";
  if (blockX >= 9 || blockY >= 10) return "suburb";
  if (radius <= 9) return "commercial";
  return "townhomes";
}

export function districtForPosition(x: number, y: number) {
  return districtForBlock(Math.floor(x / ROAD_SPACING), Math.floor(y / ROAD_SPACING));
}

export function lotForBlock(blockX: number, blockY: number, district: DistrictKind): LotKind {
  if (district === "residential") return residentialLotForBlock(blockX, blockY);
  if (district === "mountain") return mountainLotForBlock(blockX, blockY);
  if (district === "desert") return desertLotForBlock(blockX, blockY);
  if (district === "wetland") return wetlandLotForBlock(blockX, blockY);
  if (district === "coastal") return coastalLotForBlock(blockX, blockY);
  if (landmarkTileForBlock(blockX, blockY)) return "landmark";
  if (cityGreenAt(blockX * ROAD_SPACING + 18, blockY * ROAD_SPACING + 18)) return "park";
  const signature = (
    Math.imul(blockX + 47, 73856093) ^
    Math.imul(blockY - 31, 19349663)
  ) >>> 0;
  if (signature % 17 === 0) return "park";
  if (signature % 31 === 0) return "civic";
  if (signature % 37 === 0 && district !== "downtown" && district !== "harbor") return "gas";
  const macroX = Math.floor((blockX + 2) / 4);
  const macroY = Math.floor((blockY + 2) / 4);
  const macroTone = blockRandom(macroX, macroY, 0x51f15e)();
  const roll = (blockRandom(blockX, blockY, 0x10a7)() * 0.72 + macroTone * 0.28) % 1;
  if (district === "downtown") return roll < 0.42 ? "tower" : roll < 0.58 ? "office" : roll < 0.72 ? "apartment" : roll < 0.84 ? "shops" : roll < 0.92 ? "plaza" : roll < 0.97 ? "park" : "civic";
  if (district === "commercial") return roll < 0.25 ? "shops" : roll < 0.36 ? "diner" : roll < 0.46 ? "office" : roll < 0.55 ? "gas" : roll < 0.63 ? "carwash" : roll < 0.72 ? "motel" : roll < 0.82 ? "apartment" : roll < 0.9 ? "civic" : roll < 0.95 ? "plaza" : "construction";
  if (district === "townhomes") return roll < 0.32 ? "townhouses" : roll < 0.48 ? "homes" : roll < 0.6 ? "apartment" : roll < 0.68 ? "diner" : roll < 0.77 ? "playground" : roll < 0.86 ? "park" : roll < 0.93 ? "shops" : "civic";
  if (district === "suburb") return roll < 0.34 ? "homes" : roll < 0.5 ? "townhouses" : roll < 0.62 ? "playground" : roll < 0.74 ? "park" : roll < 0.82 ? "civic" : roll < 0.89 ? "diner" : roll < 0.95 ? "shops" : "carwash";
  if (district === "market") return roll < 0.3 ? "market" : roll < 0.46 ? "shops" : roll < 0.58 ? "diner" : roll < 0.68 ? "plaza" : roll < 0.78 ? "apartment" : roll < 0.86 ? "park" : roll < 0.92 ? "gas" : "office";
  if (district === "industrial") return roll < 0.32 ? "warehouse" : roll < 0.5 ? "factory" : roll < 0.62 ? "construction" : roll < 0.72 ? "carwash" : roll < 0.8 ? "gas" : roll < 0.87 ? "diner" : roll < 0.93 ? "motel" : "shops";
  return roll < 0.27 ? "marina" : roll < 0.47 ? "boardwalk" : roll < 0.6 ? "shops" : roll < 0.7 ? "diner" : roll < 0.79 ? "apartment" : roll < 0.87 ? "park" : roll < 0.94 ? "motel" : "market";
}

export function lotOrientationForBlock(blockX: number, blockY: number) {
  const mountain = regionalSettlementPlan(blockX, blockY);
  if (mountain) return mountain.orientation;
  return Math.floor(blockRandom(blockX, blockY, 0x0a71e)() * 4);
}

/** Shared quarter-turn transform for lot geometry and semantic anchors. */
export function transformLotPose(
  centerX: number,
  centerY: number,
  x: number,
  y: number,
  heading: number,
  orientation: number,
  contentScale = 1,
) {
  const offsetX = (x - centerX) * contentScale;
  const offsetY = (y - centerY) * contentScale;
  if (orientation === 1) {
    return { x: centerX - offsetY, y: centerY + offsetX, heading: heading + Math.PI / 2 };
  }
  if (orientation === 2) {
    return { x: centerX - offsetX, y: centerY - offsetY, heading: heading + Math.PI };
  }
  if (orientation === 3) {
    return { x: centerX + offsetY, y: centerY - offsetX, heading: heading + Math.PI * 1.5 };
  }
  return { x: centerX + offsetX, y: centerY + offsetY, heading };
}

type PortalSpec = {
  id?: string;
  suffix: string;
  kind: VenueKind;
  label: string;
  x: number;
  y: number;
  heading?: number;
};

function portalSpecsForLot(
  lot: LotKind,
  centerX: number,
  centerY: number,
  blockX: number,
  blockY: number,
): PortalSpec[] {
  if (lot.startsWith("coast-")) {
    return coastalPortalSpecs(lot, centerX, centerY, blockX, blockY);
  }
  if (lot.startsWith("reach-")) {
    return wetlandPortalSpecs(lot, centerX, centerY, blockX, blockY);
  }
  if (lot.startsWith("mesa-")) {
    return desertPortalSpecs(lot, centerX, centerY, blockX, blockY);
  }
  if (lot.startsWith("range-")) {
    return mountainPortalSpecs(lot, centerX, centerY, blockX, blockY);
  }
  if (lot.startsWith("vale-")) {
    return residentialPortalSpecs(lot, centerX, centerY, blockX, blockY);
  }
  if (lot === "landmark") {
    const tile = landmarkTileForBlock(blockX, blockY);
    if (!tile) return [];
    const { portal } = tile.definition;
    if (portal.tileX !== tile.tileX || portal.tileY !== tile.tileY) return [];
    return [{
      suffix: portal.suffix,
      kind: portal.kind,
      label: tile.definition.label,
      x: centerX + portal.x,
      y: centerY + portal.y,
      heading: portal.heading,
    }];
  }
  if (lot === "tower" && blockX === 0 && blockY === 0) {
    return [{ suffix: "home", kind: "home", label: "NEON LOFTS", x: centerX - 2.2, y: centerY - 8.95 }];
  }
  if (lot === "tower") return [{ suffix: "lobby", kind: "lobby", label: "NEON MART", x: centerX - 2.2, y: centerY - 8.95 }];
  if (lot === "shops") return [
    { suffix: "left", kind: "shop", label: "INK & THREAD", x: centerX - 7.1, y: centerY + 1.15 },
    { suffix: "center", kind: "shop", label: "QUICKBYTE", x: centerX, y: centerY + 1.15 },
    { suffix: "right", kind: "shop", label: "NEON MARKET", x: centerX + 7.1, y: centerY + 1.15 },
  ];
  if (lot === "diner") return [{ suffix: "front", kind: "diner", label: "TURBO DINER", x: centerX + 1.6, y: centerY + 0.55 }];
  if (lot === "gas") return [{ suffix: "store", kind: "gas", label: "GO-GO GAS", x: centerX + 6.7, y: centerY + 0.35 }];
  if (lot === "market") return [{ suffix: "hall", kind: "market", label: "INK MARKET", x: centerX, y: centerY + 3.05 }];
  if (lot === "boardwalk") return [{ suffix: "arcade", kind: "arcade", label: "MARINA ARCADE", x: centerX + 6.8, y: centerY - 8.65 }];
  if (lot === "plaza") return [{ suffix: "kiosk", kind: "kiosk", label: "GO-GO KIOSK", x: centerX + 7.6, y: centerY - 1.2 }];
  if (lot === "office") return [{ suffix: "office", kind: "office", label: "APEX BUSINESS", x: centerX + 0.5, y: centerY - 4.15 }];
  if (lot === "apartment") return [{ suffix: "lobby", kind: "apartment", label: "SUNSET HEIGHTS", x: centerX - 5.4, y: centerY - 7.85 }];
  if (lot === "motel") return [{ suffix: "lobby", kind: "motel", label: "FLASH MOTEL", x: centerX + 7.7, y: centerY - 5.2 }];
  if (lot === "civic") return [{ suffix: "desk", kind: "civic", label: "CIVIC CENTER", x: centerX, y: centerY - 1 }];
  if (lot === "carwash") return [{ suffix: "desk", kind: "garage", label: "SPLASHLINE", x: centerX + 3.5, y: centerY - 0.55 }];
  if (lot === "warehouse") return [{ suffix: "dispatch", kind: "warehouse", label: "RUSH DEPOT", x: centerX + 7.4, y: centerY - 4.45 }];
  if (lot === "factory") return [{ suffix: "dispatch", kind: "factory", label: "VOLT WORKS", x: centerX + 3.8, y: centerY - 3.4 }];
  if (lot === "marina") return [{ suffix: "office", kind: "marina", label: "BLUE LINE MARINA", x: centerX + 7.3, y: centerY - 8.15 }];
  if (lot === "townhouses") return [{ suffix: "unit", kind: "residence", label: "BRICK ROW", x: centerX, y: centerY - 2.75 }];
  if (lot === "homes") return [{ suffix: "front", kind: "residence", label: "SUNSET HOME", x: centerX - 4, y: centerY - 7.7 }];
  return [];
}

function addLotInteractions(
  interactions: WorldInteraction[],
  blockX: number,
  blockY: number,
  centerX: number,
  centerY: number,
  lot: LotKind,
) {
  const landmark = lot === "landmark" ? landmarkTileForBlock(blockX, blockY) : null;
  const residentialAnchor = residentialAnchorForBlock(blockX, blockY);
  const mountainAnchor = mountainAnchorForBlock(blockX, blockY);
  const desertAnchor = desertAnchorForBlock(blockX, blockY);
  const wetlandAnchor = wetlandAnchorForBlock(blockX, blockY);
  const coastal = regionForBlock(blockX, blockY)?.theme === "coastal";
  const cedar = regionForBlock(blockX, blockY)?.theme === "residential";
  const wetland = regionForBlock(blockX, blockY)?.theme === "wetland";
  const fixedCoastal = coastal && (blockX < -56 || coastalAnchorForBlock(blockX, blockY) || coastCanalBlock(blockX, blockY));
  const orientation = landmark?.definition.orientation ?? (residentialAnchor || mountainAnchor || desertAnchor || wetlandAnchor || fixedCoastal || cedar ? 0 : wetland ? wetlandLotOrientation(blockX, blockY) : lotOrientationForBlock(blockX, blockY));
  const contentScale = landmark || residentialAnchor || mountainAnchor || desertAnchor || wetlandAnchor || coastal || cedar || wetland ? 1 : GENERIC_LOT_CONTENT_SCALE;
  for (const spec of portalSpecsForLot(lot, centerX, centerY, blockX, blockY)) {
    const pose = transformLotPose(
      centerX,
      centerY,
      spec.x,
      spec.y,
      spec.heading ?? -Math.PI / 2,
      orientation,
      contentScale,
    );
    const id = spec.id ?? `venue:${blockX}:${blockY}:${spec.suffix}`;
    interactions.push({
      id,
      kind: "venue-entrance",
      label: spec.label,
      x: pose.x,
      y: pose.y,
      heading: pose.heading,
      radius: 2.35,
      venue: { id, kind: spec.kind, label: spec.label },
    });
  }
}

function addSolid(ctx: LotContext, id: string, x: number, y: number, sx: number, sy: number, height: number) {
  ctx.colliders.push({ id: `${id}:${ctx.blockX}:${ctx.blockY}`, x, y, halfX: sx / 2, halfY: sy / 2, height });
}

function addWaterRegion(
  ctx: LotContext,
  id: string,
  x: number,
  y: number,
  sx: number,
  sy: number,
  yaw = 0,
) {
  ctx.surfaceRegions.push({
    id: `${id}:${ctx.blockX}:${ctx.blockY}`,
    kind: "water",
    x,
    y,
    halfX: sx / 2,
    halfY: sy / 2,
    yaw,
  });
}

function addBuildingShell(
  ctx: LotContext,
  id: string,
  x: number,
  y: number,
  sx: number,
  sy: number,
  height: number,
  color: Color,
  windowColor: Color = CYAN,
  roofColor: Color = INK,
) {
  ctx.boxes.push({ x: x + 0.52, y: y + 0.52, z: height / 2 + 0.46, sx: sx + 0.58, sy: sy + 0.58, sz: height, yaw: 0, color: INK, material: MAT_BUILDING });
  ctx.boxes.push({ x, y, z: height / 2 + 0.58, sx, sy, sz: height, yaw: 0, color, material: MAT_BUILDING });
  const bands = height > 10 ? 2 : 1;
  for (let band = 1; band <= bands; band += 1) {
    ctx.boxes.push({
      x,
      y,
      z: 0.65 + height * (band / (bands + 1)),
      sx: sx + 0.08,
      sy: sy + 0.08,
      sz: 0.34,
      yaw: 0,
      color: windowColor,
      material: MAT_WINDOW,
    });
  }
  ctx.boxes.push({ x, y, z: height + 0.72, sx: sx + 0.3, sy: sy + 0.3, sz: 0.28, yaw: 0, color: roofColor, material: MAT_BUILDING });
  if (height > 8 && ctx.random() > 0.45) {
    ctx.boxes.push({ x: x + sx * 0.22, y: y - sy * 0.2, z: height + 1.18, sx: 1.15, sy: 1.15, sz: 0.75, yaw: 0, color: STEEL, material: MAT_BUILDING });
  }
  addSolid(ctx, id, x, y, sx, sy, height + 0.7);
}

function addTree(ctx: LotContext, x: number, y: number, scale = 1, solid = false) {
  ctx.boxes.push({ x, y, z: 1.45 * scale + 0.45, sx: 0.58 * scale, sy: 0.58 * scale, sz: 2.9 * scale, yaw: 0, color: BRICK, material: MAT_BUILDING });
  ctx.boxes.push({ x: x + 0.12 * scale, y: y - 0.1 * scale, z: 3.7 * scale + 0.45, sx: 2.5 * scale, sy: 2.5 * scale, sz: 3.15 * scale, yaw: Math.PI / 4, color: ctx.random() > 0.38 ? LEAF : LIME, material: MAT_FOLIAGE });
  if (solid) addSolid(ctx, `tree-${ctx.boxes.length}`, x, y, 0.7 * scale, 0.7 * scale, 4.9 * scale);
}

function addBench(ctx: LotContext, x: number, y: number, yaw = 0) {
  ctx.boxes.push({ x, y, z: 0.78, sx: 2.25, sy: 0.52, sz: 0.2, yaw, color: BRICK, material: MAT_BUILDING });
  ctx.boxes.push({ x, y: y + 0.22, z: 1.28, sx: 2.25, sy: 0.18, sz: 0.82, yaw, color: INK, material: MAT_BUILDING });
  ctx.boxes.push({ x, y, z: 0.48, sx: 1.75, sy: 0.4, sz: 0.58, yaw, color: INK, material: MAT_BUILDING });
}

function addPerson(ctx: LotContext, x: number, y: number, color: Color) {
  ctx.boxes.push({ x, y, z: 1.05, sx: 0.52, sy: 0.38, sz: 1.25, yaw: 0, color, material: MAT_PERSON });
  ctx.boxes.push({ x, y, z: 1.82, sx: 0.48, sy: 0.48, sz: 0.48, yaw: 0, color: PAPER, material: MAT_PERSON });
}

function addParkedVehicle(ctx: LotContext, id: string, x: number, y: number, yaw: number, color: Color) {
  ctx.boxes.push({ x: x + 0.22, y: y + 0.22, z: 0.48, sx: 4.15, sy: 2.05, sz: 0.58, yaw, color: INK, material: MAT_VEHICLE });
  ctx.boxes.push({ x, y, z: 0.72, sx: 3.85, sy: 1.82, sz: 0.72, yaw, color, material: MAT_VEHICLE });
  ctx.boxes.push({ x: x - Math.cos(yaw) * 0.18, y: y - Math.sin(yaw) * 0.18, z: 1.22, sx: 1.8, sy: 1.5, sz: 0.5, yaw, color: WHITE, material: MAT_VEHICLE });
  const vertical = Math.abs(Math.sin(yaw)) > 0.7;
  addSolid(ctx, id, x, y, vertical ? 1.82 : 3.85, vertical ? 3.85 : 1.82, 1.55);
}

function addPylonSign(ctx: LotContext, x: number, y: number, face: Color, height = 5.3, width = 2.6, solid = false) {
  ctx.boxes.push({ x, y, z: height / 2 + 0.4, sx: 0.28, sy: 0.28, sz: height, yaw: 0, color: INK, material: MAT_BUILDING });
  ctx.boxes.push({ x, y, z: height + 0.55, sx: width + 0.35, sy: 0.5, sz: 1.7, yaw: 0, color: INK, material: MAT_BUILDING });
  ctx.boxes.push({ x, y: y - 0.18, z: height + 0.65, sx: width, sy: 0.18, sz: 1.36, yaw: 0, color: face, material: MAT_SIGN });
  if (solid) addSolid(ctx, `pylon-${ctx.boxes.length}`, x, y, 0.42, 0.42, height + 1.5);
}

function addParkingStripes(ctx: LotContext, x: number, y: number, count: number, vertical = false) {
  for (let index = 0; index < count; index += 1) {
    const offset = (index - (count - 1) / 2) * 2.6;
    ctx.boxes.push({
      x: vertical ? x : x + offset,
      y: vertical ? y + offset : y,
      z: 0.7,
      sx: vertical ? 2.1 : 0.18,
      sy: vertical ? 0.18 : 2.1,
      sz: 0.07,
      yaw: 0,
      color: WHITE,
      material: MAT_SIDEWALK,
    });
  }
}

function addCornerKit(ctx: LotContext, district: DistrictKind) {
  const x = ctx.centerX - 10.2;
  const y = ctx.centerY - 10.2;
  if (district === "suburb" || district === "townhomes" || district === "residential") {
    addTree(ctx, x, y, 0.7);
    ctx.boxes.push({ x: x + 1.8, y, z: 1.05, sx: 0.4, sy: 0.55, sz: 1.15, yaw: 0, color: district === "residential" ? YELLOW : district === "suburb" ? RED : BLUE, material: MAT_BUILDING });
    return;
  }
  ctx.boxes.push({ x, y, z: 1.8, sx: 0.24, sy: 0.24, sz: 3.2, yaw: 0, color: INK, material: MAT_LAMP });
  ctx.boxes.push({ x, y, z: 3.55, sx: 0.8, sy: 0.8, sz: 0.34, yaw: 0, color: district === "industrial" ? ORANGE : district === "harbor" ? BLUE : PINK, material: MAT_LAMP });
  if (district === "commercial" || district === "market") {
    ctx.boxes.push({ x: x + 1.8, y: y + 0.2, z: 0.9, sx: 0.58, sy: 0.58, sz: 0.95, yaw: 0, color: RED, material: MAT_BUILDING });
  } else if (district === "industrial") {
    ctx.boxes.push({ x: x + 1.8, y: y + 0.5, z: 0.82, sx: 1.4, sy: 1.1, sz: 1.05, yaw: 0, color: STEEL, material: MAT_BUILDING });
  }
}

export const STREET_COMMERCE_KINDS = [
  "hot-dog-cart",
  "newsstand",
  "produce-stand",
  "food-truck",
  "coffee-cart",
  "ice-cream-cart",
  "flower-stand",
  "busker",
] as const;

export type StreetCommerceKind = (typeof STREET_COMMERCE_KINDS)[number];

type StreetCommerceBlock = {
  blockX: number;
  blockY: number;
  centerX: number;
  centerY: number;
  district: DistrictKind;
  lot: LotKind;
};

type StreetCommercePlacement = {
  kind: StreetCommerceKind;
  x: number;
  y: number;
  yaw: number;
  sx: number;
  sy: number;
  halfX: number;
  halfY: number;
};

const STREET_COMMERCE_DENSITY: Readonly<Record<DistrictKind, number>> = {
  downtown: 0.32,
  commercial: 0.24,
  townhomes: 0.1,
  suburb: 0.08,
  residential: 0.055,
  mountain: 0,
  desert: 0.018,
  wetland: 0,
  coastal: 0,
  market: 0.3,
  industrial: 0.15,
  harbor: 0.22,
};

const STREET_COMMERCE_DECKS: Readonly<Record<DistrictKind, readonly StreetCommerceKind[]>> = {
  downtown: ["newsstand", "newsstand", "coffee-cart", "coffee-cart", "hot-dog-cart", "busker", "food-truck"],
  commercial: ["food-truck", "food-truck", "hot-dog-cart", "hot-dog-cart", "coffee-cart", "newsstand", "ice-cream-cart"],
  market: ["produce-stand", "produce-stand", "produce-stand", "flower-stand", "flower-stand", "hot-dog-cart", "food-truck", "busker"],
  harbor: ["ice-cream-cart", "ice-cream-cart", "food-truck", "food-truck", "produce-stand", "newsstand", "busker"],
  industrial: ["food-truck", "food-truck", "food-truck", "coffee-cart", "hot-dog-cart"],
  townhomes: ["flower-stand", "flower-stand", "coffee-cart", "ice-cream-cart", "busker", "hot-dog-cart"],
  suburb: ["ice-cream-cart", "ice-cream-cart", "flower-stand", "hot-dog-cart", "coffee-cart"],
  residential: ["ice-cream-cart", "flower-stand", "flower-stand", "coffee-cart", "hot-dog-cart", "busker"],
  mountain: ["coffee-cart", "food-truck", "busker"],
  desert: ["food-truck", "coffee-cart", "produce-stand", "busker"],
  wetland: ["food-truck", "coffee-cart", "busker"],
  coastal: ["ice-cream-cart", "food-truck", "busker"],
};

const STREET_COMMERCE_PALETTES: Readonly<Record<DistrictKind, readonly (readonly [Color, Color])[]>> = {
  downtown: [[RED, CYAN], [YELLOW, PINK], [BLUE, ORANGE]],
  commercial: [[ORANGE, CYAN], [RED, YELLOW], [PINK, BLUE]],
  market: [[PINK, LIME], [ORANGE, BLUE], [RED, YELLOW]],
  harbor: [[BLUE, ORANGE], [CYAN, PINK], [WHITE, RED]],
  industrial: [[ORANGE, STEEL], [YELLOW, RED], [WHITE, BLUE]],
  townhomes: [[BRICK, PINK], [BLUE, YELLOW], [LIME, ORANGE]],
  suburb: [[PINK, CYAN], [YELLOW, BLUE], [RED, WHITE]],
  residential: [[LEAF, YELLOW], [BONE, ORANGE], [BLUE, WHITE]],
  mountain: [[RANGE_AMBER, RANGE_GROUND], [CYAN, LEAF], [BONE, BRICK]],
  desert: [[MESA_TURQUOISE, MESA_REDROCK], [MESA_GOLD, MESA_CREAM], [ORANGE, PINK]],
  wetland: [[REACH_LANTERN, REACH_MUD], [REACH_MINT, REACH_CYPRESS], [REACH_CREAM, REACH_REED]],
  coastal: [[COAST_CORAL, COAST_STUCCO], [COAST_MINT, COAST_SAND]],
};

const STREET_COMMERCE_FOOTPRINTS: Readonly<Record<StreetCommerceKind, {
  sx: number;
  sy: number;
  normal: number;
  tangent: number;
}>> = {
  "hot-dog-cart": { sx: 1.8, sy: 0.9, normal: 9.25, tangent: 6.1 },
  newsstand: { sx: 2.7, sy: 1.5, normal: 8.8, tangent: 5.9 },
  "produce-stand": { sx: 2.4, sy: 1.3, normal: 9, tangent: 6 },
  "food-truck": { sx: 4.9, sy: 2.15, normal: 7.8, tangent: 5.1 },
  "coffee-cart": { sx: 1.8, sy: 1, normal: 9.2, tangent: 6.1 },
  "ice-cream-cart": { sx: 2.1, sy: 1.1, normal: 9.1, tangent: 6 },
  "flower-stand": { sx: 2.4, sy: 1.3, normal: 9, tangent: 6 },
  busker: { sx: 2.4, sy: 1.3, normal: 9, tangent: 6 },
};

function streetCommerceDeck(district: DistrictKind, lot: LotKind) {
  if (lot === "park" || lot === "playground" || lot === "plaza") {
    return ["ice-cream-cart", "hot-dog-cart", "flower-stand", "coffee-cart", "busker"] as const;
  }
  if (lot === "warehouse" || lot === "factory" || lot === "construction") {
    return ["food-truck", "food-truck", "food-truck", "coffee-cart", "hot-dog-cart"] as const;
  }
  if (lot === "market" || lot === "boardwalk" || lot === "marina") {
    return ["produce-stand", "produce-stand", "flower-stand", "ice-cream-cart", "food-truck", "busker"] as const;
  }
  if (lot === "tower" || lot === "office" || lot === "civic") {
    return ["newsstand", "coffee-cart", "coffee-cart", "hot-dog-cart", "food-truck"] as const;
  }
  return STREET_COMMERCE_DECKS[district];
}

export function streetCommerceKindForBlock(
  blockX: number,
  blockY: number,
  district = districtForBlock(blockX, blockY),
  lot = lotForBlock(blockX, blockY, district),
): StreetCommerceKind {
  const deck = streetCommerceDeck(district, lot);
  const roll = blockRandom(blockX, blockY, 0xc0ffee)();
  return deck[Math.min(deck.length - 1, Math.floor(roll * deck.length))];
}

function pointDistanceToAabb(
  point: { x: number; y: number },
  x: number,
  y: number,
  halfX: number,
  halfY: number,
) {
  return Math.hypot(
    Math.max(Math.abs(point.x - x) - halfX, 0),
    Math.max(Math.abs(point.y - y) - halfY, 0),
  );
}

function streetCommercePlacementIsClear(
  placement: StreetCommercePlacement,
  colliders: readonly Collider[],
  surfaceRegions: readonly LotContext["surfaceRegions"][number][],
  interactions: readonly WorldInteraction[],
) {
  const clearance = 0.46;
  for (const collider of colliders) {
    if (Math.abs(placement.x - collider.x) <= placement.halfX + collider.halfX + clearance
      && Math.abs(placement.y - collider.y) <= placement.halfY + collider.halfY + clearance) return false;
  }

  const roadSamples = [
    [0, 0],
    [-placement.halfX, -placement.halfY],
    [placement.halfX, -placement.halfY],
    [-placement.halfX, placement.halfY],
    [placement.halfX, placement.halfY],
    [-placement.halfX, 0],
    [placement.halfX, 0],
    [0, -placement.halfY],
    [0, placement.halfY],
  ] as const;
  if (roadSamples.some(([offsetX, offsetY]) => isRoadSurface({
    x: placement.x + offsetX,
    y: placement.y + offsetY,
  }, 0.45))) return false;

  const candidate = {
    x: placement.x,
    y: placement.y,
    heading: 0,
    halfLength: placement.halfX + clearance,
    halfWidth: placement.halfY + clearance,
  };
  if (surfaceRegions.some((region) => obbOverlap(candidate, {
    x: region.x,
    y: region.y,
    heading: region.yaw,
    halfLength: region.halfX + clearance,
    halfWidth: region.halfY + clearance,
  }))) return false;

  for (const interaction of interactions) {
    if (pointDistanceToAabb(interaction, placement.x, placement.y, placement.halfX, placement.halfY)
      <= interaction.radius + 0.75) return false;
    const returnPose = {
      x: interaction.x + Math.cos(interaction.heading) * 1.15,
      y: interaction.y + Math.sin(interaction.heading) * 1.15,
    };
    if (pointDistanceToAabb(returnPose, placement.x, placement.y, placement.halfX, placement.halfY)
      <= 0.94) return false;
  }
  return true;
}

function findStreetCommercePlacement(
  block: StreetCommerceBlock,
  kind: StreetCommerceKind,
  colliders: readonly Collider[],
  surfaceRegions: readonly LotContext["surfaceRegions"][number][],
  interactions: readonly WorldInteraction[],
) {
  const footprint = STREET_COMMERCE_FOOTPRINTS[kind];
  const { normal, tangent } = footprint;
  const candidates = [
    { x: block.centerX - tangent, y: block.centerY - normal, yaw: 0 },
    { x: block.centerX + tangent, y: block.centerY - normal, yaw: 0 },
    { x: block.centerX + normal, y: block.centerY - tangent, yaw: Math.PI / 2 },
    { x: block.centerX + normal, y: block.centerY + tangent, yaw: Math.PI / 2 },
    { x: block.centerX + tangent, y: block.centerY + normal, yaw: Math.PI },
    { x: block.centerX - tangent, y: block.centerY + normal, yaw: Math.PI },
    { x: block.centerX - normal, y: block.centerY + tangent, yaw: -Math.PI / 2 },
    { x: block.centerX - normal, y: block.centerY - tangent, yaw: -Math.PI / 2 },
  ];
  const start = block.blockX === 0 && block.blockY === 0
    ? 0
    : (
      Math.floor(blockRandom(block.blockX, block.blockY, 0x51de)() * candidates.length)
      + lotOrientationForBlock(block.blockX, block.blockY) * 2
    ) % candidates.length;
  for (let offset = 0; offset < candidates.length; offset += 1) {
    const candidate = candidates[(start + offset) % candidates.length];
    const vertical = Math.abs(Math.sin(candidate.yaw)) > 0.7;
    const placement: StreetCommercePlacement = {
      kind,
      ...candidate,
      sx: footprint.sx,
      sy: footprint.sy,
      halfX: (vertical ? footprint.sy : footprint.sx) / 2,
      halfY: (vertical ? footprint.sx : footprint.sy) / 2,
    };
    if (streetCommercePlacementIsClear(placement, colliders, surfaceRegions, interactions)) return placement;
  }
  return null;
}

function addCommerceBox(
  ctx: LotContext,
  placement: StreetCommercePlacement,
  forward: number,
  right: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  color: Color,
  material: Box["material"],
) {
  const point = localPoint(placement.x, placement.y, placement.yaw, forward, right);
  ctx.boxes.push({ ...point, z, sx, sy, sz, yaw: placement.yaw, color, material });
}

function addCommercePerson(
  ctx: LotContext,
  placement: StreetCommercePlacement,
  forward: number,
  right: number,
  color: Color,
) {
  const point = localPoint(placement.x, placement.y, placement.yaw, forward, right);
  addPerson(ctx, point.x, point.y, color);
}

function addCanopyCart(
  ctx: LotContext,
  placement: StreetCommercePlacement,
  accent: Color,
  secondary: Color,
  specialty: "hot-dog" | "coffee" | "ice-cream",
) {
  addCommerceBox(ctx, placement, 0, 0, 0.98, placement.sx - 0.12, placement.sy - 0.08, 0.72, INK, MAT_BUILDING);
  addCommerceBox(ctx, placement, 0, -placement.sy * 0.42, 1.25, placement.sx - 0.3, 0.12, 0.5, accent, MAT_SIGN);
  addCommerceBox(ctx, placement, 0, 0, 2.55, placement.sx + 0.35, placement.sy + 0.42, 0.24, accent, MAT_SIGN);
  addCommerceBox(ctx, placement, -placement.sx * 0.37, 0.2, 1.82, 0.12, 0.12, 1.35, INK, MAT_BUILDING);
  addCommerceBox(ctx, placement, placement.sx * 0.37, 0.2, 1.82, 0.12, 0.12, 1.35, INK, MAT_BUILDING);
  if (specialty === "coffee") {
    addCommerceBox(ctx, placement, 0.35, -0.04, 1.62, 0.42, 0.42, 0.62, CYAN, MAT_LAMP);
  } else if (specialty === "ice-cream") {
    addCommerceBox(ctx, placement, 0.45, -0.08, 1.7, 0.38, 0.3, 0.82, PINK, MAT_SIGN);
  } else {
    addCommerceBox(ctx, placement, 0, -0.02, 1.48, 0.82, 0.3, 0.18, secondary, MAT_SIGN);
  }
  addCommercePerson(ctx, placement, 0, 0.82, secondary);
  addCommercePerson(ctx, placement, placement.sx / 2 + 0.72, 0.05, accent);
}

function addNewsstand(
  ctx: LotContext,
  placement: StreetCommercePlacement,
  accent: Color,
  secondary: Color,
) {
  addCommerceBox(ctx, placement, 0, 0, 1.35, 2.55, 1.35, 1.85, INK, MAT_BUILDING);
  addCommerceBox(ctx, placement, 0, 0, 2.42, 2.92, 1.68, 0.3, accent, MAT_SIGN);
  addCommerceBox(ctx, placement, 0, -0.74, 1.3, 2.38, 0.14, 1.3, BONE, MAT_SIGN);
  addCommerceBox(ctx, placement, -0.76, -0.84, 1.32, 0.55, 0.08, 0.68, PAPER, MAT_SIGN);
  addCommerceBox(ctx, placement, 0, -0.84, 1.32, 0.55, 0.08, 0.68, RED, MAT_SIGN);
  addCommerceBox(ctx, placement, 0.76, -0.84, 1.32, 0.55, 0.08, 0.68, BLUE, MAT_SIGN);
  addCommercePerson(ctx, placement, 1.78, 0.18, secondary);
  addCommercePerson(ctx, placement, -1.82, 0.12, accent);
}

function addOpenStand(
  ctx: LotContext,
  placement: StreetCommercePlacement,
  accent: Color,
  secondary: Color,
  flowers: boolean,
) {
  addCommerceBox(ctx, placement, 0, 0, 1.08, 2.3, 1.1, 0.75, INK, MAT_BUILDING);
  addCommerceBox(ctx, placement, 0, 0, 2.48, 2.72, 1.65, 0.25, accent, MAT_SIGN);
  addCommerceBox(ctx, placement, -0.95, 0.18, 1.78, 0.12, 0.12, 1.4, INK, MAT_BUILDING);
  addCommerceBox(ctx, placement, 0.95, 0.18, 1.78, 0.12, 0.12, 1.4, INK, MAT_BUILDING);
  addCommerceBox(ctx, placement, -0.58, -0.28, flowers ? 1.62 : 1.45, 0.88, 0.55, flowers ? 0.66 : 0.36, flowers ? PINK : LIME, flowers ? MAT_FOLIAGE : MAT_SIGN);
  addCommerceBox(ctx, placement, 0.58, -0.28, flowers ? 1.62 : 1.45, 0.88, 0.55, flowers ? 0.66 : 0.36, flowers ? YELLOW : ORANGE, flowers ? MAT_FOLIAGE : MAT_SIGN);
  addCommercePerson(ctx, placement, 0, 0.9, secondary);
  addCommercePerson(ctx, placement, 1.72, 0.05, accent);
}

function addFoodTruck(
  ctx: LotContext,
  placement: StreetCommercePlacement,
  accent: Color,
  secondary: Color,
) {
  addCommerceBox(ctx, placement, 0, 0, 0.78, 4.8, 2, 0.8, INK, MAT_VEHICLE);
  addCommerceBox(ctx, placement, 0.35, 0, 1.62, 4.05, 1.84, 1.65, accent, MAT_VEHICLE);
  addCommerceBox(ctx, placement, -1.68, 0, 1.52, 1.15, 1.7, 1.35, BONE, MAT_VEHICLE);
  addCommerceBox(ctx, placement, 0.72, -0.96, 1.78, 1.65, 0.1, 0.82, CYAN, MAT_WINDOW);
  addCommerceBox(ctx, placement, 0.72, -1.3, 2.42, 2.05, 0.62, 0.18, secondary, MAT_SIGN);
  addCommerceBox(ctx, placement, 0.72, 0, 2.78, 2.25, 0.46, 0.48, secondary, MAT_SIGN);
  addCommercePerson(ctx, placement, 0.72, -1.42, secondary);
  addCommercePerson(ctx, placement, -0.92, -1.7, accent);
}

function addBusker(
  ctx: LotContext,
  placement: StreetCommercePlacement,
  accent: Color,
  secondary: Color,
) {
  addCommerceBox(ctx, placement, 0, 0, 0.64, 2.4, 1.3, 0.08, accent, MAT_SIGN);
  addCommerceBox(ctx, placement, 0.72, -0.22, 0.75, 1.02, 0.46, 0.12, INK, MAT_BUILDING);
  addCommerceBox(ctx, placement, 0.72, -0.22, 0.83, 0.82, 0.3, 0.08, RED, MAT_SIGN);
  addCommerceBox(ctx, placement, -0.9, 0.22, 0.98, 0.5, 0.45, 0.68, INK, MAT_BUILDING);
  addCommerceBox(ctx, placement, 0, 0.05, 1.28, 0.54, 0.28, 0.72, secondary, MAT_SIGN);
  addCommerceBox(ctx, placement, 0, 0.05, 1.9, 0.14, 0.16, 0.9, BRICK, MAT_BUILDING);
  addCommercePerson(ctx, placement, 0, 0.38, secondary);
  addCommercePerson(ctx, placement, 1.65, 0.18, accent);
}

function addStreetCommerceScene(
  ctx: LotContext,
  block: StreetCommerceBlock,
  placement: StreetCommercePlacement,
) {
  const palette = STREET_COMMERCE_PALETTES[block.district];
  const paletteIndex = Math.floor(blockRandom(block.blockX, block.blockY, 0xacc37)() * palette.length);
  const [accent, secondary] = palette[Math.min(palette.length - 1, paletteIndex)];
  const firstBox = ctx.boxes.length;
  if (placement.kind === "hot-dog-cart") addCanopyCart(ctx, placement, accent, secondary, "hot-dog");
  else if (placement.kind === "coffee-cart") addCanopyCart(ctx, placement, accent, secondary, "coffee");
  else if (placement.kind === "ice-cream-cart") addCanopyCart(ctx, placement, accent, secondary, "ice-cream");
  else if (placement.kind === "newsstand") addNewsstand(ctx, placement, accent, secondary);
  else if (placement.kind === "produce-stand") addOpenStand(ctx, placement, accent, secondary, false);
  else if (placement.kind === "flower-stand") addOpenStand(ctx, placement, accent, secondary, true);
  else if (placement.kind === "food-truck") addFoodTruck(ctx, placement, accent, secondary);
  else addBusker(ctx, placement, accent, secondary);

  const boxCount = ctx.boxes.length - firstBox;
  if (boxCount > STREET_COMMERCE_MAX_BOXES_PER_SCENE) {
    throw new Error(`Street commerce ${placement.kind} exceeded ${STREET_COMMERCE_MAX_BOXES_PER_SCENE} boxes`);
  }
  ctx.colliders.push({
    id: `street-commerce:${placement.kind}:${block.blockX}:${block.blockY}`,
    x: placement.x,
    y: placement.y,
    halfX: placement.halfX,
    halfY: placement.halfY,
    height: placement.kind === "food-truck" ? 3.2 : 3,
  });
}

function addStreetCommerceForChunk(
  ctx: Pick<LotContext, "boxes" | "colliders" | "surfaceRegions">,
  interactions: readonly WorldInteraction[],
  blocks: readonly StreetCommerceBlock[],
) {
  const selected = blocks
    .map((block) => {
      // The opening block always introduces the system with one familiar cart;
      // every other scene follows the normal district density roll.
      const presence = block.blockX === 0 && block.blockY === 0
        ? -1
        : blockRandom(block.blockX, block.blockY, 0x57ee7)();
      const density = STREET_COMMERCE_DENSITY[block.district];
      return { block, presence, score: presence / density };
    })
    .filter(({ presence, block }) => presence < STREET_COMMERCE_DENSITY[block.district])
    .sort((left, right) => left.score - right.score
      || left.block.blockX - right.block.blockX
      || left.block.blockY - right.block.blockY)
    .slice(0, STREET_COMMERCE_MAX_SCENES_PER_CHUNK);

  const commerceCtx: LotContext = {
    ...ctx,
    centerX: 0,
    centerY: 0,
    blockX: 0,
    blockY: 0,
    random: () => 0.5,
  };
  for (const { block } of selected) {
    const requestedKind = streetCommerceKindForBlock(block.blockX, block.blockY, block.district, block.lot);
    let placement = findStreetCommercePlacement(
      block,
      requestedKind,
      ctx.colliders,
      ctx.surfaceRegions,
      interactions,
    );
    if (!placement && requestedKind === "food-truck") {
      const fallbackKind = block.district === "industrial" ? "coffee-cart" : "hot-dog-cart";
      placement = findStreetCommercePlacement(
        block,
        fallbackKind,
        ctx.colliders,
        ctx.surfaceRegions,
        interactions,
      );
    }
    if (!placement) continue;
    commerceCtx.blockX = block.blockX;
    commerceCtx.blockY = block.blockY;
    commerceCtx.centerX = block.centerX;
    commerceCtx.centerY = block.centerY;
    const firstBox = ctx.boxes.length, firstCollider = ctx.colliders.length;
    addStreetCommerceScene(commerceCtx, block, placement);
    if (inCityTerrain(placement.x, placement.y)) {
      const floor = terrainHeightAt(placement.x, placement.y);
      for (let i = firstBox; i < ctx.boxes.length; i += 1) { ctx.boxes[i].z += floor; ctx.boxes[i].screenLift = floor; }
      for (let i = firstCollider; i < ctx.colliders.length; i += 1) ctx.colliders[i].baseZ = floor;
    }
  }
}

function addTowerLot(ctx: LotContext) {
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 0.55, sx: 22.2, sy: 22.2, sz: 0.18, yaw: 0, color: WHITE, material: MAT_SIDEWALK });
  const colors = [BONE, WHITE, STEEL, BRICK] as const;
  const style = ctx.random();
  if (style < 0.38) {
    addBuildingShell(ctx, "tower-a", ctx.centerX - 4.7, ctx.centerY + 1.3, 9.2, 15.5, 18 + ctx.random() * 6, colors[Math.floor(ctx.random() * colors.length)], CYAN, RED);
    addBuildingShell(ctx, "tower-b", ctx.centerX + 5.8, ctx.centerY + 4.3, 7.4, 8.8, 12 + ctx.random() * 7, colors[Math.floor(ctx.random() * colors.length)], BLUE, INK);
  } else if (style < 0.72) {
    addBuildingShell(ctx, "tower-slab", ctx.centerX + 1.2, ctx.centerY + 2.4, 13.5, 12.8, 20 + ctx.random() * 5, colors[Math.floor(ctx.random() * colors.length)], CYAN, INK);
    ctx.boxes.push({ x: ctx.centerX - 6.7, y: ctx.centerY - 5.7, z: 2.15, sx: 7.2, sy: 5.1, sz: 3.2, yaw: 0, color: BRICK, material: MAT_BUILDING });
    addSolid(ctx, "tower-podium", ctx.centerX - 6.7, ctx.centerY - 5.7, 7.2, 5.1, 3.5);
  } else {
    addBuildingShell(ctx, "stepped-base", ctx.centerX, ctx.centerY + 2.2, 16.5, 14.5, 9.5, BRICK, CYAN, INK);
    ctx.boxes.push({ x: ctx.centerX + 1.8, y: ctx.centerY + 2.3, z: 14.2, sx: 9.4, sy: 9.2, sz: 9.2, yaw: 0, color: BONE, material: MAT_BUILDING });
    ctx.boxes.push({ x: ctx.centerX + 1.8, y: ctx.centerY + 2.3, z: 18.95, sx: 9.8, sy: 9.6, sz: 0.3, yaw: 0, color: RED, material: MAT_BUILDING });
  }
  ctx.boxes.push({ x: ctx.centerX - 2.2, y: ctx.centerY - 7.7, z: 1.22, sx: 6.4, sy: 2.2, sz: 0.32, yaw: 0, color: INK, material: MAT_BUILDING });
  ctx.boxes.push({ x: ctx.centerX - 2.2, y: ctx.centerY - 7.95, z: 1.43, sx: 5.9, sy: 0.35, sz: 0.55, yaw: 0, color: ORANGE, material: MAT_SIGN });
  addPerson(ctx, ctx.centerX - 8.8, ctx.centerY - 9.2, RED);
  addPerson(ctx, ctx.centerX + 4.8, ctx.centerY - 8.1, BLUE);
}

function addOfficeLot(ctx: LotContext) {
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 0.55, sx: 22.2, sy: 22.2, sz: 0.18, yaw: 0, color: BONE, material: MAT_SIDEWALK });
  const glass = ctx.random() > 0.5 ? CYAN : BLUE;
  addBuildingShell(ctx, "office-main", ctx.centerX + 3.5, ctx.centerY + 3.7, 12.4, 13.8, 12 + ctx.random() * 5, STEEL, glass, INK);
  addBuildingShell(ctx, "office-wing", ctx.centerX - 6.3, ctx.centerY + 5.2, 6.2, 9.6, 7.5 + ctx.random() * 3.5, BONE, glass, RED);
  ctx.boxes.push({ x: ctx.centerX + 0.5, y: ctx.centerY - 3.5, z: 2.4, sx: 8.5, sy: 2.1, sz: 0.42, yaw: 0, color: INK, material: MAT_BUILDING });
  ctx.boxes.push({ x: ctx.centerX + 0.5, y: ctx.centerY - 3.78, z: 2.55, sx: 7.8, sy: 0.28, sz: 0.52, yaw: 0, color: ORANGE, material: MAT_SIGN });
  ctx.boxes.push({ x: ctx.centerX - 3.4, y: ctx.centerY - 6.7, z: 0.72, sx: 11.2, sy: 5.2, sz: 0.16, yaw: 0, color: WHITE, material: MAT_SIDEWALK });
  for (const x of [-7.4, -2.2]) {
    ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY - 7.2, z: 0.95, sx: 2.8, sy: 1.3, sz: 0.72, yaw: 0, color: INK, material: MAT_GENERIC });
    ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY - 7.2, z: 1.45, sx: 2.35, sy: 1.05, sz: 0.7, yaw: 0, color: LEAF, material: MAT_FOLIAGE });
  }
  ctx.boxes.push({ x: ctx.centerX - 4.8, y: ctx.centerY - 4.7, z: 2.2, sx: 0.58, sy: 0.58, sz: 3.2, yaw: 0, color: INK, material: MAT_GENERIC });
  ctx.boxes.push({ x: ctx.centerX - 4.8, y: ctx.centerY - 4.7, z: 3.95, sx: 2.2, sy: 2.2, sz: 0.5, yaw: Math.PI / 4, color: PINK, material: MAT_SIGN });
  addPerson(ctx, ctx.centerX - 0.5, ctx.centerY - 7.6, BLUE);
  addPerson(ctx, ctx.centerX + 2.2, ctx.centerY - 6.8, RED);
}

function addApartmentLot(ctx: LotContext) {
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 0.55, sx: 22, sy: 22, sz: 0.18, yaw: 0, color: GRASS, material: MAT_GRASS });
  const colors = [BRICK, BONE, WHITE, STEEL] as const;
  for (const side of [-1, 1]) {
    const x = ctx.centerX + side * 5.4;
    const height = 10 + ctx.random() * 5;
    addBuildingShell(ctx, `apartment-${side}`, x, ctx.centerY + 1.4, 8.2, 17.2, height, colors[Math.floor(ctx.random() * colors.length)], side > 0 ? CYAN : BLUE, INK);
    for (let floor = 0; floor < 2; floor += 1) {
      ctx.boxes.push({ x, y: ctx.centerY - 7.35, z: 3.1 + floor * 2.7, sx: 6.7, sy: 0.85, sz: 0.2, yaw: 0, color: side > 0 ? ORANGE : WHITE, material: MAT_BUILDING });
    }
  }
  for (const x of [ctx.centerX - 8.8, ctx.centerX + 8.8]) addTree(ctx, x, ctx.centerY - 7.8, 0.68);
  addBench(ctx, ctx.centerX, ctx.centerY - 8.2);
  addPerson(ctx, ctx.centerX - 2.1, ctx.centerY - 8.4, PINK);
}

function addShopLot(ctx: LotContext) {
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 0.55, sx: 22.4, sy: 22.4, sz: 0.18, yaw: 0, color: ROAD, material: MAT_ROAD });
  const colors = [BONE, BRICK, STEEL] as const;
  const accents = [RED, ORANGE, PINK, BLUE] as const;
  for (let shop = -1; shop <= 1; shop += 1) {
    const x = ctx.centerX + shop * 7.1;
    const color = colors[(shop + 2 + Math.floor(ctx.random() * 3)) % colors.length];
    const accent = accents[(shop + 2 + Math.floor(ctx.random() * 4)) % accents.length];
    addBuildingShell(ctx, `shop-${shop}`, x, ctx.centerY + 6.5, 6.45, 8.1, 4.6 + ctx.random() * 2.2, color, CYAN, INK);
    ctx.boxes.push({ x, y: ctx.centerY + 2.05, z: 2.8, sx: 5.8, sy: 0.82, sz: 0.4, yaw: 0, color: accent, material: MAT_SIGN });
    ctx.boxes.push({ x, y: ctx.centerY + 2.24, z: 1.55, sx: 2.8, sy: 0.25, sz: 1.55, yaw: 0, color: CYAN, material: MAT_WINDOW });
  }
  addParkingStripes(ctx, ctx.centerX, ctx.centerY - 4.2, 4);
  if (ctx.random() > 0.3) addParkedVehicle(ctx, "shop-car", ctx.centerX + 6.5, ctx.centerY - 4.1, Math.PI / 2, ctx.random() > 0.5 ? RED : BLUE);
  addPylonSign(ctx, ctx.centerX - 9.2, ctx.centerY - 5.4, ORANGE, 4.5, 2.1);
  addPerson(ctx, ctx.centerX - 3.5, ctx.centerY + 0.7, YELLOW);
  addPerson(ctx, ctx.centerX + 1.5, ctx.centerY + 0.5, PINK);
}

function addDinerLot(ctx: LotContext) {
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 0.55, sx: 22.5, sy: 22.5, sz: 0.18, yaw: 0, color: ROAD, material: MAT_ROAD });
  addBuildingShell(ctx, "diner", ctx.centerX + 1.6, ctx.centerY + 5.6, 16.5, 8.1, 4.5, BONE, CYAN, RED);
  ctx.boxes.push({ x: ctx.centerX + 1.6, y: ctx.centerY + 1.32, z: 3.25, sx: 15.7, sy: 0.58, sz: 0.52, yaw: 0, color: INK, material: MAT_GENERIC });
  for (let panel = 0; panel < 5; panel += 1) {
    const x = ctx.centerX - 4.7 + panel * 3.15;
    ctx.boxes.push({ x, y: ctx.centerY + 0.98, z: 3.28, sx: 2.6, sy: 0.18, sz: 0.34, yaw: 0, color: panel % 2 ? CYAN : PINK, material: MAT_SIGN });
  }
  ctx.boxes.push({ x: ctx.centerX - 4.2, y: ctx.centerY + 1.05, z: 1.65, sx: 2.2, sy: 0.22, sz: 2.05, yaw: 0, color: BLUE, material: MAT_WINDOW });
  ctx.boxes.push({ x: ctx.centerX + 5.9, y: ctx.centerY + 1.05, z: 1.65, sx: 2.2, sy: 0.22, sz: 2.05, yaw: 0, color: BLUE, material: MAT_WINDOW });
  addParkingStripes(ctx, ctx.centerX, ctx.centerY - 4.8, 5);
  addParkedVehicle(ctx, "diner-car-a", ctx.centerX - 5.8, ctx.centerY - 6.2, Math.PI / 2, RED);
  if (ctx.random() > 0.45) addParkedVehicle(ctx, "diner-car-b", ctx.centerX + 5.2, ctx.centerY - 6.2, Math.PI / 2, BLUE);
  addPylonSign(ctx, ctx.centerX - 9.2, ctx.centerY - 4.8, PINK, 6.3, 2.8, true);
  addPerson(ctx, ctx.centerX + 8.1, ctx.centerY + 0.3, ORANGE);
}

function addTownhouseLot(ctx: LotContext) {
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 0.55, sx: 22.2, sy: 22.2, sz: 0.18, yaw: 0, color: GRASS, material: MAT_GRASS });
  ctx.boxes.push({ x: ctx.centerX + 0.35, y: ctx.centerY + 2.8, z: 3.75, sx: 20.7, sy: 9.7, sz: 6.4, yaw: 0, color: INK, material: MAT_BUILDING });
  const colors = [BRICK, BONE, STEEL, WHITE, MUTED_RED] as const;
  for (let unit = 0; unit < 5; unit += 1) {
    const x = ctx.centerX + (unit - 2) * 4.15;
    const height = 5.5 + (unit % 3) * 0.75;
    ctx.boxes.push({ x, y: ctx.centerY + 2.45, z: height / 2 + 0.62, sx: 3.65, sy: 9.1, sz: height, yaw: 0, color: colors[unit], material: MAT_BUILDING });
    ctx.boxes.push({ x, y: ctx.centerY + 2.45, z: height + 0.75, sx: 3.88, sy: 9.35, sz: 0.3, yaw: 0, color: unit % 2 ? INK : RED, material: MAT_BUILDING });
    ctx.boxes.push({ x, y: ctx.centerY - 2.15, z: 1.55, sx: 0.9, sy: 0.24, sz: 1.8, yaw: 0, color: unit % 2 ? BLUE : ORANGE, material: MAT_SIGN });
    ctx.boxes.push({ x, y: ctx.centerY - 3.1, z: 0.72, sx: 1.7, sy: 1.5, sz: 0.24, yaw: 0, color: BONE, material: MAT_SIDEWALK });
  }
  addSolid(ctx, "townhouse-row", ctx.centerX, ctx.centerY + 2.45, 20.3, 9.1, 7.8);
  for (const x of [ctx.centerX - 7.2, ctx.centerX, ctx.centerX + 7.2]) {
    ctx.boxes.push({ x, y: ctx.centerY - 5.1, z: 0.85, sx: 2.3, sy: 0.75, sz: 0.95, yaw: 0, color: LEAF, material: MAT_FOLIAGE });
  }
  addTree(ctx, ctx.centerX - 9.5, ctx.centerY - 8, 0.6);
  addTree(ctx, ctx.centerX + 9.5, ctx.centerY - 8, 0.6);
  addPerson(ctx, ctx.centerX + 5.2, ctx.centerY - 5.6, RED);
}

function addHomesLot(ctx: LotContext) {
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 0.55, sx: 22.5, sy: 22.5, sz: 0.18, yaw: 0, color: GRASS, material: MAT_GRASS });
  const homes = [
    { x: -6.2, y: -2.5, c: BONE },
    { x: 5.5, y: -3.2, c: BRICK },
    { x: 0.3, y: 6.1, c: WHITE },
  ] as const;
  homes.forEach((home, index) => {
    const height = 4.2 + ctx.random() * 1.8;
    const colliderIndex = ctx.colliders.length;
    addBuildingShell(ctx, `home-${index}`, ctx.centerX + home.x, ctx.centerY + home.y, 6.6, 6.9, height, home.c, BLUE, index % 2 ? RED : INK);
    const homeCollider = ctx.colliders[colliderIndex];
    homeCollider.y -= 0.45;
    homeCollider.halfY = 3.9;
    ctx.boxes.push({ x: ctx.centerX + home.x + 2.2, y: ctx.centerY + home.y - 3.8, z: 1.55, sx: 2, sy: 1.1, sz: 2, yaw: 0, color: STEEL, material: MAT_BUILDING });
    ctx.boxes.push({ x: ctx.centerX + home.x + 2.2, y: ctx.centerY + home.y - 5.2, z: 0.7, sx: 2.2, sy: 4, sz: 0.08, yaw: 0, color: BONE, material: MAT_SIDEWALK });
  });
  ([[-9.2, -8.1], [9.1, -8], [-8.7, 7.7], [8.7, 7.9]] as const).forEach(([x, y], index) => addTree(ctx, ctx.centerX + x, ctx.centerY + y, 0.58, index < 2));
  for (const side of [-1, 1]) ctx.boxes.push({ x: ctx.centerX + side * 10.5, y: ctx.centerY, z: 0.9, sx: 0.28, sy: 19.4, sz: 1.05, yaw: 0, color: WHITE, material: MAT_BUILDING });
  addParkedVehicle(ctx, "driveway-car", ctx.centerX + 7.6, ctx.centerY - 9.9, Math.PI / 2, BLUE);
  ctx.boxes.push({ x: ctx.centerX - 3.4, y: ctx.centerY - 9.4, z: 1.1, sx: 0.42, sy: 0.55, sz: 1.2, yaw: 0, color: RED, material: MAT_BUILDING });
  addPerson(ctx, ctx.centerX - 1.2, ctx.centerY - 8.5, ORANGE);
}

function addParkLot(ctx: LotContext) {
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 0.57, sx: 22.7, sy: 22.7, sz: 0.22, yaw: 0, color: GRASS, material: MAT_GRASS });
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 0.7, sx: 3.1, sy: 22.2, sz: 0.08, yaw: 0, color: BONE, material: MAT_SIDEWALK });
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 0.71, sx: 22.2, sy: 3.1, sz: 0.08, yaw: 0, color: BONE, material: MAT_SIDEWALK });
  for (const [x, y] of [[-8, -8], [-8, 7.7], [8, -8], [8, 7.7], [-5.2, 4.8], [5.2, -4.8]] as const) addTree(ctx, ctx.centerX + x, ctx.centerY + y, 0.72 + ctx.random() * 0.16, true);
  addBench(ctx, ctx.centerX - 5.4, ctx.centerY - 1.9);
  addBench(ctx, ctx.centerX + 5.4, ctx.centerY + 1.9, Math.PI);
  if (ctx.random() > 0.42) {
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 0.82, sx: 5.3, sy: 5.3, sz: 0.35, yaw: Math.PI / 4, color: INK, material: MAT_BUILDING });
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 1, sx: 4.55, sy: 4.55, sz: 0.28, yaw: Math.PI / 4, color: BLUE, material: MAT_WATER });
    addWaterRegion(ctx, "park-fountain-water", ctx.centerX, ctx.centerY, 4.55, 4.55, Math.PI / 4);
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 2, sx: 0.5, sy: 0.5, sz: 2.2, yaw: 0, color: WHITE, material: MAT_WATER });
    addSolid(ctx, "park-fountain", ctx.centerX, ctx.centerY, 4, 4, 2.7);
  } else {
    ctx.boxes.push({ x: ctx.centerX - 1.8, y: ctx.centerY + 1.2, z: 1.65, sx: 4.8, sy: 0.45, sz: 0.45, yaw: -0.5, color: RED, material: MAT_BUILDING });
    ctx.boxes.push({ x: ctx.centerX + 2.4, y: ctx.centerY + 3.2, z: 1.2, sx: 0.4, sy: 3.9, sz: 2.2, yaw: 0, color: INK, material: MAT_BUILDING });
    ctx.boxes.push({ x: ctx.centerX + 2.4, y: ctx.centerY + 3.2, z: 2.35, sx: 3.2, sy: 0.4, sz: 0.35, yaw: 0, color: YELLOW, material: MAT_SIGN });
  }
  addPerson(ctx, ctx.centerX - 2.1, ctx.centerY + 7.2, PINK);
  addPerson(ctx, ctx.centerX + 2.4, ctx.centerY - 6.8, ORANGE);
}

function addPlaygroundLot(ctx: LotContext) {
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 0.57, sx: 22.7, sy: 22.7, sz: 0.22, yaw: 0, color: GRASS, material: MAT_GRASS });
  ctx.boxes.push({ x: ctx.centerX + 5.5, y: ctx.centerY + 1.2, z: 0.69, sx: 9.5, sy: 14.8, sz: 0.1, yaw: 0, color: ROAD, material: MAT_ROAD });
  ctx.boxes.push({ x: ctx.centerX + 5.5, y: ctx.centerY + 1.2, z: 0.77, sx: 0.18, sy: 13.8, sz: 0.06, yaw: 0, color: WHITE, material: MAT_SIDEWALK });
  ctx.boxes.push({ x: ctx.centerX + 5.5, y: ctx.centerY + 1.2, z: 0.78, sx: 8.7, sy: 0.18, sz: 0.06, yaw: 0, color: WHITE, material: MAT_SIDEWALK });
  for (const y of [-4.5, 6.9]) {
    ctx.boxes.push({ x: ctx.centerX + 5.5, y: ctx.centerY + y, z: 2.15, sx: 0.32, sy: 0.32, sz: 2.8, yaw: 0, color: INK, material: MAT_GENERIC });
    ctx.boxes.push({ x: ctx.centerX + 5.5, y: ctx.centerY + y, z: 3.45, sx: 2.2, sy: 0.22, sz: 1.35, yaw: 0, color: ORANGE, material: MAT_SIGN });
  }
  ctx.boxes.push({ x: ctx.centerX - 5.2, y: ctx.centerY + 1.8, z: 0.7, sx: 8.2, sy: 8.2, sz: 0.12, yaw: Math.PI / 4, color: BONE, material: MAT_SIDEWALK });
  ctx.boxes.push({ x: ctx.centerX - 5.2, y: ctx.centerY + 1.8, z: 2.25, sx: 3.2, sy: 3.2, sz: 2.7, yaw: 0, color: RED, material: MAT_GENERIC });
  ctx.boxes.push({ x: ctx.centerX - 6.7, y: ctx.centerY - 0.6, z: 1.55, sx: 5.2, sy: 1.25, sz: 0.34, yaw: -0.55, color: YELLOW, material: MAT_SIGN });
  addSolid(ctx, "play-tower", ctx.centerX - 5.2, ctx.centerY + 1.8, 3.2, 3.2, 3.8);
  for (const x of [-8.5, -5.5, -2.5]) {
    ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY + 7.2, z: 2.05, sx: 0.28, sy: 0.28, sz: 3.2, yaw: 0, color: INK, material: MAT_GENERIC });
  }
  ctx.boxes.push({ x: ctx.centerX - 5.5, y: ctx.centerY + 7.2, z: 3.6, sx: 6.2, sy: 0.32, sz: 0.32, yaw: 0, color: BLUE, material: MAT_GENERIC });
  for (const x of [-7, -4]) ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY + 7.2, z: 1.75, sx: 0.18, sy: 1.6, sz: 2.7, yaw: 0, color: PINK, material: MAT_SIGN });
  addBench(ctx, ctx.centerX - 7.8, ctx.centerY - 5.8);
  for (const [x, y] of [[-9, -8], [9, -8], [9, 8]] as const) addTree(ctx, ctx.centerX + x, ctx.centerY + y, 0.62, true);
  addPerson(ctx, ctx.centerX + 2.3, ctx.centerY + 5.8, PINK);
  addPerson(ctx, ctx.centerX - 1.2, ctx.centerY - 5.7, ORANGE);
}

function addPlazaLot(ctx: LotContext) {
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 0.55, sx: 22.6, sy: 22.6, sz: 0.18, yaw: 0, color: BONE, material: MAT_SIDEWALK });
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 0.68, sx: 4.2, sy: 22, sz: 0.08, yaw: 0, color: WHITE, material: MAT_SIDEWALK });
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 0.69, sx: 22, sy: 4.2, sz: 0.08, yaw: 0, color: WHITE, material: MAT_SIDEWALK });
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 0.83, sx: 6.2, sy: 6.2, sz: 0.34, yaw: Math.PI / 4, color: INK, material: MAT_GENERIC });
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 1.05, sx: 5.45, sy: 5.45, sz: 0.26, yaw: Math.PI / 4, color: BLUE, material: MAT_WATER });
  addWaterRegion(ctx, "plaza-fountain-water", ctx.centerX, ctx.centerY, 5.45, 5.45, Math.PI / 4);
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 2.45, sx: 0.62, sy: 0.62, sz: 2.8, yaw: 0, color: WHITE, material: MAT_WATER });
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 4.05, sx: 2.25, sy: 2.25, sz: 0.48, yaw: Math.PI / 4, color: CYAN, material: MAT_SIGN });
  addSolid(ctx, "plaza-fountain", ctx.centerX, ctx.centerY, 5.2, 5.2, 4.5);
  for (const [x, y] of [[-7.6, -7.6], [7.6, -7.6], [-7.6, 7.6], [7.6, 7.6]] as const) {
    ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY + y, z: 0.95, sx: 3.2, sy: 3.2, sz: 0.65, yaw: 0, color: INK, material: MAT_GENERIC });
    ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY + y, z: 1.52, sx: 2.65, sy: 2.65, sz: 0.8, yaw: Math.PI / 4, color: LEAF, material: MAT_FOLIAGE });
  }
  addBench(ctx, ctx.centerX - 6.2, ctx.centerY);
  addBench(ctx, ctx.centerX + 6.2, ctx.centerY, Math.PI);
  addBuildingShell(ctx, "plaza-kiosk", ctx.centerX + 7.6, ctx.centerY + 1.8, 4.3, 4.8, 3.1, BRICK, CYAN, RED);
  addPerson(ctx, ctx.centerX - 2.1, ctx.centerY + 6.4, RED);
  addPerson(ctx, ctx.centerX + 2.6, ctx.centerY - 6.3, BLUE);
}

function addGasLot(ctx: LotContext) {
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 0.55, sx: 22.5, sy: 22.5, sz: 0.18, yaw: 0, color: ROAD, material: MAT_ROAD });
  addBuildingShell(ctx, "gas-store", ctx.centerX + 6.7, ctx.centerY + 5.8, 8.1, 8.7, 4.3, BONE, CYAN, RED);
  ctx.boxes.push({ x: ctx.centerX - 3.5, y: ctx.centerY + 0.5, z: 4.15, sx: 12.2, sy: 8.1, sz: 0.65, yaw: 0, color: INK, material: MAT_BUILDING });
  ctx.boxes.push({ x: ctx.centerX - 3.5, y: ctx.centerY + 0.5, z: 4.5, sx: 11.65, sy: 7.55, sz: 0.32, yaw: 0, color: RED, material: MAT_SIGN });
  for (const [x, y] of [[-8.2, -2.6], [1.2, -2.6], [-8.2, 3.6], [1.2, 3.6]] as const) {
    ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY + y, z: 2.35, sx: 0.38, sy: 0.38, sz: 3.65, yaw: 0, color: WHITE, material: MAT_BUILDING });
    addSolid(ctx, `gas-post-${x}-${y}`, ctx.centerX + x, ctx.centerY + y, 0.38, 0.38, 4.2);
  }
  for (const y of [-1.2, 2.2]) {
    ctx.boxes.push({ x: ctx.centerX - 3.5, y: ctx.centerY + y, z: 1.15, sx: 2.8, sy: 0.82, sz: 0.32, yaw: 0, color: INK, material: MAT_BUILDING });
    for (const x of [-4.25, -2.75]) {
      ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY + y, z: 1.65, sx: 0.65, sy: 0.65, sz: 1.25, yaw: 0, color: x < -3.5 ? RED : ORANGE, material: MAT_SIGN });
    }
    addSolid(ctx, `gas-pump-${y}`, ctx.centerX - 3.5, ctx.centerY + y, 2.8, 0.82, 2.25);
  }
  addPylonSign(ctx, ctx.centerX - 9, ctx.centerY - 6.3, RED, 6.4, 2.7, true);
  addParkingStripes(ctx, ctx.centerX + 5.8, ctx.centerY - 4.2, 3);
  addParkedVehicle(ctx, "gas-car", ctx.centerX + 5.4, ctx.centerY - 4.1, Math.PI / 2, ORANGE);
  addPerson(ctx, ctx.centerX + 2.2, ctx.centerY + 0.2, BLUE);
}

function addCarwashLot(ctx: LotContext) {
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 0.55, sx: 22.5, sy: 22.5, sz: 0.18, yaw: 0, color: ROAD, material: MAT_ROAD });
  addBuildingShell(ctx, "carwash-tunnel", ctx.centerX + 3.5, ctx.centerY + 4.7, 13.2, 9.2, 4.4, STEEL, CYAN, BLUE);
  ctx.boxes.push({ x: ctx.centerX + 3.5, y: ctx.centerY - 0.05, z: 2.35, sx: 10.5, sy: 0.42, sz: 3.25, yaw: 0, color: INK, material: MAT_BUILDING });
  ctx.boxes.push({ x: ctx.centerX + 3.5, y: ctx.centerY - 0.3, z: 2.4, sx: 9.8, sy: 0.2, sz: 2.8, yaw: 0, color: BLUE, material: MAT_SIGN });
  ctx.boxes.push({ x: ctx.centerX - 5.8, y: ctx.centerY - 2.4, z: 3.55, sx: 7.6, sy: 6.6, sz: 0.48, yaw: 0, color: INK, material: MAT_GENERIC });
  ctx.boxes.push({ x: ctx.centerX - 5.8, y: ctx.centerY - 2.4, z: 3.86, sx: 7.1, sy: 6.1, sz: 0.25, yaw: 0, color: CYAN, material: MAT_SIGN });
  for (const [x, y] of [[-9, -5.2], [-2.6, -5.2], [-9, 0.4], [-2.6, 0.4]] as const) {
    ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY + y, z: 2.05, sx: 0.32, sy: 0.32, sz: 3.2, yaw: 0, color: WHITE, material: MAT_GENERIC });
    addSolid(ctx, `carwash-post-${x}-${y}`, ctx.centerX + x, ctx.centerY + y, 0.32, 0.32, 3.8);
  }
  for (const x of [-8, -4.7]) {
    ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY + 3.1, z: 1.4, sx: 0.72, sy: 0.72, sz: 2, yaw: 0, color: INK, material: MAT_GENERIC });
    ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY + 3.1, z: 2.4, sx: 1.4, sy: 0.3, sz: 0.34, yaw: 0, color: PINK, material: MAT_SIGN });
  }
  addParkedVehicle(ctx, "carwash-car", ctx.centerX - 5.8, ctx.centerY - 8.1, 0, ctx.random() > 0.5 ? RED : ORANGE);
  addPylonSign(ctx, ctx.centerX - 9.3, ctx.centerY + 7.3, CYAN, 5.8, 2.6, true);
  addPerson(ctx, ctx.centerX + 9, ctx.centerY - 2.2, BLUE);
}

function addWarehouseLot(ctx: LotContext) {
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 0.55, sx: 22.4, sy: 22.4, sz: 0.18, yaw: 0, color: ROAD, material: MAT_ROAD });
  addBuildingShell(ctx, "warehouse", ctx.centerX + 1.7, ctx.centerY + 3.2, 18.3, 13.4, 6.2 + ctx.random() * 2.2, STEEL, BLUE, INK);
  for (const x of [-4.4, 1.5, 7.4]) {
    ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY - 3.65, z: 2.05, sx: 4.2, sy: 0.35, sz: 2.85, yaw: 0, color: INK, material: MAT_BUILDING });
    ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY - 3.88, z: 2.02, sx: 3.65, sy: 0.16, sz: 2.4, yaw: 0, color: BONE, material: MAT_BUILDING });
  }
  for (const x of [-6.8, -3.2, 0.4]) {
    ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY - 7.7, z: 1.1, sx: 3, sy: 2.2, sz: 1.5, yaw: 0, color: x < -4 ? RED : x < -1 ? BLUE : ORANGE, material: MAT_BUILDING });
  }
  addSolid(ctx, "warehouse-container-row", ctx.centerX - 3.2, ctx.centerY - 7.7, 10.2, 2.2, 1.9);
  for (const x of [ctx.centerX + 6.7, ctx.centerX + 9]) {
    ctx.boxes.push({ x, y: ctx.centerY - 7.3, z: 1.65, sx: 1.7, sy: 1.7, sz: 2.7, yaw: 0, color: INK, material: MAT_BUILDING });
    ctx.boxes.push({ x, y: ctx.centerY - 7.3, z: 2.65, sx: 1.95, sy: 1.95, sz: 0.28, yaw: 0, color: ORANGE, material: MAT_SIGN });
  }
  addSolid(ctx, "warehouse-tanks", ctx.centerX + 7.85, ctx.centerY - 7.3, 4, 1.7, 2.8);
  addParkedVehicle(ctx, "delivery-van", ctx.centerX + 4, ctx.centerY - 9.5, 0, WHITE);
  addPylonSign(ctx, ctx.centerX - 9.4, ctx.centerY - 0.5, ORANGE, 4.3, 2.2);
}

function addFactoryLot(ctx: LotContext) {
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 0.55, sx: 22.5, sy: 22.5, sz: 0.18, yaw: 0, color: ROAD, material: MAT_ROAD });
  addBuildingShell(ctx, "factory-floor", ctx.centerX + 1.2, ctx.centerY + 3.8, 16.8, 13.2, 7.4, BRICK, STEEL, INK);
  for (const x of [-4.8, 0.8, 6.4]) {
    ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY + 3.8, z: 10.8, sx: 1.4, sy: 1.4, sz: 7.2, yaw: 0, color: INK, material: MAT_GENERIC });
    ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY + 3.8, z: 14.55, sx: 1.8, sy: 1.8, sz: 0.45, yaw: 0, color: ORANGE, material: MAT_SIGN });
  }
  for (const x of [-7.7, -4.7]) {
    ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY - 5.8, z: 2.2, sx: 2.5, sy: 2.5, sz: 3.1, yaw: Math.PI / 4, color: STEEL, material: MAT_GENERIC });
    ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY - 5.8, z: 3.85, sx: 2.9, sy: 2.9, sz: 0.35, yaw: Math.PI / 4, color: CYAN, material: MAT_SIGN });
  }
  addSolid(ctx, "factory-tanks", ctx.centerX - 6.2, ctx.centerY - 5.8, 5.5, 2.5, 4.2);
  ctx.boxes.push({ x: ctx.centerX + 3.8, y: ctx.centerY - 5.4, z: 3.7, sx: 9.5, sy: 1.15, sz: 0.55, yaw: 0, color: INK, material: MAT_GENERIC });
  ctx.boxes.push({ x: ctx.centerX + 3.8, y: ctx.centerY - 5.4, z: 4.05, sx: 8.9, sy: 0.72, sz: 0.3, yaw: 0, color: ORANGE, material: MAT_SIGN });
  for (const x of [ctx.centerX - 0.1, ctx.centerX + 7.7]) {
    ctx.boxes.push({ x, y: ctx.centerY - 5.4, z: 2.15, sx: 0.42, sy: 0.42, sz: 3.4, yaw: 0, color: WHITE, material: MAT_GENERIC });
  }
  addParkedVehicle(ctx, "factory-truck", ctx.centerX + 3.5, ctx.centerY - 8.7, 0, WHITE);
  addPylonSign(ctx, ctx.centerX - 9.4, ctx.centerY + 0.2, ORANGE, 5.1, 2.4);
  addPerson(ctx, ctx.centerX + 8.8, ctx.centerY - 7.8, ORANGE);
}

function addMotelLot(ctx: LotContext) {
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 0.55, sx: 22.5, sy: 22.5, sz: 0.18, yaw: 0, color: ROAD, material: MAT_ROAD });
  addBuildingShell(ctx, "motel-back", ctx.centerX + 1.8, ctx.centerY + 7.1, 18, 6.4, 5.3, BONE, BLUE, RED);
  addBuildingShell(ctx, "motel-wing", ctx.centerX + 7.7, ctx.centerY, 5.7, 9.1, 5.3, BONE, BLUE, RED);
  for (const x of [-5.5, -1.3, 2.9, 7.1]) {
    ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY + 3.72, z: 2, sx: 0.8, sy: 0.25, sz: 1.55, yaw: 0, color: PINK, material: MAT_SIGN });
  }
  ctx.boxes.push({ x: ctx.centerX - 4.2, y: ctx.centerY + 0.2, z: 0.72, sx: 7, sy: 5.1, sz: 0.34, yaw: 0, color: INK, material: MAT_BUILDING });
  ctx.boxes.push({ x: ctx.centerX - 4.2, y: ctx.centerY + 0.2, z: 0.94, sx: 6.35, sy: 4.45, sz: 0.22, yaw: 0, color: BLUE, material: MAT_WATER });
  addWaterRegion(ctx, "motel-pool-water", ctx.centerX - 4.2, ctx.centerY + 0.2, 6.35, 4.45);
  addSolid(ctx, "motel-pool", ctx.centerX - 4.2, ctx.centerY + 0.2, 6.35, 4.45, 0.45);
  addPylonSign(ctx, ctx.centerX - 9.2, ctx.centerY - 6.2, PINK, 6.2, 2.7, true);
  addParkingStripes(ctx, ctx.centerX, ctx.centerY - 5.4, 7);
  addParkedVehicle(ctx, "motel-car-a", ctx.centerX + 5.3, ctx.centerY - 7.2, Math.PI / 2, RED);
  addParkedVehicle(ctx, "motel-car-b", ctx.centerX - 1.5, ctx.centerY - 7.2, Math.PI / 2, BLUE);
  addPerson(ctx, ctx.centerX - 7.8, ctx.centerY + 3.5, ORANGE);
}

function addCivicLot(ctx: LotContext) {
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 0.55, sx: 22.5, sy: 22.5, sz: 0.18, yaw: 0, color: ctx.random() > 0.5 ? GRASS : BONE, material: MAT_GRASS });
  if (ctx.random() > 0.46) {
    addBuildingShell(ctx, "school", ctx.centerX, ctx.centerY + 5.5, 19.3, 9.2, 5.8, BRICK, BLUE, INK);
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY + 0.6, z: 2.6, sx: 5.4, sy: 1.2, sz: 0.5, yaw: 0, color: INK, material: MAT_BUILDING });
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY + 0.2, z: 2.7, sx: 4.8, sy: 0.28, sz: 0.35, yaw: 0, color: ORANGE, material: MAT_SIGN });
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 5.4, z: 0.66, sx: 11.5, sy: 7.8, sz: 0.08, yaw: 0, color: ROAD, material: MAT_ROAD });
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 5.4, z: 0.73, sx: 0.2, sy: 7, sz: 0.06, yaw: 0, color: WHITE, material: MAT_SIDEWALK });
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 5.4, z: 0.74, sx: 10.8, sy: 0.2, sz: 0.06, yaw: 0, color: WHITE, material: MAT_SIDEWALK });
    for (const x of [-8.5, 8.5]) addTree(ctx, ctx.centerX + x, ctx.centerY - 5.5, 0.68);
  } else {
    addBuildingShell(ctx, "fire-hall", ctx.centerX + 1.3, ctx.centerY + 4.8, 18, 10.2, 5.4, BONE, CYAN, RED);
    for (const x of [-4.7, 1.3, 7.3]) {
      ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY - 0.45, z: 2.15, sx: 4.6, sy: 0.28, sz: 3.1, yaw: 0, color: RED, material: MAT_SIGN });
    }
    addParkedVehicle(ctx, "fire-truck", ctx.centerX - 3.5, ctx.centerY - 6, 0, RED);
    ctx.boxes.push({ x: ctx.centerX + 8.5, y: ctx.centerY + 6.7, z: 7.7, sx: 2.3, sy: 2.3, sz: 5, yaw: 0, color: BRICK, material: MAT_BUILDING });
  }
  ctx.boxes.push({ x: ctx.centerX - 8.8, y: ctx.centerY - 8.5, z: 3.1, sx: 0.18, sy: 0.18, sz: 5.3, yaw: 0, color: INK, material: MAT_BUILDING });
  ctx.boxes.push({ x: ctx.centerX - 7.9, y: ctx.centerY - 8.5, z: 5.15, sx: 1.7, sy: 0.12, sz: 0.9, yaw: 0, color: RED, material: MAT_SIGN });
  addPerson(ctx, ctx.centerX - 5.8, ctx.centerY - 8, BLUE);
  addPerson(ctx, ctx.centerX + 5.5, ctx.centerY - 8, ORANGE);
}

function addMarketLot(ctx: LotContext) {
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 0.55, sx: 22.5, sy: 22.5, sz: 0.18, yaw: 0, color: BONE, material: MAT_SIDEWALK });
  addBuildingShell(ctx, "market-hall", ctx.centerX, ctx.centerY + 7, 20.2, 6.7, 5.2, BRICK, CYAN, INK);
  const colors = [RED, ORANGE, BLUE, PINK] as const;
  for (let stall = 0; stall < 4; stall += 1) {
    const x = ctx.centerX + (stall - 1.5) * 5.2;
    const y = ctx.centerY - 1.6 + (stall % 2) * 4;
    ctx.boxes.push({ x, y, z: 1.35, sx: 3.8, sy: 2.5, sz: 0.3, yaw: 0, color: INK, material: MAT_BUILDING });
    ctx.boxes.push({ x, y, z: 2.75, sx: 4.2, sy: 2.9, sz: 0.38, yaw: 0, color: colors[stall], material: MAT_SIGN });
    addSolid(ctx, `market-stall-${stall}`, x, y, 3.8, 2.5, 3);
    addPerson(ctx, x + 1.25, y - 1.6, stall % 2 ? YELLOW : BLUE);
  }
  addPylonSign(ctx, ctx.centerX - 9.5, ctx.centerY - 7.1, PINK, 5.5, 2.6);
  addPerson(ctx, ctx.centerX + 8.1, ctx.centerY - 7.7, RED);
}

function addConstructionLot(ctx: LotContext) {
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 0.55, sx: 22.5, sy: 22.5, sz: 0.18, yaw: 0, color: ROAD, material: MAT_ROAD });
  for (const x of [-6, 0, 6]) {
    for (const y of [-4, 4]) {
      ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY + y, z: 5.2, sx: 0.55, sy: 0.55, sz: 9.2, yaw: 0, color: STEEL, material: MAT_BUILDING });
      addSolid(ctx, `construction-column-${x}-${y}`, ctx.centerX + x, ctx.centerY + y, 0.55, 0.55, 9.8);
    }
  }
  for (const z of [2.2, 5.2, 8.2]) ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z, sx: 14.2, sy: 9.2, sz: 0.42, yaw: 0, color: BONE, material: MAT_BUILDING });
  const macroCrane = (Math.abs(ctx.blockX) % 4 === 0 && Math.abs(ctx.blockY) % 4 === 0)
    && !specialRoadIntersectsSquare({ x: ctx.centerX, y: ctx.centerY }, 18, 8);
  if (macroCrane) {
    const height = 15 + ((Math.abs(ctx.blockX + ctx.blockY) % 3) * 2);
    const mastX = ctx.centerX + 7.5;
    const mastY = ctx.centerY + 5;
    ctx.boxes.push({ x: mastX, y: mastY, z: height / 2 + 0.5, sx: 0.75, sy: 0.75, sz: height, yaw: 0, color: ORANGE, material: MAT_BUILDING });
    addSolid(ctx, "construction-crane", mastX, mastY, 0.75, 0.75, height + 0.5);
    ctx.boxes.push({ x: ctx.centerX + 0.8, y: mastY, z: height, sx: 14.2, sy: 0.45, sz: 0.45, yaw: 0, color: ORANGE, material: MAT_BUILDING });
    ctx.boxes.push({ x: ctx.centerX + 8, y: mastY, z: height - 1.1, sx: 3.2, sy: 1.6, sz: 1.6, yaw: 0, color: INK, material: MAT_BUILDING });
    // A cable and hook read clearly as a crane; the former floating black box
    // looked like unexplained highway equipment.
    ctx.boxes.push({ x: ctx.centerX - 5.8, y: mastY, z: height - 4.5, sx: 0.18, sy: 0.18, sz: 8.5, yaw: 0, color: INK, material: MAT_BUILDING });
    ctx.boxes.push({ x: ctx.centerX - 5.8, y: mastY, z: height - 8.8, sx: 1, sy: 1, sz: 0.7, yaw: 0, color: YELLOW, material: MAT_SIGN });
  }
  for (let barrier = 0; barrier < 5; barrier += 1) {
    const x = ctx.centerX - 8 + barrier * 4;
    ctx.boxes.push({ x, y: ctx.centerY - 8.4, z: 0.9, sx: 3.1, sy: 0.45, sz: 0.9, yaw: 0, color: barrier % 2 ? WHITE : ORANGE, material: MAT_SIGN });
  }
  addSolid(ctx, "construction-barrier-line", ctx.centerX, ctx.centerY - 8.4, 19.1, 0.45, 1.35);
  addPerson(ctx, ctx.centerX - 7, ctx.centerY - 6.8, ORANGE);
}

function addMarinaLot(ctx: LotContext) {
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY + 2.8, z: 0.54, sx: 22.5, sy: 16.8, sz: 0.16, yaw: 0, color: BLUE, material: MAT_WATER });
  addWaterRegion(ctx, "marina-basin", ctx.centerX, ctx.centerY + 2.8, 22.5, 16.8);
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 7.1, z: 0.65, sx: 22.5, sy: 5.4, sz: 0.28, yaw: 0, color: BRICK, material: MAT_SIDEWALK });
  ctx.boxes.push({ x: ctx.centerX - 4.8, y: ctx.centerY + 1.5, z: 0.72, sx: 3.2, sy: 12.5, sz: 0.34, yaw: 0, color: BONE, material: MAT_SIDEWALK });
  ctx.boxes.push({ x: ctx.centerX + 5.5, y: ctx.centerY + 4.1, z: 0.72, sx: 9.5, sy: 2.2, sz: 0.34, yaw: 0, color: BONE, material: MAT_SIDEWALK });
  for (const [x, y, color] of [[-8, 1, RED], [2, 6.2, WHITE], [7.2, 0.8, ORANGE]] as const) {
    ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY + y, z: 1.05, sx: 4.4, sy: 1.7, sz: 0.65, yaw: Math.PI / 2, color, material: MAT_VEHICLE });
    ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY + y - 0.1, z: 1.55, sx: 1.9, sy: 1.3, sz: 0.48, yaw: Math.PI / 2, color: WHITE, material: MAT_VEHICLE });
  }
  addBuildingShell(ctx, "boathouse", ctx.centerX + 7.3, ctx.centerY - 5.2, 6.2, 4.8, 3.8, BRICK, CYAN, INK);
  addPylonSign(ctx, ctx.centerX - 8.8, ctx.centerY - 7.1, BLUE, 4.8, 2.4);
  addSolid(ctx, "marina-water", ctx.centerX, ctx.centerY + 2.8, 22.5, 16.8, 0.45);
  addPerson(ctx, ctx.centerX - 1.2, ctx.centerY - 7.4, PINK);
  addPerson(ctx, ctx.centerX + 2.2, ctx.centerY - 7.4, ORANGE);
}

function addBoardwalkLot(ctx: LotContext) {
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY + 2.5, z: 0.54, sx: 22.5, sy: 17.2, sz: 0.16, yaw: 0, color: BLUE, material: MAT_WATER });
  addWaterRegion(ctx, "boardwalk-basin", ctx.centerX, ctx.centerY + 2.5, 22.5, 17.2);
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 7.2, z: 0.66, sx: 22.5, sy: 5.2, sz: 0.3, yaw: 0, color: BONE, material: MAT_SIDEWALK });
  ctx.boxes.push({ x: ctx.centerX - 4.8, y: ctx.centerY + 1.2, z: 0.72, sx: 3.4, sy: 13.8, sz: 0.32, yaw: 0, color: BRICK, material: MAT_SIDEWALK });
  ctx.boxes.push({ x: ctx.centerX + 4.9, y: ctx.centerY + 4.2, z: 0.72, sx: 11.8, sy: 2.8, sz: 0.32, yaw: 0, color: BRICK, material: MAT_SIDEWALK });
  addBuildingShell(ctx, "boardwalk-arcade", ctx.centerX + 6.8, ctx.centerY - 5.6, 7.1, 4.9, 3.8, MUTED_RED, CYAN, INK);
  ctx.boxes.push({ x: ctx.centerX + 6.8, y: ctx.centerY - 8.25, z: 2.75, sx: 6.6, sy: 0.42, sz: 0.7, yaw: 0, color: INK, material: MAT_BUILDING });
  ctx.boxes.push({ x: ctx.centerX + 6.8, y: ctx.centerY - 8.5, z: 2.85, sx: 6.1, sy: 0.18, sz: 0.46, yaw: 0, color: PINK, material: MAT_SIGN });
  const awnings = [RED, ORANGE, PINK] as const;
  for (let stall = 0; stall < 3; stall += 1) {
    const y = ctx.centerY - 2.6 + stall * 4;
    ctx.boxes.push({ x: ctx.centerX - 4.8, y, z: 1.55, sx: 3.4, sy: 2.2, sz: 1.7, yaw: 0, color: INK, material: MAT_BUILDING });
    ctx.boxes.push({ x: ctx.centerX - 4.8, y: y - 0.2, z: 2.55, sx: 3.8, sy: 2.55, sz: 0.35, yaw: 0, color: awnings[stall], material: MAT_SIGN });
  }
  for (const x of [1.2, 5.2, 9.2]) {
    ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY + 4.2, z: 2.1, sx: 0.28, sy: 0.28, sz: 2.8, yaw: 0, color: WHITE, material: MAT_GENERIC });
    ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY + 4.2, z: 3.55, sx: 2.4, sy: 2.4, sz: 0.28, yaw: Math.PI / 4, color: x > 7 ? YELLOW : x > 3 ? CYAN : RED, material: MAT_SIGN });
  }
  ctx.boxes.push({ x: ctx.centerX + 8.8, y: ctx.centerY + 4.2, z: 5.1, sx: 0.36, sy: 0.36, sz: 7.9, yaw: 0, color: INK, material: MAT_GENERIC });
  ctx.boxes.push({ x: ctx.centerX + 7.4, y: ctx.centerY + 4.2, z: 8.4, sx: 3.3, sy: 0.18, sz: 1.25, yaw: 0, color: RED, material: MAT_SIGN });
  addSolid(ctx, "boardwalk-water", ctx.centerX, ctx.centerY + 2.5, 22.5, 17.2, 0.45);
  addBench(ctx, ctx.centerX + 0.2, ctx.centerY - 7.2);
  addPerson(ctx, ctx.centerX - 0.8, ctx.centerY - 7.4, BLUE);
  addPerson(ctx, ctx.centerX + 3.3, ctx.centerY - 7.4, ORANGE);
}

function addLandmarkPad(
  ctx: LotContext,
  color: Color,
  material: Box["material"] = MAT_SIDEWALK,
) {
  const tile = landmarkTileForBlock(ctx.blockX, ctx.blockY);
  if (tile && (tile.definition.width > 1 || tile.definition.height > 1)) {
    addCampusGround(ctx, tile.tileX, tile.tileY, tile.definition.width, tile.definition.height,
      material === MAT_WATER ? BONE : color, material === MAT_WATER ? MAT_SIDEWALK : material);
    return;
  }
  ctx.boxes.push({
    x: ctx.centerX,
    y: ctx.centerY,
    z: 0.56,
    sx: 22.4,
    sy: 22.4,
    sz: 0.22,
    yaw: 0,
    color,
    material,
  });
}

function campusPoint(
  ctx: LotContext,
  tileX: number,
  tileY: number,
  width: number,
  height: number,
  x = 0,
  y = 0,
) {
  const point = campusLocalPoint(tileX, tileY, width, height);
  return { x: ctx.centerX - point.x + x, y: ctx.centerY - point.y + y };
}

function addCampusGround(
  ctx: LotContext,
  tileX: number,
  tileY: number,
  width: number,
  height: number,
  color: Color,
  material: Box["material"] = MAT_SIDEWALK,
) {
  const edges = campusInternalEdgesForBlock(ctx.blockX, ctx.blockY);
  const west = edges.west ? ROAD_SPACING / 2 : 12;
  const east = edges.east ? ROAD_SPACING / 2 : 12;
  const north = edges.north ? ROAD_SPACING / 2 : 12;
  const south = edges.south ? ROAD_SPACING / 2 : 12;
  ctx.boxes.push({
    x: ctx.centerX + (east - west) / 2,
    y: ctx.centerY + (south - north) / 2,
    z: 0.56,
    sx: west + east,
    sy: north + south,
    sz: 0.24,
    yaw: 0,
    color,
    material,
  });
  const jointColor = material === MAT_GRASS ? color : BONE;
  if (edges.west) ctx.boxes.push({ x: ctx.centerX - 15, y: ctx.centerY, z: 0.69, sx: 6, sy: north + south - 1, sz: 0.08, yaw: 0, color: jointColor, material });
  if (edges.north) ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 15, z: 0.7, sx: west + east - 1, sy: 6, sz: 0.08, yaw: 0, color: jointColor, material });
  // Keep the arguments visible in this common helper: callers choose a
  // campus-wide coordinate system even though the ground is tile-owned.
  void tileX; void tileY; void width; void height;
}

function addStadiumStand(
  ctx: LotContext,
  id: string,
  x: number,
  y: number,
  sx: number,
  sy: number,
  color: Color,
) {
  ctx.boxes.push({ x, y, z: 2.1, sx, sy, sz: 3.2, yaw: 0, color: BRICK, material: MAT_BUILDING });
  ctx.boxes.push({ x, y, z: 4.25, sx: sx - 1.2, sy: sy - 0.8, sz: 1.1, yaw: 0, color: BONE, material: MAT_BUILDING });
  ctx.boxes.push({ x, y, z: 5.2, sx: sx - 2.2, sy: sy - 1.2, sz: 0.75, yaw: 0, color, material: MAT_SIGN });
  // Approximate each tier with a tile-owned solid. The visible macro stand can
  // meet across a removed campus seam, while the collider remains clear of
  // every public perimeter street and works in the streamed collision window.
  const colliderSx = Math.min(sx, 20);
  const colliderSy = Math.min(sy, 20);
  const colliderX = clamp(
    x,
    ctx.centerX - 12 + colliderSx / 2,
    ctx.centerX + 12 - colliderSx / 2,
  );
  const colliderY = clamp(
    y,
    ctx.centerY - 12 + colliderSy / 2,
    ctx.centerY + 12 - colliderSy / 2,
  );
  addSolid(ctx, id, colliderX, colliderY, colliderSx, colliderSy, 5.8);
}

function addPulseStadiumTile(ctx: LotContext, tileX: number, tileY: number) {
  addCampusGround(ctx, tileX, tileY, 3, 2, BONE);
  const campusCenter = campusPoint(ctx, tileX, tileY, 3, 2);
  const fieldY = campusCenter.y;

  // The pitch spans all three columns, so the campus reads as one American
  // football stadium in plan view as well as from the chase cameras.
  const fieldTileY = ctx.centerY + (tileY === 0 ? 10.1 : -10.1);
  const pitchSliceX = ctx.centerX + (tileX === 0 ? 7 : tileX === 2 ? -7 : 0);
  ctx.boxes.push({ x: pitchSliceX, y: fieldTileY, z: 0.78, sx: tileX === 1 ? 36 : 21.5, sy: 15.8, sz: 0.18, yaw: 0, color: GRASS, material: MAT_GRASS });
  if (tileX === 0 || tileX === 2) {
    ctx.boxes.push({ x: ctx.centerX + (tileX === 0 ? 7 : -7), y: fieldTileY, z: 0.91, sx: 13.5, sy: 15.4, sz: 0.09, yaw: 0, color: tileX === 0 ? RED : BLUE, material: MAT_SIGN });
  }
  for (const localX of [-9, 0, 9]) {
    ctx.boxes.push({ x: ctx.centerX + localX, y: fieldTileY, z: 0.94, sx: 0.22, sy: 14.5, sz: 0.07, yaw: 0, color: WHITE, material: MAT_SIGN });
  }
  for (const localY of [-4.8, 0, 4.8]) {
    ctx.boxes.push({ x: ctx.centerX, y: fieldTileY + localY, z: 0.95, sx: 22.8, sy: 0.18, sz: 0.07, yaw: 0, color: WHITE, material: MAT_SIGN });
  }

  const northStandY = fieldY - 20;
  const southStandY = fieldY + 20;
  if (tileY === 0) addStadiumStand(ctx, `pulse-north-${tileX}`, pitchSliceX, northStandY, tileX === 1 ? 34 : 21.5, 7.4, tileX % 2 ? CYAN : RED);
  else addStadiumStand(ctx, `pulse-south-${tileX}`, pitchSliceX, southStandY, tileX === 1 ? 34 : 21.5, 7.4, tileX % 2 ? YELLOW : BLUE);

  if (tileX === 0 || tileX === 2) {
    const outerX = ctx.centerX + (tileX === 0 ? -7 : 7);
    addStadiumStand(ctx, `pulse-end-${tileX}-${tileY}`, outerX, fieldTileY, 6.2, 15.8, tileX === 0 ? RED : BLUE);
  }
  if ((tileX === 0 || tileX === 2) && tileY === 0) {
    const uprightX = ctx.centerX + (tileX === 0 ? 5.5 : -5.5);
    ctx.boxes.push({ x: uprightX, y: fieldY, z: 3.7, sx: 0.35, sy: 8.8, sz: 0.35, yaw: 0, color: YELLOW, material: MAT_SIGN });
    for (const y of [-4.1, 4.1]) ctx.boxes.push({ x: uprightX, y: fieldY + y, z: 6.1, sx: 0.35, sy: 0.35, sz: 5.1, yaw: 0, color: YELLOW, material: MAT_SIGN });
  }

  if (tileX === 1 && tileY === 0) {
    // Monumental south gate, visible from the portal/perimeter road.
    for (const x of [-11.2, -5.6, 5.6, 11.2]) {
      ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY - 8.8, z: 3.8, sx: 1.25, sy: 1.25, sz: 6.4, yaw: 0, color: BRICK, material: MAT_BUILDING });
      addSolid(ctx, `pulse-gate-column-${x}`, ctx.centerX + x, ctx.centerY - 8.8, 1.25, 1.25, 7);
    }
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 8.8, z: 7.2, sx: 26.5, sy: 1.5, sz: 1.2, yaw: 0, color: INK, material: MAT_BUILDING });
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 9.65, z: 7.35, sx: 21, sy: 0.2, sz: 0.8, yaw: 0, color: YELLOW, material: MAT_SIGN });
    addPerson(ctx, ctx.centerX - 4, ctx.centerY - 7.4, RED);
    addPerson(ctx, ctx.centerX + 4, ctx.centerY - 7.4, CYAN);
  }

  if (tileX === 2 && tileY === 1) {
    for (const x of [-3.6, 3.6]) {
      ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY + 4, z: 7, sx: 0.55, sy: 0.55, sz: 12.5, yaw: 0, color: INK, material: MAT_BUILDING });
      addSolid(ctx, `pulse-scoreboard-post-${x}`, ctx.centerX + x, ctx.centerY + 4, 0.55, 0.55, 13.2);
    }
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY + 4, z: 12, sx: 9, sy: 1.1, sz: 4.8, yaw: 0, color: INK, material: MAT_BUILDING });
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY + 3.35, z: 12.2, sx: 8.2, sy: 0.2, sz: 3.8, yaw: 0, color: CYAN, material: MAT_SIGN });
  }

  if ((tileX === 0 || tileX === 2)) {
    const x = ctx.centerX + (tileX === 0 ? -9.5 : 9.5);
    const y = ctx.centerY + (tileY === 0 ? -9.5 : 9.5);
    ctx.boxes.push({ x, y, z: 8.2, sx: 0.45, sy: 0.45, sz: 14.6, yaw: 0, color: INK, material: MAT_LAMP });
    ctx.boxes.push({ x, y, z: 15.5, sx: 4, sy: 1.1, sz: 0.45, yaw: 0, color: WHITE, material: MAT_LAMP });
    addSolid(ctx, `pulse-floodlight-${tileX}-${tileY}`, x, y, 0.55, 0.55, 15.9);
  }
}

function addSkyportTile(ctx: LotContext, tileX: number, tileY: number) {
  addLandmarkPad(ctx, tileY === 1 && tileX === 1 ? ROAD : STEEL, tileY === 1 && tileX === 1 ? MAT_ROAD : MAT_SIDEWALK);
  if (tileX === 0 && tileY === 0) {
    addBuildingShell(ctx, "skyport-terminal", ctx.centerX, ctx.centerY + 3.1, 20, 10.8, 5.3, STEEL, CYAN, RED);
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 2.7, z: 3.2, sx: 17.5, sy: 1.8, sz: 0.4, yaw: 0, color: INK, material: MAT_BUILDING });
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 3, z: 3.35, sx: 16.7, sy: 0.2, sz: 0.72, yaw: 0, color: ORANGE, material: MAT_SIGN });
    for (const x of [-6, 0, 6]) addPerson(ctx, ctx.centerX + x, ctx.centerY - 7.8, x === 0 ? ORANGE : WHITE);
  } else if (tileX === 1 && tileY === 0) {
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY + 1, z: 0.72, sx: 20, sy: 16, sz: 0.16, yaw: 0, color: ROAD, material: MAT_ROAD });
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY + 1, z: 1.25, sx: 14.5, sy: 1.25, sz: 1.15, yaw: 0, color: WHITE, material: MAT_VEHICLE });
    ctx.boxes.push({ x: ctx.centerX - 1, y: ctx.centerY + 1, z: 1.25, sx: 5.5, sy: 9.5, sz: 0.3, yaw: 0, color: WHITE, material: MAT_VEHICLE });
    ctx.boxes.push({ x: ctx.centerX - 5.8, y: ctx.centerY + 1, z: 2.1, sx: 2.8, sy: 0.4, sz: 2.8, yaw: 0, color: ORANGE, material: MAT_VEHICLE });
    ctx.boxes.push({ x: ctx.centerX + 5.8, y: ctx.centerY + 1, z: 1.6, sx: 0.9, sy: 3.3, sz: 1.3, yaw: 0, color: CYAN, material: MAT_VEHICLE });
    addSolid(ctx, "parked-aircraft", ctx.centerX, ctx.centerY + 1, 15.5, 9.5, 2.8);
  } else if (tileX === 2 && tileY === 0) {
    addBuildingShell(ctx, "skyport-hangar", ctx.centerX, ctx.centerY + 1.2, 20, 16.5, 6.7, BONE, CYAN, INK);
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 7.35, z: 3.6, sx: 16, sy: 0.28, sz: 4.8, yaw: 0, color: INK, material: MAT_BUILDING });
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 7.55, z: 4.7, sx: 13, sy: 0.18, sz: 1.2, yaw: 0, color: CYAN, material: MAT_SIGN });
  } else if (tileX === 0 && tileY === 1) {
    addParkingStripes(ctx, ctx.centerX, ctx.centerY, 7, true);
    addParkedVehicle(ctx, "airport-car-a", ctx.centerX, ctx.centerY - 6.3, 0, BLUE);
    addParkedVehicle(ctx, "airport-car-b", ctx.centerX, ctx.centerY + 5.2, 0, WHITE);
    addPylonSign(ctx, ctx.centerX - 8.7, ctx.centerY - 7.4, ORANGE, 8.2, 3.3);
  } else if (tileX === 1 && tileY === 1) {
    for (let stripe = -4; stripe <= 4; stripe += 1) {
      ctx.boxes.push({ x: ctx.centerX + stripe * 2.25, y: ctx.centerY, z: 0.72, sx: 1.15, sy: 0.28, sz: 0.08, yaw: 0, color: stripe % 2 ? WHITE : YELLOW, material: MAT_SIGN });
    }
    for (const y of [-8.5, 8.5]) {
      for (const x of [-8, -4, 0, 4, 8]) {
        ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY + y, z: 0.92, sx: 0.5, sy: 0.5, sz: 0.5, yaw: Math.PI / 4, color: x % 8 ? CYAN : YELLOW, material: MAT_LAMP });
      }
    }
  } else {
    addBuildingShell(ctx, "control-base", ctx.centerX, ctx.centerY + 2.5, 7.2, 7.2, 10.5, STEEL, CYAN, INK);
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY + 2.5, z: 12, sx: 10, sy: 10, sz: 2, yaw: Math.PI / 4, color: INK, material: MAT_BUILDING });
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY + 2.5, z: 12.2, sx: 8.4, sy: 8.4, sz: 1.35, yaw: Math.PI / 4, color: CYAN, material: MAT_WINDOW });
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY + 2.5, z: 15, sx: 0.45, sy: 0.45, sz: 4.7, yaw: 0, color: ORANGE, material: MAT_SIGN });
  }
}

function addNovaMegamallTile(ctx: LotContext, tileX: number, tileY: number) {
  addLandmarkPad(ctx, BONE);
  if (tileX === 0 && tileY === 0) {
    addBuildingShell(ctx, "mall-west", ctx.centerX, ctx.centerY + 3.2, 19, 11.8, 8.5, MUTED_RED, PINK, INK);
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 3.1, z: 4.4, sx: 15.8, sy: 0.4, sz: 1.5, yaw: 0, color: PINK, material: MAT_SIGN });
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 3.35, z: 4.5, sx: 8.4, sy: 0.18, sz: 0.8, yaw: 0, color: YELLOW, material: MAT_SIGN });
  } else if (tileX === 1 && tileY === 0) {
    addBuildingShell(ctx, "mall-east", ctx.centerX, ctx.centerY + 1.2, 18.5, 16.5, 6.5, BONE, CYAN, RED);
    for (const x of [-6, 0, 6]) {
      ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY - 7.4, z: 2.1, sx: 4.6, sy: 0.45, sz: 2.6, yaw: 0, color: x === 0 ? YELLOW : x < 0 ? CYAN : PINK, material: MAT_SIGN });
    }
  } else if (tileX === 0 && tileY === 1) {
    addBuildingShell(ctx, "mall-atrium", ctx.centerX, ctx.centerY, 13.5, 13.5, 12.5, INK, CYAN, PINK);
    for (let deck = 0; deck < 3; deck += 1) {
      ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 13.6 + deck * 0.6, sx: 10.5 - deck * 2.2, sy: 10.5 - deck * 2.2, sz: 0.48, yaw: Math.PI / 4, color: deck % 2 ? PINK : CYAN, material: MAT_SIGN });
    }
  } else {
    addParkingStripes(ctx, ctx.centerX, ctx.centerY + 1, 7);
    addParkedVehicle(ctx, "mall-car-a", ctx.centerX - 6, ctx.centerY + 1, Math.PI / 2, PINK);
    addParkedVehicle(ctx, "mall-car-b", ctx.centerX + 5.7, ctx.centerY + 1, Math.PI / 2, YELLOW);
    addPylonSign(ctx, ctx.centerX + 8.8, ctx.centerY - 6.8, PINK, 9.5, 4.2);
  }
}

function addNeonTitanTile(ctx: LotContext, tileY: number) {
  addLandmarkPad(ctx, tileY === 0 ? WHITE : BONE);
  if (tileY === 0) {
    ctx.boxes.push({ x: ctx.centerX - 2, y: ctx.centerY + 2.5, z: 1.2, sx: 8.5, sy: 8.5, sz: 1.3, yaw: Math.PI / 4, color: INK, material: MAT_BUILDING });
    ctx.boxes.push({ x: ctx.centerX - 2, y: ctx.centerY + 2.5, z: 2.1, sx: 6.7, sy: 6.7, sz: 0.55, yaw: Math.PI / 4, color: YELLOW, material: MAT_SIGN });
    for (const side of [-1, 1]) {
      ctx.boxes.push({ x: ctx.centerX - 2 + side * 1.35, y: ctx.centerY + 2.5, z: 6.2, sx: 1, sy: 1, sz: 8.2, yaw: 0, color: STEEL, material: MAT_BUILDING });
    }
    ctx.boxes.push({ x: ctx.centerX - 2, y: ctx.centerY + 2.5, z: 11.2, sx: 4.6, sy: 2.4, sz: 3.1, yaw: 0, color: YELLOW, material: MAT_SIGN });
    ctx.boxes.push({ x: ctx.centerX + 1.5, y: ctx.centerY + 2.5, z: 13.6, sx: 5.8, sy: 0.72, sz: 0.72, yaw: -0.55, color: CYAN, material: MAT_SIGN });
    addSolid(ctx, "titan-plinth", ctx.centerX - 2, ctx.centerY + 2.5, 8.5, 8.5, 12.8);
    addBuildingShell(ctx, "titan-kiosk", ctx.centerX + 7.6, ctx.centerY + 2.7, 5.8, 5.8, 3.1, BRICK, CYAN, INK);
  } else {
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 0.68, sx: 8, sy: 18, sz: 0.16, yaw: 0, color: BLUE, material: MAT_WATER });
    addWaterRegion(ctx, "titan-reflection", ctx.centerX, ctx.centerY, 8, 18);
    addSolid(ctx, "titan-reflection", ctx.centerX, ctx.centerY, 8, 18, 0.45);
    for (const x of [-8.5, 8.5]) {
      addTree(ctx, ctx.centerX + x, ctx.centerY - 6.5, 0.8, true);
      addTree(ctx, ctx.centerX + x, ctx.centerY + 6.5, 0.8, true);
    }
    addBench(ctx, ctx.centerX - 7.8, ctx.centerY, Math.PI / 2);
    addBench(ctx, ctx.centerX + 7.8, ctx.centerY, Math.PI / 2);
  }
}

function addDeepBlueAquariumTile(ctx: LotContext, tileX: number, tileY: number) {
  addLandmarkPad(ctx, tileY === 1 ? BLUE : BONE, tileY === 1 ? MAT_WATER : MAT_SIDEWALK);
  if (tileX === 0 && tileY === 0) {
    addBuildingShell(ctx, "aquarium-hall", ctx.centerX, ctx.centerY + 3.1, 19, 11.5, 7.3, INK, CYAN, BLUE);
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 3, z: 4, sx: 16.5, sy: 0.35, sz: 2.5, yaw: 0, color: BLUE, material: MAT_WINDOW });
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY + 3.1, z: 9.1, sx: 9.5, sy: 9.5, sz: 1, yaw: Math.PI / 4, color: CYAN, material: MAT_SIGN });
  } else if (tileX === 1 && tileY === 0) {
    for (const x of [-5.2, 5.2]) {
      addBuildingShell(ctx, `aquarium-tank-${x}`, ctx.centerX + x, ctx.centerY + 1.5, 8.5, 15, 6.2, BLUE, CYAN, INK);
      ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY - 6.2, z: 3.2, sx: 7.4, sy: 0.2, sz: 3.8, yaw: 0, color: CYAN, material: MAT_WINDOW });
    }
  } else if (tileX === 0 && tileY === 1) {
    addWaterRegion(ctx, "aquarium-lagoon", ctx.centerX, ctx.centerY, 21, 21);
    addSolid(ctx, "aquarium-lagoon", ctx.centerX, ctx.centerY, 21, 21, 0.45);
    for (const x of [-7, 0, 7]) {
      ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY, z: 1.2, sx: 1.1, sy: 8.5, sz: 0.38, yaw: 0, color: WHITE, material: MAT_SIDEWALK });
    }
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 2.1, sx: 12.5, sy: 3.2, sz: 2, yaw: 0, color: CYAN, material: MAT_SIGN });
  } else {
    addBuildingShell(ctx, "aquarium-research", ctx.centerX, ctx.centerY + 2, 11, 11, 12.8, WHITE, CYAN, BLUE);
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY + 2, z: 15.1, sx: 7.8, sy: 7.8, sz: 1.1, yaw: Math.PI / 4, color: BLUE, material: MAT_SIGN });
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY + 2, z: 18, sx: 0.4, sy: 0.4, sz: 5.2, yaw: 0, color: CYAN, material: MAT_SIGN });
  }
}

function addNeonGeneralTile(ctx: LotContext, tileX: number, tileY: number) {
  addCampusGround(ctx, tileX, tileY, 2, 2, WHITE);
  const campusCenter = campusPoint(ctx, tileX, tileY, 2, 2);

  // A continuous medical podium visually ties all four claimed blocks into a
  // single structure. The upper masses vary by tile to form a skyline.
  if (tileX === 0 && tileY === 0) {
    // A real lobby cut through the front podium keeps the exterior portal
    // visible and walkable rather than hiding it inside a decorative mass.
    ctx.boxes.push({ x: ctx.centerX - 6.5, y: ctx.centerY, z: 3.2, sx: 9, sy: 22, sz: 5, yaw: 0, color: BONE, material: MAT_BUILDING });
    ctx.boxes.push({ x: ctx.centerX + 6.5, y: ctx.centerY, z: 3.2, sx: 9, sy: 22, sz: 5, yaw: 0, color: BONE, material: MAT_BUILDING });
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY + 5.75, z: 3.2, sx: 4, sy: 10.5, sz: 5, yaw: 0, color: BONE, material: MAT_BUILDING });
    ctx.boxes.push({ x: ctx.centerX - 6.5, y: ctx.centerY, z: 5.85, sx: 8.5, sy: 21, sz: 0.35, yaw: 0, color: RED, material: MAT_SIGN });
    ctx.boxes.push({ x: ctx.centerX + 6.5, y: ctx.centerY, z: 5.85, sx: 8.5, sy: 21, sz: 0.35, yaw: 0, color: RED, material: MAT_SIGN });
    addSolid(ctx, "hospital-podium-west", ctx.centerX - 6.5, ctx.centerY, 9, 22, 5.7);
    addSolid(ctx, "hospital-podium-east", ctx.centerX + 6.5, ctx.centerY, 9, 22, 5.7);
    addSolid(ctx, "hospital-podium-rear", ctx.centerX, ctx.centerY + 5.75, 4, 10.5, 5.7);
  } else {
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 3.2, sx: 22, sy: 22, sz: 5, yaw: 0, color: BONE, material: MAT_BUILDING });
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 5.85, sx: 21, sy: 21, sz: 0.35, yaw: 0, color: RED, material: MAT_SIGN });
    addSolid(ctx, "hospital-podium", ctx.centerX, ctx.centerY, 22, 22, 5.7);
  }
  // Podium and upper masses own collision. Only the lobby tile is split into
  // solid side/rear lobes so its center entrance remains a real approach.

  if (tileX === 0 && tileY === 0) {
    addBuildingShell(ctx, "hospital-inpatient", ctx.centerX + 2, ctx.centerY + 2, 18, 18, 25, WHITE, CYAN, INK);
    for (const z of [10, 15.5, 21]) ctx.boxes.push({ x: ctx.centerX + 4, y: ctx.centerY - 6.2, z, sx: 18.5, sy: 0.28, sz: 0.75, yaw: 0, color: CYAN, material: MAT_WINDOW });
    ctx.boxes.push({ x: ctx.centerX + 4, y: ctx.centerY + 4, z: 29, sx: 13, sy: 13, sz: 1.1, yaw: Math.PI / 4, color: RED, material: MAT_SIGN });
    ctx.boxes.push({ x: ctx.centerX + 4, y: ctx.centerY + 4, z: 30.7, sx: 6.5, sy: 1.6, sz: 0.55, yaw: 0, color: WHITE, material: MAT_SIGN });
    ctx.boxes.push({ x: ctx.centerX + 4, y: ctx.centerY + 4, z: 30.72, sx: 1.6, sy: 6.5, sz: 0.56, yaw: 0, color: WHITE, material: MAT_SIGN });
  } else if (tileX === 1 && tileY === 0) {
    addBuildingShell(ctx, "hospital-emergency", ctx.centerX - 1.5, ctx.centerY + 2, 20, 18, 10.5, WHITE, CYAN, RED);
    ctx.boxes.push({ x: ctx.centerX - 2.5, y: ctx.centerY - 6, z: 4.1, sx: 22, sy: 2.3, sz: 0.42, yaw: 0, color: RED, material: MAT_SIGN });
    for (const x of [-7, 3, 9]) ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY - 7, z: 3.2, sx: 0.7, sy: 0.7, sz: 5.1, yaw: 0, color: INK, material: MAT_BUILDING });
    addParkedVehicle(ctx, "ambulance-a", ctx.centerX - 6, ctx.centerY - 7.5, Math.PI / 2, WHITE);
    addParkedVehicle(ctx, "ambulance-b", ctx.centerX + 5, ctx.centerY - 7.5, Math.PI / 2, WHITE);
  } else if (tileX === 0 && tileY === 1) {
    addBuildingShell(ctx, "hospital-diagnostics", ctx.centerX + 2, ctx.centerY - 1, 18, 20, 15, STEEL, CYAN, WHITE);
    ctx.boxes.push({ x: ctx.centerX + 4, y: ctx.centerY - 2, z: 17.4, sx: 14, sy: 14, sz: 0.8, yaw: Math.PI / 4, color: CYAN, material: MAT_SIGN });
    ctx.boxes.push({ x: ctx.centerX + 15, y: ctx.centerY - 2, z: 11.5, sx: 10, sy: 6, sz: 3, yaw: 0, color: CYAN, material: MAT_WINDOW });
  } else {
    addBuildingShell(ctx, "hospital-clinic", ctx.centerX - 2, ctx.centerY - 1, 18, 20, 12.5, WHITE, CYAN, RED);
    ctx.boxes.push({ x: ctx.centerX - 3, y: ctx.centerY - 2, z: 15.5, sx: 18, sy: 18, sz: 0.55, yaw: 0, color: INK, material: MAT_BUILDING });
    ctx.boxes.push({ x: ctx.centerX - 3, y: ctx.centerY - 2, z: 15.9, sx: 15.5, sy: 15.5, sz: 0.18, yaw: 0, color: WHITE, material: MAT_SIGN });
    ctx.boxes.push({ x: ctx.centerX - 3, y: ctx.centerY - 2, z: 16.15, sx: 9, sy: 2, sz: 0.12, yaw: 0, color: RED, material: MAT_SIGN });
    ctx.boxes.push({ x: ctx.centerX - 3, y: ctx.centerY - 2, z: 16.15, sx: 2, sy: 9, sz: 0.12, yaw: 0, color: RED, material: MAT_SIGN });
  }

  // Four glazed bridges cross the former internal streets above walking
  // height, making the 2x2 footprint read as one hospital campus.
  if (tileX === 0) {
    ctx.boxes.push({ x: ctx.centerX + 18, y: ctx.centerY + 1, z: 9.5, sx: 14, sy: 6, sz: 3.8, yaw: 0, color: CYAN, material: MAT_WINDOW });
    ctx.boxes.push({ x: ctx.centerX + 18, y: ctx.centerY + 1, z: 12, sx: 14.8, sy: 6.8, sz: 0.45, yaw: 0, color: WHITE, material: MAT_BUILDING });
  }
  if (tileY === 0) {
    ctx.boxes.push({ x: ctx.centerX + (tileX === 0 ? 2 : -1.5), y: ctx.centerY + 18, z: 8, sx: 6, sy: 14, sz: 3.4, yaw: 0, color: CYAN, material: MAT_WINDOW });
    ctx.boxes.push({ x: ctx.centerX + (tileX === 0 ? 2 : -1.5), y: ctx.centerY + 18, z: 10.2, sx: 6.8, sy: 14.8, sz: 0.45, yaw: 0, color: RED, material: MAT_SIGN });
  }

  if (tileX === 0 && tileY === 0) {
    // Main lobby faces the south perimeter road and remains portal-clear.
    for (const x of [-6, 6]) ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY - 12.2, z: 2.7, sx: 0.75, sy: 0.75, sz: 4.4, yaw: 0, color: INK, material: MAT_BUILDING });
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 12.2, z: 5.1, sx: 15, sy: 2, sz: 0.55, yaw: 0, color: RED, material: MAT_SIGN });
  }

  void campusCenter;
}

function addApexUniversityTile(ctx: LotContext, tileX: number, tileY: number) {
  addLandmarkPad(ctx, tileX === 0 && tileY === 1 ? GRASS : BONE, tileX === 0 && tileY === 1 ? MAT_GRASS : MAT_SIDEWALK);
  if (tileX === 0 && tileY === 0) {
    addBuildingShell(ctx, "university-admin", ctx.centerX, ctx.centerY + 3.1, 18, 11.3, 9.5, BRICK, CYAN, INK);
    for (const x of [-6, -3, 0, 3, 6]) {
      ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY - 3, z: 3.1, sx: 0.5, sy: 0.5, sz: 4.8, yaw: 0, color: WHITE, material: MAT_BUILDING });
    }
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 3.2, z: 6.3, sx: 16, sy: 1.2, sz: 0.45, yaw: 0, color: INK, material: MAT_BUILDING });
  } else if (tileX === 1 && tileY === 0) {
    addBuildingShell(ctx, "university-hall", ctx.centerX, ctx.centerY + 1.5, 19, 15.5, 6.2, BONE, PINK, BRICK);
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 6.6, z: 3.4, sx: 14, sy: 0.24, sz: 1.8, yaw: 0, color: PINK, material: MAT_SIGN });
  } else if (tileX === 0 && tileY === 1) {
    for (const x of [-7.5, 7.5]) for (const y of [-7.5, 7.5]) addTree(ctx, ctx.centerX + x, ctx.centerY + y, 0.85, true);
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 0.72, sx: 4.2, sy: 18, sz: 0.18, yaw: 0, color: WHITE, material: MAT_SIDEWALK });
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 1.8, sx: 3.2, sy: 3.2, sz: 2.2, yaw: Math.PI / 4, color: CYAN, material: MAT_SIGN });
    addBench(ctx, ctx.centerX - 6.5, ctx.centerY);
    addBench(ctx, ctx.centerX + 6.5, ctx.centerY);
  } else {
    addBuildingShell(ctx, "university-library", ctx.centerX, ctx.centerY + 1, 16, 16, 12.5, INK, CYAN, BRICK);
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY + 1, z: 15, sx: 7.5, sy: 7.5, sz: 1, yaw: Math.PI / 4, color: YELLOW, material: MAT_SIGN });
  }
}

function addVoltExpoTile(ctx: LotContext, tileX: number) {
  addLandmarkPad(ctx, STEEL);
  if (tileX === 0) {
    addBuildingShell(ctx, "expo-hall-a", ctx.centerX, ctx.centerY + 2.8, 19.5, 12.2, 7.5, STEEL, ORANGE, INK);
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 3.6, z: 4.4, sx: 16.5, sy: 0.35, sz: 1.8, yaw: 0, color: ORANGE, material: MAT_SIGN });
  } else if (tileX === 1) {
    for (const side of [-1, 1]) {
      ctx.boxes.push({ x: ctx.centerX + side * 6.5, y: ctx.centerY, z: 5.2, sx: 1.1, sy: 1.1, sz: 9.5, yaw: 0, color: INK, material: MAT_BUILDING });
      addSolid(ctx, `expo-arch-${side}`, ctx.centerX + side * 6.5, ctx.centerY, 1.1, 1.1, 10);
    }
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 9.3, sx: 14, sy: 1.1, sz: 1.1, yaw: 0, color: YELLOW, material: MAT_SIGN });
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 6.7, sx: 7.5, sy: 0.55, sz: 3.2, yaw: 0, color: PINK, material: MAT_SIGN });
    addBench(ctx, ctx.centerX - 6, ctx.centerY - 7.5);
    addBench(ctx, ctx.centerX + 6, ctx.centerY - 7.5);
  } else {
    addBuildingShell(ctx, "expo-hall-b", ctx.centerX, ctx.centerY + 1, 20, 16, 6.5, BONE, CYAN, ORANGE);
    for (const x of [-7, 0, 7]) {
      ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY + 1, z: 8.2, sx: 5.4, sy: 12.5, sz: 0.5, yaw: x === 0 ? 0 : x > 0 ? 0.18 : -0.18, color: x === 0 ? ORANGE : CYAN, material: MAT_SIGN });
    }
  }
}

function addStarfallObservatoryTile(ctx: LotContext, tileX: number) {
  addLandmarkPad(ctx, BONE);
  if (tileX === 0) {
    addBuildingShell(ctx, "observatory-center", ctx.centerX, ctx.centerY + 3.2, 18, 11.2, 5.2, BONE, CYAN, INK);
  } else {
    addSolid(ctx, "observatory-dome", ctx.centerX, ctx.centerY + 1.5, 13, 13, 10);
  }
}

function addLuckyCasinoTile(ctx: LotContext, tileX: number, tileY: number) {
  addLandmarkPad(ctx, tileX === 0 && tileY === 1 ? BLUE : INK, tileX === 0 && tileY === 1 ? MAT_WATER : MAT_SIDEWALK);
  if (tileX === 0 && tileY === 0) {
    addBuildingShell(ctx, "casino-floor", ctx.centerX, ctx.centerY + 3.1, 19, 11.5, 8.2, INK, PINK, YELLOW);
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 3, z: 5, sx: 16, sy: 0.5, sz: 2.8, yaw: 0, color: PINK, material: MAT_SIGN });
    for (const x of [-5.5, 0, 5.5]) {
      ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY - 3.35, z: 5, sx: 2.8, sy: 0.18, sz: 1.5, yaw: Math.PI / 4, color: YELLOW, material: MAT_SIGN });
    }
  } else if (tileX === 1 && tileY === 0) {
    addBuildingShell(ctx, "casino-hotel", ctx.centerX, ctx.centerY + 1, 13, 15.5, 22, MUTED_RED, CYAN, INK);
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY + 1, z: 24.5, sx: 6.5, sy: 6.5, sz: 1, yaw: Math.PI / 4, color: YELLOW, material: MAT_SIGN });
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY + 1, z: 27, sx: 0.45, sy: 0.45, sz: 4.5, yaw: 0, color: PINK, material: MAT_SIGN });
  } else if (tileX === 0 && tileY === 1) {
    addWaterRegion(ctx, "casino-pool", ctx.centerX, ctx.centerY, 20, 16);
    addSolid(ctx, "casino-pool", ctx.centerX, ctx.centerY, 20, 16, 0.45);
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 0.72, sx: 20, sy: 16, sz: 0.18, yaw: 0, color: BLUE, material: MAT_WATER });
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 1.1, sx: 12, sy: 4.2, sz: 0.35, yaw: Math.PI / 8, color: CYAN, material: MAT_SIGN });
    for (const x of [-8, 8]) addPylonSign(ctx, ctx.centerX + x, ctx.centerY + 7, PINK, 4.5, 1.8);
  } else {
    addParkingStripes(ctx, ctx.centerX, ctx.centerY + 1, 7);
    addParkedVehicle(ctx, "casino-limo", ctx.centerX, ctx.centerY - 5.5, 0, INK);
    addPylonSign(ctx, ctx.centerX + 8.5, ctx.centerY - 6.8, YELLOW, 10.5, 4.5);
  }
}

function addLandmarkLot(ctx: LotContext, landmark: LandmarkTile) {
  if (landmark.definition.style === "marina-arcade") {
    addMarketLot(ctx);
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY + 3.15, z: 6.7, sx: 12.5, sy: 0.55, sz: 2.4, yaw: 0, color: INK, material: MAT_BUILDING });
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY + 2.82, z: 6.8, sx: 11.8, sy: 0.18, sz: 1.85, yaw: 0, color: PINK, material: MAT_SIGN });
  } else if (landmark.definition.style === "apex-hotel") {
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 0.55, sx: 22.2, sy: 22.2, sz: 0.18, yaw: 0, color: WHITE, material: MAT_SIDEWALK });
    addBuildingShell(ctx, "apex-hotel", ctx.centerX + 1.5, ctx.centerY + 2.5, 13.8, 14.5, 21.8, BONE, CYAN, RED);
    ctx.boxes.push({ x: ctx.centerX + 1.5, y: ctx.centerY - 5.2, z: 1.45, sx: 8.5, sy: 2.1, sz: 0.38, yaw: 0, color: INK, material: MAT_BUILDING });
    ctx.boxes.push({ x: ctx.centerX + 1.5, y: ctx.centerY - 5.45, z: 1.55, sx: 7.8, sy: 0.24, sz: 0.55, yaw: 0, color: RED, material: MAT_SIGN });
    ctx.boxes.push({ x: ctx.centerX + 1.5, y: ctx.centerY + 2.5, z: 23.6, sx: 0.65, sy: 0.65, sz: 3.2, yaw: 0, color: INK, material: MAT_BUILDING });
    ctx.boxes.push({ x: ctx.centerX + 1.5, y: ctx.centerY + 2.5, z: 25.35, sx: 2.4, sy: 2.4, sz: 0.55, yaw: Math.PI / 4, color: RED, material: MAT_SIGN });
    addPerson(ctx, ctx.centerX - 5.5, ctx.centerY - 7.8, PINK);
  } else if (landmark.definition.style === "south-terminal") {
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 0.55, sx: 22.5, sy: 22.5, sz: 0.18, yaw: 0, color: ROAD, material: MAT_ROAD });
    addBuildingShell(ctx, "terminal", ctx.centerX + 3.5, ctx.centerY + 6.4, 15.5, 7.7, 5.1, STEEL, CYAN, RED);
    for (const x of [-7.5, -2.5, 2.5, 7.5]) {
      ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY - 0.8, z: 3.8, sx: 4.4, sy: 9.5, sz: 0.5, yaw: 0, color: INK, material: MAT_BUILDING });
      ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY - 0.8, z: 4.1, sx: 4, sy: 9.1, sz: 0.24, yaw: 0, color: ORANGE, material: MAT_SIGN });
      ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY - 0.8, z: 2.25, sx: 0.32, sy: 0.32, sz: 3.2, yaw: 0, color: WHITE, material: MAT_BUILDING });
      addSolid(ctx, `terminal-post-${x}`, ctx.centerX + x, ctx.centerY - 0.8, 0.32, 0.32, 4.2);
    }
    addParkedVehicle(ctx, "terminal-bus", ctx.centerX - 6.7, ctx.centerY - 4, Math.PI / 2, RED);
    addPylonSign(ctx, ctx.centerX - 9.5, ctx.centerY + 7.1, ORANGE, 6.2, 2.8, true);
  } else if (landmark.definition.style === "rooftop-radio") {
    addApartmentLot(ctx);
    ctx.boxes.push({ x: ctx.centerX + 5.4, y: ctx.centerY + 1.4, z: 19, sx: 0.55, sy: 0.55, sz: 11.5, yaw: 0, color: INK, material: MAT_BUILDING });
    for (const z of [16.5, 20.2, 24.2]) ctx.boxes.push({ x: ctx.centerX + 5.4, y: ctx.centerY + 1.4, z, sx: 5.2, sy: 0.28, sz: 0.28, yaw: z * 0.1, color: RED, material: MAT_SIGN });
  } else if (landmark.definition.style === "ink-market") {
    addMarketLot(ctx);
    addPylonSign(ctx, ctx.centerX + 9.2, ctx.centerY - 7.3, PINK, 7.1, 3.1);
  } else if (landmark.definition.style === "redline-pier") {
    addMarinaLot(ctx);
    ctx.boxes.push({ x: ctx.centerX + 8.5, y: ctx.centerY - 7, z: 6.7, sx: 0.42, sy: 0.42, sz: 11.5, yaw: 0, color: INK, material: MAT_BUILDING });
    ctx.boxes.push({ x: ctx.centerX + 6.3, y: ctx.centerY - 7, z: 11.9, sx: 4.7, sy: 0.38, sz: 0.55, yaw: 0, color: RED, material: MAT_SIGN });
  } else if (landmark.definition.style === "pulse-stadium") {
    addPulseStadiumTile(ctx, landmark.tileX, landmark.tileY);
  } else if (landmark.definition.style === "skyport-airport") {
    addSkyportTile(ctx, landmark.tileX, landmark.tileY);
  } else if (landmark.definition.style === "nova-megamall") {
    addNovaMegamallTile(ctx, landmark.tileX, landmark.tileY);
  } else if (landmark.definition.style === "neon-titan") {
    addNeonTitanTile(ctx, landmark.tileY);
  } else if (landmark.definition.style === "deep-blue-aquarium") {
    addDeepBlueAquariumTile(ctx, landmark.tileX, landmark.tileY);
  } else if (landmark.definition.style === "neon-general") {
    addNeonGeneralTile(ctx, landmark.tileX, landmark.tileY);
  } else if (landmark.definition.style === "apex-university") {
    addApexUniversityTile(ctx, landmark.tileX, landmark.tileY);
  } else if (landmark.definition.style === "volt-expo") {
    addVoltExpoTile(ctx, landmark.tileX);
  } else if (landmark.definition.style === "starfall-observatory") {
    addStarfallObservatoryTile(ctx, landmark.tileX);
  } else if (landmark.definition.style === "lucky-88-casino") {
    addLuckyCasinoTile(ctx, landmark.tileX, landmark.tileY);
  } else {
    const unhandled: never = landmark.definition.style;
    throw new Error(`Unhandled landmark style ${unhandled}`);
  }
}

function buildLot(ctx: LotContext, district: DistrictKind, lot: LotKind) {
  const lotBoxes: Box[] = [];
  const lotColliders: Collider[] = [];
  const lotSurfaces: MeshFace[] = [];
  const lotSurfaceRegions: LotContext["surfaceRegions"] = [];
  const lotCtx: LotContext = {
    ...ctx,
    boxes: lotBoxes,
    surfaces: lotSurfaces,
    colliders: lotColliders,
    surfaceRegions: lotSurfaceRegions,
  };
  const landmark = landmarkTileForBlock(ctx.blockX, ctx.blockY);
  const residentialAnchor = residentialAnchorForBlock(ctx.blockX, ctx.blockY);
  const mountainAnchor = mountainAnchorForBlock(ctx.blockX, ctx.blockY);
  const desertAnchor = desertAnchorForBlock(ctx.blockX, ctx.blockY);
  const wetlandAnchor = wetlandAnchorForBlock(ctx.blockX, ctx.blockY);
  if (lot === "landmark") {
    if (!landmark) throw new Error(`Missing landmark at ${ctx.blockX},${ctx.blockY}`);
    addLandmarkLot(lotCtx, landmark);
    finishCityLandmark(lotCtx, landmark);
  } else if (district === "coastal") {
    buildCoastalLot(lotCtx, lot);
  } else if (district === "wetland") {
    buildWetlandLot(lotCtx, lot);
  } else if (inCityTerrain(ctx.centerX, ctx.centerY)) {
    buildCityLot(lotCtx, lot, district);
  } else {
    switch (lot) {
      case "tower": addTowerLot(lotCtx); break;
      case "office": addOfficeLot(lotCtx); break;
      case "apartment": addApartmentLot(lotCtx); break;
      case "shops": addShopLot(lotCtx); break;
      case "diner": addDinerLot(lotCtx); break;
      case "townhouses": addTownhouseLot(lotCtx); break;
      case "homes": addHomesLot(lotCtx); break;
      case "park": addParkLot(lotCtx); break;
      case "playground": addPlaygroundLot(lotCtx); break;
      case "plaza": addPlazaLot(lotCtx); break;
      case "gas": addGasLot(lotCtx); break;
      case "carwash": addCarwashLot(lotCtx); break;
      case "warehouse": addWarehouseLot(lotCtx); break;
      case "factory": addFactoryLot(lotCtx); break;
      case "motel": addMotelLot(lotCtx); break;
      case "civic": addCivicLot(lotCtx); break;
      case "market": addMarketLot(lotCtx); break;
      case "construction": addConstructionLot(lotCtx); break;
      case "marina": addMarinaLot(lotCtx); break;
      case "boardwalk": addBoardwalkLot(lotCtx); break;
      case "vale-bungalow":
      case "vale-ranch":
      case "vale-duplex":
      case "vale-cottages":
      case "vale-rowhomes":
      case "vale-garden-apartments":
      case "vale-corner-flats":
      case "vale-pocket-park":
      case "vale-community-garden":
      case "vale-recreation":
      case "vale-pool":
      case "vale-commons":
      case "vale-school":
      case "vale-library":
      case "vale-firehouse":
      case "vale-water-tower":
      case "vale-drive-in":
      case "vale-gateway-station": buildResidentialLot(lotCtx, lot); break;
      case "range-cabin":
      case "range-a-frame":
      case "range-farmstead":
      case "range-lakeside-home":
      case "range-forest-clearing":
      case "range-meadow":
      case "range-rocky-grove":
      case "range-campground":
      case "range-trailhead":
      case "range-main-street":
      case "range-general-store":
      case "range-diner":
      case "range-outfitter":
      case "range-workshop":
      case "range-roadside-motel":
      case "range-gas-stop":
      case "range-chalet":
      case "range-ski-rental":
      case "range-snowfield":
      case "range-lift-support":
      case "range-northstar-gate":
      case "range-copper-gas":
      case "range-village-square":
      case "range-timberline-lodge":
      case "range-ranger-station":
      case "range-old-spruce-mill":
      case "range-mirror-lake":
      case "range-silver-run-resort":
      case "range-aurora-lookout": buildMountainLot(lotCtx, lot); break;
      case "mesa-adobe-home":
      case "mesa-courtyard-home":
      case "mesa-casita":
      case "mesa-desert-ranch":
      case "mesa-trailer-court":
      case "mesa-saguaro-scrub":
      case "mesa-creosote-flat":
      case "mesa-dry-wash":
      case "mesa-rock-garden":
      case "mesa-redrock-shelf":
      case "mesa-trailhead":
      case "mesa-main-street":
      case "mesa-diner":
      case "mesa-gas-stop":
      case "mesa-convenience":
      case "mesa-auto-shop":
      case "mesa-motor-court":
      case "mesa-pottery-market":
      case "mesa-shade-plaza":
      case "mesa-sundown-gate":
      case "mesa-roadrunner-post":
      case "mesa-copper-junction":
      case "mesa-coyote-motor-court":
      case "mesa-desert-bloom-resort":
      case "mesa-dustwind-airpark":
      case "mesa-ocotillo-arts":
      case "mesa-sunstone-solar":
      case "mesa-saguaro-rodeo":
      case "mesa-painted-canyon": buildDesertLot(lotCtx, lot); break;
      case "reach-stilt-house":
      case "reach-shotgun-house":
      case "reach-fisher-cottage":
      case "reach-houseboat-yard":
      case "reach-cypress-grove":
      case "reach-reed-marsh":
      case "reach-blackwater-pool":
      case "reach-boardwalk-trail":
      case "reach-fishing-dock":
      case "reach-mudflat":
      case "reach-main-street":
      case "reach-seafood-market":
      case "reach-gas-stop":
      case "reach-bait-shop":
      case "reach-boatyard":
      case "reach-motel":
      case "reach-roadhouse":
      case "reach-marina":
      case "reach-twinwater-gate":
      case "reach-lantern-market":
      case "reach-bayou-belle":
      case "reach-stormwall-locks":
      case "reach-cypress-crown":
      case "reach-gulfwatch-station":
      case "reach-moonwater-marina":
      case "reach-sunkissed-motel":
      case "reach-blackwater-shipyard":
      case "reach-saint-lumina": buildWetlandLot(lotCtx, lot); break;
    }
  }
  if (!inCityTerrain(ctx.centerX, ctx.centerY) && !landmark && !residentialAnchor && !mountainAnchor && !desertAnchor && !wetlandAnchor && district !== "mountain" && district !== "desert" && district !== "wetland" && district !== "coastal" && district !== "residential") addCornerKit(lotCtx, district);

  const fixedCoastal = district === "coastal" && (ctx.blockX < -56 || coastalAnchorForBlock(ctx.blockX, ctx.blockY) || coastCanalBlock(ctx.blockX, ctx.blockY));
  const orientation = landmark?.definition.orientation ?? (residentialAnchor || mountainAnchor || desertAnchor || wetlandAnchor || fixedCoastal || district === "residential" ? 0 : district === "wetland" ? wetlandLotOrientation(ctx.blockX, ctx.blockY) : lotOrientationForBlock(ctx.blockX, ctx.blockY));
  const contentScale = landmark || residentialAnchor || mountainAnchor || desertAnchor || wetlandAnchor || district === "coastal" || district === "residential" || district === "wetland" ? 1 : GENERIC_LOT_CONTENT_SCALE;
  for (const box of lotBoxes) {
    const offsetX = (box.x - ctx.centerX) * contentScale;
    const offsetY = (box.y - ctx.centerY) * contentScale;
    box.sx *= contentScale;
    box.sy *= contentScale;
    if (orientation === 1) {
      box.x = ctx.centerX - offsetY;
      box.y = ctx.centerY + offsetX;
    } else if (orientation === 2) {
      box.x = ctx.centerX - offsetX;
      box.y = ctx.centerY - offsetY;
    } else if (orientation === 3) {
      box.x = ctx.centerX + offsetY;
      box.y = ctx.centerY - offsetX;
    } else {
      box.x = ctx.centerX + offsetX;
      box.y = ctx.centerY + offsetY;
    }
    box.yaw += orientation * Math.PI / 2;
    if (box.groundAnchor) box.groundAnchor = transformLotPose(ctx.centerX, ctx.centerY,
      box.groundAnchor.x, box.groundAnchor.y, 0, orientation, contentScale);
    ctx.boxes.push(box);
  }
  for (const collider of lotColliders) {
    const offsetX = (collider.x - ctx.centerX) * contentScale;
    const offsetY = (collider.y - ctx.centerY) * contentScale;
    collider.halfX *= contentScale;
    collider.halfY *= contentScale;
    if (orientation === 1) {
      collider.x = ctx.centerX - offsetY;
      collider.y = ctx.centerY + offsetX;
    } else if (orientation === 2) {
      collider.x = ctx.centerX - offsetX;
      collider.y = ctx.centerY - offsetY;
    } else if (orientation === 3) {
      collider.x = ctx.centerX + offsetY;
      collider.y = ctx.centerY - offsetX;
    } else {
      collider.x = ctx.centerX + offsetX;
      collider.y = ctx.centerY + offsetY;
    }
    if (orientation % 2 === 1) {
      const halfX = collider.halfX;
      collider.halfX = collider.halfY;
      collider.halfY = halfX;
    }
    if (collider.groundAnchor) collider.groundAnchor = transformLotPose(ctx.centerX, ctx.centerY,
      collider.groundAnchor.x, collider.groundAnchor.y, 0, orientation, contentScale);
    ctx.colliders.push(collider);
  }
  for (const face of lotSurfaces) {
    const transform = (point: Vec3) => ({ ...transformLotPose(ctx.centerX, ctx.centerY,
      point.x, point.y, 0, orientation, contentScale), z: point.z });
    const corners = face.corners.map(transform) as unknown as MeshFace["corners"];
    const groundAnchor = face.groundAnchor ? transform({ ...face.groundAnchor, z: 0 }) : undefined;
    ctx.surfaces?.push({ ...face, corners, ...(groundAnchor ? { groundAnchor } : {}) });
  }
  for (const region of lotSurfaceRegions) {
    const offsetX = (region.x - ctx.centerX) * contentScale;
    const offsetY = (region.y - ctx.centerY) * contentScale;
    region.halfX *= contentScale;
    region.halfY *= contentScale;
    if (orientation === 1) {
      region.x = ctx.centerX - offsetY;
      region.y = ctx.centerY + offsetX;
    } else if (orientation === 2) {
      region.x = ctx.centerX - offsetX;
      region.y = ctx.centerY - offsetY;
    } else if (orientation === 3) {
      region.x = ctx.centerX + offsetY;
      region.y = ctx.centerY - offsetX;
    } else {
      region.x = ctx.centerX + offsetX;
      region.y = ctx.centerY + offsetY;
    }
    region.yaw += orientation * Math.PI / 2;
    ctx.surfaceRegions.push(region);
  }
}

function addCorridorVerge(ctx: LotContext, district: DistrictKind) {
  if (district === "coastal") {
    buildCoastalVerge(ctx, (x, y) => {
      const road = nearestSpecialRoadProjection({ x, y });
      return !!road && road.surfaceDistance > 5 && !isRoadSurface({ x, y }, 4);
    });
    return;
  }
  if (district === "desert") {
    buildDesertVerge(ctx, (x, y) => {
      const road = nearestSpecialRoadProjection({ x, y });
      return !!road && road.surfaceDistance > 5 && !isRoadSurface({ x, y }, 4);
    });
    return;
  }
  if (district === "mountain") {
    buildMountainVerge(ctx, (x, y) => {
      const road = nearestSpecialRoadProjection({ x, y });
      return !!road && road.surfaceDistance > 5 && !isRoadSurface({ x, y }, 4);
    });
    return;
  }
  const vergeColor = district === "industrial"
    ? STEEL
    : district === "wetland"
      ? REACH_MOSS
    : district === "harbor"
      ? BLUE
      : district === "downtown" || district === "commercial"
        ? BONE
        : GRASS;
  ctx.boxes.push({
    x: ctx.centerX + 0.55,
    y: ctx.centerY + 0.55,
    z: 0.14,
    sx: 25.4,
    sy: 25.4,
    sz: 0.22,
    yaw: 0,
    color: INK,
    material: MAT_SIDEWALK,
  });
  ctx.boxes.push({
    x: ctx.centerX,
    y: ctx.centerY,
    z: 0.28,
    sx: 24,
    sy: 24,
    sz: 0.22,
    yaw: 0,
    color: vergeColor,
    material: district === "suburb" || district === "townhomes" || district === "wetland" ? MAT_GRASS : MAT_SIDEWALK,
  });
  const corners = [
    [-7.6, -7.6], [7.6, -7.6], [-7.6, 7.6], [7.6, 7.6],
  ] as const;
  for (const [offsetX, offsetY] of corners) {
    const x = ctx.centerX + offsetX;
    const y = ctx.centerY + offsetY;
    const road = nearestSpecialRoadProjection({ x, y });
    if (!road || road.surfaceDistance < 3.2) continue;
    ctx.boxes.push({
      x,
      y,
      z: 0.45,
      sx: 5.4,
      sy: 5.4,
      sz: 0.16,
      yaw: 0,
      color: district === "industrial" ? ROAD : district === "wetland" ? REACH_MOSS : GRASS,
      material: district === "industrial" ? MAT_ROAD : MAT_GRASS,
    });
    if (district !== "industrial" && ((ctx.blockX + ctx.blockY + offsetX) % 3 !== 0)) {
      addTree(ctx, x, y, 0.48);
    }
  }
}

function specialRoadOwner(a: { x: number; y: number }, b: { x: number; y: number }) {
  const midpointX = (a.x + b.x) / 2;
  const midpointY = (a.y + b.y) / 2;
  return nearestActiveChunk(
    Math.floor((midpointX + CHUNK_SIZE / 2) / CHUNK_SIZE),
    Math.floor((midpointY + CHUNK_SIZE / 2) / CHUNK_SIZE),
  );
}

const cedarRoadIds = new Set(CEDAR_ROADS.map((road) => road.id));

function addSpecialRoadGeometry(boxes: Box[], surfaces: MeshFace[], colliders: Collider[], cx: number, cy: number) {
  for (const segment of SPECIAL_ROAD_SEGMENTS) {
    const owner = specialRoadOwner(segment.a, segment.b);
    if (owner.cx !== cx || owner.cy !== cy) continue;
    const structure = roadStructure(segment);
    boxes.push(...structure.boxes);
    colliders.push(...structure.colliders);
    surfaces.push(...structure.surfaces);
    const mountainStructure = mountainRoadStructures(segment);
    boxes.push(...mountainStructure.boxes);
    colliders.push(...mountainStructure.colliders);
    surfaces.push(...mountainStructure.surfaces);
    const copperStructure = copperRoadStructures(segment);
    boxes.push(...copperStructure.boxes);
    colliders.push(...copperStructure.colliders);
    surfaces.push(...copperStructure.surfaces);
    const geometry = compiledSpecialRoad(segment.pathId)!;
    const cedarRoad = cedarRoadIds.has(segment.pathId);
    const strip = (lateral: number, width: number, z: number, height: number, color: Color, material: NonNullable<Box["material"]>) => {
      const a = geometry.sections[segment.index];
      const b = geometry.sections[segment.index + 1];
      const left = lateral - width / 2, right = lateral + width / 2;
      surfaces.push(roadStripQuad(a, b, left * a.halfWidth / segment.halfWidth, right * a.halfWidth / segment.halfWidth,
        z + height / 2, color, material, left * b.halfWidth / segment.halfWidth, right * b.halfWidth / segment.halfWidth));
    };
    strip(0,
      segment.halfWidth * 2 + 1.25,
      0.46,
      0.2,
      INK,
      MAT_ROAD,
    );

    strip(0, segment.halfWidth * 2, 0.57, 0.14, ROAD, MAT_ROAD);
    if (cedarRoad) {
      for (const side of [-1, 1]) {
        const section = geometry.sections[segment.index];
        const point = { x: (segment.a.x + segment.b.x) / 2 + section.right.x * side * (segment.halfWidth - 1),
          y: (segment.a.y + segment.b.y) / 2 + section.right.y * side * (segment.halfWidth - 1) };
        if (!cedarStreetIndex().query(point, 1).some((road) => road.roadId !== segment.pathId)) {
          strip(side * (segment.halfWidth - 1), 2, 0.65, 0.02, VALE_CREAM, MAT_SIDEWALK);
          strip(side * (segment.halfWidth - 2), 0.16, 0.67, 0.02, WHITE, MAT_SIDEWALK);
        }
      }
      if (!segment.pathId.endsWith("-turnaround") && segment.index % 3 === 0) strip(0, 0.23, 0.68, 0.02, VALE_AMBER, MAT_ROUTE);
      continue;
    }

    const cityRoad = inCityTerrain(segment.a.x, segment.a.y) && inCityTerrain(segment.b.x, segment.b.y);
    const northstarRoad = inNorthstarTerrain(segment.a.x, segment.a.y) || segment.pathId === "northstar-highway"
      || segment.pathId === "pinehook-loop"
      || segment.pathId === "mirror-lake-road"
      || segment.pathId === "silver-run-switchbacks";
    const desertRoad = inCopperTerrain(segment.a.x, segment.a.y) || segment.pathId === "sundown-highway"
      || segment.pathId === "copper-loop"
      || segment.pathId === "arroyo-road"
      || segment.pathId === "painted-canyon-drive";
    const wetlandRoad = REACH_ROAD_IDS.has(segment.pathId);
    const coastalRoad = inCoastTerrain(segment.a.x, segment.a.y);
    const edgeColor = segment.kind === "parkway" && !northstarRoad && !desertRoad && !wetlandRoad && !coastalRoad ? CYAN : wetlandRoad ? REACH_MINT : WHITE;
    const edgeOffset = Math.max(2.5, segment.halfWidth - 0.58);
    strip(edgeOffset, 0.22, 0.67, 0.055, edgeColor, MAT_ROUTE);
    strip(-edgeOffset, 0.22, 0.67, 0.055, edgeColor, MAT_ROUTE);

    if (segment.kind === "boulevard") {
      strip(0, 0.52, 0.69, 0.08, YELLOW, MAT_ROUTE);
      if (segment.index % 2 === 0) {
        strip(segment.halfWidth * 0.48, 0.2, 0.68, 0.06, WHITE, MAT_ROUTE);
        strip(-segment.halfWidth * 0.48, 0.2, 0.68, 0.06, WHITE, MAT_ROUTE);
      }
    } else if (segment.kind === "highway") {
      strip(0, 0.78, 0.72, 0.16, YELLOW, MAT_SIGN);
      if (segment.index % 2 === 0) {
        strip(segment.halfWidth * 0.48, 0.22, 0.68, 0.06, WHITE, MAT_ROUTE);
        strip(-segment.halfWidth * 0.48, 0.22, 0.68, 0.06, WHITE, MAT_ROUTE);
      }
    } else if (segment.kind === "parkway") {
      if (segment.index % 2 === 0) {
        strip(0, 0.38, 0.68, 0.06, YELLOW, MAT_ROUTE);
      }
      if (segment.index % 6 === 0) {
        const yaw = Math.atan2(segment.b.y - segment.a.y, segment.b.x - segment.a.x);
        for (const side of [-1, 1]) {
          const plantingOffset = segment.halfWidth + (wetlandRoad ? 6.2 : 3.1);
          const x = (segment.a.x + segment.b.x) / 2 - Math.sin(yaw) * side * plantingOffset;
          const y = (segment.a.y + segment.b.y) / 2 + Math.cos(yaw) * side * plantingOffset;
          if (cityRoad || northstarRoad || desertRoad || coastalRoad) {
            const z = ((segment.a.z ?? 0) + (segment.b.z ?? 0)) / 2;
            if (Math.abs(terrainHeightAt(x, y) - z) < 1.5) {
              boxes.push({ x, y, z: z + 1.1, sx: 0.22, sy: 0.22, sz: 1.8, yaw,
                color: WHITE, material: MAT_SIGN, screenLift: z });
              boxes.push({ x, y, z: z + 1.85, sx: 0.28, sy: 0.28, sz: 0.25, yaw,
                color: RANGE_AMBER, material: MAT_SIGN, screenLift: z });
            }
            continue;
          }
          if (desertRoad) {
            boxes.push({ x, y, z: 2.5, sx: 0.58, sy: 0.58, sz: 4.7, yaw: 0, color: MESA_SAGUARO, material: MAT_FOLIAGE });
            boxes.push({ x: x + 0.6 * side, y, z: 2.45, sx: 1.25, sy: 0.4, sz: 0.42, yaw: 0, color: MESA_SAGUARO, material: MAT_FOLIAGE });
          } else if (wetlandRoad) {
            if (reachIsLandAt(x, y, 3) && !reachIsPromenadeAt(x, y, 2) && !isRoadSurface({ x, y }, 4) && !campusTileForBlock(Math.floor(x / 36), Math.floor(y / 36)) && (segment.a.z ?? 0) < 1) reachPalm({ boxes, surfaces, colliders, surfaceRegions: [],
              centerX: x, centerY: y, blockX: Math.floor(x / 36), blockY: Math.floor(y / 36), random: () => .5 }, x, y, .86, true);
          } else {
            boxes.push({ x, y, z: 1.1, sx: 0.48, sy: 0.48, sz: 1.8, yaw: 0, color: northstarRoad ? RANGE_TIMBER : BRICK, material: MAT_FOLIAGE });
            boxes.push({ x, y, z: 2.35, sx: 2.1, sy: 2.1, sz: 1.25, yaw: 0, color: northstarRoad ? RANGE_SPRUCE : LEAF, material: MAT_FOLIAGE });
          }
        }
      }
    } else if (segment.kind === "ramp") {
      if (segment.index % 3 === 0) {
        strip(0, 0.32, 0.68, 0.06, ORANGE, MAT_ROUTE);
      }
    } else if (segment.kind === "roundabout") {
      strip(-segment.halfWidth + 0.48, 0.34, 0.69, 0.07, YELLOW, MAT_ROUTE);
    }
  }

  for (const roundabout of ROUNDABOUTS) {
    const owner = specialRoadOwner(roundabout.center, roundabout.center);
    if (owner.cx !== cx || owner.cy !== cy) continue;
    const islandBase = atRoadElevation({ ...roundabout.center, z: 0 }).z;
    const firstIslandBox = boxes.length;
    boxes.push({
      x: roundabout.center.x + 0.5,
      y: roundabout.center.y + 0.5,
      z: 0.67,
      sx: roundabout.islandHalfSize * 2.45,
      sy: roundabout.islandHalfSize * 2.45,
      sz: 0.42,
      yaw: Math.PI / 4,
      color: INK,
      material: MAT_SIDEWALK,
    });
    boxes.push({
      x: roundabout.center.x,
      y: roundabout.center.y,
      z: 0.91,
      sx: roundabout.islandHalfSize * 2.05,
      sy: roundabout.islandHalfSize * 2.05,
      sz: 0.32,
      yaw: Math.PI / 4,
      color: GRASS,
      material: MAT_GRASS,
    });
    for (let tree = 0; tree < 4; tree += 1) {
      const angle = tree * Math.PI / 2 + Math.PI / 4;
      const x = roundabout.center.x + Math.cos(angle) * 4.1;
      const y = roundabout.center.y + Math.sin(angle) * 4.1;
      boxes.push({ x, y, z: 1.7, sx: 0.42, sy: 0.42, sz: 1.55, yaw: 0, color: BRICK, material: MAT_FOLIAGE });
      boxes.push({ x, y, z: 2.8, sx: 1.75, sy: 1.75, sz: 1.2, yaw: 0, color: LIME, material: MAT_FOLIAGE });
    }
    colliders.push({
      id: `roundabout-island-${roundabout.id}`,
      x: roundabout.center.x,
      y: roundabout.center.y,
      halfX: roundabout.islandHalfSize - 1.8,
      halfY: roundabout.islandHalfSize - 1.8,
      height: 3.4,
      baseZ: islandBase,
    });
    for (let i = firstIslandBox; i < boxes.length; i += 1) { boxes[i].z += islandBase; boxes[i].screenLift = islandBase; }
  }
}

export function generateCityChunk(cx: number, cy: number): CityChunk {
  if (!isActiveChunk(cx, cy)) throw new Error(`Inactive world chunk ${cx},${cy}`);
  const region = regionForChunk(cx, cy)!;
  const boxes: Box[] = [];
  const surfaces: MeshFace[] = [];
  const colliders: Collider[] = [];
  const surfaceRegions: CityChunk["surfaceRegions"] = [];
  const interactions: WorldInteraction[] = [];
  const streetCommerceBlocks: StreetCommerceBlock[] = [];
  const originX = cx * CHUNK_SIZE - CHUNK_SIZE / 2;
  const originY = cy * CHUNK_SIZE - CHUNK_SIZE / 2;
  if (region.id === "city-center" || region.id === "northstar-range" || region.id === "copper-mesa" || region.id === "solana-coast") surfaces.push(...regionalTerrainMesh(originX, originY, CHUNK_SIZE));
  if (region.id === "cypress-reach") addReachGround(surfaces, colliders, surfaceRegions, originX, originY);
  else boxes.push({
    x: originX + CHUNK_SIZE / 2,
    y: originY + CHUNK_SIZE / 2,
    z: -0.72,
    sx: CHUNK_SIZE + 0.2,
    sy: CHUNK_SIZE + 0.2,
    sz: 1.4,
    yaw: 0,
    color: region.theme === "residential"
      ? VALE_GROUND
      : region.theme === "mountain"
        ? RANGE_GROUND
        : region.theme === "desert"
          ? MESA_SAND
          : region.theme === "coastal"
            ? COAST_SAND
        : PAPER,
    material: MAT_GENERIC,
  });

  const addRoadSegment = (roadX: number, roadY: number, vertical: boolean) => {
    if (inElevatedTerrain(roadX, roadY)) {
      const a = atRoadElevation({ x: roadX - (vertical ? 0 : ROAD_SPACING / 2), y: roadY - (vertical ? ROAD_SPACING / 2 : 0) });
      const b = atRoadElevation({ x: roadX + (vertical ? 0 : ROAD_SPACING / 2), y: roadY + (vertical ? ROAD_SPACING / 2 : 0) });
      const road = compileRoad(`grid:${roadX}:${roadY}`, inCityTerrain(roadX, roadY) ? drapeCityRoad([a, b], Infinity) : [a, b], ROAD_HALF);
      for (let i = 1; i < road.sections.length; i += 1) {
        surfaces.push(roadStripQuad(road.sections[i - 1], road.sections[i], -ROAD_HALF, ROAD_HALF, 0.64, ROAD, MAT_ROAD));
        surfaces.push(roadStripQuad(road.sections[i - 1], road.sections[i], -0.14, 0.14, 0.7, YELLOW, MAT_ROUTE));
      }
      return;
    }
    boxes.push({
      x: roadX,
      y: roadY,
      z: 0.02,
      sx: vertical ? ROAD_HALF * 2 : ROAD_SPACING,
      sy: vertical ? ROAD_SPACING : ROAD_HALF * 2,
      sz: 0.12,
      yaw: 0,
      color: ROAD,
      material: MAT_ROAD,
    });
    boxes.push({
      x: roadX,
      y: roadY,
      z: 0.13,
      sx: vertical ? 0.28 : 18,
      sy: vertical ? 18 : 0.28,
      sz: 0.07,
      yaw: 0,
      color: YELLOW,
      material: MAT_ROUTE,
    });
    if (region.theme === "residential") {
      const ends = [-1, 1].map((side) => {
        const point = { x: roadX + (vertical ? 0 : side * 18), y: roadY + (vertical ? side * 18 : 0) };
        const junction = cedarStreetIndex().query(point, 0.1).some((road) =>
          Math.abs(Math.sin(road.heading - (vertical ? Math.PI / 2 : 0))) > 0.2);
        const offset = side * (junction ? 8.5 : 18);
        return { x: roadX + (vertical ? 0 : offset), y: roadY + (vertical ? offset : 0) };
      });
      const road = compileRoad("cedar-sidewalk", ends, ROAD_HALF);
      for (const side of [-1, 1]) surfaces.push(roadStripQuad(road.sections[0], road.sections[1],
        side < 0 ? -9.5 : 6.2, side < 0 ? -6.2 : 9.5, 0.12, VALE_CREAM, MAT_SIDEWALK));
    }
  };

  for (let localX = 0; localX < BLOCKS_PER_CHUNK; localX += 1) {
    for (let localY = 0; localY < BLOCKS_PER_CHUNK; localY += 1) {
      const blockX = cx * BLOCKS_PER_CHUNK - 2 + localX;
      const blockY = cy * BLOCKS_PER_CHUNK - 2 + localY;
      const left = blockX * ROAD_SPACING;
      const bottom = blockY * ROAD_SPACING;
      const centerX = left + ROAD_SPACING / 2;
      const centerY = bottom + ROAD_SPACING / 2;
      const district = districtForBlock(blockX, blockY);
      const lot = lotForBlock(blockX, blockY, district);
      const random = blockRandom(blockX, blockY, 0x1a90);

      const verticalStreet = gridStreetSegmentEnabled(
        { x: left, y: bottom },
        { x: left, y: bottom + ROAD_SPACING },
      );
      const horizontalStreet = gridStreetSegmentEnabled(
        { x: left, y: bottom },
        { x: left + ROAD_SPACING, y: bottom },
      );

      // The legacy center owns the shared x=792 seam. Cedar Vale starts its
      // horizontal pavement there without drawing a second vertical strip.
      if (
        verticalStreet
        && !(cx === CHUNK_MAX + 1 && localX === 0)
      ) addRoadSegment(left, centerY, true);
      if (
        horizontalStreet
        && !(cy === CHUNK_MAX + 1 && localY === 0)
      ) addRoadSegment(centerX, bottom, false);

      const corridorBlock = lot !== "landmark" && district !== "residential"
        && !mountainAnchorForBlock(blockX, blockY)
        && !desertAnchorForBlock(blockX, blockY)
        && !wetlandAnchorForBlock(blockX, blockY)
        && !coastalAnchorForBlock(blockX, blockY)
        && !(district === "coastal" && blockX < -56)
        && specialRoadIntersectsSquare(
        { x: centerX, y: centerY },
        12,
        1.5,
      );
      const blockCtx = { boxes, surfaces, colliders, surfaceRegions, centerX, centerY, blockX, blockY, random };
      if (region.id === "city-center" && !corridorBlock && lot !== "landmark") addCityPaving(blockCtx);
      const terrainBoxStart = boxes.length, terrainColliderStart = colliders.length;
      const terrainFaceStart = surfaces.length;
      const terrainInteractionStart = interactions.length;
      if (corridorBlock) {
        if (region.id === "city-center") buildCityVerge(blockCtx);
        else if (district === "wetland") buildReachVerge({ boxes, surfaces, colliders, surfaceRegions, centerX, centerY, blockX, blockY, random },
          (x, y) => !isRoadSurface({ x, y }, 5));
        else addCorridorVerge({ boxes, surfaces, colliders, surfaceRegions, centerX, centerY, blockX, blockY, random }, district);
      } else if (district === "mountain" || district === "desert" || district === "wetland" || district === "coastal" || district === "residential") {
        buildLot({ boxes, surfaces, colliders, surfaceRegions, centerX, centerY, blockX, blockY, random }, district, lot);
        addLotInteractions(interactions, blockX, blockY, centerX, centerY, lot);
      } else {
        buildLot({ boxes, surfaces, colliders, surfaceRegions, centerX, centerY, blockX, blockY, random }, district, lot);
        addLotInteractions(interactions, blockX, blockY, centerX, centerY, lot);
        if (lot !== "landmark" && !campusTileForBlock(blockX, blockY)) {
          streetCommerceBlocks.push({ blockX, blockY, centerX, centerY, district, lot });
        }
      }
      if (region.id === "city-center" || district === "mountain" || district === "desert" || (district === "coastal" && blockX >= -56)) {
        const floor = region.id === "city-center"
          ? regionalSettlementPlan(blockX, blockY)?.floor ?? terrainHeightAt(centerX, centerY)
          : mountainAnchorForBlock(blockX, blockY) || desertAnchorForBlock(blockX, blockY) || coastalAnchorForBlock(blockX, blockY)
            ? atRoadElevation({ x: centerX, y: centerY, z: 0 }).z : terrainHeightAt(centerX, centerY);
        for (let i = terrainBoxStart; i < boxes.length; i += 1) {
          const box = boxes[i];
          const height = box.groundAnchor ? terrainHeightAt(box.groundAnchor.x, box.groundAnchor.y)
            : box.material === MAT_FOLIAGE ? terrainHeightAt(box.x, box.y) : floor;
          box.z += height;
          box.screenLift = height;
        }
        for (let i = terrainFaceStart; i < surfaces.length; i += 1) {
          const face = surfaces[i];
          const height = face.groundAnchor ? terrainHeightAt(face.groundAnchor.x, face.groundAnchor.y) : floor;
          face.corners = face.corners.map((point) => ({ ...point, z: point.z + height })) as unknown as MeshFace["corners"];
        }
        for (let i = terrainColliderStart; i < colliders.length; i += 1) {
          const collider = colliders[i];
          collider.baseZ = (region.id === "city-center" || district === "desert" || district === "coastal" ? collider.baseZ ?? 0 : 0)
            + (collider.groundAnchor ? terrainHeightAt(collider.groundAnchor.x, collider.groundAnchor.y) : floor);
          if (collider.id.startsWith("mirror-water")) { collider.baseZ = (collider.baseZ ?? 0) - 4; collider.height += 5; }
        }
        for (let i = terrainInteractionStart; i < interactions.length; i += 1) interactions[i].z = region.id === "city-center"
          ? terrainHeightAt(interactions[i].x, interactions[i].y) : floor;
        if (region.id === "city-center") groundCityFoundations(boxes.slice(terrainBoxStart), colliders.slice(terrainColliderStart), floor);
      } else if (district === "coastal") {
        for (let i = terrainInteractionStart; i < interactions.length; i += 1) {
          const interaction = interactions[i];
          interaction.z = onCoastPier(interaction.x, interaction.y) ? COAST_PIER.deckHeight : terrainHeightAt(interaction.x, interaction.y);
        }
      }
    }
  }

  if (cx === CHUNK_MAX || cx === WORLD_CHUNK_MAX_X) {
    for (let localY = 0; localY < BLOCKS_PER_CHUNK; localY += 1) {
      const roadX = cx === CHUNK_MAX ? CHUNK_MAX * CHUNK_SIZE + CHUNK_SIZE / 2 : WORLD_ROAD_MAX_X;
      const segmentY = originY + localY * ROAD_SPACING;
      if (gridStreetSegmentEnabled(
        { x: roadX, y: segmentY },
        { x: roadX, y: segmentY + ROAD_SPACING },
      )) addRoadSegment(roadX, segmentY + ROAD_SPACING / 2, true);
    }
  }
  if (cy === CHUNK_MAX || cy === WORLD_CHUNK_MAX_Y) {
    for (let localX = 0; localX < BLOCKS_PER_CHUNK; localX += 1) {
      const segmentX = originX + localX * ROAD_SPACING;
      const roadY = cy === CHUNK_MAX ? CHUNK_MAX * CHUNK_SIZE + CHUNK_SIZE / 2 : WORLD_ROAD_MAX_Y;
      if (gridStreetSegmentEnabled(
        { x: segmentX, y: roadY },
        { x: segmentX + ROAD_SPACING, y: roadY },
      )) addRoadSegment(segmentX + ROAD_SPACING / 2, roadY, false);
    }
  }

  addSpecialRoadGeometry(boxes, surfaces, colliders, cx, cy);
  if (region.id === "cedar-vale") for (const court of CEDAR_COURTS) {
    const owner = specialRoadOwner(court.center, court.center);
    if (owner.cx !== cx || owner.cy !== cy) continue;
    const ctx: LotContext = { boxes, surfaces, colliders, surfaceRegions, centerX: court.center.x, centerY: court.center.y,
      blockX: Math.floor(court.center.x / 36), blockY: Math.floor(court.center.y / 36), random: blockRandom(cx, cy, 0xc0a7) };
    cedarRoundVolume(ctx, court.center.x, court.center.y, [{ z: 0.04, radius: 1.7 }, { z: 0.22, radius: 1.7 }], VALE_GROUND, MAT_GRASS, 12);
    cedarTree(ctx, court.id, court.center.x, court.center.y, 0.8);
  }
  if (region.id === "northstar-range") addMountainScenery({ boxes, surfaces, colliders, surfaceRegions }, cx, cy);
  if (region.id === "copper-mesa") addCopperScenery({ boxes, surfaces, colliders, surfaceRegions }, cx, cy);
  if (region.id === "solana-coast") addCoastScenery({ boxes, surfaces, colliders, surfaceRegions }, cx, cy);
  addStreetCommerceForChunk({ boxes, colliders, surfaceRegions }, interactions, streetCommerceBlocks);

  if (boxes.length > MAX_CHUNK_BOXES) throw new Error(`City chunk ${cx},${cy} exceeded ${MAX_CHUNK_BOXES} instances`);
  if (colliders.length > MAX_CHUNK_COLLIDERS) throw new Error(`City chunk ${cx},${cy} exceeded ${MAX_CHUNK_COLLIDERS} colliders`);
  if (interactions.length > MAX_CHUNK_INTERACTIONS) throw new Error(`City chunk ${cx},${cy} exceeded ${MAX_CHUNK_INTERACTIONS} interactions`);

  if (surfaces.length > MAX_CHUNK_SURFACE_QUADS) throw new Error(`City chunk ${cx},${cy} has ${surfaces.length} surface faces, exceeding ${MAX_CHUNK_SURFACE_QUADS}`);
  return { key: `${cx},${cy}`, cx, cy, boxes, surfaces, colliders, surfaceRegions, interactions };
}

export class CityStream {
  private cache = new Map<string, CityChunk>();
  private current: WorldView = { key: "", boxes: [], colliders: [], chunks: [], interactions: [] };

  update(x: number, y: number, requestedRadius = COLLISION_STREAM_RADIUS) {
    const unclampedCenterX = Math.floor((x + CHUNK_SIZE / 2) / CHUNK_SIZE);
    const unclampedCenterY = Math.floor((y + CHUNK_SIZE / 2) / CHUNK_SIZE);
    const { cx: centerX, cy: centerY } = nearestActiveChunk(unclampedCenterX, unclampedCenterY);
    const streamRadius = clamp(Math.round(requestedRadius), COLLISION_STREAM_RADIUS, DISTANT_STREAM_RADIUS);
    const coords: Array<[number, number]> = [];
    for (let dx = -streamRadius; dx <= streamRadius; dx += 1) {
      for (let dy = -streamRadius; dy <= streamRadius; dy += 1) {
        const cx = centerX + dx;
        const cy = centerY + dy;
        if (isActiveChunk(cx, cy)) coords.push([cx, cy]);
      }
    }
    const key = `${centerX},${centerY},${streamRadius}|${coords.map(([cx, cy]) => `${cx},${cy}`).join("|")}`;
    if (key === this.current.key) return this.current;

    const chunks = coords.map(([cx, cy]) => {
      const chunkKey = `${cx},${cy}`;
      let chunk = this.cache.get(chunkKey);
      if (!chunk) {
        chunk = generateCityChunk(cx, cy);
        this.cache.set(chunkKey, chunk);
      }
      return chunk;
    });

    for (const [chunkKey, chunk] of this.cache) {
      if (Math.abs(chunk.cx - centerX) > CACHE_RADIUS || Math.abs(chunk.cy - centerY) > CACHE_RADIUS) this.cache.delete(chunkKey);
    }

    const streamBoxes = chunks.flatMap((chunk) => chunk.boxes);
    const streamColliders = chunks
      .filter((chunk) => Math.abs(chunk.cx - centerX) <= COLLISION_STREAM_RADIUS && Math.abs(chunk.cy - centerY) <= COLLISION_STREAM_RADIUS)
      .flatMap((chunk) => chunk.colliders);
    if (streamBoxes.length > MAX_STREAM_BOXES) throw new Error(`Streamed city exceeded ${MAX_STREAM_BOXES} instances`);
    if (streamColliders.length > MAX_STREAM_COLLIDERS) throw new Error(`Streamed city exceeded ${MAX_STREAM_COLLIDERS} colliders`);
    const streamInteractions = chunks.flatMap((chunk) => chunk.interactions);
    if (streamInteractions.length > MAX_STREAM_INTERACTIONS) throw new Error(`Streamed city exceeded ${MAX_STREAM_INTERACTIONS} interactions`);
    const surfaces = chunks.flatMap((chunk) => chunk.surfaces ?? []);
    const landscapeSurfaces = Math.abs(centerX) <= 5 && Math.abs(centerY) <= 5 ? cityLandscape(chunks, generateCityChunk)
      : centerX >= 6 && centerY >= 6 ? reachLandscape(chunks)
      : centerX <= -6 && centerY >= -5 && centerY <= 5 ? coastLandscape(chunks)
      : centerX >= -5 && centerX <= 5
        ? centerY <= -5 ? northstarLandscape(chunks) : centerY >= 5 ? copperLandscape(chunks) : [] : [];
    if (surfaces.length + landscapeSurfaces.length > MAX_STREAM_SURFACE_QUADS) throw new Error(`Streamed surface budget exceeded at ${centerX},${centerY}: ${surfaces.length} near + ${landscapeSurfaces.length} distant`);
    this.current = {
      surfaces,
      ...(landscapeSurfaces.length ? { landscapeSurfaces } : {}),
      key,
      chunks,
      boxes: streamBoxes,
      colliders: streamColliders,
      interactions: streamInteractions,
    };
    return this.current;
  }
}


export function districtName(x: number, y: number) {
  return regionalPlaceName(x, y) ?? DISTRICT_LABELS[districtForPosition(x, y)];
}
