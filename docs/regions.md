# Regional world plan

Neon Fare's world uses a planned 3 × 3 compass registry of regional cells,
with Palm Reach extended south into a peninsula.
The original procedural city owns the center cell. Each compass cell can carry
its own theme, name, lot deck, landmarks, public realm, and ambient scenes while
sharing one continuous driving, walking, fare, traffic, streaming, and GPS
simulation.

## Coordinate contract

The base regional cell is 11 × 11 chunks; Palm Reach is 11 × 18 chunks.
A chunk is 4 × 4 blocks; a block is 36 world units square. One base cell is
therefore 44 × 44 blocks and 1,584 world units wide. Palm Reach is 44 × 72 blocks.

| Slot | Chunk X | Chunk Y | Status |
| --- | ---: | ---: | --- |
| NW | -16…-6 | -16…-6 | reserved |
| N | -5…5 | -16…-6 | active: Northstar Range |
| NE | 6…16 | -16…-6 | reserved |
| W | -16…-6 | -5…5 | active: Solana Coast |
| C | -5…5 | -5…5 | active: Neon City |
| E | 6…16 | -5…5 | active: Cedar Vale |
| SW | -16…-6 | 6…16 | reserved |
| S | -5…5 | 6…16 | active: Copper Mesa |
| SE | 6…16 | 6…23 | active: Palm Reach |

The active footprint is 803 chunks: 121 in each of five base cells and 198 in
Palm Reach. Registered ocean chunks stream water and remain physically impassable.

The center/E seam is the road at `x = 792`, and the N/center seam is the road at
`y = -792`. Cedar Vale's outer road is `x = 2376`; Northstar Range ends in
mountain wilderness at `y = -2376`, with no perimeter street. The center/S seam
is `y = 792`; Copper Mesa ends in canyon wilderness at `y = 2376`, also without
a perimeter street. Palm Reach shares `y = 792` with Cedar Vale and part of `x = 792` with Copper
Mesa. Its registered bounds extend to `x = 2376` and `y = 3384`, but those
outer edges are open water with no perimeter roads. Dry land tapers to a cape
near `(1683, 3285)`. Solana Coast shares `x = -792` with Neon City; its outer west
edge at `x = -2376` is ocean, with no perimeter road. Northeast, southwest,
and northwest remain inactive even when
they lie inside the world's rectangular hull. Region
ownership is stored in `game/regions.ts`; systems must use the active-region
registry rather than infer playable space from one symmetric radius or hull.

## Runtime ownership

- `game/regions.ts` owns slots, active regions, exact containment, bounds,
  nearest-region presentation, movement projection, and local place names.
- `game/residential.ts` owns Cedar Vale's parcels, neighborhood deck, pedestrian
  frontages and anchor registry. `cedar-layout.ts` defines its collectors, loops,
  courts and local streets; `residential-buildings.ts` and `cedar-assets.ts` own
  its homes, campuses, trees and architectural meshes.
- `game/mountain.ts` owns Northstar Range's area deck, rural building families,
  terrain dressing, portals, and authored anchor registry.
- `game/terrain/` owns Northstar and Copper landforms, settlement benches, shared
  terrain mesh/contact, watercourse beds, distant terrain, and GPS contours.
  Pure `region-forms.ts` dispatches road-design and natural height fields before
  the road network and final cut terrain are built.
- `game/mountain-scenery.ts` owns the spillway and gondola; `game/architecture.ts`
  supplies pitched roofs, faceted rocks, conifer crowns, and the observatory dome.
- `game/desert.ts` owns Copper Mesa's area deck, roadside families, portals, and
  authored anchor registry. `copper-assets.ts` supplies faceted desert plants,
  stratified rocks, adobe buildings, and open arcades; `copper-scenery.ts` owns
  the canyon river, drive-through rock arch, windmills, balloons, and roadrunners.
- `game/palm-reach.ts` owns Palm Reach's lots, portals, and pedestrian policy;
  `wetland.ts` preserves its compatibility exports. `reach-layout.ts` owns the
  shore and grid; `reach-roads.ts` the authored drives; `reach-destinations.ts`
  the anchors; `reach-assets.ts` and `reach-buildings.ts` their geometry.
  `reach-landscape.ts`, `reach-distant.ts`, and `reach-scenery.ts` own shared
  land/water, unloaded skyline proxies, and bounded waterfront animation.
