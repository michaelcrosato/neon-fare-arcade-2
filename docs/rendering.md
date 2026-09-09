# Rendering contracts

## Instance protocol

`game/render/packing.ts` is the authoritative CPU/GPU layout. Every box occupies
16 float32 values (64 bytes):

```text
0..3   world position xyz, material
4..7   scale xyz, yaw
8..11  RGBA tint
12..15 pitch, tilt, reserved, reserved
```

The WebGPU vertex buffer declarations consume the named byte offsets exported
by `packing.ts`. WGSL locations must still match those fields exactly. Material
IDs remain integers; pitch and tilt are separate local-X/local-Y transform
attributes.

Hard budgets:

- streamed city: 37,240 instances;
- actors: 2,048;
- navigation: 32;
- ghost/occlusion pass: 96;
- camera uniform: 24 floats / 96 bytes.

## Road, terrain, and architectural surfaces

`MeshFace` accepts triangles or quads alongside the unchanged box protocol;
`SurfaceQuad` remains the four-corner road-authoring type.
`game/render/surfaces.ts` packs one or two triangles per face, with 12 floats /
48 bytes per vertex: position xyz/material, normal xyz/face light, and RGBA.
Surface budgets are independent: 2,048 faces per chunk and 65,536 per visual
stream, including distant landscape. The worst-case vertex allocation is
393,216 vertices. Timber, stone, and snow use material IDs 16, 17, and 18;
adobe, cactus, and sandstone use 19, 20, and 21. Desert shaders add plaster
grain, cactus ribs, and sandstone strata to the original procedural geometry.
The WebGPU road pipeline shares the scene's lighting, fog and depth buffer;
static road vertices upload only when the streamed world key changes. Interior
switches clear this buffer. Device loss and disposal release it with the other
GPU resources.

Pavement and lane strips use the same mitered cross sections as tire contact
and traffic. Deck sidewalls, undersides, guardrails and supports are generated
with matching collision geometry. Canvas projects those same surfaces, culls
back faces, and draws actors/routes on their decks. Northstar, Copper, and Solana Coast use
full cuboid faces and `app/terrain-raster.ts` for per-pixel orthographic depth
across terrain, structures, animated scenery, and the taxi. Intersecting faces
resolve by pixel depth instead of a face's average depth, so large ground
triangles cannot paint over nearer roads or vehicles. The reusable color/depth
buffer is capped at 1.2 million pixels and scales back to the Canvas surface.
It remains an overhead graphic fallback. An outline preserves taxi visibility
under an elevated road.

Chunk collision capacity is 256 and stream capacity is 1,536; collision radius
remains one chunk. The 121 central city chunks currently total 71,092 static
boxes and 8,581 colliders. Their maximum radius-three view is 30,457 boxes;
their maximum collision window is 888. The exhaustive tests also check every
window across all 726 active regional chunks.

Pocket interiors replace the streamed city buffer instead of appending to it.
Absolute buffer capacity is 512 static boxes, 96 colliders, and 32 interactions;
authored venues target and enforce 128 boxes, 24 colliders, and six interactions.
Door beacons use the actor buffer. The walking avatar shares the taxi's ghost
buffer for its silhouette and final opaque passes; drawing it after the ghost
pass prevents its own rear faces from appearing occluded. Never spend the
32-instance navigation buffer on exploration UI.

## Controlled player avatar

The WebGPU on-foot player is a connected, articulated low-poly figure built
from renderer-neutral boxes. It uses the dedicated `MAT_PLAYER` material;
`MAT_PERSON` is only for ambient citizens because its shader-wide bob would
move every articulated part independently. Animation phase advances from
collision-resolved ground distance, with separate walk/run stride, crouch
compression, airborne tuck, turn lean, and landing recovery. The base figure
uses at least 20 boxes and must fit beside the parked taxi and optional courier
parcel inside the 96-instance ghost budget.

Canvas draws the same costume, proportions, stance, gait, jump elevation, and
cargo ownership as a dedicated outlined comic silhouette. It need not project
every limb box, but reduced motion and player state must match WebGPU.

## Navigation glyphs

Every WebGPU camera uses the same canonical turn or U-turn pieces. Camera mode
changes only the plane pitch. Normal arrows use 16 boxes and U-turns use 30, so
new decorative pieces require budget review.

The Canvas fallback draws an equivalent 2D path because its projector does not
support the WebGPU box pitch transform. It must not select a different symbol by
camera mode.

## Landmark campuses

Featured landmarks are composed from the same renderer-neutral box protocol as
the rest of the city. Their identity must survive both perspective WebGPU and
top-down Canvas through footprint, height, palette, and sign silhouettes rather
than shader-only detail. A multi-block campus generates each module inside its
own block/chunk; no box or collider may be owned by a distant anchor chunk.
Grid-interrupting flagships extend their tile-owned ground to the former street
seam, and their map lines expose the same gaps as the driveable road graph.
Inspect campuses that cross chunk seams from fixed, chase, cab, and Canvas
views, and keep the full-map footprint labels legible beneath active routes.

## Camera and sky

Camera matrices, collision-shortened boom, and perspective sky pitch are in
`game/render/camera.ts`. The sky is a compass/world-relative panorama:

- north: mountains, pines, radio landmark;
- east: water, bridge, lighthouse, and the sun sector;
- southeast: blackwater, cypress crowns, lock tower, and lantern;
- south: industrial terminal;
- west: downtown skyline.

Sun, clouds, and horizon motifs are fixed to bearings rather than screen UVs.
Turning away must move them off screen. Real 3D buildings render after the sky
and naturally occlude it.

