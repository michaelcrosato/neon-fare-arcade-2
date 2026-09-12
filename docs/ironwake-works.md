# Ironwake Works

Ironwake activates the southwest cell as a working industrial harbor, with 121
chunks added to the continuous world. It connects south from Solana Coast by
Ironwake Freightway and west from Copper Mesa by Copper Freight Link.
The Regional GPS exposes it as **SW · WORKS**.

## Places to explore

| Destination | World block footprint | Distinctive scene |
| --- | --- | --- |
| Ironwake Gate | (-48, 24), 2 × 2 | Overhead checkpoint and weighbridges on a level arrival terrace |
| Vulcan Steelworks | (-42, 28), 6 × 5 | Continuous sawtooth halls, blast furnaces, rail forecourt and smoke |
| Ironwake Container Port | (-63, 33), 11 × 9 | Finger docks, 216-unit cargo ship, container stacks and working quay cranes |
| Blackline Refinery | (-38, 40), 8 × 7 | Silver tanks, elevated pipe racks, process towers and flare tips |
| Leviathan Dry Dock | (-60, 47), 8 × 9 | 252-unit vessel under repair, flooded basin and two 180-unit orange gantries |
| Magnet King Salvage | (-40, 54), 9 × 7 | Wreck towers, mixed scrap heaps, crusher and moving magnet |
| Freight Exchange | (-46, 40), 3 × 3 | Dispatch terminal and rail sidings |
| Shift Change Diner | (-31, 34), 2 × 1 | Worker diner with amber sign and stainless trim |
| Ironwake Truck Stop | (-26, 45), 2 × 2 | Fuel and taxi services |
| Breakwater Watch | (-58, 61), 2 × 2 | Harbor watchtower and sea overlook |

Five shared freight roads feed sparse industrial streets. Continuous campuses
interrupt internal public grid streets. Each named destination has one public
entrance and three fare occasions. The shared 48 passengers can appear alongside
six new local workers. Four traffic slots are appended to the existing 36.

The western sea and flooded repair basin use the same intervals in terrain,
semantic water, collision and both GPS views. Overhead gantries and pipe racks
have elevated colliders, leaving their passages open. Loaded and distant geometry
come from the same industrial builders. Smoke, flares, hoists, magnet lift and tug
use simulation time and cull outside a local range; reduced motion holds a static
pose. Both WebGPU and Canvas consume the renderer-neutral geometry.

## Verification

Focused tests cover the active union, both neighbor routes and seam grades, all
121 industrial chunks and radius-three views, matching harbor barriers, ten clear
public entrances, freight lanes, worker paths and bounded animation. Gameplay
fixtures exercise real venue entry/exit, truck-stop purchases, all six local fare
pickups/dropoffs, traffic recycling and both driving models crossing each seam.
Browser tours exercise all four driving cameras, walking, desktop, portrait and
landscape phones, both renderers, and both GPS sizes.

Validated on Windows with the repository's Node/npm toolchain and the live
development server at `http://127.0.0.1:4173`:

- `npm run check:fast`: passed lint, TypeScript, 9 architecture checks,
  35 runtime checks and 276 core checks.
- `npm run test:world`: exercised 189 exhaustive cases, including every one of
  the 924 chunks and every radius-three window. The initial run passed 185;
  four fixtures still expected an inactive southwest, City-only coastal
  transfers or the previous campus list. Those expectations were updated, and
  all four passed on a focused rerun. Existing City geometry hashes, driving,
  portals, road clearance, pedestrians, fare placement and transfer checks passed.
- The 12 September release audit subsequently passed the complete `npm run check`
  gate: all 467 game cases (including all 189 exhaustive cases), 35 runtime and
  9 architecture cases, the Worker build and rendered HTML. See the
  [release audit](repository-audit-2026-09-12.md) for the combined release checks.
- The ten focused industrial world/gameplay cases passed, including venue
  return poses, truck-stop purchases, both seam directions in both driving
  models and deterministic machinery.
- `npm run test:browser -- tests/browser/industrial-world.spec.ts
  tests/browser/industrial-session.spec.ts --workers=1`: all 13 scenarios passed.
  Actual WebGPU and Canvas sessions teleported through the major landmarks,
  decoded both new atlases and completed a container-port fare. Tours covered
  all four driving cameras, walking, two phone orientations and both GPS views.
  The walking fixture uses the production taxi-exit placement.
