# Neon City reimagining

Status: complete and locally verified, September 10, 2026. Source baseline: `6bfbc25`.

## Intent

Rebuild the original starting city with the terrain, roads, grounded architecture,
and connected public spaces used by the reimagined regions. Keep a predominantly
orthogonal city, but give it a deliberate shape: a low downtown core, hilltop
landmarks, terraced neighborhoods, open green routes, and streets whose crests
let a fast taxi catch air. Remove the unused Neon Beltway and all eight ramps.

## Direction

- Downtown remains the readable starting grid, with a level spawn at `(0, 2)`.
  Distinct tower crowns, commercial frontages, and civic spaces establish the
  city silhouette and leave the existing controls and first fare accessible.
- Starfall Heights rises toward the observatory and university. Ridge streets
  and a winding scenic drive connect graded destination terraces; open parkland
  interrupts the grid around the skyline landmarks.
- The Ink Quarter gains sloping market streets, masonry frontages, courtyards,
  and planted terraces. The western green route breaks up the repeated blocks.
- Redline's industrial streets gain broad rollers, sawtooth sheds, warehouses,
  and construction scenery. Crests and visible landing streets create driving
  opportunities through the actual pavement and contact system.
- The southern city combines Titan's rise, lower harbor streets, leisure
  landmarks, and connected greens. Named campuses use continuous grounds with
  perimeter access rather than unnecessary streets through their interiors.
- All sixteen named landmarks, courier destinations and the starting home retain
  their identities. Procedural parcels may become green space; surviving venues
  retain their semantic IDs.
  Regional boundaries and all four cardinal seams remain at their existing
  coordinates and meet at ground height zero. Neighboring terrain and destinations
  retain their content, with boundary planting adjusted for road clearance.

## Implementation boundaries

Pure city landforms and street policy sit below the road compiler. The shared
road graph and surface index remain authoritative for pavement, traffic,
navigation, contact, fares, and both GPS views. Grounded lots, collision,
pedestrians, venue returns, scenery, cameras, and distant views consume the same
terrain. No driving-force, scoring, boost, or vehicle-package tuning is part of
this rebuild; airtime must come from the authored landscape and existing physics.

The city uses the existing triangle terrain and architectural mesh protocols.
All chunk and stream limits remain in force. Geometry and design ownership may
be split into focused city modules; this is replacement content, not an engine
refactor mixed with handling changes.

## Acceptance and evidence to gather

1. The beltway and its ramps are absent from road definitions, graph, pavement,
   structures, traffic assignment, GPS, and live scenery. Shared bridge/contact
   regression coverage continues on real bridges in other regions.
2. Most of the city remains a connected grid. Substantial park, ridge, and
   campus areas interrupt it intentionally and remain accessible by authored
   roads. All named destinations and cardinal exits are reachable.
3. Elevation is physical throughout the city, with a flat starting block and
   exact seams. Both lanes agree with contact; pavement is not buried and
   buildings, entrances, walkers, and traffic are grounded and collision-clear.
4. Several distinct urban crests produce observable takeoff and clean landings
   with ordinary driving controls. Slower travel remains usable in both vehicle
   models, without changing vehicle tuning to manufacture the result.
5. City architecture, public spaces, landmarks, foreground terrain, and distant
   views form the rebuilt city in WebGPU and Canvas. Both GPS views show the
   same roads, terrain contours, destinations, and elevations.
6. Every active chunk and stream window stays within existing budgets. Review
   changed City counts/hashes, compare non-City content against the baseline,
   and retain fare, portal, water, traffic, region, camera, and input regressions.
7. Focused deterministic and browser checks, `npm run check:fast`, the full
   publication gate, production build, and actual desktop/mobile browser
   verification pass. Record measured results here before completion.


## Implemented terrain and mesh rules

- The shared City road field uses six-unit triangles, twelve-unit level junction
  tables and graded mid-block pavement. All curves are split at design triangle
  boundaries; width, bank and graph/contact agreement survive simplification.