Saved camera mode remains unchanged when entering or leaving the taxi. On foot,
Chase High and Chase Low select their closer pedestrian presets and Fixed uses
a modest zoom. Cab View becomes first person and follows jump elevation,
crouch stance, gait, and landing recovery; chase cameras receive only a partial
vertical lift. Camera boom collision uses the same height offset at both ray
endpoints. Reduced motion suppresses cosmetic bob and landing displacement.

While driving, Cab View places the eye on the left side of the cabin and draws
a renderer-neutral 3D cockpit: dashboard, windshield frame, hood, gauge pod,
mirror, door tops, and an articulated box-built steering wheel. WebGPU renders
those pieces in world/cab space. Canvas draws a purpose-built 2D cockpit
fallback with the same framing instead of pretending its top-down box projector
is three-dimensional. The compact HTML instrument readout is telemetry only;
it must not replace or obscure the rendered cockpit.

The simulation Crown cab's sprung pitch and total roll angle are shared scene
state. Exterior and cockpit box centers rotate around one grounded longitudinal
pivot, not independently in place. WebGPU orientation accepts the full
side-to-roof range; Canvas projects the same rotated centers and collapsed
footprint. Normal cornering remains a small suspension lean, while a tripped
roll visibly carries the complete body, wheels, roof sign, and cockpit onto its
side or roof. In Cab view, the WebGPU eye and up vector remain fixed to that
rolling cockpit; Canvas rotates its cabin projection and HTML frame together.
Loaded courier cargo stays attached to the taxi body while driving or walking
outside it.

## Streaming and fog

Scene surfaces have hard pixel budgets: 2.5 million pixels for WebGPU and 1.8
million for Canvas. `render/resolution.ts` may choose a scale below one on large
displays. WebGPU also respects the device's maximum texture dimension. The
HTML HUD keeps its native resolution. These limits bound surface size, not FPS.

## Lighting and ground shadows

`render/lighting.ts` supplies Canvas's warm direct/cool ambient light and short
world-space shadow offset, aligned with the existing WebGPU sun direction.
Canvas uses light bands on building edges and two-layer elliptical contact
shadows for cars, foliage, and nearby citizens. Sky and vignette gradients are
created on resize, not each frame. Emissive signs and navigation retain their
authored colors. This remains a graphic overhead fallback, not perspective 3D.

`taxiGroundShadow` is flat ground geometry independent of body roll and pitch.
`taxiBoxes(game, { includeGroundShadow: false })` is the body-only model. WebGPU puts
the taxi shadow in the normal depth-tested actor pass, outside the ghost
silhouette. Canvas uses the same ground footprint for its elliptical shadow.
No new shadow texture, material ID, instance field, or render pass is required.
These are contact approximations, not scene-wide cast shadows; raised surfaces
can still hide the ground plane in WebGPU.

The shared road pose transforms the complete taxi, cockpit, wheels, loaded
cargo and boost trail. Arcade body load transfer composes with road pitch/bank;
the simulation cab retains its existing rollover model. Cab View follows that
same deck immediately and uses a 1.72-unit seated eye to clear the dashboard.
Chase and fixed cameras follow elevation with smoothing. Contact shadows remain
on the supporting deck while an airborne taxi rises above them.

## World streaming

Perspective views draw visual chunks out to radius 3 and keep collision chunks
at radius 1. The normal far plane is 400. Northstar, Copper, and Solana Coast add cached
36-unit distant terrain patches and road strips beyond the loaded chunks,
reaching a 1,200-unit far plane. Chunk borders retain 9-unit vertices to meet
near terrain without cracks. Near terrain has 256 faces per chunk. Copper
also continues its west/south horizon with a render-only terrain skirt; those
patches count toward the surface budget and never expand the playable union.
The same final terrain supplies GPS contours, and painted background geography
is suppressed inside these elevated regions. Solana continues the ocean beyond
the active coast and keeps the wheel's frame and moving cabins visible together.
Increasing draw distance requires checking:

1. `DISTANT_STREAM_RADIUS` and `CACHE_RADIUS` together;
2. `MAX_STREAM_BOXES` and the world budget tests;
3. city buffer allocation and actual GPU frame time;
4. fog end distance and background composition;
5. collision radius remains unchanged unless gameplay deliberately changes.

Ambient citizens are renderer-neutral two-box actors. Ordinary populated lots
emit six walkers across two lanes of the widened perimeter sidewalk; WebGPU and
Canvas consume the same positions and colors.

Street-commerce scenes are also renderer-neutral static boxes. Their chunky
silhouettes, layered signs, service windows, canopies, vendors, and customers
must remain readable in Canvas without relying only on height or shader glow.
Generation is capped at two ten-box scenes per chunk.

## Required visual checks

- all four camera modes while the same turn cue is active;
- both left and right arrows, plus U-turn;
- camera boom compressed by a nearby building;
- north/east/south/west sky bearings;
- taxi ghosting behind buildings;
- Canvas fallback after disabling or rejecting WebGPU.
- ramp ascent/descent, beltway deck and the street beneath it in all four
  cameras and both renderers; confirm cockpit and camera share the road pose;
- simulation cab at normal roll, two-wheel lift, settled on either side, and on
  its roof in Chase High, Chase Low, Cab, and Canvas views;
- exit/re-enter in every saved taxi camera, preserving the exterior view during
  walking; Cab becomes first-person on foot without hiding the parked taxi;
- standing, walking, running, crouching, jumping, and landing avatar states in
  WebGPU and Canvas, including Cab View eye height and a nearby boom collider;
- street vendors in a dense market/commercial block and a sparse residential
  block, including collision and pedestrian clearance;
- enter/exit an interior, verify the city does not leak into it, then confirm
  the same parked taxi and exterior scene return.
