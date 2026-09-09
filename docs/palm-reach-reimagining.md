# Palm Reach — southeast peninsula master plan

Status: implemented and verified. Production delivery uses the repository's
existing GitHub-to-Vercel workflow.

## Brief

Reimagine the southeast as a distinctive Miami-inspired peninsula with a
late-1980s/early-1990s atmosphere. Extend the playable world south, give the land a
recognizable taper and two different waterfronts, and make the complete drive
and walking experience support the setting.

The public region name is **Palm Reach**. The existing `cypress-reach` region
key, ten destination keys, and regional passenger identity remain stable.
Geography, architecture, local names, destination positions, and scenery can
change to serve the new design. Existing venue services remain available.

## Spatial plan

- Extend the southeast from chunk Y 6–16 to 6–23: seven extra rows, 77 extra
  chunks, and 1,008 world units of southern extent. Other regions keep their
  current bounds. Open water occupies part of the registered area.
- A broad northern shoulder connects to Cedar Vale. A west approach connects
  Copper Mesa across a real bay causeway. These connections meet a continuous
  north/south boulevard and coastal circuit.
- The western shore cuts inward to form a sheltered turquoise bay. The eastern
  shore carries a continuous pale beach and promenade. South of the old world
  edge, the peninsula narrows and curves toward a rounded lighthouse cape.
- Shore, land, water collision, bridge exceptions, scenery, and both GPS maps
  consume the same authored geometry. No square green floor under the ocean,
  perimeter road around the water, or isolated scenery masquerading as a coast.
- Street grids are limited to populated districts. The southern extension
  provides open, curving drives, marina turnoffs, and a proper return circuit.

## District sequence

1. **Calle Luna** — the northern gateway and café quarter. Low stucco courtyard
   buildings, striped awnings, corner groceries, record shops, a market plaza,
   a small chapel, and bright tiled sidewalks.
2. **Mirage Bay** — the western urban waterfront. A compact stepped skyline,
   glass and coral towers, waterfront lawns, Channel 86 studios, a marine
   stadium, and a dramatic approach across the bay.
3. **Ocean Ribbon** — the signature beach drive. A coherent row of pastel Art
   Deco hotels, vertical neon blades, stepped rooflines, curved corners,
   portholes, horizontal window eyebrows, pools, and double rows of palms.
4. **Moonwater Keys** — the quieter southern marina coast. Yacht slips,
   speedboats, low villas, a period motor inn,
   and long views across water. This district crosses the old world boundary.
5. **Sundial Point** — the tapered southern tip. Sea grapes and palms, white
   sand, an accessible lighthouse campus, a waterfront walk, and a scenic
   turnaround. Its silhouette should read clearly on the full map.

## Visual direction

Use warm ivory, shell pink, faded peach, seafoam, lilac, lagoon turquoise, and
selective hot-pink/cyan neon. Bay water is deeper teal; ocean shallows are bright
turquoise with thin white surf lines. Buildings should be varied in silhouette,
not repeated cubes with different colors.