- All four phone scenarios also passed with `isMobile` and touch input
  emulation enabled, exercising the coarse-pointer camera policy in portrait
  and landscape for both renderers.
- `npm run build` passed and validated the Worker export and hosting manifest;
  `node --test tests/rendered-html.test.mjs` passed. Final lint, TypeScript and
  whitespace checks also passed.

Local test logs and reviewed screenshots are in ignored `outputs/ironwake-*`
paths. Earlier browser attempts encountered two startup timeouts while the
exhaustive sweep saturated the CPU; both passed on retry, and the subsequent
complete 13-scenario run passed without retries.

## Generated game art

Tool: OpenAI builtin `image_gen.imagegen`. Two original 1536 × 1024 images were
generated as exact 3-column × 2-row atlases, visually reviewed, then converted
with the repository's installed Sharp library to WebP at quality 90. Conversion
did not change the compositions. Existing art cells remain unchanged.

- `public/fare-passengers-29.webp`: row-major cells 168–173, Walt, Winona, Kenji,
  Rocio, Meera and Desmond.
- `public/fare-destinations-17.webp`: row-major cells 96–101, steelworks,
  refinery, container port, dry dock, salvage and diner.

### Passenger atlas prompt

Use case: illustration-story. Asset type: final game passenger sprite atlas. Create one landscape 1536x1024 image containing EXACTLY 6 distinct square portraits in a perfectly regular 3-column by 2-row grid, each cell 512x512, no gutters, no borders. Arcade taxi game heavy industrial region Ironwake Works. Match a bold faceted low-poly comic illustration style: angular triangular color planes, ink-dark outlines, warm amber rim lighting, teal shadows, very dark nearly black backgrounds. Waist-up colorful adult characters, centered separately within their square cell, whole heads/hats visible, each visually distinct and friendly/confident. Row-major identities: 1 elderly white steelworker with grey moustache and orange hardhat, navy overalls; 2 Black woman refinery process engineer with clear safety glasses, yellow hardhat and teal coveralls; 3 East Asian male port dispatcher in a bright orange reflective vest, headset and short black hair; 4 Latina shipyard welder with lifted welding visor and burgundy leather work jacket; 5 South Asian woman salvage mechanic with tied-up dark hair, amber bandana, grease-marked cheeks, purple work shirt; 6 burly Black tugboat captain with grey beard, navy knit cap and ochre deck jacket. Strong readable faces at thumbnail size, expressive individual poses, detailed work clothing. No text, no labels, no lettering, no watermark. Six separate portraits only. Exact evenly divided grid required for CSS sprites.

### Destination atlas prompt

Use case: illustration-story. Asset type: final game destination sprite atlas. Create one landscape 1536x1024 image containing EXACTLY 6 square scenes in a perfectly regular 3-column by 2-row grid, each cell 512x512, no gutters, no borders. Arcade taxi game heavy industrial region Ironwake Works. Bold low-poly faceted comic concept art with angular architecture, black ink shadows, vivid amber/orange/cyan accents, halftone sunburst sky graphics, dramatic perspective. Each cell is a separately composed landmark with its main silhouette centered and visible. Row-major cells: 1 enormous rusty red steelworks with continuous sawtooth roof, blast furnaces, striped smokestacks and glowing orange foundry windows; 2 complex oil refinery with silver distillation columns, domed round storage tanks, yellow pipe racks and two tall orange flares; 3 working deepwater container port with massive teal-and-yellow ship-to-shore gantry cranes, colorful cargo containers and a red-hulled container ship; 4 heavy shipyard with a huge unfinished grey-and-red ocean-going vessel in a flooded dry dock beneath towering orange gantry cranes, scaffolding; 5 sprawling junkyard with crushed car towers, a yellow car crusher, giant magnet crane and rusty scrap heaps; 6 cozy stainless steel shift-workers diner with orange neon roof trim, coffee and chrome accents, with distant industrial silhouettes. Distinct sophisticated compositions, strong architecture, eye-level or modest elevated view. No text, no logos, no labels, no watermark. Exact evenly divided grid required for CSS sprites.
