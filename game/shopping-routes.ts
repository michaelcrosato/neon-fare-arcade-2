import { CITY_STORES, type StoreId } from "./brands";
import { generateCityChunk } from "./world";

export function storeEntrance(id: StoreId) {
  const store = CITY_STORES.find(store => store.id === id)!;
  return generateCityChunk(Math.floor(store.blockX / 4), Math.floor(store.blockY / 4)).interactions
    .find(entry => entry.id === `venue:${store.blockX}:${store.blockY}:center` && entry.kind === "venue-entrance")!;
}

export function homeEntrance() {
  return generateCityChunk(0, 0).interactions.find(entry => entry.id === "venue:0:0:home")!;
}
/** A dependable city fuel stop, resolved from the same authored portals as the world. */
export function cityFuelEntrance() {
  for (const [x, y] of [[0, 0], [-1, 0], [0, -1], [1, 0], [0, 1]]) {
    const entry = generateCityChunk(x, y).interactions.find(entry => entry.venue.kind === "gas");
    if (entry) return entry;
  }
  throw new Error("City fuel stop is missing");
}
