import assert from "node:assert/strict";
import test from "node:test";
import { compileRoad } from "../../game/roads/geometry";
import { RoadSpatialIndex } from "../../game/roads/spatial-index";
import { groundContact, ROAD_SURFACE_HEIGHT } from "../../game/roads/contact";
import { SPECIAL_ROADS } from "../../game/road-layout";
import { sampleSpecialRoad, specialRoadLength, specialRoadSurfaceIndex, routeRoadNetworkShortest } from "../../game/road-network";
import { makeGame } from "../../game/state";
import { stepVehicleRoadContact } from "../../game/vehicle-road-contact";
import { findTaxiExitPose, canEnterTaxi, stepWalkingActor } from "../../game/player";
import { taxiHitsBuilding, circleHitsBuilding } from "../../game/collision";
import type { WorldView } from "../../game/model";
import { taxiBoxes, cabInteriorBoxes } from "../../game/render/scene";
import { advancePathTraffic } from "../../game/traffic";
import { CityStream } from "../../game/world";
import { ceilingHeightAt } from "../../game/collision";
import { normalizeAngle } from "../../game/math";
import { stepGame } from "../../game/simulation";

const bridgeRoads = SPECIAL_ROADS.filter(road => ["stormwall-levee-road", "spruce-gorge-viaduct"].includes(road.id));
const bridgeSample = () => sampleSpecialRoad("stormwall-levee-road", 400)!;
const empty: WorldView = { key: "test", chunks: [], boxes: [], colliders: [], interactions: [] };
const idle = { up: false, down: false, left: false, right: false, boost: false };

test("support selection catches a descending deck without lifting actors through a bridge", () => {
  const low = compileRoad("low", [{ x: -30, y: 0 }, { x: 30, y: 0 }], 6);
  const high = compileRoad("high", [{ x: 0, y: -30, z: 8 }, { x: 0, y: 30, z: 8 }], 6);
  const index = new RoadSpatialIndex([low, high]);
  assert.equal(groundContact(index, { x: 0, y: 0, z: 0 }, 0.85).roadId, "low");
  assert.equal(groundContact(index, { x: 0, y: 0, z: 2 }).roadId, "low");
  assert.equal(groundContact(index, { x: 0, y: 0, z: 12 }).roadId, "high");
  assert.equal(groundContact(index, { x: 0, y: 0, z: 8.64 }).height, 8.64);
});

test("swept contact catches uphill flight against the pavement and preserves bridge undersides", () => {
  const slope = compileRoad("slope", [{ x: -10, y: 0, z: 4 }, { x: 10, y: 0, z: 8 }], 3);
  const upper = compileRoad("upper", [{ x: -10, y: 0, z: 12 }, { x: 10, y: 0, z: 12 }], 3);
  const index = new RoadSpatialIndex([slope, upper]);
  // The feet rise, but the pavement rises faster. Both poses are above the
  // old horizontal-height query ceiling used by the vehicle controller.
  const landing = index.sweep({ x: -1, y: 1, z: 5.9 }, { x: 1, y: 1, z: 6.1 });
  assert.equal(landing?.roadId, "slope");
  assert.ok(Math.abs(landing!.point.x) < 1e-6);
  assert.ok(Math.abs(landing!.point.z - 6) < 1e-6);
  assert.equal(index.sweep({ x: -1, y: 0, z: 1 }, { x: 1, y: 0, z: 0.9 }), null, "underpass remains below both decks");
  assert.equal(index.sweep({ x: -1, y: 0, z: 5 }, { x: 1, y: 0, z: 7 }), null, "rising through an underside is not a landing");
  assert.equal(index.sweep({ x: -1, y: 4, z: 7 }, { x: 1, y: 4, z: 5 }), null, "the infinite plane outside the paved width is not solid");
  assert.equal(index.sweep({ x: -1, y: 0, z: 15 }, { x: 1, y: 0, z: 1 })?.roadId, "upper", "a fast fall hits the first deck");
  assert.equal(index.sweep({ x: -1, y: 0, z: 7 }, { x: 1, y: 0, z: 7 }), null, "a real jump stays airborne above the slope");
});

