import assert from "node:assert/strict";
import test from "node:test";
import { makeGame } from "../../game/state";
import { stepGame } from "../../game/simulation";
import { CityStream } from "../../game/world";
import { normalizeAngle } from "../../game/math";
import { sampleSpecialRoad, specialRoadLength, specialRoadSurfaceIndex } from "../../game/road-network";
import { ROAD_SURFACE_HEIGHT } from "../../game/roads/contact";
import { groundAt, stepVehicleRoadContact } from "../../game/vehicle-road-contact";
import { coastRoadHeight } from "../../game/terrain/coast-forms";

const coastRoadIds = ["pacific-coast-drive", "sunset-boulevard", "citrus-scenic-loop", "mariposa-drive", "palisades-overlook-drive", "laurel-canyon-run", "canal-cruise"];

for (const drivingModel of ["arcade", "simulation"] as const) {
  test(`${drivingModel} clears the Sunset Boulevard arrival junctions at speed`, () => {
    const game = makeGame("street-ace", 5, "free-run", drivingModel);
    const stream = new CityStream();
    const roadId = "sunset-boulevard";
    const start = sampleSpecialRoad(roadId, 10, 2.25)!;
    const targetSpeed = 35;
    Object.assign(game, { ...start.point, z: start.point.z + ROAD_SURFACE_HEIGHT,
      heading: start.heading, vx: Math.cos(start.heading) * targetSpeed,
      vy: Math.sin(start.heading) * targetSpeed, speed: targetSpeed,
      traffic: [], fareDispatchEnabled: false });
    game.roadMotion.roadId = roadId;
    let finished = false;
    for (let tick = 0; tick < 600; tick += 1) {
      const projected = specialRoadSurfaceIndex.query(game, 12)
        .filter((point) => point.roadId === roadId)
        .sort((a, b) => a.centerDistance - b.centerDistance)[0];
      assert.ok(projected);
      if (projected.distance > 300) { finished = true; break; }
      const target = sampleSpecialRoad(roadId, projected.distance + 10, 2.25)!;
      const error = normalizeAngle(Math.atan2(target.point.y - game.y, target.point.x - game.x) - game.heading);
      const correction = error - (drivingModel === "simulation" ? game.simulationVehicle.yawRate * 0.3 : game.arcadeVehicle.yawRate * 0.13);
      stepGame(game, { up: game.speed < targetSpeed, down: game.speed > targetSpeed + 1,
        left: correction < -0.025, right: correction > 0.025, boost: false },
      1 / 60, stream.update(game.x, game.y, 1), () => 1);
      const deck = specialRoadSurfaceIndex.query(game, 0.05)
        .find((point) => point.roadId === roadId && point.surfaceDistance < 0.025);
      assert.ok(deck, "ordinary steering stays on the lane");
      assert.ok(game.z >= deck.point.z + ROAD_SURFACE_HEIGHT - 0.04,
        `taxi sank through the road at ${projected.distance}: ${game.z} < ${deck.point.z + ROAD_SURFACE_HEIGHT}`);
      assert.equal(game.collisions, 0, "landing must not count as hitting the deck's underside");
    }
    assert.ok(finished, "the car continues through the arrival junctions");
  });

  test(`${drivingModel} crosses both Sunset side-street junctions in both directions`, () => {
    const stream = new CityStream();
    for (const streetX of [-936, -900]) for (const direction of [-1, 1]) {
      const game = makeGame("street-ace", 5, "free-run", drivingModel);
      const x = streetX - 2.25 * direction, y = -20 * direction;
      const support = groundAt({ x, y, z: coastRoadHeight(x, y) + ROAD_SURFACE_HEIGHT }, 0.85);
      Object.assign(game, { x, y, z: support.height, heading: direction * Math.PI / 2,
        vx: 0, vy: 20 * direction, speed: 20, traffic: [], fareDispatchEnabled: false });
      game.roadMotion.roadId = support.roadId;
      let finished = false;
      for (let tick = 0; tick < 240; tick += 1) {
        stepGame(game, { up: game.speed < 20, down: game.speed > 21,
          left: false, right: false, boost: false }, 1 / 60, stream.update(game.x, game.y, 1), () => 1);
        assert.equal(game.collisions, 0, `${streetX} ${direction} hit a deck at ${game.y}`);
        if (game.y * direction > 20) { finished = true; break; }
      }
      assert.ok(finished, `${streetX} ${direction} stopped at ${game.y}`);
      assert.ok(Math.abs(game.z - support.height) < 0.04);
    }
  });

  test(`${drivingModel} catches a rising landing on an elevated Coast deck`, () => {
    const game = makeGame("street-ace", 5, "free-run", drivingModel);
    const stream = new CityStream();
    const start = sampleSpecialRoad("sunset-boulevard", 145, 2.25)!;
    Object.assign(game, { ...start.point, z: start.point.z + ROAD_SURFACE_HEIGHT + 0.005,
      heading: start.heading, vx: Math.cos(start.heading) * 35, vy: Math.sin(start.heading) * 35,
      speed: 35, traffic: [], fareDispatchEnabled: false });
    game.roadMotion.roadId = "sunset-boulevard";
    game.roadMotion.grounded = false;
    game.roadMotion.verticalSpeed = start.grade * 35 - 1;
    assert.ok(game.roadMotion.verticalSpeed > 0, "the airborne taxi is still rising");
    for (let tick = 0; tick < 10; tick += 1) {
      stepGame(game, { up: false, down: false, left: false, right: false, boost: false },
        1 / 60, stream.update(game.x, game.y, 1), () => 1);
      const deck = specialRoadSurfaceIndex.query(game, 0.05).find((point) => point.roadId === "sunset-boulevard" && point.surfaceDistance < 0.025)!;
      assert.ok(game.z >= deck.point.z + ROAD_SURFACE_HEIGHT - 0.04, "the moving foot trajectory must catch the uphill pavement");
      assert.equal(game.collisions, 0);
    }
    assert.ok(game.roadMotion.grounded);
  });

  test(`${drivingModel} never penetrates any Coast road during fast crests and landings`, () => {
    let airborne = 0;
    for (const roadId of coastRoadIds) for (const direction of [-1, 1]) for (const speed of [35, 70]) {
      const game = makeGame("street-ace", 5, "free-run", drivingModel);
      const length = specialRoadLength(roadId);
      let distance = direction > 0 ? 2 : length - 2;
      const start = sampleSpecialRoad(roadId, distance, 2.25 * direction)!;
      Object.assign(game, { ...start.point, z: start.point.z + ROAD_SURFACE_HEIGHT, speed });
      game.roadMotion.roadId = roadId;
      // A prescribed lane trajectory isolates vertical contact from cornering
      // limits. The tests above exercise the full simulation with normal input.
      for (distance += direction * speed / 60; distance > 2 && distance < length - 2; distance += direction * speed / 60) {
        const sample = sampleSpecialRoad(roadId, distance, 2.25 * direction)!;
        const previous = { x: game.x, y: game.y, z: game.z };
        game.vx = (sample.point.x - game.x) * 60; game.vy = (sample.point.y - game.y) * 60;
        game.x = sample.point.x; game.y = sample.point.y;
        game.heading = sample.heading + (direction < 0 ? Math.PI : 0);
        stepVehicleRoadContact(game, 1 / 60, previous);
        assert.ok(game.z >= sample.point.z + ROAD_SURFACE_HEIGHT - 0.04,
          `${roadId} ${direction} at ${speed}, distance ${distance}: feet ${game.z}, deck ${sample.point.z + ROAD_SURFACE_HEIGHT}`);
        if (!game.roadMotion.grounded) airborne += 1;
      }
    }
    assert.ok(airborne > 0, "genuine fast crests still launch the taxi");
  });
}

