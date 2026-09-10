import { ROAD_SPACING } from "./config";
import type { VenueKind, Vec2 } from "./model";

export type LandmarkStyle =
  | "marina-arcade"
  | "apex-hotel"
  | "south-terminal"
  | "rooftop-radio"
  | "ink-market"
  | "redline-pier"
  | "pulse-stadium"
  | "skyport-airport"
  | "nova-megamall"
  | "neon-titan"
  | "deep-blue-aquarium"
  | "neon-general"
  | "apex-university"
  | "volt-expo"
  | "starfall-observatory"
  | "lucky-88-casino";

export type LandmarkPortal = {
  tileX: number;
  tileY: number;
  suffix: string;
  kind: VenueKind;
  /** Local coordinates relative to the portal tile's center, before rotation. */
  x: number;
  y: number;
  heading?: number;
};

export type LandmarkDefinition = {
  id: string;
  label: string;
  style: LandmarkStyle;
  originX: number;
  originY: number;
  width: number;
  height: number;
  orientation: 0 | 1 | 2 | 3;
  featured: boolean;
  portal: LandmarkPortal;
};

export type LandmarkTile = {
  definition: LandmarkDefinition;
  tileX: number;
  tileY: number;
};

/**
 * Authored macro lots. The original six one-block destinations remain stable
 * for courier/venue compatibility; the ten featured complexes deliberately
 * claim adjacent city lots as continuous campuses with perimeter access.
 */
export const CITY_LANDMARKS: readonly LandmarkDefinition[] = [
  {
    id: "marina-arcade",
    label: "MARINA ARCADE",
    style: "marina-arcade",
    originX: -2,
    originY: 3,
    width: 1,
    height: 1,
    orientation: 2,
    featured: false,
    portal: { tileX: 0, tileY: 0, suffix: "landmark", kind: "arcade", x: 0, y: 3.05 },
  },
  {
    id: "apex-hotel",
    label: "APEX HOTEL",
    style: "apex-hotel",
    originX: 5,
    originY: 2,
    width: 1,
    height: 1,
    orientation: 2,
    featured: false,
    portal: { tileX: 0, tileY: 0, suffix: "landmark", kind: "hotel", x: 1.5, y: -5.55 },
  },
  {
    id: "south-terminal",
    label: "SOUTH TERMINAL",
    style: "south-terminal",
    originX: 8,
    originY: -5,
    width: 1,
    height: 1,
    orientation: 2,
    featured: false,
    portal: { tileX: 0, tileY: 0, suffix: "landmark", kind: "terminal", x: 3.5, y: 2 },
  },
  {
    id: "rooftop-radio",
    label: "ROOFTOP RADIO",
    style: "rooftop-radio",
    originX: -6,
    originY: -8,
    width: 1,
    height: 1,
    orientation: 0,
    featured: false,
    portal: { tileX: 0, tileY: 0, suffix: "landmark", kind: "studio", x: -5.4, y: -7.85 },
  },
  {
    id: "ink-market",
    label: "INK MARKET",
    style: "ink-market",
    originX: -12,
    originY: 5,
    width: 1,
    height: 1,
    orientation: 2,
    featured: false,
    portal: { tileX: 0, tileY: 0, suffix: "landmark", kind: "market", x: 0, y: 3.05 },
  },
  {
    id: "redline-pier",
    label: "REDLINE PIER",
    style: "redline-pier",
    originX: 10,
    originY: 11,
    width: 1,
    height: 1,
    orientation: 2,
    featured: false,
    portal: { tileX: 0, tileY: 0, suffix: "landmark", kind: "marina", x: 7.3, y: -8.15 },
  },
  {
    id: "pulse-stadium",
    label: "PULSE STADIUM",
    style: "pulse-stadium",
    originX: -15,
    originY: 0,
    width: 3,
    height: 2,
    orientation: 0,
    featured: true,
    portal: { tileX: 1, tileY: 0, suffix: "main-gate", kind: "civic", x: 0, y: -9.2 },
  },
  {
    id: "skyport-airport",
    label: "SKYPORT INTERNATIONAL",
    style: "skyport-airport",
    originX: 14,
    originY: -16,
    width: 3,
    height: 2,
    orientation: 0,
    featured: true,
    portal: { tileX: 0, tileY: 0, suffix: "terminal", kind: "terminal", x: 0, y: -9.15 },
  },
  {
    id: "nova-megamall",
    label: "NOVA MEGAMALL",
    style: "nova-megamall",
    originX: 13,
    originY: 3,
    width: 2,
    height: 2,
    orientation: 0,
    featured: true,
    portal: { tileX: 0, tileY: 0, suffix: "grand-entry", kind: "market", x: 0, y: -9.2 },
  },
  {
    id: "neon-titan",
    label: "NEON TITAN PLAZA",
    style: "neon-titan",
    originX: -1,
    originY: 7,
    width: 1,
    height: 2,
    orientation: 0,
    featured: true,
    portal: { tileX: 0, tileY: 0, suffix: "visitor-kiosk", kind: "kiosk", x: 7.6, y: -1.2 },
  },
  {
    id: "deep-blue-aquarium",
    label: "DEEP BLUE AQUARIUM",
    style: "deep-blue-aquarium",
    originX: 14,
    originY: 14,
    width: 2,
    height: 2,
    orientation: 0,
    featured: true,
    portal: { tileX: 0, tileY: 0, suffix: "ocean-hall", kind: "marina", x: 0, y: -9.15 },
  },
  {
    id: "neon-general",
    label: "NEON GENERAL HOSPITAL",
    style: "neon-general",
    originX: -9,
    originY: -1,
    width: 2,
    height: 2,
    orientation: 0,
    featured: true,
    portal: { tileX: 0, tileY: 0, suffix: "main-lobby", kind: "civic", x: 0, y: -9.1 },
  },
  {
    id: "apex-university",
    label: "APEX UNIVERSITY",
    style: "apex-university",
    originX: -15,
    originY: -15,
    width: 2,
    height: 2,
    orientation: 0,
    featured: true,
    portal: { tileX: 0, tileY: 0, suffix: "admissions", kind: "office", x: 0, y: -9.1 },
  },
  {
    id: "volt-expo",
    label: "VOLT EXPO CENTER",
    style: "volt-expo",
    originX: -4,
    originY: -15,
    width: 3,
    height: 1,
    orientation: 0,
    featured: true,
    portal: { tileX: 0, tileY: 0, suffix: "hall-a", kind: "civic", x: 0, y: -9.15 },
  },
  {
    id: "starfall-observatory",
    label: "STARFALL OBSERVATORY",
    style: "starfall-observatory",
    originX: -2,
    originY: -18,
    width: 2,
    height: 1,
    orientation: 0,
    featured: true,
    portal: { tileX: 0, tileY: 0, suffix: "visitor-center", kind: "studio", x: 0, y: -9.15 },
  },
  {
    id: "lucky-88-casino",
    label: "LUCKY 88 CASINO",
    style: "lucky-88-casino",
    originX: 8,
    originY: 16,
    width: 2,
    height: 2,
    orientation: 0,
    featured: true,
    portal: { tileX: 0, tileY: 0, suffix: "casino-floor", kind: "hotel", x: 0, y: -9.15 },
  },
] as const;