- `game/coastal.ts` owns Solana Coast's lots, portals, anchors, and pedestrian
  policy. `coast-assets.ts` supplies pure architectural meshes;
  `coast-scenery.ts` owns canal structures and deterministic coastal animation.
  `coastal-layout.ts` holds shoreline, pier, and canal coordinates for world and
  GPS; `terrain/coast-forms.ts` owns physical landforms and the street plan.
- `game/road-topology.ts` owns enabled local-grid segments. Cedar, Northstar, Copper
  Mesa, Palm Reach, and Solana Coast use compact town lattices and sparse rural spines
  instead of citywide grids.
- `game/world.ts` dispatches from region to district/theme and generates chunks.
- Roads, navigation, movement, fare placement, pedestrians, traffic, streaming,
  and the full GPS use axis-specific or active-region-aware bounds.
- The Regional GPS opens focused on the taxi's current region, supports
  wheel/button zoom, drag and keyboard panning, route/taxi/region focus, and a
  stable all-nine overview derived from the compass slot registry. Reserved
  cells appear as future regions only in overview; local roads and labels enter
  at deterministic detail levels so another activation cannot make the map
  unreadable.
- The original `CHUNK_MIN`, `CHUNK_MAX`, `WORLD_ROAD_LIMIT`, and `WORLD_LIMIT`
  constants are center-region compatibility aliases only.

An inactive compass cell must remain non-driveable even if two active cells
form an L around it. `containingRegionForPosition`, `isPlayablePoint`,
`isActiveBlock`, and `isActiveChunk` are the authority for simulation. A
nearest-region lookup is presentation-only.

## Cedar Vale: East region

Cedar Vale is leafy North American suburbia: winding neighborhood roads,
street-facing homes, separate yards, garages, porches, real gabled roofs,
mature broadleaf trees, mailboxes and parked family cars. Cream, sage, brick
and muted blue tie the buildings together. Connected greens replace the old
checkerboard of tiny housing islands and asphalt.

Cedar Avenue connects the city arrival to a compact civic center and Garden
End. Pine Ridge, Brookside and Garden End have neighborhood loops; Bellwether
Lane, Brookside Greenway and Moonbeam Road serve the destinations. Oak,
Hawthorn and Birch Courts each end in a planted turning circle surrounded by
homes. The 613 parcels have distinct, non-overlapping yards; spaces away from
streets become woodland, gardens and pocket greens. Pedestrians follow the
actual front sidewalks, including curves.

Its five neighborhoods are:

- **Willow Gate** — the denser city transition: rowhomes, duplexes, garden
  apartments, corner flats, and the gateway station.
- **Pine Ridge** — bungalows, ranch houses, mature woodland, and Bellwether
  School.
- **Maple Commons** — the civic heart: common green, library, recreation, local
  shops, and denser family housing.
- **Brookside** — cottage courts, a pool, basketball courts, playing fields, and
  pocket parks.
- **Garden End** — deeper yards, community gardens, the water tower, and the
  Moonbeam Drive-In.

The authored regional anchors are Maple Commons, Bellwether School, Cedar
Branch Library, Brookside Recreation Center, Engine House 9, Garden End Water
Tower, Moonbeam Drive-In, and Cedar Vale Gateway Station. All eight retain their
stable portal IDs and services. Multi-block anchors close internal streets to
form continuous school grounds, commons, library, recreation and drive-in sites.
See [the redesign record](cedar-vale-reimagining.md) for scope and evidence.

## Northstar Range: North region

Northstar Range is a rural mountain destination built around a small tourism
town rather than another urban grid. Its visual language uses pine forest,
granite shelves, meadow and snow colors, cabins, A-frames, farmsteads, a sparse
roadside-services layer, and resort architecture. Five winding authored roads—
Northstar Highway, Pinehook Loop, Mirror Lake Road, Silver Run Switchbacks, and
Spruce Gorge Viaduct—connect its compact village and short service lanes to the
city seam. The highway includes a covered rock gallery; Silver Run makes broad
hairpins around Aurora Lookout and returns around the west side of the resort.

Its five named areas are:

- **Timber Pass** — the city gateway, roadside motel, fuel, general store, and
  scattered homes.
- **Northstar Village** — the compact main-street core, diner, outfitter, town
  square, and Timberline Lodge.
- **Pinehook Woods** — cabins, campgrounds, trails, ranger services, and Old
  Spruce Mill.
- **Mirror Lake** — lakeside homes, forest clearings, fishing lodge, and a
  large impassable water landmark.