test("level junction ties retain the followed road before the streets diverge in height", () => {
  const avenue = compileRoad("through-avenue", [{ x: -10, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0, z: 3 }], 6);
  const street = compileRoad("cross-street", [{ x: 0, y: -10 }, { x: 0, y: 10 }], 6);
  const index = new RoadSpatialIndex([street, avenue]);
  const junction = groundContact(index, { x: 0, y: 0, z: 0.64 }, 0.85, "through-avenue");
  assert.equal(junction.roadId, "through-avenue");
  const uphill = groundContact(index, { x: 1, y: 0, z: junction.height }, 0.85, junction.roadId);
  assert.equal(uphill.roadId, "through-avenue");
  assert.ok(uphill.height > junction.height);
});

test("near-level overlaps retain an aligned road and allow a turn onto a rising road", () => {
  const avenue = compileRoad("avenue", [{ x: -10, y: 0 }, { x: 10, y: 0 }], 6);
  const crossing = compileRoad("crossing", [{ x: 0, y: -10, z: 0.02 }, { x: 0, y: 10, z: 0.02 }], 6);
  const index = new RoadSpatialIndex([avenue, crossing]);
  const point = { x: 0, y: 0, z: ROAD_SURFACE_HEIGHT };
  assert.equal(groundContact(index, point, 0.85, "avenue", undefined, 0).roadId, "avenue");
  assert.equal(groundContact(index, point, 0.85, "avenue", undefined, Math.PI / 2).roadId, "crossing");
  const parallel = compileRoad("parallel", [{ x: -10, y: -0.1, z: 0.02 }, { x: 10, y: 0.1, z: 0.02 }], 6);
  const overlap = new RoadSpatialIndex([avenue, parallel]);
  for (const heading of [-0.3, 0, 0.3, Math.PI]) {
    assert.equal(groundContact(overlap, point, 0.85, "avenue", undefined, heading).roadId, "avenue", "steering corrections must not swap nearly parallel decks");
  }
});

test("real regional bridge approaches climb continuously and route at deck height", () => {
  assert.equal(bridgeRoads.length, 2);
  for (const road of bridgeRoads) {
    const length = specialRoadLength(road.id);
    const start = sampleSpecialRoad(road.id, 1)!;
    const game = makeGame("street-ace", 5);
    Object.assign(game, { ...start.point, z: start.point.z + ROAD_SURFACE_HEIGHT });
    game.roadMotion.roadId = road.id;
    let minimum = game.z, maximum = game.z;
    for (let progress = 1.3; progress < length - 1; progress += .3) {
      const sample = sampleSpecialRoad(road.id, progress)!;
      const previous = { x: game.x, y: game.y, z: game.z };
      game.vx = (sample.point.x - game.x) * 60; game.vy = (sample.point.y - game.y) * 60;
      game.speed = Math.hypot(game.vx, game.vy); game.heading = sample.heading;
      game.x = sample.point.x; game.y = sample.point.y;
      stepVehicleRoadContact(game, 1 / 60, previous);
      assert.ok(game.roadMotion.grounded, road.id);
      assert.ok(Math.abs(game.z - sample.point.z - ROAD_SURFACE_HEIGHT) < .08, `${road.id}@${progress}`);
      assert.ok(Math.abs(game.z - previous.z) < .15, road.id);
      minimum = Math.min(minimum, game.z); maximum = Math.max(maximum, game.z);
    }
    assert.ok(maximum - minimum > 3, road.id);
    const route = routeRoadNetworkShortest(start.point, sampleSpecialRoad(road.id, length - 1)!.point);
    assert.ok(route && route.route.some(point => (point.z ?? 0) > minimum + 1), road.id);
  }
});