export const FEATURED_CITY_LANDMARKS = CITY_LANDMARKS.filter((landmark) => landmark.featured);

export function landmarkTileForBlock(blockX: number, blockY: number): LandmarkTile | null {
  for (const definition of CITY_LANDMARKS) {
    const tileX = blockX - definition.originX;
    const tileY = blockY - definition.originY;
    if (tileX >= 0 && tileX < definition.width && tileY >= 0 && tileY < definition.height) {
      return { definition, tileX, tileY };
    }
  }
  return null;
}

export function landmarkWorldCenter(landmark: LandmarkDefinition): Vec2 {
  return {
    x: (landmark.originX + landmark.width / 2) * ROAD_SPACING,
    y: (landmark.originY + landmark.height / 2) * ROAD_SPACING,
  };
}

export function landmarkBlocks(landmark: LandmarkDefinition) {
  const blocks: Array<{ blockX: number; blockY: number }> = [];
  for (let tileX = 0; tileX < landmark.width; tileX += 1) {
    for (let tileY = 0; tileY < landmark.height; tileY += 1) {
      blocks.push({
        blockX: landmark.originX + tileX,
        blockY: landmark.originY + tileY,
      });
    }
  }
  return blocks;
}

/** Every multi-block institution owns continuous grounds inside its public perimeter. */
export function landmarkInterruptsGrid(landmark: LandmarkDefinition) {
  return landmark.width > 1 || landmark.height > 1;
}