- **Silver Run** — chalet country, snowfields, lift infrastructure, resort, and
  the Aurora Lookout.

The nine authored anchors are Northstar Gate, Timber Pass Gas & General,
Northstar Village Square, Timberline Lodge, Pinewatch Ranger Station, Old
Spruce Mill, Mirror Lake, Silver Run Resort, and Aurora Lookout.

Northstar now has physical mountains: a 9-unit triangulated terrain field,
road cuts and embankments, high bridges over the gorge, and buildings on graded
benches. Village ground is z=44, Mirror Lake z=82, the resort z=128, Aurora
Lookout z=157, and the upper gondola station z=221. Road tops add 0.64. Terrain,
tires, walking feet, traffic, collision, camera height, fare approaches, portals,
and both GPS views share those elevations. GPS displays 18 meters per unit.

Mirror Lake drains through an animated spillway into the gorge. An eight-cabin
gondola follows two sagging cables above a cleared snow run between the resort
and an upper station. It is animated scenery, with solid station walls, ceilings,
and pylons; it does not transport the player. Distant ridges use the same physical
height field as nearby mountains, so they remain in place throughout the climb.

## Copper Mesa: South region

Copper Mesa is a Sonoran-inspired desert region with sunbaked sand, adobe cream,
terracotta, red rock, turquoise, saguaro green, and roadside-neon accents. It
combines a compact tourism town with ranch country, trading posts, dry washes,
cactus flats, volcanic cinders, pale salt flats, and striped mesa country.
Seven authored roads—Sundown Highway, Copper Loop, Arroyo Road, Painted Canyon
Scenic Drive, Saguaro Trail, Cinder Cone Loop, and Canyon Rim Road—connect short
service lanes to Neon City's south seam and Palm Reach's west edge.

Its five named areas are:

- **Redrock Gate** — the urban transition, visitor arch, services, auto shops,
  first adobe homes, and roadside motor courts.
- **Copper Junction** — the historic town core, shaded plaza, diner, pottery
  market, civic bell tower, and tourism services.
- **Saguaro Flats** — ranches, trailers, homesteads, trailheads, cactus country,
  and the Dustwind Airpark.
- **Arroyo Vista** — courtyard homes, arts, resort architecture, roadside
  commerce, and the Sunstone solar campus.
- **Painted Canyon** — rodeo country, red-rock shelves, dry washes, sparse
  wilderness, scenic roads, and the regional visitor center.

The ten authored anchors are Sundown Gate, Roadrunner Trading Post, Copper
Junction, Coyote Motor Court, Desert Bloom Resort, Dustwind Airpark, Ocotillo
Arts Center, Sunstone Solar Field, Saguaro Rodeo Grounds, and Painted Canyon.
Multi-block anchors are continuous campuses whose internal grid streets are
removed from pavement, routing, traffic, fares, pedestrians, physics, and GPS.

Copper Mesa uses the same physical 9-unit terrain triangles as Northstar, with
its own road-design heights, capped mesas, scalloped cliffs, cinder cone,
crater, wash, and river canyon. The ten destination terraces range from z=5 at
Sundown Gate to z=74 at the visitor center; Copper Junction is z=24. Road tops
add 0.64. Level road junctions prevent abrupt steps between overlapping curves.
Grades meet z=0 at the city and Palm Reach seams. Southern circuits turn back
through the playable region; distant west/south terrain continues the horizon
without adding playable cells or invisible roads.

Saguaro Trail winds through varied cactus country. Cinder Cone Loop passes
through an open natural rock arch, while Painted Canyon Scenic Drive crosses
the river on rust-red arches and sandstone piers. The river has a shared cut
bed and matching impassable-water collision. Shaded adobe arcades, exposed
timbers, inset windows, neon motor courts, agave, ocotillo, barrel cacti, and
palo verde trees replace the old repeated box scenery. Windmills, an airpark
windsock, three balloons, and small roadrunners animate in both renderers.

Terrain, roads, walking, portals, gas service, fares, traffic, cameras, and both
GPS views share elevation. The full map and minimap display sandstone contour
bands, the river, crater, and altitude. All ten anchor IDs and services remain.

## Palm Reach: Southeast peninsula

Palm Reach is a Miami-inspired peninsula with a late-1980s/early-1990s atmosphere.
The public name changes while the `cypress-reach` region key, `wetland` theme,
ten destination keys, existing venue IDs, and regional rider identities remain
stable. Its 198 chunks include a southward extension and open water. The five
other active regions keep their bounds.

