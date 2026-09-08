# Copper Mesa reimagining

Status: complete and verified, September 8, 2026.

## Publication checkpoint

The completed 3D engine and Northstar rebuild are committed as `107d1e3` and
pushed to the public repository at
https://github.com/michaelcrosato/neon-fare-arcade-2. `main` and the remote were
verified at the same full commit SHA before starting this expansion.

## Experience

Copper Mesa is an Arizona-inspired road trip: airy Sonoran cactus country,
colorful adobe courtyards and neon motor courts, rust-red buttes and striped
badlands, dark volcanic ground, and a deep canyon with turquoise water. Roads
alternate open, flowing bends with narrow rock passages and climbs onto wide
mesas. Detours have distinct scenery and return to the connected regional road
network.

Visual references are the National Park Service's descriptions of
[Saguaro's Sonoran vegetation](https://www.nps.gov/articles/000/sagu-saguaro-cacti-plant-story.htm),
[Painted Desert mesas and layered badlands](https://www.nps.gov/pefo/learn/nature/geologicformations.htm),
and [Sunset Crater's cinder cones and lava](https://www.nps.gov/sucr/learn/nature/geology.htm).
The region remains fictional and all new assets are original procedural geometry.

## Delivered landscape and roads

The shared terrain dispatch now supports Northstar and Copper with independent
pure design fields. Copper has physical flat-topped mesas, scalloped cliffs,
striped badlands, a cinder cone and crater, dry wash, salt flat, and excavated
river canyon. Rendering, tire support, walking, traffic, fares, portals, and GPS
consume the same final 9-unit triangles. Both neighboring seams meet z=0.

Seven authored roads replace the old four-road/sparse-grid layout:

- **Sundown Highway** connects the city, town, mesa climb, and southern circuit.
- **Copper Loop** serves the motor court, western flats, and airpark.
- **Arroyo Road** makes broad bends through resort and solar country.
- **Painted Canyon Scenic Drive** loops through rodeo country, the canyon's
  rust-red bridge crossings, and the eastern salt flats.
- **Saguaro Trail** crosses varied cactus flats to the trading post.
- **Cinder Cone Loop** circles volcanic ground and passes through a rock arch.
- **Canyon Rim Road** links the visitor terrace and mesa lookout circuit.

Copper Junction retains a compact street grid, while destinations have short
access lanes and level graded plots. Junction benches at the mesa and solar
merges prevent overlapping road ribbons from making steps. Cliffside roads
have retaining faces; canyon bridges have rust-colored arch ribs, piers,
spandrels, guardrails, and matching height-aware collision. The southern roads
turn back into the region. A render-only west/south landscape skirt carries
the horizon without expanding the playable world.

## Destinations and atmosphere

All ten established anchors retain their IDs, footprints, and services:
Sundown Gate, Roadrunner Trading Post, Copper Junction, Coyote Motor Court,
Desert Bloom Resort, Dustwind Airpark, Ocotillo Arts Center, Sunstone Solar
Field, Saguaro Rodeo Grounds, and Painted Canyon. Their terraces range from
z=5 to z=74; town ground is z=24 and road tops add 0.64.

New geometry includes asymmetric saguaros, flowering barrel cacti, agave,
ocotillo, branching palo verde trees, layered rocks, chamfered adobe walls,
parapets, inset windows, exposed timbers, and open shaded arcades. Wilderness
plants follow their own ground anchors and avoid steep slopes, roads, and
water. Isolated procedural buildings appear beside enabled service streets.
The canyon visitor site has open pergolas on its actual rim terrace.

Two turning windmills, three striped hot-air balloons, an airpark windsock,
and small running roadrunners add deterministic ambient motion. Balloons are
scenery. The rock arch has a solid crown and a clear driving opening; the
turquoise river has an excavated bed and matching impassable-water regions.
No downloaded image assets, credentials, or external services were added.

## Renderer and gameplay integration

Adobe, cactus, and sandstone use material IDs 19–21 with plaster grain, cactus
ribs, and sandstone strata in WebGPU. Desert fog blends into the distant
landscape. Full GPS and minimap share colored terrain bands, contours, river,
crater, all seven roads, and altitude.

Canvas remains an overhead graphic fallback. A reusable per-pixel depth buffer
now resolves overlapping terrain, buildings, scenery, and taxi geometry in
both elevated regions. Its inner surface is capped at 1.2 million pixels.
This fixes large terrain faces painting over nearer roads and actors.

Six fare slots and all established services remain. New initial desert markets
use the connected town as their search anchor; rolling markets retain the
actual previous dropoff. Local legs still cap at 1,512 route units. Fare six
may use the existing 3,960-unit mountain allowance when Copper is an endpoint,
to accommodate the winding graded roads; flat-region-only transfers retain
their 2,160-unit cap. The exact active-region union and cardinal-neighbor rules
are unchanged.

## Verification

`npm run check` passed on Windows with the locked repository toolchain:
307 deterministic game tests, 10 runtime tests, 9 architecture checks, lint,
strict TypeScript, production build, Sites artifact validation, and one
rendered-HTML test. The original Neon City counts and deterministic hash
remain unchanged. Northstar's terrain, driving, venue, fare, and scenery
regressions pass.

The Copper tests cover:

- All seven roads, both lane directions, physical pavement support, terrain
  clearance, height-aware collision, and the two neighboring seams.
- 28 complete ordinary-control trips: seven roads × two directions × Arcade
  and Simulation, at test speeds of 10 and 8 world units/s respectively.
  No collision or unintended airborne frame occurs on those trips.
- Entering and returning from all ten venues on their actual ground, plus
  purchases at both elevated fuel stops with a cab parked in the near lane.
  A taxi below the station is correctly rejected.
- Six real fare pickup/dropoff sequences, recycled traffic following the
  physical roads, rock-arch clearance and solid crown, river bed/collision,
  and deterministic finite animation output.
- A runtime depth test with intersecting ground and road triangles submitted
  in both orders, proving per-pixel visibility and transparent background.

`copper-world.spec.ts` captures ten desktop and three mobile locations, each
in Fixed, Chase High, Chase Low, and Cab using WebGPU and Canvas: 104 scene
captures plus four GPS captures. All 22 tests in the complete browser suite
passed against both the development server and the built Worker preview,
covering the city, elevated beltway, Northstar, menus, simulation
controls, walking, focus, persistence recovery, diagnostics, and trusted mobile
input. Representative desktop/mobile frames were visually reviewed in both
renderers. A manual Free Run check opened **S · MESA**, selected a destination,
and committed the resulting road route from the city.

Publication also restored the executable bits on the Linux build helpers.
`npm start` previews the built Cloudflare Worker and its assets through Vite;
this avoids the native Windows path separators in vinext's static-file cache.
Linux CI uses an explicit SwiftShader Vulkan adapter under Xvfb so WebGPU is
actually rendered and captured. All shader, device-loss, and frame-error
assertions remain active. Regional scene cases receive a larger time allowance
on the CPU renderer; desktop Windows continues to exercise the native GPU.

## Final budget measurements

All 121 southern chunks total 29,800 static boxes, 4,032 colliders, 114,693
surface faces, and 91 interactions. Every regional stream remains within its
existing hard capacity; seam windows include neighboring regions.

| Resource | Maximum Copper chunk | Maximum stream centered in Copper | Hard chunk / stream cap |
| --- | ---: | ---: | ---: |
| Boxes | 421 | 22,163 | 760 / 37,240 |
| Colliders | 253 | 1,083 | 256 / 1,536 |
| Surface faces | 1,346 | 59,887 | 2,048 / 65,536 |
| Interactions | 10 | 379 | 32 / 720 |

Stream surface totals include the distant landscape and horizon skirt. The
canyon chunk `(0,16)` has the highest collider count and only three remaining
slots; future additions there need an explicit budget review. Visual streaming
stays at radius three and physical collision at radius one. The full suite
sweeps all 726 active chunks and every regional window.
