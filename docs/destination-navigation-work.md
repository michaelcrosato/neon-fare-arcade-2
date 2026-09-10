# Destination realism, stable navigation, and Dev Mode

This is the implementation and local verification record for the user request.
Production verification is performed against the published commit after these gates.

## Required outcomes

- [x] View and categorize every existing destination card; assign artwork by
  actual place semantics instead of a random stop-ID hash.
- [x] Waterfront artwork/names have nearby water; urban-building cards have a
  compatible built setting. Every ordinary stop describes the area it serves.
- [x] Reduce empty-country drop-offs; retain occasional scenic destinations only
  with suitable destination artwork and a compatible fictional rider interest.
- [x] Give every major landmark three distinct destination cards/occasions and
  every minor landmark at least one. Increase landmark destination frequency
  while retaining geographic variety and six deterministic fare slots.
- [x] Remove road-class speed bonuses without changing ordinary-street handling.
- [x] Keep the selected GPS path until the player is more than 1,000 displayed
  meters from the closest point on that path. Normal progress is not a reroute.
- [x] Recommend a U-turn only when it saves at least 1,000 displayed meters of
  actual road travel; heading changes alone cannot bypass that requirement.
- [x] Add an obvious Dev Mode entry in Options, with both GPS thresholds and
  useful controls for repeated destination, navigation, and driving playtests.
- [x] Verify deterministic placement, popularity, category/environment agreement,
  navigation boundaries, speed parity, Dev Mode controls, both renderers, and
  desktop/mobile presentation. Pass repository gates before publishing.

## Evidence from the initial audit

Baseline: clean worktree at `4daa82ac333735a322fc915fd0ae714195a29b94`.
All six destination atlases were visually inspected, row-major, on 2026-09-10.
Each sheet contains six square cards. Existing destination selection uses a
stop-ID hash over regional art ranges; it has no semantic compatibility test.
City content has 16 named landmarks: ten featured campuses and six smaller
landmarks. Regional anchor and mini-landmark inventories still need auditing.

| Art cell | Visible subject | Required compatible setting |
| --- | --- | --- |
| 0 | Arcade entrance between moored boats | Marina arcade; water and boats/docks nearby |
| 1 | Faceted urban hotel and arrival canopy | Built-up hotel frontage |
| 2 | Gantry crane and container terminal | Freight/container terminal or industrial yard |
| 3 | Rooftop broadcast mast and dishes | Broadcast studio/tower in a built setting |
| 4 | Dense covered street market | Market/shop frontage |
| 5 | Cargo cranes along a quay | Working pier with nearby water |
| 6 | Outdoor produce market | Market/shop district |
| 7 | Covered rail/transit platform | Actual transport terminal/platform |
| 8 | Entertainment hall on a waterside boardwalk | Waterfront arcade/pier |
| 9 | Tall hotel with illuminated lobby | Urban hotel frontage |
| 10 | Open workshop/garage and machinery | Industrial/service frontage |
| 11 | Planted rooftop terrace with skyline | Built urban garden/terrace; not remote parkland |
| 12 | Covered descending metro entrance | Actual transit/station entrance |
| 13 | Low rounded diner | Diner/cafe frontage |
| 14 | Theater with marquee | Theater/entertainment frontage |
| 15 | Monumental civic/cultural entrance | Museum/civic/campus building |
| 16 | Row houses and stoops | Built residential neighborhood |
| 17 | Glazed shopping arcade | Shopping mall/retail frontage |
| 18 | Truss bridge over water | Actual bridge and water |
| 19 | Two-storey courtyard motel | Motel/lodging frontage |
| 20 | Large faceted entertainment hall | Arena/event/cultural venue |
| 21 | Tall civic/office entrance | Office/civic building |
| 22 | Roofed ferry/boat landing | Landing with nearby water |
| 23 | Observatory dome | Actual observatory/science venue |
| 24 | Beach and lifeguard tower | Sandy coastline and ocean |
| 25 | Ferris wheel and rides on a pier | Actual amusement pier with water |
| 26 | Mission courtyard and fountain | Mission/Spanish civic campus |
| 27 | Modern house above coastal cliffs | Built coastal home/viewpoint with water |
| 28 | Art Deco studio gates | Actual film/studio campus |
| 29 | Surf shops beside a beach boardwalk | Coastal retail/beach access |
| 30 | Palm-lined cafe and record-shop street | Built tropical shopping district |
| 31 | Neon Art Deco hotel | Tropical hotel frontage |
| 32 | Curved causeway to a waterfront skyline | Actual causeway and broad water |
| 33 | Yacht club and marina | Marina, water, and boats |
| 34 | Lighthouse on a rocky shore | Actual lighthouse and coast |
| 35 | Waterfront roller rink and grandstand | Actual rink/event venue near water |

