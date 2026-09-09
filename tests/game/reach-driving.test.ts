import assert from "node:assert/strict";
import test from "node:test";
import { REACH_ROADS } from "../../game/reach-roads";
import { makeGame } from "../../game/state";
import { stepGame } from "../../game/simulation";
import { CityStream } from "../../game/world";
import { normalizeAngle } from "../../game/math";
import { isRoadSurface, nearestRoadProjection, sampleSpecialRoad, specialRoadLength, specialRoadSurfaceIndex } from "../../game/road-network";
import { containingRegionForPosition } from "../../game/regions";

for (const drivingModel of ["arcade", "simulation"] as const) {
  test(`${drivingModel} crosses both Palm Reach seams in either direction without collision or loss of road contact`, () => {
    const stream = new CityStream();
    for (const seam of [
      { start: { x: 1368, y: 788 }, end: { x: 1368, y: 864 }, neighbor: "cedar-vale", heading: Math.PI / 2 },
      { start: { x: 756, y: 1944 }, end: { x: 864, y: 1944 }, neighbor: "copper-mesa", heading: 0 },
    ]) for (const direction of [1, -1]) {
      const game = makeGame("street-ace", 15, "free-run", drivingModel);
      game.traffic = []; game.fareDispatchEnabled = false;
      const heading = seam.heading + (direction < 0 ? Math.PI : 0);
      const start = direction > 0 ? seam.start : seam.end, end = direction > 0 ? seam.end : seam.start;
      Object.assign(game, { x: start.x - Math.sin(heading) * 2.25, y: start.y + Math.cos(heading) * 2.25, z: .64, heading });
      game.z = (nearestRoadProjection(game).point.z ?? 0) + .64;
      const regions = new Set([containingRegionForPosition(game.x, game.y)?.id]);
      let finished = false;
      for (let tick = 0; tick < 1800; tick++) {
        stepGame(game, { up: game.speed < 10, down: game.speed > 11, left: false, right: false, boost: false }, 1 / 60,
          stream.update(game.x, game.y, 1), () => 1);
        regions.add(containingRegionForPosition(game.x, game.y)?.id);
        assert.equal(game.collisions, 0, seam.neighbor);
        assert.ok(isRoadSurface(game) && game.roadMotion.grounded, `${seam.neighbor} ${game.x},${game.y},${game.z}`);
        if ((end.x - game.x) * Math.cos(heading) + (end.y - game.y) * Math.sin(heading) <= 0) { finished = true; break; }
      }
      assert.ok(finished && regions.has("cypress-reach") && regions.has(seam.neighbor as "cedar-vale" | "copper-mesa"));
    }
  });

  test(`${drivingModel} drives every Palm Reach boulevard, causeway and coastal loop in both directions`, () => {
    const stream = new CityStream();
    for (const road of REACH_ROADS) for (const direction of [1, -1] as const) {
      const game = makeGame("street-ace", 5, "free-run", drivingModel);
      game.traffic = []; game.fareDispatchEnabled = false;
      const length = specialRoadLength(road.id), court = road.id.endsWith("-turnaround");
      const start = sampleSpecialRoad(road.id, direction > 0 ? 2 : length - 2, 2.25 * direction)!;
      Object.assign(game, { ...start.point, z: (start.point.z ?? 0) + 0.64, heading: start.heading + (direction < 0 ? Math.PI : 0) });
      game.roadMotion.roadId = road.id;
      const simulation = drivingModel === "simulation", targetSpeed = court ? 4 : road.closed ? 10 : 14;
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
        assert.ok(game.z >= 0.6, `${road.id} ${direction} at ${progress} taxi at ${game.x},${game.y},${game.z} below pavement`);
      }
      assert.ok(finished, `${road.id} ${direction} stopped at ${progress}/${length}`);
      assert.ok(game.roadMotion.grounded, road.id);
    }
  });
}
