import { cityRoadHeight, drapeCityRoad, inCityTerrain } from "../../game/terrain/city-forms";
import { compiledSpecialRoad, elevatedGridRoads } from "../../game/road-network";
import { sampleRoad } from "../../game/roads/geometry";
import { CityStream } from "../../game/world";
import { groundAt } from "../../game/vehicle-road-contact";
import { taxiHitsBuilding } from "../../game/collision";
import assert from "node:assert/strict";
import test from "node:test";
import { MAT_BUILDING, TAXI_START } from "../../game/config";
import { SPECIAL_ROADS } from "../../game/road-layout";
import { gridStreetSegmentEnabled } from "../../game/road-topology";
import { drapeRegionalRoad, inElevatedTerrain, roadDesignHeight } from "../../game/terrain/region-forms";
import { regionalTerrainMesh, terrainHeightAt } from "../../game/terrain/surface";
import { generateCityChunk } from "../../game/world";
import { citySettlementPlan } from "../../game/terrain/settlement";

test("the city replaces the unused elevated beltway and every interchange", () => {
  assert.equal(SPECIAL_ROADS.some(road => road.id === "neon-beltway"), false);
  assert.deepEqual(SPECIAL_ROADS.filter(road => /^(north|south)(east|west)-(inner|outer)-ramp$/.test(road.id)), []);
});

test("Neon City has physical hill districts around a level starting block and exact regional seams", () => {
  assert.equal(inElevatedTerrain(0, 0), true);
  assert.equal(roadDesignHeight(TAXI_START.x, TAXI_START.y), 0);
  assert.equal(terrainHeightAt(TAXI_START.x, TAXI_START.y), 0);
  assert.ok(terrainHeightAt(-36, -630) > 24, "Starfall must occupy a real hill");
  assert.ok(terrainHeightAt(-486, -486) > 14, "the university terrace must rise above downtown");
  assert.ok(terrainHeightAt(-414, 198) > 5, "the Ink Quarter must have physical terraces");
  for (let coordinate = -792; coordinate <= 792; coordinate += 9) {
    for (const point of [{ x: -792, y: coordinate }, { x: 792, y: coordinate },
      { x: coordinate, y: -792 }, { x: coordinate, y: 792 }]) {
      assert.equal(roadDesignHeight(point.x, point.y), 0);
      assert.equal(terrainHeightAt(point.x, point.y), 0);
    }
  }
  assert.equal(inElevatedTerrain(-1000, -1000), false);
  assert.equal(inElevatedTerrain(-1000, 1000), true, "Ironwake now owns southwest terrain");
});

test("the city remains mostly a grid while making substantial room for parks and authored streets", () => {
  let enabled = 0, possible = 0;
  for (let x = -756; x < 756; x += 36) for (let y = -756; y < 756; y += 36) {
    for (const next of [{ x: x + 36, y }, { x, y: y + 36 }]) {
      possible += 1;
      if (gridStreetSegmentEnabled({ x, y }, next)) enabled += 1;
    }
  }
  const proportion = enabled / possible;
  assert.ok(proportion > .7 && proportion < .94, `enabled grid proportion: ${proportion}`);
});

test("city road draping and the visible ground use the shared physical terrain pipeline", () => {
  const points = drapeRegionalRoad([{ x: -684, y: -612 }, { x: 684, y: 468 }]);
  assert.ok(points.some(point => (point.z ?? 0) > 14));
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1], b = points[index];
    for (const t of [.2, .5, .8]) {
      const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
      assert.ok(Math.abs(roadDesignHeight(x, y) - (a.z! + (b.z! - a.z!) * t)) < 1e-8);
    }
  }
  const chunk = generateCityChunk(0, -4);
  assert.ok(chunk.surfaces?.some(face => face.kind === "terrain" && face.corners.some(point => point.z > 20)));
});

