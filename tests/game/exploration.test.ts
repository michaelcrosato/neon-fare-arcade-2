import assert from "node:assert/strict";
import test from "node:test";
import { circleHitsBuilding } from "../../game/collision";
import { SPEED_KMH_PER_WORLD_UNIT } from "../../game/config";
import { stepExploration, sceneWorld } from "../../game/exploration";
import { INTERIOR_DEFINITIONS, interiorWorld } from "../../game/interiors";
import type { InputState, VenueKind, WorldView } from "../../game/model";
import { controlledPose, stepWalkingActor, walkingMotion } from "../../game/player";
import { localPoint } from "../../game/math";
import { interactionPrompt } from "../../game/interactions";
import { stepGame } from "../../game/simulation";
import { makeGame } from "../../game/state";
import { CityStream } from "../../game/world";

const IDLE: InputState = { up: false, down: false, left: false, right: false, boost: false };
const EMPTY_WORLD: WorldView = { key: "empty", boxes: [], colliders: [], chunks: [], interactions: [] };

test("exiting a stopped simulation cab clears drive input and leaves it parked", () => {
  const game = makeGame("street-ace", 405, "free-run", "simulation");
  game.traffic = [];
  game.fareDispatchEnabled = false;
  game.simulationVehicle.throttle = 1;
  game.simulationVehicle.engineRpm = 2_000;
  game.simulationVehicle.yawRate = 0.2;
  game.simulationVehicle.steeringAngle = 0.3;
  const taxi = { x: game.x, y: game.y, heading: game.heading };
  const events = stepGame(game, { ...IDLE, interact: true }, 1 / 60, EMPTY_WORLD, () => 0.5);
  assert.ok(events.some((event) => event.type === "vehicle-exited"));
  assert.equal(game.player.kind, "walking");
  for (let tick = 0; tick < 120; tick += 1) {
    stepGame(game, IDLE, 1 / 60, EMPTY_WORLD, () => 0.5);
  }
  assert.deepEqual({ x: game.x, y: game.y, heading: game.heading }, taxi);
  assert.equal(game.speed, 0);
  assert.equal(game.simulationVehicle.throttle, 0);
  assert.equal(game.simulationVehicle.yawRate, 0);
});

test("a stopped taxi exits once and re-enters through the same context action", () => {
  const game = makeGame();
  const taxi = { x: game.x, y: game.y, heading: game.heading };
  const first = stepExploration(game, { ...IDLE, interact: true }, 1 / 60, EMPTY_WORLD);
  assert.deepEqual(first, [{ type: "vehicle-exited" }]);
  assert.equal(game.player.kind, "walking");
  if (game.player.kind !== "walking") assert.fail("expected walking player");
  assert.deepEqual(walkingMotion(game.player.actor), {
    elevation: 0.64,
    verticalSpeed: 0,
    grounded: true,
    crouchAmount: 0,
    jumpHeld: false,
    jumpBuffer: 0,
    coyoteTime: 0.1,
    gaitPhase: 0,
    landingImpact: 0,
    turnLean: 0,
    action: "idle",
  });
  assert.deepEqual({ x: game.x, y: game.y, heading: game.heading }, taxi);

  // A held key cannot immediately bounce the player back into the cab.
  assert.deepEqual(stepExploration(game, { ...IDLE, interact: true }, 1 / 60, EMPTY_WORLD), []);
  assert.equal(game.player.kind, "walking");
  stepExploration(game, IDLE, 1 / 60, EMPTY_WORLD);
  assert.deepEqual(stepExploration(game, { ...IDLE, interact: true }, 1 / 60, EMPTY_WORLD), [{ type: "vehicle-entered" }]);
  assert.equal(game.player.kind, "driving");
});

