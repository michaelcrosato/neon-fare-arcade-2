import assert from "node:assert/strict";
import test from "node:test";
import { makeGame } from "../../game/state";
import { damageSpeedLimit, makeVehicleDamage, recordVehicleContacts, stepRepairLot, vehicleRepairQuote, repairVehicle, declineVehicleRepair } from "../../game/vehicle-damage";
import { makeTestWorld } from "./support/fixtures";
import type { Game } from "../../game/model";
import { TEST_IDLE_INPUT } from "./support/fixtures";
import { stepGame } from "../../game/simulation";
import { FIXED_DT, SPEED_KMH_PER_WORLD_UNIT } from "../../game/config";
import { groundAt } from "../../game/vehicle-road-contact";
import { ACTIVE_WORLD_REGIONS } from "../../game/regions";
import { generateCityChunk } from "../../game/world";
import { taxiHitsBuilding } from "../../game/collision";

function damaged() {
  const game = makeGame("street-ace", 41, "free-run");
  game.damage = makeVehicleDamage(); game.fare = 100; game.x = 20; game.y = 20; game.z = 0;
  game.vx = 0; game.vy = 0; game.roadMotion.grounded = true;
  recordVehicleContacts(game, ["wall:1"]);
  return game;
}
const stationWorld = makeTestWorld({ interactions: [{ kind: "venue-entrance", id: "test-gas", x: 20, y: 20, z: 0,
  heading: 0, radius: 2.35, label: "TEST GAS", venue: { id: "test-gas", kind: "gas", label: "TEST GAS" },
  serviceLot: { x: 20, y: 20, halfX: 10, halfY: 10 } }] });
function stop(game: Game) { for (let i = 0; i < 8; i++) stepRepairLot(game, stationWorld, .1); }

test("real low-speed impacts stack for both driving models; a resting contact cannot charge repeatedly", () => {
  const wall = makeTestWorld({ colliders: [{ id: "wall", x: 5, y: 0, halfX: 5, halfY: 30, height: 8 }] });
  for (const model of ["arcade", "simulation"] as const) {
    const game = makeGame("street-ace", 41, "free-run", model);
    game.traffic = [];
    for (let hit = 1; hit <= 3; hit++) {
      game.x = -2.25; game.y = 0; game.heading = 0; game.vx = 2; game.vy = 0;
      game.z = groundAt(game, .85).height; game.elapsed += .5;
      const events = stepGame(game, TEST_IDLE_INPUT, FIXED_DT, wall, () => 1);
      assert.equal(game.damage.lossKmh, hit);
      assert.equal(vehicleRepairQuote(game).impactId, hit, "each new impact has a stable presentation identity");
      assert.equal(events.filter(e => e.type === "vehicle-damaged").length, 1);
      const loss = game.damage.lossKmh;
      for (let i = 0; i < 60; i++) stepGame(game, TEST_IDLE_INPUT, FIXED_DT, wall, () => 1);
      assert.equal(game.damage.lossKmh, loss);
      assert.equal(vehicleRepairQuote(game).impactId, hit, "resting contact must not reposition the damage quip");
    }
  }
});

test("maximum damage still lets each car drive to a station in every transmission and driving model", () => {
  for (const model of ["arcade", "simulation"] as const) for (const vehicle of ["crown-cab", "accord-v6"] as const) for (const transmission of ["automatic", "manual"] as const) {
    const game = makeGame("street-ace", 41, "free-run", model, vehicle, transmission);
    game.traffic = []; game.damage.lossKmh = 1000;
    for (let i = 0; i < 480; i++) {
      // Keep the test on a flat road while exercising the real throttle and governor.
      game.x = 0; game.y = 0; game.z = 0; game.heading = 0;
      stepGame(game, { ...TEST_IDLE_INPUT, up: true }, FIXED_DT, makeTestWorld(), () => 1);
    }
    const kmh = game.speed * SPEED_KMH_PER_WORLD_UNIT;
    assert.ok(kmh > 8 && kmh <= 10.01, `${model}/${vehicle}/${transmission}: ${kmh} km/h`);
  }
});

test("each separate contact costs one km/h, sustained scraping cannot repeat it, and every speed ceiling stops at ten", () => {
  const game = damaged();
  for (let i = 0; i < 120; i++) { game.elapsed += 1 / 60; recordVehicleContacts(game, ["wall:1"]); }
  assert.equal(game.damage.lossKmh, 1);
  recordVehicleContacts(game, ["wall:1", "traffic:2"]);
  assert.equal(game.damage.lossKmh, 2);
  game.elapsed += .5; recordVehicleContacts(game, []);
  recordVehicleContacts(game, ["wall:1"]);
  assert.equal(game.damage.lossKmh, 3);
  assert.equal(damageSpeedLimit(game, 165), 162);
  for (let i = 0; i < 500; i++) recordVehicleContacts(game, [`wall:${i + 20}`]);
  assert.equal(damageSpeedLimit(game, 165), 10);
  assert.equal(damageSpeedLimit(game, 320), 10);
  assert.equal(damageSpeedLimit(game, 21.7), 10);
});

