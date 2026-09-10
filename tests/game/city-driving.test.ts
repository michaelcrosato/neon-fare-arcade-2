import assert from "node:assert/strict";
import test from "node:test";
import { makeGame } from "../../game/state";
import { stepGame } from "../../game/simulation";
import { CityStream } from "../../game/world";
import { normalizeAngle } from "../../game/math";
import { sampleSpecialRoad, specialRoadLength, specialRoadSurfaceIndex } from "../../game/road-network";
import { ROAD_SURFACE_HEIGHT } from "../../game/roads/contact";
import { groundAt } from "../../game/vehicle-road-contact";
import { cityRoadHeight } from "../../game/terrain/city-forms";

const cityRoadIds = ["aurora-boulevard", "crosstown-boulevard", "harbor-parkway", "starfall-drive", "commons-greenway", "skyline-garden-drive", "titan-garden-loop"];
for (const drivingModel of ["arcade", "simulation"] as const) {
  for (const roadId of cityRoadIds) {
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

const launches = [
  { name: "Redline rollers", x: 252, y: -249.75, heading: 0, length: 468 },
  { name: "Starfall descent", x: 2.25, y: -288, heading: -Math.PI / 2, length: 450 },
  { name: "Titan rise", x: 33.75, y: 0, heading: Math.PI / 2, length: 504 },
];
for (const drivingModel of ["arcade", "simulation"] as const) for (const launch of launches) {
  test(`${drivingModel} launches and lands at ${launch.name} using ordinary acceleration`, () => {
    const game = makeGame("street-ace", 5, "free-run", drivingModel), stream = new CityStream();
    const support = groundAt({ x: launch.x, y: launch.y, z: cityRoadHeight(launch.x, launch.y) + ROAD_SURFACE_HEIGHT }, .85);
    Object.assign(game, { x: launch.x, y: launch.y, z: support.height, heading: launch.heading,
      traffic: [], fareDispatchEnabled: false });
    game.roadMotion.roadId = support.roadId;
    let airborne = 0, landed = 0, clearance = 0, finished = false;
    for (let tick = 0; tick < 2400; tick += 1) {
      const wasAirborne = !game.roadMotion.grounded;
      stepGame(game, { up: true, down: false, left: false, right: false, boost: false },
        1 / 60, stream.update(game.x, game.y, 1), () => 1);
      if (!game.roadMotion.grounded) airborne += 1;
      if (wasAirborne && game.roadMotion.grounded) landed += 1;
      clearance = Math.max(clearance, game.z - cityRoadHeight(game.x, game.y) - ROAD_SURFACE_HEIGHT);
      assert.equal(game.collisions, 0, `unexpected collision at ${game.x},${game.y}`);
      const distance = (game.x - launch.x) * Math.cos(launch.heading) + (game.y - launch.y) * Math.sin(launch.heading);
      if (distance > launch.length && game.roadMotion.grounded) { finished = true; break; }
    }
    assert.ok(finished, `stopped at ${game.x},${game.y}`);
    assert.ok(airborne >= 12, `only ${airborne} airborne frames`);
    assert.ok(clearance > .65, `only ${clearance} units of air`);
    assert.ok(landed > 0, "the taxi lands and continues on the street");
  });
}
