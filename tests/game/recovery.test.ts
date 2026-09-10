import assert from "node:assert/strict";
import test from "node:test";
import { makeGame } from "../../game/state";
import { recoverToRoad } from "../../game/recovery";
import { CityStream } from "../../game/world";
import { isRoadSurface } from "../../game/road-network";
import { taxiNearBuilding } from "../../game/collision";
import { groundAt } from "../../game/vehicle-road-contact";
import { isPlayablePoint } from "../../game/regions";
import { stepGame } from "../../game/simulation";
import { makeWalkingActor } from "../../game/player";
import { makeHud } from "../../game/hud";
import { NavigationController } from "../../game/navigation";
import { towTruckBoxes } from "../../game/render/tow-truck";
import { ACTOR_INSTANCE_CAPACITY } from "../../game/render/packing";
import { dynamicBoxes } from "../../game/render/scene";
import { SPECIAL_ROADS } from "../../game/road-layout";

const idle = { up: false, down: false, left: false, right: false, boost: false };

test("roundabout recovery follows one-way circulation even when the stranded cab faces backwards", () => {
  for (const road of SPECIAL_ROADS.filter(road => road.oneWay)) {
    const a = road.points[2], b = road.points[3], heading = Math.atan2(b.y - a.y, b.x - a.x);
    const game = makeGame("street-ace", 616, "free-run"); game.traffic = [];
    Object.assign(game, { x: (a.x + b.x) / 2 + Math.sin(heading) * 3,
      y: (a.y + b.y) / 2 - Math.cos(heading) * 3, z: ((a.z ?? 0) + (b.z ?? 0)) / 2, heading: heading + Math.PI });
    assert.ok(recoverToRoad(game), road.id);
    assert.ok(Math.cos(game.heading - heading) > .95, `${road.id} rescue faces legal traffic`);
    assert.ok(Math.hypot(game.x - a.x, game.y - a.y) < 15, `${road.id} remains on the nearby roundabout`);
  }
});

for (const model of ["arcade", "simulation"] as const) {
  test(`${model} tow rescues a fallen, rolled cab from the Northstar gorge and drives away`, () => {
    const game = makeGame("street-ace", 610, "free-run", model);
    Object.assign(game, { x: -270, y: -1770, z: 5, vx: 20, vy: -8, speed: 22, fare: 250, steering: 1,
      drifting: true, boosting: true, driftBank: 35, brakeInputHeld: true, objectiveDwell: .19 });
    game.roadMotion.grounded = false; game.roadMotion.verticalSpeed = -25;
    game.simulationVehicle.overturned = true; game.simulationVehicle.bodyRoll = Math.PI;
    game.traffic = []; game.fareDispatchEnabled = false;
    const result = recoverToRoad(game);
    assert.ok(result);
    assert.equal(result.cost, 100); assert.equal(game.fare, 150);
    assert.ok(game.z > 30, "the road is above the canyon floor");
    assert.ok(Math.hypot(game.x + 270, game.y + 1770) < 140, "recovery stays at the nearby road");
    assert.ok(isRoadSurface(game)); assert.ok(isPlayablePoint(game.x, game.y, 2.4));
    assert.equal(game.roadMotion.grounded, true); assert.equal(game.roadMotion.verticalSpeed, 0);
    assert.equal(game.simulationVehicle.overturned, false); assert.equal(game.simulationVehicle.bodyRoll, 0);
    assert.equal(game.vx, 0); assert.equal(game.vy, 0); assert.equal(game.steering, 0);
    assert.equal(game.objectiveDwell, 0); assert.equal(game.driftBank, 0);
    const stream = new CityStream(), world = stream.update(game.x, game.y, 1);
    assert.equal(taxiNearBuilding(world, game.x, game.y, game.heading, .3, game.z), false);
    assert.ok(Math.abs(groundAt(game, .1).height - game.z) < .02);
    assert.equal(makeHud(game).towReceipt?.cost, 100);
    assert.ok(towTruckBoxes(game).length > 12);
    assert.ok(dynamicBoxes(game, 0, [], world).length <= ACTOR_INSTANCE_CAPACITY);
    const start = { x: game.x, y: game.y };
    for (let tick = 0; tick < 120; tick++) stepGame(game, { ...idle, up: true }, 1 / 60, stream.update(game.x, game.y, 1), () => 1);
    assert.ok(Math.hypot(game.x - start.x, game.y - start.y) > 1);
    assert.equal(game.collisions, 0);
    const movedTruck = towTruckBoxes(game);
    assert.ok(movedTruck.length > 0);
    game.elapsed += 4;
    assert.equal(makeHud(game).towReceipt, null);
    assert.deepEqual(towTruckBoxes(game), []);
  });
}