test("stopping on the gas lot offers paid repairs; declining requires leaving and re-entering", () => {
  const game = damaged();
  game.vx = 4; stop(game);
  assert.equal(vehicleRepairQuote(game).showOffer, false);
  game.vx = 0; stop(game);
  assert.equal(vehicleRepairQuote(game).showOffer, true);
  assert.equal(vehicleRepairQuote(game).cost, 10);
  declineVehicleRepair(game); stop(game);
  assert.equal(vehicleRepairQuote(game).showOffer, false);
  game.vx = 2; stop(game); game.vx = 0; stop(game);
  assert.equal(vehicleRepairQuote(game).showOffer, false, "moving around the same lot does not re-offer");
  game.x = 31; stepRepairLot(game, stationWorld, .1);
  game.x = 20; stop(game);
  assert.equal(vehicleRepairQuote(game).showOffer, true);
  assert.equal(repairVehicle(game).status, "repaired");
  assert.equal(game.fare, 90); assert.equal(game.damage.lossKmh, 0);
  assert.equal(repairVehicle(game).status, "undamaged");
  assert.equal(game.fare, 90);
});

test("repair transactions reject insufficient funds, motion, an adjacent road and a different elevation", () => {
  const game = damaged(); stop(game);
  game.fare = 9;
  assert.equal(repairVehicle(game).status, "insufficient");
  assert.equal(game.damage.lossKmh, 1); assert.equal(game.fare, 9);
  game.fare = 100; game.vx = 3;
  assert.equal(repairVehicle(game).status, "moving");
  game.vx = 0; game.x = 31;
  assert.equal(repairVehicle(game).status, "not-at-station");
  game.x = 20; game.z = 12;
  assert.equal(repairVehicle(game).status, "not-at-station");
});

test("the same repair service is available inside the matching station with the cab parked on its lot", () => {
  const game = damaged(); stop(game); declineVehicleRepair(game);
  game.player = { kind: "walking", actor: { x: 0, y: 0, z: 0, heading: 0, vx: 0, vy: 0, speed: 0 },
    location: { kind: "interior", venue: { id: "test-gas", label: "TEST GAS", kind: "gas" }, returnPose: { x: 20, y: 20, heading: 0 } } };
  stepRepairLot(game, makeTestWorld(), .1);
  assert.equal(vehicleRepairQuote(game).eligible, true);
  assert.equal(repairVehicle(game).status, "repaired");
});

test("generated gas stations expose usable repair lots in every region that has gas venues", () => {
  for (const region of ACTIVE_WORLD_REGIONS) {
    let verified = false;
    search: for (let cy = region.chunkMinY; cy <= region.chunkMaxY; cy++) for (let cx = region.chunkMinX; cx <= region.chunkMaxX; cx++) {
      const chunk = generateCityChunk(cx, cy);
      const world = makeTestWorld({ colliders: chunk.colliders, interactions: chunk.interactions });
      for (const station of chunk.interactions) {
        if (station.kind !== "venue-entrance" || station.venue.kind !== "gas") continue;
        assert.ok(station.serviceLot, `${region.id}: ${station.id}`);
        const lot = station.serviceLot, game = damaged();
        forecourt: for (const x of [-.8, -.5, 0, .5, .8]) for (const y of [-.8, -.5, 0, .5, .8]) {
          game.x = lot.x + lot.halfX * x; game.y = lot.y + lot.halfY * y;
          game.z = groundAt(game, .85).height;
          if (taxiHitsBuilding(world, game.x, game.y, game.heading, game.z)) continue;
          stepRepairLot(game, world, .8);
          if (vehicleRepairQuote(game).showOffer) { verified = true; break forecourt; }
        }
        assert.ok(verified, `a clear forecourt point accepts repairs at ${station.id}`);
        game.x = lot.x + lot.halfX + 3;
        stepRepairLot(game, world, .8);
        assert.equal(vehicleRepairQuote(game).showOffer, false, "the neighboring street is outside the service lot");
        break search;
      }
    }
    // Cedar Vale is a residential region without gas venues in the existing map.
    assert.equal(verified, region.id !== "cedar-vale", `gas repair coverage in ${region.id}`);
  }
});
