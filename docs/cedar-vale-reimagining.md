# Cedar Vale reimagining

September 9, 2026.

## Intent

Make the existing eastern region read as leafy North American suburbia. The old
36-unit grid surrounded small housing islands with asphalt and gave homes
rotated box roofs. The redesign changes the street plan, parcel spacing,
architecture, vegetation, destination grounds and pedestrian frontages together.

## Result

- Seven neighborhood roads plus three court approaches and their turning circles
  join a compact civic grid and short destination access streets. Road topology,
  geometry, navigation, traffic, fares and both GPS maps share the same plan.
- 613 separate parcels support 504 homes or neighborhood businesses and 109
  frontage greens/gardens. Interior space becomes mature woodland and connected
  green ground. Each court has at least three surrounding homes.
- Real gabled roofs, front porches, garages, driveways, mailboxes, individual
  windows, fenced backyards and parked family cars replace the packed housing
  islands. Willow Gate has denser apartments and rowhomes; Pine Ridge and Garden
  End have ranch houses and bungalows; Brookside has family cottages; Maple
  Commons combines local shops and civic space.
- Bellwether School has connected wings, a gym, a bus and playing fields. The
  commons has a pavilion and shade trees; Brookside has a pool, clubhouse and
  basketball courts. The library is connected across its former internal street.
  The water tower has a faceted tank and open braced supports. Moonbeam has a
  continuous parking field, a screen, cars facing it, marked bays and speakers.
- All eight anchors retain stable IDs, services and one exterior portal each.
  The region has 351 entrances in total. The pool retains matching semantic
  water and collision. Campuses close only their internal grid streets.
- Residents walk two passing lanes along real street frontages and curved
  sidewalks. Curved pavement includes sidewalk support; junctions leave gaps in
  the sidewalk bands. The Canvas fallback uses the existing depth rasterizer
  for ground, roofs and trees. A low wooded horizon replaces the eastern harbor
  silhouette inside Cedar.

## Compatibility and checks

The region remains 121 chunks and the active world remains 726. The original
City geometry, eight Cedar destinations, six fare slots, 36 traffic vehicles,
active-cardinal transfers and hard renderer/stream capacities are retained.

`cedar-gameplay.test.ts` checks every parcel's road frontage and separation,
all road connections, densely sampled lane clearance, venue entry/return,
semantic pool water, pedestrian clearance across chunk boundaries, fare
completion and traffic recycling. `cedar-driving.test.ts` uses ordinary
controls to complete all 13 roads in both directions with Arcade and
Simulation: 52 journeys. The regional/world suites check every chunk and
radius-three stream; City golden fixtures remain separate.

`cedar-world.spec.ts` captures all five neighborhoods, five destination views,
three courts and mobile views in all four camera modes with WebGPU and Canvas,
plus both GPS views. School, library, gateway, pool/commons and tower/drive-in
geometry are also covered by deterministic interaction/collision checks.

The largest Cedar chunk uses 735 of 760 boxes, 1,164 of 2,048 mesh faces and
113 of 256 colliders. No capacity increase is part of the redesign. The maximum
radius-three view from a City center is now 28,967 boxes, down from 30,457,
because the eastern suburbs no longer repeat dense City-sized content.

Reproduce the focused checks with:

```sh
npm run test:file -- tests/game/cedar-gameplay.test.ts tests/game/cedar-driving.test.ts
npm run test:browser -- tests/browser/cedar-world.spec.ts --workers=1
```

The publication gate is `npm run check` and the full browser suite.