test("bridge height is shared by taxi geometry, walking and re-entry", () => {
  const game = makeGame("street-ace", 7);
  const sample = bridgeSample();
  game.x = sample.point.x; game.y = sample.point.y; game.heading = sample.heading;
  game.z = sample.point.z + ROAD_SURFACE_HEIGHT;
  stepVehicleRoadContact(game, 1 / 60, game);
  const boxes = taxiBoxes(game, { includeGroundShadow: false });
  assert.ok(boxes.every((box) => box.z > 8.6));
  assert.ok(cabInteriorBoxes(game).every((box) => box.z > 9.5), "the cockpit follows the same deck as its camera");
  const actor = findTaxiExitPose(game, empty)!;
  assert.ok(actor);
  assert.ok((actor.elevation ?? 0) > 8.6);
  for (let tick = 0; tick < 120; tick += 1) stepWalkingActor(actor, { ...idle, jump: tick < 12 }, 1 / 60, empty);
  assert.equal(actor.grounded, true);
  assert.ok(Math.abs((actor.elevation ?? 0) - game.z) < 0.02);
  assert.equal(canEnterTaxi(game, { ...actor, z: actor.elevation }), true);
  assert.equal(canEnterTaxi(game, { x: game.x, y: game.y, z: 0 }), false);
});

test("solid height intervals separate underpasses and ignore props below the actor", () => {
  const world = { ...empty, colliders: [{ id: "beam", x: 0, y: 0, halfX: 20, halfY: 2, baseZ: 7.6, height: 0.7 }] };
  assert.equal(taxiHitsBuilding(world, 0, 0, 0, 0), undefined);
  assert.ok(taxiHitsBuilding(world, 0, 0, 0, 7));
  assert.equal(taxiHitsBuilding(world, 0, 0, 0, 8.64), undefined);
  assert.equal(circleHitsBuilding(world, 0, 0, 0.5, 0), undefined);
});

test("bridge traffic follows physical height and reverses at both endpoints", () => {
  const car = makeGame().traffic.find(item => item.motion.kind === "path" && item.motion.roadId === "stormwall-levee-road")!;
  assert.ok(car && car.motion.kind === "path");
  const directions = new Set<number>(); let highest = 0;
  for (let step = 0; step < 200; step += 1) {
    assert.equal(advancePathTraffic(car, 30), true);
    assert.ok(car.motion.kind === "path");
    const sample = sampleSpecialRoad(car.motion.roadId, car.motion.progress, 2.25 * car.dir)!;
    assert.ok(Math.abs(car.z! - sample.point.z - ROAD_SURFACE_HEIGHT) < 1e-8);
    assert.ok(Number.isFinite(car.pitch! + car.roll!));
    directions.add(car.dir); highest = Math.max(highest, car.z!);
  }
  assert.equal(directions.size, 2); assert.ok(highest > 9);
});

test("every regional bridge lane clears its guardrails and deck in both travel directions", () => {
  const stream = new CityStream();
  for (const ramp of bridgeRoads) {
    for (const direction of [-1, 1]) {
      for (let progress = 0; progress <= specialRoadLength(ramp.id); progress += 1) {
        const sample = sampleSpecialRoad(ramp.id, progress, 2.25 * direction)!;
        const world = stream.update(sample.point.x, sample.point.y, 1);
        const hit = taxiHitsBuilding(world, sample.point.x, sample.point.y, sample.heading + (direction < 0 ? Math.PI : 0), sample.point.z + ROAD_SURFACE_HEIGHT);
        assert.equal(hit?.id, undefined, `${ramp.id} ${direction} ${progress}: ${hit?.id}`);
      }
    }
  }
});