test("an overturned simulation taxi must be righted on foot before it can be entered", () => {
  const game = makeGame("street-ace", 404, "free-run", "simulation");
  game.simulationVehicle.bodyRoll = Math.PI / 2;
  game.simulationVehicle.overturned = true;
  assert.deepEqual(stepExploration(game, { ...IDLE, interact: true }, 1 / 60, EMPTY_WORLD), [
    { type: "vehicle-exited" },
  ]);
  assert.equal(game.player.kind, "walking");

  stepExploration(game, IDLE, 1 / 60, EMPTY_WORLD);
  assert.deepEqual(interactionPrompt(game, EMPTY_WORLD), {
    label: "E · RIGHT TAXI",
    detail: "PUSH FROM THE SAFE SIDE",
  });
  assert.deepEqual(stepExploration(game, { ...IDLE, interact: true }, 1 / 60, EMPTY_WORLD), [
    { type: "vehicle-righted" },
  ]);
  assert.equal(game.player.kind, "walking");
  assert.equal(game.simulationVehicle.overturned, false);
  assert.equal(game.simulationVehicle.bodyRoll, 0);
  assert.deepEqual(interactionPrompt(game, EMPTY_WORLD), {
    label: "E · ENTER TAXI",
    detail: "BACK TO THE FARE",
  });
});

test("exiting preserves rollover momentum and never rights the taxi automatically", () => {
  const game = makeGame("street-ace", 406, "free-run", "simulation");
  game.traffic = [];
  game.fareDispatchEnabled = false;
  game.simulationVehicle.bodyRoll = 1.45;
  game.simulationVehicle.rollRate = 2.6;
  const taxi = { x: game.x, y: game.y };
  stepExploration(game, { ...IDLE, interact: true }, 1 / 60, EMPTY_WORLD);
  assert.equal(game.simulationVehicle.bodyRoll, 1.45);
  assert.equal(game.simulationVehicle.rollRate, 2.6);
  for (let tick = 0; tick < 180; tick += 1) {
    stepGame(game, IDLE, 1 / 60, EMPTY_WORLD, () => 0.5);
  }
  assert.equal(game.simulationVehicle.overturned, true);
  assert.ok(game.simulationVehicle.bodyRoll > 3);
  assert.deepEqual({ x: game.x, y: game.y }, taxi);
});

test("the driver must be below 10 km/h and have a collision-free side before exiting", () => {
  const moving = makeGame();
  moving.speed = 10 / SPEED_KMH_PER_WORLD_UNIT;
  assert.deepEqual(stepExploration(moving, { ...IDLE, interact: true }, 1 / 60, EMPTY_WORLD), [
    { type: "interaction-blocked", reason: "moving" },
  ]);
  assert.equal(moving.player.kind, "driving");

  const blocked = makeGame();
  const world: WorldView = {
    ...EMPTY_WORLD,
    colliders: [{ id: "box", x: blocked.x, y: blocked.y, halfX: 5, halfY: 5, height: 4 }],
  };
  assert.deepEqual(stepExploration(blocked, { ...IDLE, interact: true }, 1 / 60, world), [
    { type: "interaction-blocked", reason: "no-room" },
  ]);
  assert.equal(blocked.player.kind, "driving");
});

test("exit prompts and actions share the strict 10 km/h boundary in both cabs", () => {
  for (const drivingModel of ["arcade", "simulation"] as const) {
    for (const kmh of [0, 5, 9.99, 10, 10.01, 40]) {
      const game = makeGame("street-ace", 409, "free-run", drivingModel);
      game.traffic = [];
      game.speed = kmh / SPEED_KMH_PER_WORLD_UNIT;
      game.vx = -game.speed;
      const eligible = kmh < 10;
      assert.equal(Boolean(interactionPrompt(game, EMPTY_WORLD).label), eligible, `${drivingModel} prompt at ${kmh}`);
      const events = stepExploration(game, { ...IDLE, interact: true }, 1 / 60, EMPTY_WORLD);
      assert.equal(events[0]?.type, eligible ? "vehicle-exited" : "interaction-blocked", `${drivingModel} action at ${kmh}`);
      assert.equal(game.player.kind, eligible ? "walking" : "driving");
      if (eligible) assert.equal(game.speed, 0, "the taxi parks when the driver gets out");
    }
  }
});

test("a blocked driver side deterministically falls back to the passenger side", () => {
  const game = makeGame();
  const driverSide = localPoint(game.x, game.y, game.heading, -0.35, -2.05);
  const passengerSide = localPoint(game.x, game.y, game.heading, -0.35, 2.05);
  const world: WorldView = {
    ...EMPTY_WORLD,
    colliders: [{ id: "driver-side-block", x: driverSide.x, y: driverSide.y, halfX: 0.7, halfY: 0.7, height: 3 }],
  };
  assert.deepEqual(stepExploration(game, { ...IDLE, interact: true }, 1 / 60, world), [{ type: "vehicle-exited" }]);
  assert.equal(game.player.kind, "walking");
  if (game.player.kind !== "walking") assert.fail("expected walking player");
  assert.ok(Math.hypot(game.player.actor.x - passengerSide.x, game.player.actor.y - passengerSide.y) < 1e-9);
});

