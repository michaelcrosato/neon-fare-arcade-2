# Road authoring

`game/road-layout.ts` owns named road definitions. Existing IDs, endpoints and
regional seams remain semantic contracts. Add geometry there, then let
`road-network.ts` compile the shared surface and graph. Do not add asphalt only
to a renderer.

## Curves and frames

`sampleRoadCurve` accepts a polyline, a centripetal Catmull–Rom curve, or a chain
of cubic Beziers (3n+1 controls). Points have x/y and optional z, halfWidth and
bank. Z defaults to zero; bank is radians and positive bank raises the right
edge along increasing distance. Sampling bounds segment length and chord error,
with recursion and sample-count caps. Catmull–Rom keeps authored controls exact.

```ts
const points = sampleRoadCurve({
  kind: "bezier",
  points: [
    { x: 0, y: 0, z: 0, halfWidth: 6 },
    { x: 24, y: 0, z: 0, halfWidth: 6 },
    { x: 36, y: 24, z: 8, halfWidth: 8 },
    { x: 60, y: 24, z: 8, halfWidth: 8 },
  ],
}, { maxSegmentLength: 8, maxChordError: 0.06 });
```

`compileRoad` produces arc-length cross sections with tangent, lateral and
normal vectors. Bounded miters join pavement and lane strips. `sampleRoad`
returns position, heading, grade, bank and width at distance/lane offset.
Surface projection evaluates the same two pavement triangles used for drawing,
including twisted/banked patches. The spatial index queries all nearby decks.

Northstar and Copper drape curves onto regional 36-unit design fields, splitting them at each
height-field triangle boundary so crossing centerlines agree in z. A four-unit
physical tangent window (`compileRoad`'s fifth argument) prevents very short
height-field cuts from pinching the swept ribbon. Other roads use the original
unsmoothed frame. Keep both triangles of every ribbon patch upward-facing.

Occupied plots use level benches and short service lanes; wilderness keeps its
natural landforms. Terrain cuts follow the shared road-surface index. Level
landings at the lake and gorge junctions keep overlapping ribbons from forming
steps as a cab changes roads. The gorge landing changes road grade only, leaving
the valley below it intact. Bridge piers start on final terrain; covered-gallery
ceilings and columns use the same solid height intervals as other structures.

Copper's pure height and enabled-street policies live in
`terrain/copper-forms.ts`; `terrain/region-forms.ts` dispatches both regions.
Do not import the final terrain or road network from those design modules or
from a theme's basic asset builders. The final terrain depends on the compiled
roads. Copper's mesa and solar junction benches change road height without
filling the underlying canyon, and `roads/copper-structures.ts` builds its
rust-red arch ribs and retaining faces after the final terrain is available.

## Junctions and structures

Connect matching x/y/z endpoints. The intersection compiler splits physical
crossings only when their heights agree; a bridge crossing a street is not a
turn. Keep each route in the exact active-region union. One-way flags govern
graph edges; roundabouts retain their original legal circulation. Route costs
use physical 3D length and corridor weight, plus turn costs for live GPS.

Neon City's unused beltway and all eight ramps have been removed. Live bridge
coverage uses Northstar's gorge viaduct and Palm Reach's Mirage Bay Causeway.
`roads/structures.ts` emits 0.7-thick decks, rails with merge openings and
supports away from streets. A ramp must leave enough vertical clearance for a
cab before passing underneath a different deck. Changing XY control points can
remove procedural lots from the corridor, so review world count/hash changes.

Ground contact remembers the current road at overlapping merge surfaces.
Grounded vehicles follow reachable pavement; crest takeoff and falling use
vertical velocity, gravity, ceiling contact and landing suspension. Foot
movement, re-entry, traffic, speed bonuses and arrivals also check elevation.
Ground-based regional scenery remains ground-based until explicitly authored
otherwise; the engine does not infer physical mountains from decorative art.

## Verification

Run geometry/graph tests for compiler changes and `road-elevation.test.ts` for
contact/structure changes. That suite drives the live bridge approaches in both directions
using ordinary controls in both vehicle models, and samples both lanes for
collision clearance.
`test:world` checks all six regions, roads, fares, portals, pedestrians, water
and rendering/collision budgets. Review changed deterministic counts instead
of blindly accepting them.

Run `test:browser` for renderer, camera or input changes. The elevation fixture
is bundled only by Playwright and imports the real world, vehicle and renderers;
it adds no debug interface to production. Inspect ramp, bridge and underpass
captures in WebGPU and Canvas, including the cockpit. Finish with `npm run check`.

Northstar's engine, gameplay, and driving tests cover both lane directions,
terrain clearance, all named entrances, safe fare approaches, traffic, cable
clearance, and normal-control trips along the highway, switchbacks, and gorge.
`mountain-world.spec.ts` captures all four cameras in both renderers at nine
locations and verifies full/compact mountain GPS at desktop and mobile sizes.

Copper's terrain and gameplay suites cover both road lanes, ten elevated venue
returns, gas service, fare arrival, traffic, river collision, and the rock arch.
`copper-driving.test.ts` drives all seven roads end to end in both directions
and both vehicle models with ordinary controls. `copper-world.spec.ts` captures
ten desktop and three mobile locations in all four cameras and both renderers,
plus the full and compact desert GPS.

Neon City's pure plan and curves live in `city-layout.ts` and `city-roads.ts`;
`terrain/city-forms.ts` supplies the shared six-unit design triangles. Twelve-unit
junction tables keep intersecting lanes coplanar, with the remaining twenty-four
units of each block carrying the grade. Draping splits curves at every design
triangle and preserves width/bank changes; straight grid strips may merge exact
collinear cuts across one block. The starting core and landmark terraces stay
level, and all four regional seams meet zero height exactly.

`city-terrain.test.ts` sweeps both lanes of every City road for collision, buried
pavement and tire support. `city-driving.test.ts` drives seven authored routes
both ways in both models, then accelerates from rest through Redline, Starfall
and Titan crests to verify actual takeoff, landing and continued travel without
boost or physics overrides. `city-gameplay.test.ts` covers all portals, named
venue transitions, hilly gas forecourts, six fares and recycled traffic.
`city-world.spec.ts` covers ten desktop locations, three mobile locations, all
four cameras, both renderers and both GPS views.
