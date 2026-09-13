# Regional horizon review

The previous WebGPU shader painted one global compass: mountains north, towers
west, industry south, and water east. Position tests disabled those silhouettes
in five of the seven regions. Its three separated angular windows and shallow
vertical bands produced floating, disconnected cutouts. Canvas/WebGL had only
a flat clear color and software Canvas had a gradient.

Before changing that code, a real-renderer fixture captured all seven regions
in eight directions, both with the world and with the sky isolated. The 112
original images are retained under `outputs/horizon-before/`. The clearest gap
example is `horizon-before-cedar-vale-before-chromium/n-sky.png`; Ironwake's north
view also showed mountains where Solana Coast should be visible.

## Geography and art

The new horizon follows actual sightlines through the active-region registry.
The source region is excluded from the distant neighbor search. Cardinal views
from the regional centers resolve as follows; intermediate bearings use actual
rectangle intersections rather than fixed compass tiles.
Long sightlines retain additional regions behind that first neighbor: Northstar
can rise behind the City from Copper Mesa, and the City's skyline can appear
above lower Copper terrain when looking northwest from Palm Reach.

| View from | North | East | South | West |
| --- | --- | --- | --- | --- |
| Neon City | Northstar Range | Cedar Vale | Copper Mesa | Solana Coast |
| Cedar Vale | Wooded foothills | Countryside | Palm Reach | Neon City |
| Northstar Range | Alpine wilderness | Wooded foothills | Neon City | Coastal headlands |
| Copper Mesa | Neon City | Palm Reach | Canyon badlands | Ironwake Works |
| Palm Reach | Cedar Vale | Open ocean | Open ocean | Copper Mesa; ocean beyond the southern cape |
| Solana Coast | Coastal headlands | Neon City | Ironwake Works | Open ocean |
| Ironwake Works | Solana Coast | Copper Mesa | Dry badlands | Working sea |

Mountain backdrops have overlapping ridges, snow and conifers. Cedar's lower
wooded horizon has small roofs among trees. Copper's sandstone forms have
terraces and eroded outcrops. The City has varied tower groups; coastal and Palm
scenes use low pale buildings and palms, and Ironwake uses sawtooth sheds,
stacks and cranes. Unbuilt directions contain natural continuations, without
inventing named regions, landmarks or driveable destinations.

The illustration stays atmospheric enough for physical scenery and traffic to
read in front of it. Land and water fill continuously beneath the skyline;
individual trees and buildings may be spaced apart without cutting holes in
the underlying horizon. The sun and clouds retain the same world bearings.

## Ownership and verification

- `game/render/horizon.ts`: geography, bounded profile, periodic joins and
  quantized regional vantage. It neither mutates the simulation nor adds geometry.
- `game/render/horizon-view.ts`: shared camera-ray projection and its 64-byte
  uniform contract, including actual cabin pitch and roll.
- `app/horizon-panorama.ts`: deterministic vector artwork and two-image travel
  transitions. The GPU and software adapters consume identical artwork.
- `tests/game/horizon.test.ts`: every regional cardinal view, boundary changes,
  extended Palm Reach, unbuilt settings, continuity, determinism and projection.
- `tests/browser/regional-horizons.spec.ts`: all seven regions in eight headings
  in WebGPU and Canvas/WebGL, isolated skies and actual world screenshots,
  opaque art and an unbroken below-horizon band, mobile camera modes and the
  forced software fallback.
- `tests/browser/horizon-transitions.spec.ts`: the actual application visits
  every region and returns to the City through the existing Dev Mode controls,
  verifying that the active canvas adopts each region's background.

Generated screenshots and logs remain in ignored `outputs/`.

Final local validation on 2026-09-12:

- `npm run check`: lint, type checks, 9 architecture tests, 40 runtime tests,
  485 game tests, the Vinext build, artifact validation and one rendered-HTML
  test all pass. `npm run build:vercel` passes afterward. The result is recorded
  in `outputs/horizon-publication-result.json` and the two publication logs.
- The final regional suite passes all 20 cases: both real-app regional tours,
  both crossfade/reduced-motion checks, fourteen regional renderer tours and
  two mobile camera tours. Existing WebGPU/Canvas driving and walking smoke
  checks also pass, for 22 distinct browser checks.
- `outputs/horizon-final-verified/` retains the final screenshots.
  `outputs/horizon-before-after.png` compares the same north-facing Cedar view;
  `outputs/horizon-all-regions.png` shows the seven complete compass strips.
- A separate local Chromium measurement records a 22.9 ms median artwork
  rebuild and negligible cached-update cost. Software sky projection has a
  16.5 ms median at its 160,000-pixel limit. These are machine-specific
  observations, recorded in `outputs/horizon-performance.json`, not frame-time
  guarantees for other devices.
