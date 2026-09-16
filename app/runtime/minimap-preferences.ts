export const MINIMAP_STORAGE_KEY = "neon-fare-minimap-v1";
export const MINIMAP_SIZES = [.75, 1, 1.25, 1.5, 2] as const;
export const MINIMAP_ZOOMS = [.5, .75, 1, 1.5, 2] as const;
export type MinimapPreferences = { size: number; zoom: number };
export const DEFAULT_MINIMAP: MinimapPreferences = { size: 1, zoom: 1 };

export function normalizeMinimapPreferences(raw: unknown): MinimapPreferences {
  const value = raw && typeof raw === "object" ? raw as Partial<MinimapPreferences> : {};
  return { size: MINIMAP_SIZES.find(size => size === value.size) ?? 1,
    zoom: MINIMAP_ZOOMS.find(zoom => zoom === value.zoom) ?? 1 };
}

/** Heading-up map projection: panel dimensions and geographic zoom are independent. */
export function compactMapProjection(zoom: number) {
  const pixelsPerWorldUnit = .58 * zoom;
  return { pixelsPerWorldUnit, radiusWorldUnits: Math.hypot(62, 49) / pixelsPerWorldUnit };
}
