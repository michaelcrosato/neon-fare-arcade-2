import assert from "node:assert/strict";
import test from "node:test";
import { ACTIVE_WORLD_REGIONS, regionRoadBounds } from "../../game/regions";
import { horizonTarget, horizonSightline, makeHorizonProfile } from "../../game/render/horizon";
import { horizonView, horizonTexturePoint, HORIZON_UNIFORM_BYTES } from "../../game/render/horizon-view";
import { viewProjection } from "../../game/render/view-projection";
import { makeGame } from "../../game/state";
import type { Camera } from "../../game/model";

test("distant regions follow actual sightlines from all seven regions", () => {
  // East, south, west, north at each region's center.
  const expected = {
    "city-center": ["cedar-vale", "copper-mesa", "solana-coast", "northstar-range"],
    "cedar-vale": [null, "cypress-reach", "city-center", null],
    "northstar-range": [null, "city-center", null, null],
    "copper-mesa": ["cypress-reach", null, "ironwake-works", "city-center"],
    "cypress-reach": [null, null, "copper-mesa", "cedar-vale"],
    "solana-coast": ["city-center", "ironwake-works", null, null],
    "ironwake-works": ["copper-mesa", null, null, "solana-coast"],
  };
  for (const region of ACTIVE_WORLD_REGIONS) {
    const bounds = regionRoadBounds(region);
    const point = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
    for (let direction = 0; direction < 4; direction++) {
      assert.equal(horizonTarget(point, direction * Math.PI / 2).regionId, expected[region.id][direction], `${region.id}, direction ${direction}`);
    }
  }
});

test("a changing vantage follows region borders and Palm Reach's long peninsula", () => {
  assert.equal(horizonTarget({ x: 780, y: 0 }, 0).regionId, "cedar-vale");
  assert.equal(horizonTarget({ x: 804, y: 0 }, Math.PI).regionId, "city-center");
  assert.equal(horizonTarget({ x: 1584, y: 3000 }, Math.PI).regionId, null);
  assert.equal(horizonTarget({ x: 1584, y: 1800 }, Math.PI).regionId, "copper-mesa");
  assert.equal(horizonTarget({ x: 0, y: 1584 }, -Math.PI / 2).regionId, "city-center");
  assert.equal(horizonTarget({ x: 0, y: -1584 }, Math.PI / 2).regionId, "city-center");
});

test("long views retain taller regions behind the nearest neighbor", () => {
  assert.deepEqual(horizonSightline({ x: 0, y: 1584 }, -Math.PI / 2).map(target => target.regionId), ["city-center", "northstar-range"]);
  const palm = { x: 1584, y: 2088 };
  const cityBearing = Math.atan2(-palm.y, -palm.x);
  assert.deepEqual(horizonSightline(palm, cityBearing).map(target => target.regionId), ["copper-mesa", "city-center", "northstar-range"]);
  assert.ok(makeHorizonProfile(palm).columns.some(column => column.distantCity?.regionId === "city-center"));
  assert.ok(makeHorizonProfile({ x: 0, y: 1584 }).columns.some(column => column.target.regionId === "city-center" && column.ridge.regionId === "northstar-range"));
});

test("unbuilt bearings have coherent wilderness or open water without activating regions", () => {
  assert.equal(horizonTarget({ x: -1584, y: 0 }, Math.PI).setting, "ocean");
  assert.equal(horizonTarget({ x: 1584, y: 2800 }, 0).setting, "ocean");
  assert.equal(horizonTarget({ x: 0, y: -1584 }, -Math.PI / 2).setting, "alpine");
  assert.equal(horizonTarget({ x: 1584, y: 0 }, -Math.PI / 2).setting, "foothills");
  assert.equal(horizonTarget({ x: 0, y: 1584 }, Math.PI / 2).setting, "badlands");
  assert.equal(horizonTarget({ x: 1584, y: 0 }, 0).setting, "countryside");
});

test("every panorama is deterministic, continuous and closed through the west wrap", () => {
  const fingerprints = new Set<string>();
  for (const region of ACTIVE_WORLD_REGIONS) {
    const bounds = regionRoadBounds(region);
    const point = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
    const profile = makeHorizonProfile(point);
    assert.deepEqual(profile, makeHorizonProfile(point));
    assert.equal(profile.columns.length, 721);
    assert.deepEqual(profile.columns[0], profile.columns.at(-1));
    fingerprints.add(JSON.stringify(profile.columns));
    for (let i = 0; i < profile.columns.length; i++) {
      const column = profile.columns[i];
      assert.ok(column.far >= 0 && column.near >= 0);
      assert.ok(column.far + 1e-9 >= column.foreground);
      assert.ok(column.far < .4 && column.near < .2);
      for (const value of [...column.farColor, ...column.nearColor]) assert.ok(Number.isFinite(value) && value >= 0 && value <= 255);
      if (i) assert.ok(Math.abs(column.far - profile.columns[i - 1].far) < .045, `${region.id} has a cutout at column ${i}`);
    }
  }
  assert.equal(fingerprints.size, ACTIVE_WORLD_REGIONS.length);
});

test("panorama rays agree with geometry through headings, mobile framing, pitch and roll", () => {
  const game = makeGame("street-ace", 1527, "free-run", "simulation");
  game.simulationVehicle.bodyRoll = .4; game.simulationVehicle.bodyPitch = .08;
  game.roadMotion.pitch = .11; game.roadMotion.roll = -.04;
  assert.equal(HORIZON_UNIFORM_BYTES, 64);
  for (const mode of ["cab", "chase-high", "chase-low"] as const) for (const heading of [0, -Math.PI / 2, Math.PI - .001]) for (const mobile of [false, true]) {
    game.heading = heading;
    const camera: Camera = { x: game.x, y: game.y, heightOffset: game.z, mode, heading, mobile, boom: 8, zoom: .92 };
    const aspect = mobile ? 390 / 844 : 16 / 9;
    const basis = horizonView(game, camera, aspect), matrix = viewProjection(game, camera, aspect, 1200);
    for (const [x, y] of [[0, 0], [-.7, .4], [.8, -.6]]) {
      const ray = [0, 1, 2].map(i => basis[8 + i] + basis[i] * x + basis[4 + i] * y);
      const clip = (row: number) => matrix[row] * ray[0] + matrix[row + 4] * ray[1] + matrix[row + 8] * ray[2];
      assert.ok(Math.abs(clip(0) / clip(3) - x) < 1e-5, `${mode} horizontal bearing`);
      assert.ok(Math.abs(clip(1) / clip(3) - y) < 1e-5, `${mode} vertical bearing`);
      const uv = horizonTexturePoint(basis, x, y);
      assert.ok(uv.u >= 0 && uv.u <= 1 && uv.v >= 0 && uv.v <= 1);
    }
  }
});
