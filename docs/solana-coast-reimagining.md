# Solana Coast reimagining

Status: implemented and locally verified, September 8, 2026.

## Intent

Reinvent the existing west region as a varied, inviting Southern California
coastal drive. Keep the game's graphic low-poly style while replacing the flat
landscape and repeated blocks with physical bluffs, canyon bends, beach-town
streets, hillside architecture, and a memorable waterfront. This is an original
fictional region inspired by Los Angeles and its coast.

## Design and implementation scope

- Real coastal terrain: low beach, eroded sandstone bluffs, dry sage-covered
  hills, a canyon approach, and level terraces for destinations and local homes.
  Road pavement, tires, walking, traffic, fares, venues, and GPS share elevation.
- Seven connected scenic roads. Preserve Pacific Coast Drive, Sunset Boulevard,
  Citrus Scenic Loop, and Mariposa Drive; add Palisades Overlook Drive, Laurel
  Canyon Run, and Canal Cruise. Replace unnecessary outer grids with short
  service streets, an inviting town, and complete loops with no cliff-end roads.
- A gently scalloped continuous shore, visible ocean horizon, wave bands,
  lifeguard towers, beach umbrellas, and an extended walkable Solana Pier with
  an animated wheel. Water and solid supports have matching collision.
- A Venice-inspired canal pocket with low bridges, bank paths, gardens, and
  bungalow courts. The channels appear in both GPS views and remain solid water.
- Distinct architecture: sculpted palms, bougainvillea, sage scrub, cypress,
  terracotta mission roofs and arcades, glass-and-timber hillside houses,
  curved Art Deco shopfronts, Googie roadside roofs, and a shell at Sunset Bowl.
  Rework all ten established destinations while preserving their identity and
  services. The pier's entrance remains at its established coordinates.
- Original deterministic ambient geometry: rotating wheel/cabins, ocean surf,
  small sailboats and shore birds. No new gameplay dependency or external assets.
- Coastal colors, contour bands, shoreline, canals, and altitude on GPS;
  grounded vistas in all four cameras, on foot, in WebGPU and Canvas.

The active footprint remains 726 chunks; NW and SW stay reserved. Preserve the
Neon City seam and golden counts, all existing region regressions, six fare
slots, passenger/art indices, active-cardinal transfers, and hard stream limits.

## Visual references

