import type { StoreId } from "./brands";

export const FURNISHINGS = [
  { id: "big-screen", name: "BIG NIGHT TV", store: "best-byte", cost: 180, description: "The city is loud. Make movie night louder.", x: -11.9, y: .3 },
  { id: "stereo", name: "AFTERSHIFT STEREO", store: "best-byte", cost: 90, description: "Two speakers. One very patient neighbor.", x: -11.9, y: 4.2 },
  { id: "washer", name: "SPIN CYCLE WASHER", store: "best-byte", cost: 240, description: "Finally wash the shift out of that jacket.", x: 12, y: -3.5 },
  { id: "microwave", name: "MIDNIGHT MICROWAVE", store: "best-byte", cost: 75, description: "Leftovers are a food group now.", x: 7.7, y: -8.5 },
  { id: "fridge", name: "BIG CHILL FRIDGE", store: "cost-go", cost: 260, description: "Cold drinks. Questionable takeout. Room for both.", x: 12, y: -8.8 },
  { id: "coffee-maker", name: "FIRST FARE COFFEE", store: "cost-go", cost: 55, description: "Your most reliable morning passenger.", x: 5.8, y: -8.5 },
  { id: "vacuum", name: "DUST BUSTER-UP", store: "cost-go", cost: 65, description: "Retire the dust bunnies from active duty.", x: 12.5, y: 4.4 },
  { id: "pantry", name: "BULK LIFE PANTRY", store: "cost-go", cost: 85, description: "A proper shelf for your warehouse-sized ambitions.", x: 9.2, y: -11 },
  { id: "floor-lamp", name: "LATE SHIFT LAMP", store: "wow-mart", cost: 35, description: "Warm light for the ride home after the ride home.", x: -7.5, y: 3 },
  { id: "rug", name: "CHECKERED COMFORT RUG", store: "wow-mart", cost: 45, description: "A finish line for your living room.", x: -3.7, y: 2.8 },
  { id: "plant", name: "LOW-MAINTENANCE ROOMMATE", store: "wow-mart", cost: 30, description: "Pays no rent. Improves the place anyway.", x: 11.6, y: 8.8 },
  { id: "dining-set", name: "DINNER FOR TWO", store: "wow-mart", cost: 120, description: "A table and two chairs. The second is for laundry.", x: 6.6, y: 1.7 },
  { id: "sofa", name: "FLOPPA SOFA", store: "i-kit", cost: 160, description: "Three cushions. Zero remaining plans.", x: -3.7, y: 1.9 },
  { id: "bed-frame", name: "SNOOZA BED FRAME", store: "i-kit", cost: 140, description: "Lift your starter mattress off the floor.", x: -9.4, y: -6.7 },
  { id: "bookcase", name: "STACKA BOOKCASE", store: "i-kit", cost: 95, description: "For books, trophies, and things you call collectibles.", x: -4.1, y: -10.9 },
  { id: "side-table", name: "LITL SIDE TABLE", store: "i-kit", cost: 45, description: "A tiny home for the remote you will still lose.", x: -.2, y: 2.4 },
] as const satisfies readonly { id: string; name: string; store: StoreId; cost: number; description: string; x: number; y: number }[];
export type FurnishingId = typeof FURNISHINGS[number]["id"];
export type HomeFurnishings = { owned: FurnishingId[]; placed: FurnishingId[] };
export function emptyFurnishings(): HomeFurnishings { return { owned: [], placed: [] }; }
export function normalizeFurnishings(raw: unknown): HomeFurnishings {
  if (!raw || typeof raw !== "object") return emptyFurnishings();
  const value = raw as Partial<HomeFurnishings>;
  const known = (list: unknown): FurnishingId[] => Array.isArray(list)
    ? [...new Set(list.filter((id): id is FurnishingId => FURNISHINGS.some(item => item.id === id)))] : [];
  const owned = known(value.owned);
  return { owned, placed: known(value.placed).filter(id => owned.includes(id)) };
}
