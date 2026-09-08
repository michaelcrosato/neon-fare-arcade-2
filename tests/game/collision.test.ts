import assert from "node:assert/strict";
import test from "node:test";

import {
  depenetrateTaxi,
  obbContact,
  obbOverlap,
  taxiHitsBuilding,
} from "../../game/collision";
import { makeTestWorld } from "./support/fixtures";

test("oriented collision boxes separate at the expected boundary", () => {
  const taxi = { x: 0, y: 0, halfLength: 2, halfWidth: 1, heading: 0 };
  assert.equal(obbOverlap(taxi, { ...taxi, x: 3.9 }), true);
  assert.equal(obbOverlap(taxi, { ...taxi, x: 4 }), false);
  assert.equal(obbOverlap(taxi, { ...taxi, x: 4.1 }), false);

  const contact = obbContact(taxi, { ...taxi, x: 3.5 });
  assert.ok(contact);
  assert.equal(contact.normalX, -1);
  assert.ok(Math.abs(contact.normalY) < 1e-9);
  assert.equal(contact.depth, 0.5);
});

test("taxi collision uses the generated building footprint", () => {
  const world = makeTestWorld({
    key: "test",
    colliders: [{ id: "building", x: 0, y: 0, halfX: 3, halfY: 3, height: 5 }],
  });
  assert.equal(Boolean(taxiHitsBuilding(world, 0, 0, 0)), true);
  assert.equal(Boolean(taxiHitsBuilding(world, 10, 10, 0)), false);
});

test("iterative depenetration clears a taxi from a multi-building corner", () => {
  const world = makeTestWorld({
    key: "corner",
    colliders: [
      { id: "vertical", x: 5, y: 0, halfX: 5, halfY: 20, height: 5 },
      { id: "horizontal", x: 0, y: 5, halfX: 20, halfY: 5, height: 5 },
    ],
  });
  const repaired = depenetrateTaxi(world, -1, -1, 0);
  assert.equal(repaired.resolved, true);
  assert.equal(repaired.moved, true);
  assert.equal(Boolean(taxiHitsBuilding(world, repaired.x, repaired.y, 0)), false);
});
