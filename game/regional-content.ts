import { COPPER_MESA_ANCHORS } from "./desert";
import { NORTHSTAR_RANGE_ANCHORS } from "./mountain";
import type { RegionalWorldRegionId, RegionalWorldTheme } from "./region-types";
import { CEDAR_VALE_ANCHORS } from "./residential";
import { CYPRESS_REACH_ANCHORS } from "./wetland";
import { SOLANA_COAST_ANCHORS } from "./coastal";
import { IRONWAKE_ANCHORS } from "./industrial-layout";

export type RegionalAnchorSummary = {
  id: string;
  label: string;
  originX: number;
  originY: number;
  width: number;
  height: number;
};

export type RegionalContentEntry = {
  id: RegionalWorldRegionId;
  theme: RegionalWorldTheme;
  anchors: readonly RegionalAnchorSummary[];
  mapLabelPolicy: "far-east" | "positive-x" | "always-west";
  campusPolicy: "bellwether-only" | "multi-tile";
};

/** Shared regional metadata consumed by map and campus integration layers. */
export const REGIONAL_CONTENT_BY_ID = {
  "cedar-vale": {
    id: "cedar-vale",
    theme: "residential",
    anchors: CEDAR_VALE_ANCHORS,
    mapLabelPolicy: "far-east",
    campusPolicy: "multi-tile",
  },
  "northstar-range": {
    id: "northstar-range",
    theme: "mountain",
    anchors: NORTHSTAR_RANGE_ANCHORS,
    mapLabelPolicy: "positive-x",
    campusPolicy: "multi-tile",
  },
  "copper-mesa": {
    id: "copper-mesa",
    theme: "desert",
    anchors: COPPER_MESA_ANCHORS,
    mapLabelPolicy: "positive-x",
    campusPolicy: "multi-tile",
  },
  "cypress-reach": {
    id: "cypress-reach",
    theme: "wetland",
    anchors: CYPRESS_REACH_ANCHORS,
    mapLabelPolicy: "always-west",
    campusPolicy: "multi-tile",
  },
  "solana-coast": {
    id: "solana-coast",
    theme: "coastal",
    anchors: SOLANA_COAST_ANCHORS,
    mapLabelPolicy: "always-west",
    campusPolicy: "multi-tile",
  },
  "ironwake-works": {
    id: "ironwake-works", theme: "industrial", anchors: IRONWAKE_ANCHORS,
    mapLabelPolicy: "always-west", campusPolicy: "multi-tile",
  },
} as const satisfies Record<RegionalWorldRegionId, RegionalContentEntry>;

export const REGIONAL_CONTENT: readonly RegionalContentEntry[] = Object.values(
  REGIONAL_CONTENT_BY_ID,
);
