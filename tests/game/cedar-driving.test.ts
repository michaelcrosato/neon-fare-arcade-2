import assert from "node:assert/strict";
import test from "node:test";
import { CEDAR_ROADS } from "../../game/cedar-layout";
import { makeGame } from "../../game/state";
import { stepGame } from "../../game/simulation";
import { CityStream } from "../../game/world";
import { normalizeAngle } from "../../game/math";
import { sampleSpecialRoad, specialRoadLength, specialRoadSurfaceIndex } from "../../game/road-network";

for (const drivingModel of ["arcade", "simulation"] as const) {
  test(`${drivingModel} drives every Cedar collector, loop and turning court in both directions`, () => {
    const stream = new CityStream();
    for (const road of CEDAR_ROADS) for (const direction of [1, -1] as const) {
      const game = makeGame("street-ace", 5, "free-run", drivingModel);
      game.traffic = []; game.fareDispatchEnabled = false;
      const length = specialRoadLength(road.id), court = road.id.endsWith("-turnaround");
      const start = sampleSpecialRoad(road.id, direction > 0 ? 2 : length - 2, 2.25 * direction)!;
      Object.assign(game, { ...start.point, z: 0.64, heading: start.heading + (direction < 0 ? Math.PI : 0) });
      game.roadMotion.roadId = road.id;
      const simulation = drivingModel === "simulation", targetSpeed = court ? 4 : 10;
      let finished = false, progress = direction > 0 ? 2 : length - 2;
      // Spawn once, then use only ordinary throttle, brake and steering inputs.
      for (let tick = 0; tick < Math.ceil(length / targetSpeed * 120); tick++) {
        const projected = specialRoadSurfaceIndex.query(game, 12).filter(p => p.roadId === road.id)
          .sort((a, b) => a.centerDistance - b.centerDistance)[0];
        assert.ok(projected, `${road.id} lost its lane`);
        progress = projected.distance;
        if (direction > 0 ? progress > length - 3 : progress < 3) { finished = true; break; }
        const target = sampleSpecialRoad(road.id, Math.max(0, Math.min(length, progress + direction * (court ? 2 : simulation ? 7 : 5))), 2.25 * direction)!;
        const error = normalizeAngle(Math.atan2(target.point.y - game.y, target.point.x - game.x) - game.heading);
        const correction = error - (simulation ? game.simulationVehicle.yawRate * 0.3 : game.arcadeVehicle.yawRate * 0.13);
        stepGame(game, { up: game.speed < targetSpeed, down: game.speed > targetSpeed + 1,
          left: correction < -0.025, right: correction > 0.025, boost: false }, 1 / 60,
        stream.update(game.x, game.y, 1), () => 1);
        assert.equal(game.collisions, 0, `${road.id} ${direction} collision at ${progress}`);
        assert.ok(game.z >= 0.6, `${road.id} taxi sank below the pavement`);
      }
      assert.ok(finished, `${road.id} ${direction} stopped at ${progress}/${length}`);
      assert.ok(game.roadMotion.grounded, road.id);
    }
  });
}