for (const drivingModel of ["arcade", "simulation"] as const) {
  for (const roadId of coastRoadIds) {
    test(`${drivingModel} drives ${roadId} in both directions with normal controls`, () => {
      const stream = new CityStream();
      for (const direction of [1, -1] as const) {
        const game = makeGame("street-ace", 5, "free-run", drivingModel);
        game.traffic = [];
        game.fareDispatchEnabled = false;
        const length = specialRoadLength(roadId);
        const start = sampleSpecialRoad(roadId, direction > 0 ? 2 : length - 2, 2.25 * direction)!;
        Object.assign(game, { ...start.point, z: start.point.z + ROAD_SURFACE_HEIGHT,
          heading: start.heading + (direction < 0 ? Math.PI : 0) });
        game.roadMotion.roadId = roadId;
        const simulation = drivingModel === "simulation";
        const targetSpeed = simulation ? 8 : 10;
        let finished = false;
        let airborne = 0;
        let progress = direction > 0 ? 2 : length - 2;
        // Only digital input changes the moving taxi. Position is set once at spawn.
        for (let tick = 0; tick < Math.ceil(length / targetSpeed * 120); tick += 1) {
          const projected = specialRoadSurfaceIndex.query(game, 12)
            .filter((point) => point.roadId === roadId)
            .sort((a, b) => a.centerDistance - b.centerDistance)[0];
          assert.ok(projected, `${roadId} ${direction} lost road at ${progress}`);
          progress = projected.distance;
          if (direction > 0 ? progress > length - 3 : progress < 3) { finished = true; break; }
          const target = sampleSpecialRoad(roadId, Math.max(0, Math.min(length,
            progress + direction * (simulation ? 7 : 5))), 2.25 * direction)!;
          const error = normalizeAngle(Math.atan2(target.point.y - game.y, target.point.x - game.x) - game.heading);
          const correction = error - (simulation ? game.simulationVehicle.yawRate * 0.3 : game.arcadeVehicle.yawRate * 0.13);
          stepGame(game, { up: game.speed < targetSpeed, down: game.speed > targetSpeed + 1,
            left: correction < -0.025, right: correction > 0.025, boost: false },
          1 / 60, stream.update(game.x, game.y, 1), () => 1);
          if (!game.roadMotion.grounded) airborne += 1;
          assert.equal(game.collisions, 0, `${roadId} ${direction} collision at ${progress}`);
        }
        assert.equal(finished, true, `${roadId} ${direction} stopped at ${progress}/${length}, ${game.x},${game.y},${game.z}`);
        assert.equal(game.roadMotion.grounded, true, roadId);
        assert.equal(airborne, 0, `${roadId} detached from a safe-speed climb`);
        const end = sampleSpecialRoad(roadId, progress, 2.25 * direction)!;
        assert.ok(Math.abs(game.z - end.point.z - ROAD_SURFACE_HEIGHT) < 0.25, roadId);
      }
    });
  }
}
