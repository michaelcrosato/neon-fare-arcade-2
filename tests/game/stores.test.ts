import assert from "node:assert/strict";
import test from "node:test";
import { CITY_STORES, BRANDS } from "../../game/brands";
import { cityFuelEntrance, homeEntrance, storeEntrance } from "../../game/shopping-routes";
import { generateCityChunk } from "../../game/world";
import { interiorWorld, INTERIOR_ENTRY_POSE } from "../../game/interiors";
import { FURNISHINGS } from "../../game/furnishing-catalog";
import { circleHitsBuilding } from "../../game/collision";
import type { WorldView } from "../../game/model";
import { packSurfaceQuads } from "../../game/render/surfaces";
import { brandSign } from "../../game/render/brand-signs";
import { lookAt, mat4Multiply, orthoZO, perspectiveZO } from "../../game/render/camera";
import { projectWorldPoint } from "../../game/render/view-projection";

function reachable(world: WorldView, from: { x: number; y: number }, to: { x: number; y: number }) {
  const queue = [{ x: Math.round(from.x), y: Math.round(from.y) }], seen = new Set<string>();
  for (let i = 0; i < queue.length && i < 2000; i++) {
    const point = queue[i];
    if (Math.hypot(point.x - to.x, point.y - to.y) < 1) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { x: point.x + dx, y: point.y + dy }, key = `${next.x},${next.y}`;
      if (seen.has(key) || Math.abs(next.x) > 14 || Math.abs(next.y) > 11 || circleHitsBuilding(world, next.x, next.y, .44, 0)) continue;
      seen.add(key); queue.push(next);
    }
  }
  return false;
}

test("all four branded stores retain three usable doors and reachable showroom counters", () => {
  for (const store of CITY_STORES) {
    const chunk = generateCityChunk(Math.floor(store.blockX / 4), Math.floor(store.blockY / 4));
    const entries = chunk.interactions.filter(entry => entry.venue.brand === store.id);
    assert.equal(entries.length, 3);
    assert.ok(entries.some(entry => entry.id === storeEntrance(store.id).id));
    const exterior = { ...chunk, key: store.id, chunks: [chunk] };
    for (const entry of entries) {
      assert.equal(entry.label, BRANDS[store.id].name);
      assert.equal(Boolean(circleHitsBuilding(exterior, entry.x, entry.y, .44, entry.z)), false);
    }
    const room = interiorWorld(entries[1].venue);
    assert.ok(room.boxes.length <= 128 && room.colliders.length <= 24 && room.interactions.length <= 6);
    assert.ok((room.surfaces?.length ?? 0) > 20, "store wordmark is real shared geometry");
    for (const action of room.interactions) assert.ok(reachable(room, INTERIOR_ENTRY_POSE, action), `${store.id}: ${action.id}`);
  }
});
test("home and city fuel GPS resolve real entrances; a fully furnished apartment remains traversable", () => {
  const home = homeEntrance(), gas = cityFuelEntrance();
  assert.equal(home.venue.kind, "home"); assert.equal(gas.venue.kind, "gas"); assert.equal(gas.venue.brand, "go-go-gas");
  const room = interiorWorld(home.venue, FURNISHINGS.map(item => item.id));
  for (const action of room.interactions) assert.ok(reachable(room, INTERIOR_ENTRY_POSE, action), action.id);
});

test("brand lettering reads left to right in the game's fixed and perspective projections", () => {
  const world: WorldView = { key: "sign-test", boxes: [], surfaces: [], colliders: [], chunks: [], interactions: [] };
  for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    world.surfaces = []; brandSign(world, "best-byte", 0, 0, 5, 10, heading);
    assert.ok(Array.from(packSurfaceQuads(world.surfaces)).every(Number.isFinite));
    const [left, right] = world.surfaces[0].corners;
    const view = lookAt([Math.cos(heading) * 20, Math.sin(heading) * 20, 8], [0, 0, 5]);
    for (const projection of [orthoZO(15, -15, -10, 10, .1, 100), perspectiveZO(Math.PI / 3, 1.5, .1, 100)]) {
      const matrix = mat4Multiply(projection, view);
      assert.ok(projectWorldPoint(matrix, left.x, left.y, left.z, 900, 600)!.x < projectWorldPoint(matrix, right.x, right.y, right.z, 900, 600)!.x);
    }
  }
});