Five districts give the drive a clear sequence:

- **Calle Luna** — the northern gateway, café and record-shop quarter, low
  stucco courtyards, striped awnings, market plaza, and Saint Lumina chapel.
- **Mirage Bay** — the western waterfront, glass and coral condo skyline,
  Channel 86 Studios, waterfront lawns, and folded-roof marine stadium.
- **Ocean Ribbon** — pastel Art Deco hotels, stepped rooflines, rounded
  corners, portholes, concrete window eyebrows, vertical neon, and pool decks.
- **Moonwater Keys** — quiet southern villas, a yacht club with dry piers,
  marina slips, a period motor inn, and open coastal drives beyond the old edge.
- **Sundial Point** — a rounded, tapering cape with palms, white sand, an
  accessible lighthouse campus, and a complete scenic return loop.

Eight authored roads connect the districts: Palm Reach Boulevard, Calle Luna,
Ocean Ribbon, Mirage Bay Causeway, Mirage Bay Drive, Flamingo Parkway,
Moonwater Drive, and Sundial Point Loop. The first four retain their historical
road IDs for traffic compatibility. Compact local grids end before the shore;
there is no perimeter road around the ocean. Lane-offset physics and traffic
queries use the same street eligibility as pavement and GPS.

The north entry meets Cedar Vale at `(1368, 792)`. The west bridge joins Copper
Mesa's existing approach at `(792, 1944)`, bends across Mirage Bay, rises to a
real deck at z=9, and lands on the urban waterfront. Both seams meet z=0.
The rest of the peninsula is low, level land. Identical 4.5-unit shore bands
define dry ground, semantic water, collision, and GPS. Reclaimed abutment,
stadium, and yacht-club ground belong to that same layout. A seven-unit beach
promenade runs continuously down the ocean side toward the cape.

Ten destinations preserve their services: Palm Reach Gateway, Calle Luna
Market, The Mirage Hotel, Mirage Marine Stadium, Flamingo Park, Sundial
Lighthouse, Moonwater Yacht Club, Sun Kiss Motor Inn, Channel 86 Studios, and
Saint Lumina. Tile-owned campuses keep every entrance and outward return pose
dry and clear. Local fare placement reaches the southern extension; fare six
still transfers only to Cedar Vale or Copper Mesa.

Shared animation adds surf, five bay motorboats, seabirds, the lighthouse beam,
and the Channel 86 beacon. Distant shoreline and skyline proxies continue the
actual landform and buildings beyond loaded chunks in both renderers. The 24
regional portraits have matching period art; six new destination cells are
reserved for Palm Reach. See [the design and evidence record](palm-reach-reimagining.md).

## Solana Coast: West region

Solana Coast takes its cues from Los Angeles and Southern California beach
towns. A scalloped turquoise shore meets golden sand, sandstone bluffs, dry
sage hills, and a canyon climb. White stucco, coral, mint, glass, timber,
terracotta roofs, mission arcades, Googie canopies, and sculpted palms give it
a coastal identity. Terrain, pavement, tires, traffic, walking, fare stops,
venues, and GPS share real elevation. The City seam stays exactly flat.

Five named areas give the coast structure:

- **Pacific Strand** — a broad beach, rescue towers, volleyball courts,
  striped umbrella meshes, a palm promenade, and a 288-unit walkable pier with
  a rotating wheel and upright cabins. Surf, sailboats, and birds animate offshore.
- **Solana Village** — Spanish Revival courtyard homes, Art Deco shops,
  surfboard workshops, motor inns, and small skate parks. Three Venice-inspired
  canals have solid water, bridge decks, narrow housing courts, and bank walks.
- **Citrus Heights** — glass-fronted mid-century homes, overhanging roofs,
  butterfly roofs, sage scrub, and level destination terraces above the coast.
- **Mariposa Arts** — the film studio, record shops, surf culture, and an
  outdoor music venue with a single broad shell stage.
- **Sunset Gate** — the city transition, with the welcome arch, fuel stops,
  roadside businesses, and low-rise homes.

Seven roads make a connected coastal circuit: Pacific Coast Drive follows the
beach, Sunset Boulevard links it to the City, Citrus Scenic Loop serves the
heights, and Mariposa Drive crosses the south. Palisades Overlook Drive climbs
the bluff, Laurel Canyon Run winds inland, and Canal Cruise circles the canal
district. A compact town grid and short service streets share topology with
traffic, fares, physics, and GPS. Four existing traffic slots retain their
original road IDs; the total traffic population remains 36.