test("coalesced City terrain preserves the physical plane throughout every merged face", () => {
  let merged = 0;
  for (const [cx, cy] of [[0, 0], [0, -4], [-3, 1], [3, -2], [0, 2]]) {
    const faces = regionalTerrainMesh(cx * 144 - 72, cy * 144 - 72, 144);
    for (const face of faces) {
      const [a, b, , d] = face.corners;
      if (b.x - a.x <= 6 || !d) continue;
      merged += 1;
      for (const u of [.17, .5, .83]) for (const v of [.17, .5, .83]) {
        const x = a.x + (b.x - a.x) * u, y = a.y + (d.y - a.y) * v;
        const z = a.z + (b.z - a.z) * u + (d.z - a.z) * v;
        assert.ok(Math.abs(terrainHeightAt(x, y) - z) < 1e-8, `merged ground at ${x},${y}`);
      }
    }
  }
  assert.ok(merged > 0, "representative chunks must exercise merged terrain");
});

test("City junction tables meet in one plane and draping preserves authored width and bank changes", () => {
  for (const [x, y] of [[432, -252], [0, -540], [36, 324], [-684, 144]]) {
    for (const dx of [-5, 0, 5]) for (const dy of [-5, 0, 5]) {
      assert.ok(Math.abs(cityRoadHeight(x + dx, y + dy) - cityRoadHeight(x, y)) < 1e-8);
    }
  }
  const points = drapeCityRoad([{ x: 0, y: 0, halfWidth: 6, bank: 0 },
    { x: 9, y: 0, halfWidth: 8, bank: .1 }, { x: 18, y: 0, halfWidth: 6, bank: 0 }]);
  assert.ok(points.some(point => point.x === 9 && point.halfWidth === 8 && point.bank === .1));
});

test("steep City plots have solid foundations reaching the downhill ground", () => {
  let foundations = 0;
  for (const [cx, cy] of [[2, -1], [5, -2], [-4, -4], [-3, -3], [-1, -1]]) {
    const chunk = generateCityChunk(cx, cy);
    for (const box of chunk.boxes) {
      if (box.material !== MAT_BUILDING || box.groundAnchor || box.sx < 4 || box.sy < 4 || box.sz < 3) continue;
      const floor = citySettlementPlan(Math.floor(box.x / 36), Math.floor(box.y / 36))?.floor;
      const bottom = box.z - box.sz / 2;
      if (floor === undefined || bottom > floor + .01) continue;
      foundations += 1;
      for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const x = box.x + dx * box.sx / 2 * Math.cos(box.yaw) - dy * box.sy / 2 * Math.sin(box.yaw);
        const y = box.y + dx * box.sx / 2 * Math.sin(box.yaw) + dy * box.sy / 2 * Math.cos(box.yaw);
        assert.ok(bottom <= terrainHeightAt(x, y) + 1e-8, `floating foundation at ${x},${y}`);
      }
      assert.ok(chunk.colliders.some(collider => Math.abs(collider.x - box.x) < .01 && Math.abs(collider.y - box.y) < .01
        && (collider.baseZ ?? 0) <= bottom + .01), `unsupported wall at ${box.x},${box.y}`);
    }
  }
  assert.ok(foundations > 20);
});

test("all City lanes stay clear of scenery and terrain and share physical tire support", () => {
  const stream = new CityStream();
  const blocked = new Set<string>(), buried: string[] = [], unsupported: string[] = [];
  const roads = [...SPECIAL_ROADS.map((road) => compiledSpecialRoad(road.id)!), ...elevatedGridRoads]
    .filter((road) => road.sections.some((section) => inCityTerrain(section.center.x, section.center.y) && Math.abs(section.center.x) < 792 && Math.abs(section.center.y) < 792));
  for (const road of roads) {
    for (let distance = 0.1; distance < road.length; distance += 1) {
      for (const lane of [-2.7, 2.7]) {
        const sample = sampleRoad(road, distance, lane);
        const { x, y, z } = sample.point, top = z + 0.64;
        const world = stream.update(x, y, 1);
        const solid = taxiHitsBuilding(world, x, y, sample.heading, top);
        if (solid) blocked.add(`${road.id}:${solid.id}`);
        const ground = terrainHeightAt(x, y);
        if (ground > top + 0.08 && buried.length < 16) buried.push(`${road.id}@${distance}: ${ground - top}`);
        const support = groundAt({ x, y, z: top }, 0.85, road.id);
        if (Math.abs(support.height - top) > 0.12 && unsupported.length < 16) unsupported.push(`${road.id}@${distance}: ${support.height - top}`);
      }
    }
  }
  assert.deepEqual({ blocked: [...blocked], buried, unsupported }, { blocked: [], buried: [], unsupported: [] });
});
