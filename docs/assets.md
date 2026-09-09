# Fare art assets

`assets/fare-art-manifest.json` is the machine-readable authority for fare-card
atlases. It records each physical file, global cell range, ordered rider IDs,
pickup region, and SHA-256 content hash.

Every atlas is 1536×1024: three columns by two rows of 512×512 cells. Passenger
cell indices are global across all sheets; destination indices use their own
independent range. Do not infer either count from the six active fare slots.

The original images predate the manifest. Their original generation prompts and
license record were not preserved, so the manifest reports those fields as
unknown rather than inventing provenance. Any newly generated or replaced art
must record its tool/source, prompt or source reference, usage rights, and new
hash in the same change.

The fare-asset test rejects missing files, reordered riders, incorrect cell
ranges, wrong dimensions, and content that no longer matches the manifest.

Solana Coast adds passenger sheets 25–28 (cells 144–167) and destination sheet 5
(cells 24–29). Their generation prompts, source tool, project-use record, and
format-conversion settings are in `assets/solana-coast-art-prompts.json`. No
resize or crop was applied. Each new manifest entry points to that record.

Palm Reach refreshes passenger sheets 21–24 (cells 120–143), preserving every
rider identity and cell order, and adds destination sheet 6 (cells 30–35).
`assets/palm-reach-art-prompts.json` records all five exact image-generation
prompts, source/reference details, project-use record, conversion, and hashes.
The 1536×1024 sheets were converted to WebP without resizing or cropping.

## Fonts

The engine rebuild originally retained the fare atlases. The eleven cached
WOFF2 font files are also copied byte-for-byte to `public/fonts/`. Face names,
weights and Unicode ranges remain in `app/fonts.css`; the existing Barlow
Condensed package remains the display face. This removes generated font URLs
from browser startup without requiring an external font request.

## Northstar procedural assets

The reimagined Northstar adds original geometry authored in this repository;
no external raster images, models, or textures were downloaded or generated.
`game/architecture.ts` supplies gabled/A-frame roofs, tapered conifer crowns,
faceted boulders, and the twelve-sided observatory dome. `game/mountain.ts`
assembles timber buildings, warm windows, stone foundations, forest/snow lots,
and the nine retained landmarks. `game/mountain-scenery.ts` adds two gondola
stations, five supports, twin cables, eight animated cabins, a waterfall, and
water collision. Road modules add a covered gallery, retaining faces, bridge
ribs, piers, and rails. All geometry is seeded or authored deterministically;
only renderer-neutral cabin and foam actors change with simulation time.

## Solana Coast procedural assets

The coastal reinvention uses original geometry authored in this repository,
with no external model, texture, or raster downloads. `game/coast-assets.ts`
builds tapered leaning palms and drooping fronds, sage, cypress, mission arcades
and roofs, butterfly-roof glass houses, beveled Deco buildings, Googie canopies,
striped umbrella meshes, the aquarium vault, and the Sunset Bowl shell.
`game/coast-scenery.ts` builds canal banks and bridges, the pier wheel frame,
and deterministic wheel cabins, surf bands, sailboats, and birds. These use the
existing renderer-neutral box/mesh protocol and material IDs. The coastline,
canals, and pier share authored dimensions with collision, terrain, and GPS.
The procedural coastal geometry uses no raster textures; its separate fare
+atlases and their provenance are recorded above.