test("tow costs exactly $100 when affordable and is free below $100, with no repeated charge", () => {
  for (const cash of [0, 99, 100, 175]) {
    const game = makeGame("street-ace", 611, "free-run");
    game.fare = cash; game.traffic = [];
    const paid = cash >= 100 ? 100 : 0;
    assert.equal(recoverToRoad(game)?.cost, paid);
    assert.equal(game.fare, cash - paid);
    assert.equal(recoverToRoad(game), null, "double activation cannot charge twice during one tow");
    assert.equal(game.fare, cash - paid);
  }
});

test("tow preserves the occupied job, custom destination, run clock, score and fare roster", () => {
  const game = makeGame("street-ace", 612, "timed");
  game.fare = 400; game.onboard = true; game.timeLeft = 27; game.score = 950;
  game.customDestination = { x: 360, y: -2196, z: 157 }; game.traffic = [];
  const jobs = structuredClone(game.fareJobs), destination = { ...game.customDestination };
  const nav = new NavigationController(); nav.update(game);
  Object.assign(game, { x: -270, y: -1770, z: 5 });
  assert.ok(recoverToRoad(game));
  assert.equal(game.onboard, true); assert.equal(game.timeLeft, 27); assert.equal(game.score, 950);
  assert.deepEqual(game.fareJobs, jobs); assert.deepEqual(game.customDestination, destination);
  const plan = nav.update(game);
  assert.deepEqual(plan.route[0], { x: game.x, y: game.y, z: game.z });
  assert.ok(Math.hypot(plan.route[1].x - game.x, plan.route[1].y - game.y) < 100, "navigation replans at the recovered cab");
  game.towRecovery = null;
  game.elapsed += 4;
  assert.equal(nav.update(game).diagnostics?.revision, plan.diagnostics?.revision,
    "ending the tow animation does not recalculate the selected route");
});

test("walking and interior rescues reunite the player with the taxi near their exterior position", () => {
  for (const interior of [false, true]) {
    const game = makeGame("street-ace", 613, "free-run"); game.traffic = [];
    const origin = { x: -270, y: -1770, z: 5, heading: 0 };
    game.player = { kind: "walking", actor: makeWalkingActor({ ...(interior ? { x: 2, y: 3, heading: 0 } : origin), vx: 0, vy: 0, speed: 0 }),
      location: interior ? { kind: "interior", venue: { id: "test", kind: "shop", label: "SHOP" }, returnPose: origin } : { kind: "city" } };
    assert.ok(recoverToRoad(game));
    assert.equal(game.player.kind, "driving");
    assert.ok(Math.hypot(game.x - origin.x, game.y - origin.y) < 140);
  }
});

test("recovery finds real safe roads in every region and avoids occupied spawn points", () => {
  for (const [x, y] of [[18, 18], [-270, -1770], [1200, 180], [210, 1700], [1900, 1800], [-1900, 370], [900, -1000]]) {
    const game = makeGame("street-ace", 614, "free-run"); Object.assign(game, { x, y, z: -15 }); game.traffic = [];
    assert.ok(recoverToRoad(game), `${x},${y}`);
    assert.ok(isPlayablePoint(game.x, game.y, 2.4)); assert.ok(isRoadSurface(game));
    assert.ok(Math.abs(groundAt(game, .1).height - game.z) < .02);
  }
  const game = makeGame("street-ace", 615, "free-run");
  const reference = makeGame("street-ace", 615, "free-run"); reference.traffic = [];
  recoverToRoad(reference);
  const car = game.traffic[0]; Object.assign(car, { x: reference.x, y: reference.y, z: reference.z, activeAt: 0 });
  game.traffic = [car];
  assert.ok(recoverToRoad(game));
  assert.ok(Math.hypot(game.x - car.x, game.y - car.y) >= 8);
  assert.equal(game.traffic[0], car, "tow does not move other traffic");
});
