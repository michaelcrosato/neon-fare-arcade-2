import assert from "node:assert/strict";
import test from "node:test";
import { applyCareerRunBonuses, makeCareerState, normalizeCareerState } from "../../game/career";
import { makeGame } from "../../game/state";
import { placeFurnishing, purchaseFurnishing } from "../../game/furnishings";
import { FURNISHINGS } from "../../game/furnishing-catalog";
import { CITY_STORES } from "../../game/brands";
import { interiorWorld } from "../../game/interiors";

test("new and migrated careers own the apartment; inventory and tanks normalize safely", () => {
  assert.ok(makeCareerState().owned.includes("neon-loft"));
  const saved = normalizeCareerState({ bank: 23, owned: [], furnishings: { owned: ["sofa", "sofa", "bad"], placed: ["sofa", "fridge", "bad"] }, fuelTanks: { "accord-v6": 12, "crown-cab": -5 } });
  assert.equal(saved.bank, 23); assert.deepEqual(saved.owned, ["neon-loft"]);
  assert.deepEqual(saved.furnishings, { owned: ["sofa"], placed: ["sofa"] });
  assert.deepEqual(saved.fuelTanks, { "accord-v6": 12, "crown-cab": 0, "gtr-r35": 73.8 });
  const game = makeGame("street-ace", 931, "free-run", "arcade", "accord-v6");
  applyCareerRunBonuses(game, saved);
  assert.equal(game.fuel.litres, 12); assert.deepEqual(game.homeFurnishings, ["sofa"]);
});

test("each real store sells its own catalog once, delivers to the apartment and persists placement", () => {
  const game = makeGame("street-ace", 932, "free-run");
  let career = { ...makeCareerState(), bank: 10_000 };
  const before = career.bank;
  assert.equal(purchaseFurnishing(game, career, "sofa").status, "wrong-store");
  for (const store of CITY_STORES) {
    game.player = { kind: "walking", actor: { x: 2.4, y: -3.7, vx: 0, vy: 0, speed: 0, heading: 0 }, location: { kind: "interior",
      venue: { id: `venue:${store.blockX}:${store.blockY}:center`, kind: "shop", label: store.id, brand: store.id }, returnPose: { x: 0, y: 0, heading: 0 } } };
    const beforeStock = [...game.homeFurnishings], stock = FURNISHINGS.find(item => item.store === store.id)!;
    assert.equal(purchaseFurnishing(game, { ...career, bank: 0 }, stock.id).status, "insufficient");
    assert.deepEqual(game.homeFurnishings, beforeStock);
    for (const item of FURNISHINGS.filter(item => item.store === store.id)) {
      const result = purchaseFurnishing(game, career, item.id);
      assert.equal(result.status, "purchased"); career = result.state;
      assert.equal(purchaseFurnishing(game, career, item.id).status, "owned");
      assert.ok(game.homeFurnishings.includes(item.id));
    }
  }
  assert.equal(before - career.bank, FURNISHINGS.reduce((sum, item) => sum + item.cost, 0));
  assert.equal(placeFurnishing(game, career, "sofa", false).status, "unavailable");
  assert.equal(game.player.kind, "walking");
  if (game.player.kind !== "walking") throw new Error("Shopping must leave the player on foot");
  game.player.location = { kind: "interior", venue: { id: "venue:0:0:home", kind: "home", label: "NEON LOFTS" }, returnPose: { x: 0, y: 0, heading: 0 } };
  const removed = placeFurnishing(game, career, "sofa", false);
  assert.equal(removed.status, "placed"); assert.ok(!game.homeFurnishings.includes("sofa"));
  assert.ok(removed.state.furnishings.owned.includes("sofa"));
  assert.equal(placeFurnishing(game, removed.state, "sofa", true).status, "placed");
});

test("furnished rooms change their actual scene, retain bounded geometry and clear service paths", () => {
  const venue = { id: "venue:0:0:home", kind: "home" as const, label: "NEON LOFTS" };
  const empty = interiorWorld(venue, []), full = interiorWorld(venue, FURNISHINGS.map(item => item.id));
  assert.notEqual(empty.key, full.key);
  assert.ok(full.boxes.length > empty.boxes.length + 35);
  assert.ok(full.boxes.length <= 128); assert.ok(full.colliders.length <= 24); assert.ok(full.interactions.length <= 6);
  for (const interaction of full.interactions) {
    assert.ok(!full.colliders.some(c => Math.abs(c.x - interaction.x) < c.halfX + .44 && Math.abs(c.y - interaction.y) < c.halfY + .44), interaction.id);
  }
  assert.strictEqual(interiorWorld(venue, FURNISHINGS.map(item => item.id).reverse()), full, "placement order must not duplicate cached rooms");
});