test("walking is deterministic, responsive, and slides without entering walls", () => {
  const actor = { x: 0, y: 0, vx: 0, vy: 0, heading: 0, speed: 0 };
  for (let tick = 0; tick < 60; tick += 1) stepWalkingActor(actor, { ...IDLE, up: true }, 1 / 60, EMPTY_WORLD);
  assert.ok(actor.x > 4.2 && actor.x < 4.35);
  assert.ok(Math.abs(actor.y) < 1e-9);

  const wallWorld: WorldView = {
    ...EMPTY_WORLD,
    colliders: [{ id: "wall", x: 3, y: 1.5, halfX: 0.3, halfY: 4, height: 4 }],
  };
  const slider = { x: 0, y: 0, vx: 0, vy: 0, heading: 0.35, speed: 0 };
  for (let tick = 0; tick < 90; tick += 1) stepWalkingActor(slider, { ...IDLE, up: true }, 1 / 60, wallWorld);
  assert.equal(Boolean(circleHitsBuilding(wallWorld, slider.x, slider.y, 0.44)), false);
  assert.ok(slider.y > 1);
});

test("streamed venue metadata enters and exits a deterministic pocket interior", () => {
  const game = makeGame();
  const city = new CityStream().update(0, 0, 1);
  const portal = city.interactions.find((interaction) => interaction.id === "venue:0:0:home");
  assert.ok(portal?.venue);
  game.player = {
    kind: "walking",
    actor: { x: portal.x, y: portal.y, vx: 0, vy: 0, heading: portal.heading, speed: 0 },
    location: { kind: "city" },
  };
  const entered = stepExploration(game, { ...IDLE, interact: true }, 1 / 60, city);
  assert.deepEqual(entered, [{ type: "venue-entered", label: "NEON LOFTS" }]);
  assert.equal(game.player.kind, "walking");
  assert.equal(game.player.location.kind, "interior");
  assert.equal(walkingMotion(game.player.actor).grounded, true);
  const room = sceneWorld(game, city);
  assert.match(room.key, /^interior:/);
  assert.ok(room.boxes.length < 512);
  assert.ok(room.colliders.length < 96);
  assert.equal(room.interactions.length, 3);
  assert.equal(room.interactions.find((interaction) => interaction.kind === "service")?.serviceId, "home-hub");
  assert.ok(room.interactions.some((interaction) => interaction.kind === "service" && interaction.serviceId === "courier-board"));

  stepExploration(game, IDLE, 1 / 60, city);
  if (game.player.kind !== "walking" || game.player.location.kind !== "interior") assert.fail("expected interior");
  game.player.actor.x = 0;
  game.player.actor.y = 10.2;
  const exited = stepExploration(game, { ...IDLE, interact: true }, 1 / 60, city);
  assert.deepEqual(exited, [{ type: "venue-exited", label: "NEON LOFTS" }]);
  assert.equal(game.player.kind, "walking");
  assert.equal(game.player.location.kind, "city");
  assert.equal(walkingMotion(game.player.actor).action, "idle");
  assert.ok(Math.hypot(controlledPose(game).x - portal.x, controlledPose(game).y - portal.y) < 1.3);
  assert.equal(Boolean(circleHitsBuilding(city, controlledPose(game).x, controlledPose(game).y, 0.44)), false);
});

test("the cutaway interior still contains the walking simulation", () => {
  const venue = { id: "containment", kind: "shop" as const, label: "NEON MARKET" };
  const room = interiorWorld(venue);
  const actor = { x: 0, y: 8.3, vx: 0, vy: 0, heading: Math.PI / 2, speed: 0 };
  for (let tick = 0; tick < 240; tick += 1) stepWalkingActor(actor, { ...IDLE, up: true }, 1 / 60, room);
  assert.ok(actor.y < 11.4);
  assert.equal(Boolean(circleHitsBuilding(room, actor.x, actor.y, 0.44)), false);
});