test("a low ceiling stops a jump and an oriented guardrail blocks sideways movement", () => {
  const world = { ...empty, colliders: [{ id: "ceiling", x: 18, y: 18, halfX: 10, halfY: 10, baseZ: 3, height: 1 }] };
  assert.equal(ceilingHeightAt(world, 18, 18, 0, 0.5), 3);
  const actor = { x: 18, y: 18, heading: 0, vx: 0, vy: 0, speed: 0, elevation: 0, grounded: true };
  let highest = 0;
  for (let tick = 0; tick < 100; tick += 1) {
    stepWalkingActor(actor, { ...idle, jump: true }, 1 / 60, world);
    highest = Math.max(highest, actor.elevation);
  }
  assert.ok(highest > 0.4 && highest <= 0.601);
  assert.equal(actor.grounded, true);
  const railWorld = { ...empty, colliders: [{ id: "rail", x: 0, y: 0, halfX: 15, halfY: 0.2, yaw: Math.PI / 4, baseZ: 8, height: 1 }] };
  assert.ok(taxiHitsBuilding(railWorld, 9, 9, Math.PI / 4, 8));
  assert.ok(circleHitsBuilding(railWorld, 9, 9, 0.5, 8));
  assert.equal(taxiHitsBuilding(railWorld, 9, -9, Math.PI / 4, 8), undefined);
  assert.equal(circleHitsBuilding(railWorld, 9, 9, 0.5, 0), undefined);
});

for (const drivingModel of ["arcade", "simulation"] as const) test(`${drivingModel} controls climb and descend both streamed regional bridges without collisions`, () => {
  const stream = new CityStream();
  for (const ramp of bridgeRoads) {
    for (const direction of [-1, 1]) {
      const game = makeGame("street-ace", 5, "free-run", drivingModel);
      game.traffic = [];
      game.fareDispatchEnabled = false;
      const length = specialRoadLength(ramp.id);
      const start = sampleSpecialRoad(ramp.id, direction < 0 ? length - 1 : 1, 2.25 * direction)!;
      Object.assign(game, { x: start.point.x, y: start.point.y, z: start.point.z + ROAD_SURFACE_HEIGHT,
        heading: start.heading + (direction < 0 ? Math.PI : 0) });
      game.roadMotion.roadId = ramp.id;
      let finished = false;
      const simulation = drivingModel === "simulation";
      const targetSpeed = simulation ? 8 : 10;
      // A digital test driver steers toward a short lookahead; it never writes
      // position, height or velocity after spawning on the lane.
      for (let tick = 0; tick < Math.ceil(length / targetSpeed * 120); tick += 1) {
        const projected = specialRoadSurfaceIndex.query(game, 12)
          .filter((point) => point.roadId === ramp.id)
          .sort((a, b) => a.centerDistance - b.centerDistance)[0];
        assert.ok(projected, ramp.id);
        if (direction < 0 ? projected.distance < 2 : projected.distance > length - 2) {
          finished = true;
          break;
        }
        const target = sampleSpecialRoad(ramp.id,
          Math.max(0, Math.min(length, projected.distance + direction * (simulation ? 7 : 5))), 2.25 * direction)!;
        const error = normalizeAngle(Math.atan2(target.point.y - game.y, target.point.x - game.x) - game.heading);
        const correction = error - (simulation ? game.simulationVehicle.yawRate * 0.3 : game.arcadeVehicle.yawRate * 0.13);
        stepGame(game, { ...idle, up: game.speed < targetSpeed, down: game.speed > targetSpeed + 1,
          left: correction < -0.025, right: correction > 0.025 }, 1 / 60, stream.update(game.x, game.y, 1), () => 1);
      }
      assert.equal(finished, true, `${ramp.id} direction ${direction}`);
      assert.equal(game.collisions, 0, ramp.id);
      assert.equal(game.roadMotion.grounded, true, ramp.id);
      const end = sampleSpecialRoad(ramp.id, direction < 0 ? 2 : length - 2)!;
      assert.ok(Math.abs(game.z - end.point.z - ROAD_SURFACE_HEIGHT) < .4, ramp.id);
    }
  }
});