## Navigation findings

The controller currently replans after passing a turn by 1.5 world units, after
leaving the first active segment by roughly one lane, and on a heading reversal.
Those paths all need to use one route-deviation gate. The current U-turn choice
uses weighted routing costs and a 1.4 ratio; the requested savings are actual
displayed road meters. One displayed kilometer is `1000 / 18` world units.

Google's public Navigation SDK distinguishes active route guidance from reroutes
requested when a vehicle leaves its suggested route ([Navigator reference](https://developers.google.com/maps/documentation/navigation/android-sdk/reference/com/google/android/libraries/navigation/Navigator)).
The requested 1,000 m thresholds are this game's policy, not a claim about
Google Maps' private rerouting thresholds.

## Implemented destination selection

All 63 authored places (16 City landmarks and 47 regional anchors) now have
three distinct occasion cards. Their bounds come from the owning landmark and
regional registries. Normal dropoffs reserve approximately 70% of slots for
landmarks, weight major places more heavily, and avoid repeating a place within
the market. Remaining destinations require an actual compatible built lot.
Curbs retain procedural IDs and all existing safety/route/spacing validation.
Public arrival curbs may be across the street (within 18 world units); Solana's
long pedestrian pier uses arrival access from the coast road within 108 units.
Water-dependent subjects require semantic water within 108 world units.

Scenic stops are restricted to actual trailhead/beach-access lots, a 1-in-20
eligible-rider roll, and at most one per market. The explicitly matched fictional
riders are Beckett, Eira, Forrest, Imani, Anouk, Frankie, Sienna and Leila; their
binocular/map/backpack/camera/guide/surf/tide-pool props were visually inspected
in passenger atlases 13, 14, 21 and 25. Empty meadows, snowfields, washes,
rock shelves and ocean lots cannot receive ordinary dropoffs.

Pickup/dropoff event metadata, the animated card and the run deck retain the
occasion. Passenger reviews use the booked occasion instead of an unrelated
portrait-index travel reason. Only the selected destination sheet is warmed
on pickup. The art manifest checks every final WebP's dimensions and SHA-256.

### New visually inspected destination frames

All ten new atlases were inspected by their image workers and the primary
agent. Every image uses native ImageGen and unchanged WebP transcoding. Exact
prompts and per-sheet provenance are in
[`assets/destination-realism-art-prompts.json`](../assets/destination-realism-art-prompts.json).
The runtime's exhaustive subject/category table is `game/destination-cards.ts`.

| Sheet | Cells | Subjects, row-major |
| --- | --- | --- |
| 7 | 36–41 | Pulse Stadium; Skyport; Nova Megamall; Neon Titan; Deep Blue Aquarium; Neon General |
| 8 | 42–47 | Apex University; Volt Expo; Starfall; Lucky 88; Cedar Gateway; Maple Commons |
| 9 | 48–53 | Bellwether; Cedar Library; Brookside Rec; Engine House 9; Garden Water Tower; Moonbeam Drive-In |
| 10 | 54–59 | Northstar Gate; Timber Pass Gas; Village Square; Timberline Lodge; Pinewatch Ranger; Old Spruce Mill |
| 11 | 60–65 | Mirror Lake; Silver Run; Aurora Observatory; Sundown Gate; Roadrunner Trading Post; Copper Junction |
| 12 | 66–71 | Coyote Motor Court; Desert Bloom; Dustwind Airpark; Ocotillo Arts; Sunstone Solar; Saguaro Rodeo |
| 13 | 72–77 | Painted Canyon; Sunset Gate; Tidal Aquarium; Pacific Palms; Sunset Bowl; woodland trailhead |
| 14 | 78–83 | Palm Gateway; Flamingo tennis/rink; Sun Kiss Motor Inn; Channel 86 Studios; Saint Lumina; tropical beach |
| 15 | 84–89 | Inland Marina Arcade; South Terminal bus station; Cedar bungalow; Northstar cabin; desert home; Palm condo |
| 16 | 90–95 | Inland Coastwatch Rescue; City marina; City apartments; Solana courtyard homes; mountain motel; desert shops |

The audit corrected misleading legacy IDs: Marina Arcade has no nearby water;
South Terminal is a bus station; Coastwatch Rescue is an inland bluff station;
Palm's old shipyard/preserve/riverboat IDs now mean television studios, tennis
park and an Art Deco hotel. Unmatched old ferry/bridge/metro images are retained
in the categorized asset inventory but cannot be randomly assigned to a curb.

## Navigation and driving implementation

Road-class speed bonuses have been removed. Normal/boost/reverse behavior uses
the same package caps on ordinary streets and former bonus corridors. The
controller keeps the current route until deviation exceeds 1,000 displayed
meters from its closest remaining segment, including elevation. Progress and
later-leg rejoining consume the existing path; heading changes do not replan.
U-turn selection compares physical road lengths and requires 1,000 meters of
savings, with no ratio or heading-only override. Explicit new destinations,
new runs and tow recovery still establish a fresh route. Tow animation expiry
does not. Coincident arrival points retain their endpoint and do not rebuild
the same plan every frame. Both initial and direction-triggered U-turn checks
compare real forward/reverse graph distances. Shared normalized settings feed
the visible Dev Mode controls and both rendering paths.

## Dev Mode implementation

Options is visible in the header and the pause menu. Dev Mode exposes both GPS
thresholds (0–10,000 displayed meters), a default reset, live route diagnostics,
clock freeze, unlimited arcade boost, 0.25×/0.5×/1×/2× speed, single fixed-frame
stepping, boost refill, active traffic clearing, upright reset, pickup/dropoff
jumps and seeded restart. The destination explorer previews every landmark and
occasion, sets an ordinary GPS route, teleports to a validated curb or loads a
test passenger while preserving six slots. It remains paused while open and
saves its settings on this device.

GPS-only tuning leaves run eligibility intact. Tools that alter time, supplies,
traffic, position or assignments mark a sticky playtest excluded from career
banking and high scores. Disabling Dev Mode restores standard rules. Simulation
handling never receives arcade boost. Live diagnostics do not produce repeated
screen-reader announcements.

Actual browser checks found and fixed an arrival-tool issue: a right-lane pose
could sit outside the narrow dropoff ring. Jumps now prefer the existing safe
road approach, using nearest-clear-road recovery only when the approach is blocked.

## Verification record

- 80 focused navigation, recovery, custom-waypoint and driving tests passed
  before destination integration (`outputs/release/destination-navigation-speed-tests.log`).
- All 63 places now have validated arrival curbs; every regional seed sweep
  favors landmarks and matches ordinary/scenic lots to its card. This passed
  in `destination-integration-tests.log` before expected event-payload fixtures
  were updated for the new occasion metadata.
- 37 simulation, fare-presentation and passenger-review tests passed after the
  event integration (`destination-event-tests.log`).
- TypeScript passed after the destination/event integration.
- 26 focused Dev Mode, navigation and runtime-command tests passed, including
  single-frame stepping, sticky playtest banking and repeatable seeded restart.
- 28 destination/navigation tests passed after the arrival fix, including actual
  rare scenic stops for Beckett (seed 45), Anouk (3) and Sienna (20), and the
  arrival-plan stability regression.
- `check:fast` passed: lint, types, architecture, runtime and 256 core tests.
- All 31 local browser cases passed, including Dev Mode on both renderers at
  desktop/mobile sizes, actual stadium arrival and lake scenery, total-distance
  arrow badges in every camera, tow recovery, touch controls, modal focus,
  storage, and portrait/landscape layouts down to 320 pixels.
- The complete final `npm run check` passed (lint, typecheck, architecture,
  runtime, deterministic world/gameplay tests, production artifact build and
  rendered HTML). The old six-cell Palm Reach fixture now checks the semantic
  card and actual region; its focused southern dispatch cases also passed.
- The native Next production build passed. Release verification uses the
  GitHub/Vercel status for the published commit, repeats the four Dev Mode browser
  flows on the production URL, and checks every deployed destination atlas
  against its recorded SHA-256. Logs are retained in local `outputs/release/`.
- Production verification passed all four desktop/mobile WebGPU/Canvas flows
  and all 16 destination-atlas SHA-256 checks. The hosted full verification job
  reached its former 15-minute limit after 396 passing checks, so its allowance
  is now 25 minutes. Its commands and coverage remain unchanged.
- The Linux software-GPU trace reached the stadium curb at zero remaining
  meters, but its slow fixed-step progress exceeded the new browser test's
  arrival deadline. That test now shares the existing software-renderer
  readiness allowance and has enough overall time for the complete flow.
- The hosted full verification subsequently passed all 437 game, 22 runtime,
  nine architecture and one rendered-HTML tests plus both builds. The corrected
  desktop Dev Mode flow also passed on Linux software WebGPU. A browser shard
  reached its 20-minute limit near its final regional cases; the full browser
  suite now runs across four shards with 25-minute allowances. The temporary
  mobile arrival notice is checked for its exact visible occasion in one
  assertion so it cannot expire between separate visibility and text checks.
- Existing scene-fixture, renderer-activation and menu-hydration checks still
  used the generic eight-second assertion limit, causing slow CI startup to
  fail before the world checks ran. Their readiness assertions now use the
  shared `SCENE_START_TIMEOUT`, retaining the real enabled/active/hydrated
  conditions and all subsequent gameplay and rendering assertions.