- [Santa Monica: Palisades Park](https://www.santamonica.gov/places/parks/palisades-park)
  informs the ocean-facing park, bluff, paths, palms, and overlook sequence.
- [LA Conservancy: Johnie's Coffee Shop](https://www.laconservancy.org/learn/historic-places/johnies-coffee-shop/)
  informs the expressive sloping roof, glass frontage, and roadside signs.
- [LA City Planning: Venice historic districts](https://planning.lacity.gov/odocument/e9a0a639-c26c-47bf-8cb4-2f5992093d88/Venice_Districts.pdf)
  informs the intimate canal-oriented housing and paths.
- [NPS: Coastal Sage Scrub](https://www.nps.gov/samo/learn/nature/coastalsagescrub.htm)
  informs the gray-green low scrub and dry coastal slopes.

## Verification evidence

- Ordinary digital controls complete all seven roads in both directions with
  Arcade and Simulation: **28 complete journeys**, zero scenery collisions and
  zero airborne frames at the tested 8–10-unit speeds. Both lanes also pass
  dense tire-support, buried-pavement, and scenery-clearance sampling. Every
  compiled road retains continuous lane joins.
- Elevated-road regressions add **56 prescribed lane sweeps** at 35 and 70 world
  units/s across all seven roads, both directions and both driving models.
  Ordinary controls also cover Sunset's arrival climb and both side-street
  crossings in both directions. Rising airborne landings catch the pavement,
  while real crests, underpasses and all eight beltway ramps retain their rules.
  Clearance sampling now includes every elevated Coast grid street at one-unit
  intervals in both lanes.
- All ten venues enter and return on their actual ground. Elevated fuel stops
  sell an upgrade with a taxi in the near lane and reject a taxi below the
  station. Six coastal fares complete pickup and drop-off at safe approaches;
  the local cast/art ranges and City-only sixth-fare transfer remain intact.
  Recycled traffic stays on the physical roads; town and canal walkers stay clear.
- The full 288-unit pier supports an ordinary walk in both directions beneath
  the wheel. Three canals have real excavated beds, solid water, and nine grid
  crossings with bridge decks; curved crossings use the shared road structures.
  Wheel cabins, surf, sailboats, and birds animate deterministically.
- The exact City seam stays z=0. Regional GPS reaches the beginning, middle,
  and end of each coastal drive, including very short terrain-cut spans. A
  routing bug that discarded distinct nodes less than 0.05 units apart is
  fixed without inventing a connection between different elevated decks.
- Solana's 121 chunks total **14,478 boxes, 99,576 faces, 5,485 colliders, and
  173 interactions**. Per-chunk maxima are **397 / 1,334 / 237 / 10**. Maximum
  coastal-centered radius-three streams use **15,767 boxes, 60,559 faces
  including far landscape, 1,132 colliders, and 354 interactions**, within all
  existing limits. Coastal ambient scenery peaks at 284 boxes in this sweep,
  including the full wheel frame so it stays visible with its moving cabins.
- Live Free Run smoke: opened **W · COAST**, tapped Pacific Coast Drive, and
  committed a custom route from Neon City along Sunset Boulevard to the beach.
  Browser error collection remained empty. Local server: `http://127.0.0.1:4173`.

- `npm run check` passes: lint, strict types, nine architecture checks, ten
  runtime tests, **342 deterministic game tests**, production build, artifact
  validation, and rendered HTML. City golden counts and all region/stream
  regressions remain green.
- The complete **34-test browser suite** passes locally. It includes 160 coastal
  scene captures across all four cameras,
  WebGPU/Canvas, desktop/mobile, plus both GPS views. The review corrected pier
  and bridge surface overlap, an aquarium approach plaza, and avatar hatching.
  Desktop coastal captures run in bounded tours per renderer to avoid
  timing out when software rendering competes with the full game suite.
  The live WebGPU smoke test allows
  longer startup on software-rendered CI while still requiring the real playing
  UI and checking every camera, walking, and browser errors.
- The [Quality workflow](https://github.com/michaelcrosato/neon-fare-arcade-2/actions/workflows/quality.yml)
  repeats the full checks on Ubuntu and retains browser artifacts for seven days.

## Implementation notes

Keep pure coastal landform and street data below road compilation; never import
the final terrain or network from a theme/asset module reachable through the
regional campus registry. Renderer fixtures use the isolated scene page so the
animated main menu does not compete with software WebGPU capture in CI.

GPS retains the game's parked-taxi navigation contract while the separate
walker marker tracks an on-foot player. At Citrus House's 72-unit terrace,
the parked taxi's 72.64-unit road height displays as 1,308 m. These are the
game's display units, not a claim about a real Los Angeles location.

The pier's timber deck provides flat foot support at z=0.64 while the seabed
remains below water, avoiding sand ramps outside its edges. Canal bridge slabs
sit just below their asphalt surfaces. The aquarium terrace includes both sides
of its approach street so neighboring plazas cannot float across the camera.
WebGPU draws the walking avatar after its occlusion silhouette, like the taxi,
so the avatar's own rear faces no longer produce false yellow hatching.

Sunset's arrival terrace extends across the full junction apron. The north/south
streets at x=-936 and x=-900 now meet the boulevard's grade instead of descending
into its deck edge. Vehicle landings sweep the complete 3D foot trajectory
against the pavement triangles; testing only the previous height at the new XY
could miss a rising slope, sink through it and then hit the solid underside.
Support selection also retains the followed ribbon through nearly parallel
overlaps, while a turn can transfer onto a climbing road.
