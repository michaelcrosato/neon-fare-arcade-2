# Northstar Range reimagining

Status: implemented and verified on 2026-09-08 in `C:\dev\neon-fare-arcade-2`.

## Intended experience

Drive out of Neon City into a forested gorge, cross high viaducts, climb into a
terraced alpine town, circle a high mountain lake, then follow hairpins to snowy
resort ridges and an observatory. Northstar should read as a continuous mountain
landscape from the road, on foot, from every camera, and in the regional GPS.
Keep the comic palette and readable low-poly silhouettes; build new procedural
geometry rather than overlaying photographic scenery.

## Delivered

- A deterministic terrain engine with continuous chunk seams, shared triangle
  contact, slope collision, road cuts/embankments, elevated water and landforms.
- Reimagined road hierarchy with real sustained climbs, hairpins, exposed ridge
  roads, a gorge viaduct and a covered mountain passage. Roads, traffic, routing,
  both GPS maps and both renderers must use the same elevations.
- Slope-aware building placement and new architectural geometry: pitched roofs,
  foundations, retaining walls, terraces, alpine shops/chalets, resort/lift
  structures and prominent landmark silhouettes.
- Distinct forest, village, lake and high-alpine environments with scenic
  viewpoints, rock strata, snowline, water and animated regional details.
- Preserve working fares, all existing named destinations/services, walking,
  interiors, couriers, region transfers, both driving models and local saves.
- Verify all 121 Northstar chunks and every relevant regional stream, routes,
  road/terrain contact, cliff/water boundaries, portals, fares, traffic and
  budgets. Drive real ascent/descent routes using normal controls.
- Inspect desktop/mobile, all cameras, WebGPU and Canvas at the city seam,
  gorge, village, lake and summit. Finish with full checks and production build.

## Implementation

- `game/terrain/northstar-forms.ts` defines landforms, flat occupied benches,
  the compact street policy, and a continuous road-design field. `surface.ts`
  applies settlement grading, cuts, embankments, and water beds, and emits the
  exact triangles used for tire/foot contact. `landscape.ts` supplies distant
  ridges with fine boundary vertices; `map.ts` supplies GPS contours.
- Five named roads have 8,174 total units of physical centerline. Their longest
  route, Silver Run Switchbacks, is 2,512 units. The village lies at z=44, lake
  at 82, resort at 128, lookout at 157, and upper gondola station at 221.
  Grades are deliberately stylized for this arcade world, reaching about 43%.
- The road compiler supports a physical tangent-smoothing window for uneven
  curve samples. Road and terrain contact, directed routing, traffic, fare
  approaches, walking/interior returns, gas proximity, and cameras share z.
  Mountain regional transfers allow up to 3,960 route units; other transfers
  retain their 2,160-unit limit.
- Triangle and quad architectural faces support pitched roofs, A-frames,
  faceted rocks, snow-capped conifers, and an observatory dome. Timber, stone,
  and snow have dedicated material IDs. Buildings sit on graded plots; the
  nine original named anchors retain their IDs, portals, and services.
- The gorge viaduct has real deck/rail/pier collision and visible steel ribs.
  The highway's rock gallery has solid columns and a ceiling. Mirror Lake
  drains through a carved spillway with animated foam and impassable water.
- An eight-cabin gondola runs on two sagging cables through five supports.
  Its station entrances align with the cables, central support legs clear the
  cabins, and roofs clear the incoming incline. It is animated scenery; riding
  the gondola is outside this implementation.
- WebGPU and Canvas consume the same meshes and dynamic actors. Canvas uses
  full projected cuboids for mountain structures. Both GPS views include
  topography, the spillway and lift; the full map displays altitude.

## Verification evidence

- `npm run check`: **296 game tests, 9 architecture tests, 9 runtime tests,
  1 rendered-HTML test, lint, strict typecheck, and production build passed**.
  The generated Worker and hosting manifest also passed artifact validation.
  Final log: `outputs/northstar-final-check.log`.
- `npm run test:browser -- --workers=1`: **16 tests passed**, including normal
  game input, exploration, GPS, both driving modes, saved state, mobile touch,
  WebGPU, Canvas, and all four cameras. The six mountain browser tests passed
  again after the final station refinement.
- The mountain browser fixture captures **96 camera views**: nine desktop
  locations and three mobile locations, four cameras, both renderers. The upper
  gondola station is inspected on foot. Full and compact GPS pass at both sizes.
  Review images are in `outputs/northstar-renderer-review/`.
- Normal digital controls drive the complete highway, switchbacks, and gorge
  in both directions and both driving models: **12 complete journeys**, zero
  collisions and no airborne frames at the tested 8–10-unit speeds.
- Both lanes of all five roads are sampled for tire support, buried pavement,
  and scenery collision. Every ribbon triangle remains unfolded. All nine
  venues enter and return at elevation; all six generated mountain fare pairs
  complete pickup/drop-off at their road approaches. Recycled traffic follows
  enabled streets or adopts the curved road. Cabins clear terrain and structures
  at 1,002 samples across both cable directions.
- Exhaustive world checks cover **726 chunks**, including all **121 Northstar
  chunks** and their radius-three views. Northstar totals 9,226 static boxes,
  95,772 mesh faces, and 4,528 colliders. Maxima per chunk are 233 boxes, 1,128
  faces, and 129 colliders. Maximum Northstar-centered streams use 14,568 boxes,
  49,056 faces including far landscape, and 540 colliders, within the 37,240 /
  65,536 / 1,536 budgets. City determinism fixtures remain passing.
- Live browser smoke: started Arcade Free Run, opened **N · RANGE**, tapped the
  summit road, and committed a custom GPS route to Silver Run. Local server:
  `http://127.0.0.1:4173`.

Headless browser checks verify correctness and layout; they are not an FPS
guarantee for a particular GPU. Far terrain deliberately omits detailed trees
and buildings until their visual chunks load. Procedural asset ownership is
documented in `docs/assets.md`.

The prior engine rebuild is already present as uncommitted work in this checkout.
Preserve it and keep the original `C:\dev\neon-fare-arcade` checkout untouched.