Ten authored destinations anchor the area: Sunset Gate, Solana Pier, Mission
del Sol, Tidal Aquarium, Pacific Palms Club, Mariposa Pictures, Citrus House,
Breakwater Surf Pavilion, Sunset Bowl, and Coastwatch Rescue. Multi-tile sites
close only their internal grid streets. All sites publish one clear entrance
and outward return position.

The coast has 24 exclusive pickup customers. Their roles include surf coaches,
film crew, artists, marine scientists, mechanics, a nurse, and local shop owners.
Their portraits occupy cells 144–167 on four new sheets. Six destination scenes
occupy cells 24–29 on a separate coastal sheet. Existing destination indices stay
stable in cells 0–23. The shared 48 riders can also appear here. Fare six returns
to Neon City, the coast's only active cardinal neighbor.

Shore geometry stays world-aligned and unscaled. Water tiles meet the shared
shore curve and split around the pier's dry walking deck. Canal bridges have
real undersides and rails, with low water collision below the road. The beach
and promenade have no road lattice or generic curb walkers. Both GPS sizes show
coastal terrain, contours, shore, canals, and pier; the full map reports taxi altitude. Distant
landforms and an ocean horizon keep the loaded region grounded without adding
active chunks. See `solana-coast-reimagining.md` for validation evidence.

## Content and budget contract

Every new theme should provide:

1. A region-local deterministic lot deck with its own RNG salt.
2. At least four visually dominant tile families not reused from another theme.
3. Several quiet tiles, several social/public tiles, and spaced authored anchors.
4. A regional palette and recognizable skyline/roadside motif.
5. Stable place names for HUD, fares, and the full map.
6. Collision, pedestrian, portal, and semantic-water clearance.

Hard live budgets remain independent of total geography because streaming stays
local:

- 760 boxes, 256 colliders, 2,048 surface faces, and 32 interactions per chunk.
- Radius 3 / at most 49 visual chunks.
- Radius 1 / at most 9 collision chunks.
- 37,240 streamed boxes, 1,536 streamed colliders, and 720 streamed interactions.
- 65,536 surface faces per stream, including distant terrain.

New region targets should be lower than the hard caps: approximately 700 boxes
and 105 colliders per chunk, with no more than 12 interactions per chunk on
average. One residence portal per lot is unnecessary; visual doors can outnumber
interactive doors.

## Expansion checklist

Before activating another compass cell:

1. Extend `region-types.ts` and add the active entry/slot mapping in
   `regions.ts`; keep all nine compass identities stable.
2. Define the cell's chunk/road bounds in `config.ts` and update the world
   extent derived from active cells.
3. Add a dedicated theme module for lot selection, builders, portals, anchors,
   semantic water, and pedestrian policy. Extend the model's district/lot
   unions exhaustively rather than growing an untyped global switch.
4. Add its anchors, theme, campus rule, and map-label policy to the exhaustive
   `regional-content.ts` manifest.
5. Add sparse/local roads through `road-topology.ts` and authored corridors
   through `road-layout.ts`; keep routing, pavement, traffic, fares,
   pedestrians, and GPS on those shared authorities.
6. Add its passenger pool, portrait-sheet metadata, fare placement coverage,
   place names, renderer scene policy, and relevant CSS theme styling.
7. Ensure the old region owns shared seam geometry and the new first row/column
   does not double-draw it.
8. Run deterministic chunk, stream, collision, portal, pedestrian, fare, route,
   map, and regional-manifest sweeps across every active region.
9. Preserve center hashes, courier portals, opening-fare behavior, sixth-fare
   cardinal transfers, and inactive-cell containment.
10. Verify Fixed, Chase High, Chase Low, Cab, walking, WebGPU, and Canvas at the
    seam, regional center, landmark cluster, and far edge.

The shared road graph now uses A* for regional routes. Cross-region paths honor
the exact active-cell union and enabled street topology, so Northstar-to-Cedar
trips descend through Neon City instead of cutting across the inactive northeast
cell, while Palm Reach connects only through Cedar Vale and Copper Mesa. The
guaranteed sixth-fare transfer crosses only an active cardinal seam, ranks only
its destination cell, and starts a new region-local six-job market after arrival.
Future expansions must preserve those properties; any global fare fallback
should iterate active-region ranges or a top-k index instead of sorting one giant
rectangular candidate set.
