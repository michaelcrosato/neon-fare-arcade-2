/** Stable compass slots in the planned 3 x 3 world. */
export type RegionDirection = "C" | "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

/** Active region identities. Additions must be coordinated through the region registry. */
export type WorldRegionId =
  | "city-center"
  | "cedar-vale"
  | "northstar-range"
  | "copper-mesa"
  | "cypress-reach"
  | "solana-coast"
  | "ironwake-works";

export type WorldTheme = "city" | "residential" | "mountain" | "desert" | "wetland" | "coastal" | "industrial";
export type RegionalWorldRegionId = Exclude<WorldRegionId, "city-center">;
export type RegionalWorldTheme = Exclude<WorldTheme, "city">;
