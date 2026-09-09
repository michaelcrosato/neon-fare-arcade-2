import assert from "node:assert/strict";
import test from "node:test";
import { compileRoad } from "../../game/roads/geometry";
import { RoadSpatialIndex } from "../../game/roads/spatial-index";
import { groundContact, ROAD_SURFACE_HEIGHT } from "../../game/roads/contact";
import { BELTWAY_ELEVATION, SPECIAL_ROADS } from "../../game/road-layout";
import { sampleSpecialRoad, specialRoadLength, specialRoadSurfaceIndex, routeRoadNetworkShortest, isHighwaySpeedSurface } from "../../game/road-network";
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

test("all eight real interchanges climb continuously onto the beltway and route through ramp endpoints", () => {
  for (const ramp of SPECIAL_ROADS.filter((road) => road.kind === "ramp")) {
    const game = makeGame("street-ace", 5);
    const length = specialRoadLength(ramp.id);
    game.z = ROAD_SURFACE_HEIGHT;
    let previous = sampleSpecialRoad(ramp.id, length)!;
    for (let progress = length; progress >= 0; progress -= 0.3) {
      const sample = sampleSpecialRoad(ramp.id, progress)!;
      const oldHeight = game.z;
      const previousPosition = { x: game.x, y: game.y, z: game.z };
      game.x = sample.point.x; game.y = sample.point.y;
      game.vx = (sample.point.x - previous.point.x) * 60;
      game.vy = (sample.point.y - previous.point.y) * 60;
      game.speed = Math.hypot(game.vx, game.vy);
      game.heading = sample.heading + Math.PI;
      stepVehicleRoadContact(game, 1 / 60, previousPosition);
      assert.ok(game.roadMotion.grounded, ramp.id);
      assert.ok(Math.abs(game.z - sample.point.z - ROAD_SURFACE_HEIGHT) < 0.08, `${ramp.id} at ${progress}`);
      assert.ok(Math.abs(game.z - oldHeight) < 0.1, ramp.id);
      previous = sample;
    }
    assert.ok(game.z > BELTWAY_ELEVATION + 0.6, ramp.id);
    const upper = sampleSpecialRoad(ramp.id, 0)!.point;
    const lower = sampleSpecialRoad(ramp.id, length)!.point;
    const route = routeRoadNetworkShortest(lower, upper)!;
    assert.ok(route && route.route.some((point) => (point.z ?? 0) > 7), ramp.id);
    assert.ok(route.route.some((point) => (point.z ?? 0) > 1 && (point.z ?? 0) < 7), ramp.id);
  }
});

test("bridge height is shared by taxi geometry, walking, re-entry and highway speed rules", () => {
  const game = makeGame("street-ace", 7);
  const sample = sampleSpecialRoad("neon-beltway", 0)!;
  game.x = sample.point.x; game.y = sample.point.y; game.heading = sample.heading;
  game.z = BELTWAY_ELEVATION + ROAD_SURFACE_HEIGHT;
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
  assert.equal(isHighwaySpeedSurface(game), true);
  assert.equal(isHighwaySpeedSurface({ ...game, z: 0 }), false);
});

test("solid height intervals separate underpasses and ignore props below the actor", () => {
  const world = { ...empty, colliders: [{ id: "beam", x: 0, y: 0, halfX: 20, halfY: 2, baseZ: 7.6, height: 0.7 }] };
  assert.equal(taxiHitsBuilding(world, 0, 0, 0, 0), undefined);
  assert.ok(taxiHitsBuilding(world, 0, 0, 0, 7));
  assert.equal(taxiHitsBuilding(world, 0, 0, 0, 8.64), undefined);
  assert.equal(circleHitsBuilding(world, 0, 0, 0.5, 0), undefined);
});

test("beltway traffic retains deck height through the closed seam", () => {
  const car = makeGame().traffic.find((item) => item.motion.kind === "path" && item.motion.roadId === "neon-beltway")!;
  assert.ok(car.z! > 8);
  for (let step = 0; step < 200; step += 1) {
    assert.equal(advancePathTraffic(car, 30), true);
    assert.ok(Math.abs(car.z! - 8.64) < 1e-8);
    assert.ok(Number.isFinite(car.pitch! + car.roll!));
  }
});

test("every ramp lane clears its guardrails and deck in both travel directions", () => {
  const stream = new CityStream();
  for (const ramp of SPECIAL_ROADS.filter((road) => road.kind === "ramp")) {
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
  const world = { ...empty, colliders: [{ id: "ceiling", x: 0, y: 0, halfX: 10, halfY: 10, baseZ: 3, height: 1 }] };
  assert.equal(ceilingHeightAt(world, 0, 0, 0, 0.5), 3);
  const actor = { x: 0, y: 0, heading: 0, vx: 0, vy: 0, speed: 0, elevation: 0, grounded: true };
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

for (const drivingModel of ["arcade", "simulation"] as const) test(`${drivingModel} controls climb and descend all eight streamed ramps without collisions`, () => {
  const stream = new CityStream();
  for (const ramp of SPECIAL_ROADS.filter((road) => road.kind === "ramp")) {
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
      for (let tick = 0; tick < 1800; tick += 1) {
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
      assert.ok(direction < 0 ? game.z > 8.6 : game.z < 0.75, ramp.id);
    }
  }
});