test("every venue family has a bounded, semantic, collision-clear interior", () => {
  const layouts = new Set<string>();
  for (const kind of Object.keys(INTERIOR_DEFINITIONS) as VenueKind[]) {
    const definition = INTERIOR_DEFINITIONS[kind];
    layouts.add(definition.layout);
    const venue = { id: `interior-contract:${kind}`, kind, label: kind.toUpperCase() };
    const room = interiorWorld(venue);
    const ids = room.interactions.map((interaction) => interaction.id);
    assert.equal(new Set(ids).size, ids.length, `${kind} has duplicate interaction IDs`);
    assert.ok(room.boxes.length <= 128, `${kind} has ${room.boxes.length} boxes`);
    assert.ok(room.colliders.length <= 24, `${kind} has ${room.colliders.length} colliders`);
    assert.ok(room.interactions.length <= 6, `${kind} has ${room.interactions.length} interactions`);
    assert.ok(room.interactions.some((interaction) => interaction.kind === "interior-exit"));
    for (const interaction of room.interactions) {
      assert.equal(
        Boolean(circleHitsBuilding(room, interaction.x, interaction.y, 0.44)),
        false,
        `${interaction.id} is blocked`,
      );
    }
  }
  assert.ok(layouts.size >= 10, `venue registry collapsed to ${layouts.size} layouts`);
});

test("store services use semantic events and on-foot actors cannot collect fares", () => {
  const game = makeGame();
  const venue = { id: "test-shop", kind: "shop" as const, label: "QUICKBYTE" };
  game.player = {
    kind: "walking",
    actor: { x: 2.4, y: -3.7, vx: 0, vy: 0, heading: 0, speed: 0 },
    location: { kind: "interior", venue, returnPose: { x: 0, y: 0, heading: 0 } },
  };
  const room = interiorWorld(venue);
  assert.equal(Boolean(circleHitsBuilding(room, game.player.actor.x, game.player.actor.y, 0.44)), false);
  assert.deepEqual(stepExploration(game, { ...IDLE, interact: true }, 1 / 60, EMPTY_WORLD), [
    { type: "service-used", serviceId: "retail-counter", venue },
  ]);
  assert.equal(game.message, "NEW STOCK ON THE WAY!");

  const gasVenue = { id: "test-gas", kind: "gas" as const, label: "GO-GO GAS" };
  const gasGame = makeGame();
  gasGame.player = {
    kind: "walking",
    actor: { x: 2.4, y: -3.7, vx: 0, vy: 0, heading: 0, speed: 0 },
    location: { kind: "interior", venue: gasVenue, returnPose: { x: 0, y: 0, heading: 0 } },
  };
  const gasRoom = interiorWorld(gasVenue);
  assert.equal(gasRoom.interactions.find((interaction) => interaction.kind === "service")?.serviceId, "gas-counter");
  assert.deepEqual(interactionPrompt(gasGame, gasRoom), {
    label: "E · BUY GAS + UPGRADES",
    detail: "TIME · BOOST · TUNING",
  });
  assert.deepEqual(stepExploration(gasGame, { ...IDLE, interact: true }, 1 / 60, EMPTY_WORLD), [
    { type: "service-used", serviceId: "gas-counter", venue: gasVenue },
  ]);
  assert.equal(gasGame.message, "GO-GO GAS READY!");

  gasGame.interactionHeld = false;
  gasGame.onboard = true;
  assert.deepEqual(stepExploration(gasGame, { ...IDLE, interact: true }, 1 / 60, EMPTY_WORLD), [
    { type: "service-used", serviceId: "gas-counter", venue: gasVenue },
  ]);
  assert.equal(gasGame.message, "TAXI OCCUPIED · FINISH THE FARE");
  assert.equal(gasGame.messageUntil, gasGame.elapsed + 2.2);

  const fareGame = makeGame();
  const pickup = fareGame.fareJobs[0].pickup;
  fareGame.x = pickup.x;
  fareGame.y = pickup.y;
  fareGame.player = {
    kind: "walking",
    actor: { x: pickup.x, y: pickup.y, vx: 0, vy: 0, heading: 0, speed: 0 },
    location: { kind: "city" },
  };
  for (let tick = 0; tick < 20; tick += 1) stepGame(fareGame, IDLE, 1 / 60, { ...EMPTY_WORLD, interactions: room.interactions });
  assert.equal(fareGame.onboard, false);
  assert.equal(fareGame.score, 0);
});