- Named terraces range from zero in the starting core to 38 units at Starfall.
  Four scenic routes cross open greens while the main grid remains dominant.
- Generic lot families are rebuilt with physical roofs, fronts and public-space
  props. Ground-level walls and their colliders extend into downhill terrain;
  trees, benches, lights, parked cars and signs use explicit ground anchors.
- All ten multi-block landmark campuses have continuous grounds. Starfall uses
  two hemispherical domes above one pale plaza, and other campuses gain physical
  roof silhouettes while retaining their names and entrances.
- Near terrain merges only exact coplanar patches. Distant City hills retain fine
  vertices at every loaded edge. Mixed City/regional views likewise reserve fine
  distant boundary vertices for loaded edges, keeping shared views in budget.
  Every neighboring generated terrain chunk remains unchanged.

## Measured acceptance evidence

The City contains 22,386 boxes, 143,983 terrain/architectural/road faces, 5,964
colliders and 1,299 procedural/named portals. The park plan replaces 170 former
procedural portals. All sixteen named landmarks and the starting home survive.
The heaviest City chunk has 287 boxes, 1,466 faces and at most 72 colliders
(the maxima occur in different chunks). The largest City view has 11,354 boxes;
maximum collision radius remains one chunk with 510 colliders. The largest
radius-three surface stream contains 63,056 faces including distant scenery,
inside the unchanged 65,536 cap.

All 1,299 entrances and return positions pass collision and grounding checks.
Both lanes of every enabled City grid and authored street are sampled for
pavement/terrain agreement and obstacle clearance. Seven authored roads complete
both directions using normal digital controls at safe speed in both models.
The three straight launch runs start from rest and use acceleration only, with
no boost, velocity injection, or physics changes:

| Run | Arcade air / clearance | Simulation air / clearance | Result |
| --- | --- | --- | --- |
| Redline rollers | 2.95 s / 6.33 units | 4.43 s / 4.69 units | 5 landings each; zero collisions |
| Starfall descent | 4.87 s / 12.97 units | 5.25 s / 12.71 units | 8 / 5 landings; zero collisions |
| Titan rise | 2.00 s / 7.70 units | 2.12 s / 4.35 units | 2 landings each; zero collisions |

Air is cumulative across each route; clearance is the highest body-reference
height above the supporting road. Each run lands and continues on the street.

Against baseline `6bfbc25`, Cedar Vale and Palm Reach chunks are byte-identical.
Only four of the other 682 regional chunks change: boundary pines at `(0,-6)`,
cacti at `(0,6)` and coastal planting at `(-6,0)` / `(-6,4)` clear the newly
physical shared City pavement. Their terrain, roads, destinations and portals
remain unchanged; the other 678 regional chunks are byte-identical. Northstar's
initial fare market now anchors at its village instead of borrowing the City
spawn, retaining six safe local fares after the City road changes.

## Release verification

- `npm run check:fast` passes lint, types, architecture, runtime and core tests.
- `npm run check` passes 9 architecture, 21 runtime, 404 game and 1 rendered-HTML
  tests, plus the validated application build. This includes every active chunk
  and all 803 regional stream windows.
- `npm run build:vercel` passes the native Next production build.
- The 81-scenario browser suite runs against that native production build.
  The final narrow-phone map fix was verified with all four route-planner cases:
  320×568, 390×844, 844×390 and 1280×800. Its two map actions share a row on
  narrow phones, preserving a usable map and the new City altitude readout.
- Actual WebGPU, Canvas/WebGL and software 3D paths, every driving camera,
  walking, mobile controls, saved state, maps and all regional tours are covered.
  Desktop/mobile City images and full/compact GPS were visually reviewed.
- All sixteen named City landmarks are reachable from the spawn through actual
  pavement, including the campuses inside greens.

Deployment target: https://neon-fare-arcade-2.vercel.app/. GitHub's Quality
workflow reruns the publication gate and both browser shards on the release.
Local screenshots, metrics and live verification reports are retained under
ignored `outputs/release/` and Playwright's ignored `test-results/`.