Architecture references: the City of Miami Beach's [architecture guide](https://www.miamibeachfl.gov/architecture/)
and [visitor guide](https://www.miamibeachfl.gov/visit-miami-beach/) describe the
nautical geometry, concrete eyebrows, portholes, and tropical Art Deco language.
The [Cape Florida park](https://www.floridastateparks.org/parks-and-trails/bill-baggs-cape-florida-state-park/experiences-amenities)
informs the quiet beach/lighthouse conclusion to the drive. Palm Reach is an
original fictional place, using this design vocabulary rather than a replica.

Period details should include radio/record culture, roller-skating courts,
striped cabanas, geometric pool decks, angular marine canopies, and a few
memorable neon signs. Animate a small, bounded set of boats, seabirds, and
waterfront details. Use physical meshes and shared scene data so the identity
survives WebGPU, Canvas, cab view, and the overhead map.

## Destination plan

Retain ten semantic destination keys and each venue's service kind. Redesign
their places as Palm Reach Gateway, Calle Luna Market, The Mirage Hotel,
Mirage Marine Stadium, Flamingo Park, Sundial Lighthouse, Moonwater Yacht Club,
Sun Kiss Motor Inn, Channel 86 Studios, and Saint Lumina. Preserve stable venue
IDs when relocating entrances. All must have a dry, clear entrance, an outward
walking return pose, a connected road approach, and suitable fare supply.

## Implementation and evidence

1. Author the shared shoreline, extended registry, peninsula roads and local
   street plan. Produce a map from those coordinates and check both seams.
2. Implement land/water contact and bridge decks, then build district-specific
   lots, continuous landmark campuses, palms, beach furniture, and marina art.
3. Integrate the public names, full GPS and minimap shoreline, regional scenery,
   distant water/sky, pedestrian frontages, traffic, and passenger presentation.
4. Verify all active chunks and windows, road/terrain/water agreement, graph
   connectivity, all ten portals/services, fare supply and transfers, and
   actual driving journeys from both neighbors to the southern tip.
5. Capture WebGPU and Canvas views of the bay approach, Art Deco strip, marina,
   and lighthouse; inspect fixed, high/low chase and cab cameras. Exercise
   driving, walking, GPS, passenger dispatch, and mobile controls.
6. Run `npm run check`, the relevant browser suite, and `npm run build:vercel`.
   Commit and push a coherent verified result, then verify production delivery.

Completion requires the extended peninsula and distinctive visual experience
to exist in the playable game. A plan, passing build, palette change, or one
isolated landmark does not meet the brief.

## Implemented design and regional evidence

The region contains 198 chunks and brings the active world to 803. The western
bridge lands on Copper Mesa's existing road at `(792, 1944)`, then curves across
the bay to the skyline. The northern entry meets Cedar Vale at `(1368, 792)`.
The old southeast region, road, destination, and venue identities remain stable.
The three southern approaches join separate points of Sundial Point Loop,
leaving a clear local approach to the lighthouse campus.

- `reach-layout.ts` supplies the tapered shoreline, reclaimed waterfront ground,
  complete dry grid segments, and uninterrupted ocean promenade. World water,
  collision, full GPS, and minimap consume this geometry.
- Eight roads, five districts, and ten campuses are built. The bay crossing has
  physical elevation; the coast has Deco hotels, cafés, records, pools, courts,
  a marina, palms, a folded stadium roof, and a lighthouse. Unloaded skyline
  proxies reuse actual building geometry. Animation has a fixed actor bound.
- Passenger sheets 21–24 preserve the 24 regional identities and cell order.
  Destination sheet 6 adds six Palm Reach scenes. Exact prompts, references,
  project-use notes, conversion settings, and hashes are recorded in
  `assets/palm-reach-art-prompts.json` and the fare-art manifest.
- Seventeen focused regional tests pass. They drive all eight roads in both
  directions with Arcade and Simulation controls, cross both neighboring seams,
  sweep every authored and enabled grid lane for collision, traverse the entire
  promenade, enter/exit all ten venues, exercise pickups/dropoffs, check traffic
  recycling, and schedule southern fare-six transfers.
- Initial Cedar and Palm markets use their local service centers. Transfers
  involving Palm Reach use the existing 3,960-unit scenic-trip ceiling, and
  destination depth is measured across the shared seam rather than region
  centers. These changes keep the extended geography inside existing fare
  safety, locality, six-slot, and cardinal-neighbor contracts.
- The normal browser app starts with WebGPU active. Its full GPS retains
  regional detail when focusing the taller peninsula, and a custom route to
  Sundial Point can be previewed and confirmed without browser errors.

## Release validation — 2026-09-09

- `npm run check` passed on the final layout: lint, strict TypeScript,
  architecture/runtime checks, all 362 deterministic game tests, the standard
  production build, and rendered-HTML verification. The geography sweep covers
  all 803 active chunks and their stream windows within the existing hard caps.
- The complete 52-test browser suite passed. After simplifying the final cape
  junction, all eight Palm Reach browser tests passed again: 120 world captures
  across both renderers, four cameras, and desktop/mobile sizes, plus full and
  compact GPS. WGSL activation and browser errors are asserted by the suite.
- `npm run build:vercel` passed and produced the native Next.js deployment.
- The spatial audit reports no road/shore violations, wet anchor footprints,
  or authored roads crossing campus interiors. Both lane sweeps, both seam
  crossings, and the full promenade are collision-clear.

The production entry point is [Neon Fare](https://neon-fare-arcade-2.vercel.app/).
Choose Free Run, open the Regional GPS, and select **SE · PALM**. Head toward
Ocean Ribbon for the Deco beachfront, or set a pin at Sundial Point to tour
the extended peninsula. Commit-specific deployment status is recorded by the
GitHub and Vercel checks.
