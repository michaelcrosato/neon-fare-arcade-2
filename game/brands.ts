import type { Color } from "./model";

export type StoreId = "best-byte" | "cost-go" | "wow-mart" | "i-kit";
export type BrandId = StoreId | "go-go-gas";
export const BRANDS = {
  "best-byte": { name: "BEST BYTE", slogan: "BIG SCREENS. SMALL EXCUSES.", department: "Electronics & appliances", background: "#1256bd", foreground: "#ffe21a", color: [.07, .34, .74, 1], accent: [1, .89, .1, 1], icon: "bolt" },
  "cost-go": { name: "COST-GO", slogan: "A LITTLE MORE OF EVERYTHING.", department: "Warehouse home essentials", background: "#e73232", foreground: "#ffffff", color: [.91, .2, .2, 1], accent: [1, 1, 1, 1], icon: "boxes" },
  "wow-mart": { name: "WOW MART", slogan: "EVERYDAY THINGS. EXTRA WOW.", department: "Everyday home & living", background: "#087abf", foreground: "#ffe21a", color: [.03, .48, .75, 1], accent: [1, .89, .1, 1], icon: "spark" },
  "i-kit": { name: "I-KIT", slogan: "SOME ASSEMBLY. ALL PERSONALITY.", department: "Flat-pack furniture", background: "#ffd51d", foreground: "#153b92", color: [1, .84, .11, 1], accent: [.08, .23, .57, 1], icon: "kit" },
  "go-go-gas": { name: "GO-GO GAS", slogan: "FILL UP. FIX UP. GO GO.", department: "Fuel & taxi service", background: "#063e45", foreground: "#ffcf24", color: [.02, .24, .27, 1], accent: [1, .81, .14, 1], icon: "drop" },
} as const satisfies Record<BrandId, { name: string; slogan: string; department: string; background: string; foreground: string; color: Color; accent: Color; icon: string }>;

/** Existing retail parcels, away from landmarks and curved-road reservations. */
export const CITY_STORES = [
  { id: "best-byte", blockX: 5, blockY: -4 },
  { id: "cost-go", blockX: 0, blockY: -8 },
  { id: "wow-mart", blockX: -4, blockY: 8 },
  { id: "i-kit", blockX: -8, blockY: -7 },
] as const satisfies readonly { id: StoreId; blockX: number; blockY: number }[];
export function storeForBlock(x: number, y: number) { return CITY_STORES.find(store => store.blockX === x && store.blockY === y); }
export function isStoreId(id: unknown): id is StoreId { return CITY_STORES.some(store => store.id === id); }
