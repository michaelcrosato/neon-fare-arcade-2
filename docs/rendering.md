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
- navigation: 48;
- ghost/occlusion pass: 96;
- player vehicle meshes: 2,048 faces in a separate dynamic buffer;
- camera uniform: 24 floats / 96 bytes.

The camera uniform is unchanged. WebGPU adds a separate 72-float frame block for
the sun, the cascade matrices and their distances, the camera eye and forward
axis, and the shadow texel size, plus one 96-byte light uniform per cascade at
the 256-byte binding stride.

## Road, terrain, and architectural surfaces

`MeshFace` accepts triangles or quads alongside the unchanged box protocol;
`SurfaceQuad` remains the four-corner road-authoring type.
`game/render/surfaces.ts` packs one or two triangles per face, with 12 floats /
48 bytes per vertex: position xyz/material, normal xyz/face light, and RGBA.
Packing writes the triangle fan directly and normalizes each triangle once,
without temporary index arrays or vector objects. Vertex order and float32
bytes remain unchanged for triangles, nonplanar quads, and reversed winding.
Surface budgets are independent: 2,048 faces per chunk and 65,536 per visual
stream, including distant landscape. The worst-case vertex allocation is
393,216 vertices. Timber, stone, and snow use material IDs 16, 17, and 18;
adobe, cactus, and sandstone use 19, 20, and 21. Desert shaders add plaster
grain, cactus ribs, and sandstone strata to the original procedural geometry.
The WebGPU road pipeline shares the scene's lighting, fog and depth buffer;
static road vertices upload only when the streamed world key changes. Interior
switches clear this buffer. Device loss and disposal release it with the other
GPU resources.

`game/render/detailed-vehicles.ts` caches local polygon models and transforms the
selected car into the shared road/body frame each render. The Accord always uses
the supplied Balanced study (372 triangles), including when Classic is saved;
the Crown keeps its Classic/Detailed choice. Meshes upload to a separate dynamic surface buffer; world keys,
static surface uploads and existing box budgets stay unchanged. The surface
pipeline and its occluded silhouette pass use the same 48-byte vertex layout.
WebGPU, WebGL and the software rasterizer render these exact faces. Cargo and
the on-foot avatar retain their existing box pass; Cab View hides the player car.
Destroying a renderer also releases the dynamic vehicle buffer.

Pavement and lane strips use the same mitered cross sections as tire contact
and traffic. Deck sidewalls, undersides, guardrails and supports are generated
with matching collision geometry. Canvas projects those same surfaces with
depth testing and draws actors/routes on their decks. All renderers use
`game/render/view-projection.ts`: Fixed ISO is orthographic, while the two chase
cameras and Cab View are perspective, including on foot. The Canvas-first
startup and WebGPU first-frame activation remain unchanged. Canvas first tries
WebGL2 on an internal surface, consuming the existing instanced boxes and
surface vertex protocol. Boxes outside the camera frustum are culled before
upload so software WebGL drivers avoid transforming the entire streamed city.
If WebGL is unavailable or its context is lost,
`app/software-scene.ts` clips faces in homogeneous coordinates and rasterizes
their perspective depth using `app/terrain-raster.ts`. The software color/depth
buffer is capped at 360,000 pixels; the HTML HUD stays at native resolution.
Both compatibility paths draw the same world, walking avatar, departing
passengers, navigation glyphs and occlusion silhouettes. Perspective streaming
uses the existing radius-three visual budget regardless of rendering backend.

Cedar's broadleaf crowns, gables and continuous ground use this depth path too.
Its authored pavement includes two-unit outer sidewalk bands; these share the
road contact surface and leave openings at junctions. Flat local streets have
low paving outside the asphalt. A low wooded eastern horizon replaces the
old harbor silhouette when the camera is in Cedar Vale.

Chunk collision capacity is 256 and stream capacity is 1,536; collision radius
remains one chunk. The 121 rebuilt City chunks total 22,386 static boxes and
5,964 colliders. Their maximum radius-three view is 11,354 boxes and 63,056
surface faces including the distant landscape; their maximum collision window
is 510. The exhaustive tests also check every
window across all 924 active regional chunks.

Pocket interiors replace the streamed city buffer instead of appending to it.
Absolute buffer capacity is 512 static boxes, 96 colliders, and 32 interactions;
authored venues target and enforce 128 boxes, 24 colliders, and six interactions.
Door beacons use the actor buffer. The walking avatar shares the taxi's ghost
buffer for its silhouette and final opaque passes; drawing it after the ghost
pass prevents its own rear faces from appearing occluded. Never spend the
48-instance navigation buffer on exploration UI.

## Controlled player avatar

The WebGPU on-foot player is a connected, articulated low-poly figure built
from renderer-neutral boxes. It uses the dedicated `MAT_PLAYER` material;
`MAT_PERSON` is only for ambient citizens because its shader-wide bob would
move every articulated part independently. Animation phase advances from
collision-resolved ground distance, with separate walk/run stride, crouch
compression, airborne tuck, turn lean, and landing recovery. The base figure
uses at least 20 boxes and must fit beside the parked taxi and optional courier
parcel inside the 96-instance ghost budget.

Canvas draws the same limb boxes, costume, stance, gait, jump elevation, and
cargo ownership as WebGPU. Reduced motion and player state match in all paths.

## Navigation glyphs

Red passenger and yellow custom destination beams use material 22 (`MAT_BEACON`). Their far depth
is clamped just inside the existing projection's far plane and their tint
is emissive, without distance fog, in WebGPU, WebGL and software. Side/near
clipping and foreground occlusion remain active. The beam stays anchored to
the destination, extends above the viewer's horizon and keeps a small angular
width at long range; its fourteen panels use the existing actor budget. The
arrival ring retains its original size. World streaming, ordinary draw/fog
distance, collision and pickup/courier markers remain unchanged. A beam still
needs to be inside the selected camera's field of view.
Custom destinations use the same fourteen-panel beam and fourteen-piece ground
ring, independent of GPS route switches. Clearing or reaching a custom pin
removes both. The existing actor capacity also covers this additional marker
alongside waiting fares, traffic, particles, pedestrians and walking interactions.

Every WebGPU camera uses the same canonical turn pieces. Camera mode changes
only the plane pitch. Normal arrows use 16 boxes, with up to 13 additional boxes
for the temporary vehicle direction arrow (total budget: 48 instances). U-turn
plans show only that temporary vehicle arrow, without a separate hairpin or badge.

Canvas consumes these same pieces and their pitch transforms through its 3D
projection. It must not select a different symbol by rendering backend.

Mobile distance badges use `navigationDistanceBadge` and the shared `viewProjection`
through one HTML presenter in `app/runtime/navigation-distance.ts`. Text stays
crisp in every backend without spending navigation instances. Badge position
follows the arrow's actual elevation and uses the same reduced-motion clock.
`road-lanes.ts` resolves route dashes onto the right traffic lane and samples
its physical height and normal; the canonical route is never modified.

Navigation Lab can extrude every enabled route's dashes into translucent vertical
columns matching its RGB color (including yellow custom GPS routes).
Their 2.8 × 0.48 XY footprint and lane placement remain identical to the ground
dots, with zero pitch/tilt so columns rise vertically even on grades. The column
base uses the actual dash elevation. Off-route guidance uses `NavigationPlan.roadRoute`,
the retained road path without the moving cab connector. Ground dots and columns
share the existing 120-instance route budget (60 each when combined); no actor,
navigation, streamed-world or packing capacity changes. All backends consume the
same boxes through their existing translucent actor pass. Arrow visibility and
heading are resolved once by the controller and shared by every backend.
Cab View uses a smaller arrow eight units ahead of the taxi so even a reverse
bearing remains ahead of the near plane and above the driving view on phones.

The brief red tow truck uses the actor buffer and renderer-neutral geometry in
`render/tow-truck.ts`. Its bounded departure path follows physical roads. The
receipt uses the same semantic charge in the HTML HUD and respects reduced
motion. Neither effect changes the instance protocol or collision budgets.

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

Mobile driving uses the same composition in every renderer. Chase High and
Chase Low place the cab body at 75% of the screen height by solving camera pitch
from the actual collision-shortened boom and field of view, including all four
distance settings and boost zoom. The raised mobile eye preserves the usual
road horizon and stays on the collision ray. The sky consumes that same pitch. Fixed ISO
shifts its eye and target toward the projected cab heading, scaled to the zoom
and viewport aspect ratio, leaving a quarter-screen trailing margin. Desktop,
Cab View, and walking retain their existing composition.

Camera matrices and collision-shortened boom are in `game/render/camera.ts`.
`game/render/horizon.ts` selects distant scenery by casting world bearings from
the current region into the actual registered regional rectangles. The nearest
visible neighboring region supplies its theme; taller distant ridges and the
City skyline can rise behind a lower intervening region. Palm Reach's extended bounds
are respected: Copper Mesa lies west of its northern half, while its southern
cape looks across open water. Reserved cells remain inactive; their backdrops
are alpine wilderness, wooded headlands/foothills, countryside, canyon badlands
or ocean according to their position in the world.

`app/horizon-panorama.ts` paints a continuous 360-degree illustration: layered
ridges, snow caps, tree lines, modest regional silhouettes and open sea. Filled
land/water extends below the horizon with no disconnected angular masks. Its
periodic color/profile joins and repeated horizontal texture sampling close the
west-facing seam. Each renderer keeps 16 MiB of canvas artwork and 16 MiB of GPU
textures; the software path uses pixel copies in place of GPU textures.
Art updates at 64-unit vantage intervals and on every
region change, with a 0.4-second crossfade; reduced motion switches directly.

WebGPU, Canvas/WebGL and software Canvas use this same illustration and
`game/render/horizon-view.ts` ray basis. The basis comes from the actual view
matrix, so it tracks road pitch, cabin roll, walking and mobile framing. Sun and
clouds retain their compass bearings between regions. Fixed ISO keeps its
overhead gradient, where no distant horizon is visible. Software sky projection
is limited to 160,000 pixels and reused while its view and artwork are unchanged.
Real 3D terrain, distant proxies and buildings draw afterward and occlude the
background. Painted silhouettes express regional identity without duplicating
named landmarks or adding physical geometry, roads or active chunks.

See [the horizon review and evidence record](regional-horizons.md).

Saved camera mode remains unchanged when entering or leaving the taxi. On foot,
Chase High and Chase Low select their closer pedestrian presets and Fixed uses
a modest zoom. Cab View becomes first person and follows jump elevation,
crouch stance, gait, and landing recovery; chase cameras receive only a partial
vertical lift. Camera boom collision uses the same height offset at both ray
endpoints. Reduced motion suppresses cosmetic bob and landing displacement.

While driving, Cab View retains the seated first-person eye on the driver's
side and shows only the outside world and normal HUD. No renderer draws a
cockpit, hood, windshield frame, steering wheel or mirror, and HTML supplies
no cabin frame or duplicate instruments. This applies to all three vehicles,
driving models and graphics quality settings on desktop and mobile. Fare
cards reserve space for the navigation arrow, without an imaginary dashboard.

The simulation Crown cab's sprung pitch and total roll angle are shared scene
state. Exterior box centers rotate around one grounded longitudinal
pivot, not independently in place. WebGPU orientation accepts the full
side-to-roof range; Canvas projects the same rotated centers and collapsed
footprint. Normal cornering remains a small suspension lean, while a tripped
roll visibly carries the complete body, wheels and roof sign onto its
side or roof. In Cab View, all renderers keep the first-person eye and up vector
attached to the rolling vehicle, without drawing the cabin.
Loaded courier cargo stays attached to the taxi body while driving or walking
outside it.

## Streaming and fog

Scene surfaces have hard pixel budgets: the WebGPU tier budget above, and 1.8
million pixels for Canvas. `render/resolution.ts` may choose a scale below one on
large displays. WebGPU also respects the device's maximum texture dimension. The
HTML HUD keeps its native resolution. These limits bound surface size, not FPS.

## WebGPU frame structure

Passes in submission order: one depth-only pass per shadow cascade; the scene
pass (panorama, streamed boxes, road and landscape surfaces, opaque actors,
navigation and ghost silhouettes, vehicle mesh, translucent actors) into a
multisampled `rgba16float` target that resolves to a sampled scene texture;
ambient occlusion at half resolution; the bloom pyramid; and the composite.

Every scene pipeline shares one explicit bind group layout and therefore one
bind group. The box pipelines cull back faces: `abs()` on the instance scale
makes every cuboid's winding identical, and both shared projections mirror X, so
outward faces arrive clockwise. Road, terrain and vehicle faces are authored
without a winding rule and stay double sided.

Bloom is a prefilter with a soft-knee threshold, a thirteen-tap downsample
chain over the mip levels of one texture, and an additively blended nine-tap
tent upsample. Ambient occlusion rebuilds view positions from the depth buffer
and normals from the nearest depth neighbours, then uses the Alchemy estimator:
a plain depth-difference test darkens every receding ground plane instead of
only its creases. The composite applies exposure, bloom, occlusion, a filmic
shoulder, saturation/contrast, the vignette and a triangular-PDF dither.

Instance streams are packed into reusable scratch arrays through
`packBoxesInto`; the WebGL fallback caches its uniform locations and grows its
buffer stores instead of reallocating them each frame. When `timestamp-query` is
available the renderer reports median shadow/scene/composite times through
`window.__renderStats()`, which `scripts/render-bench.mjs` collects.

## Quality tiers and adaptive resolution

`game/render/quality.ts` is the authoritative tier policy. `resolveRenderTier`
reads only what a browser reliably reports — the mobile breakpoint, the adapter
vendor/architecture when Chrome does not mask it, `hardwareConcurrency` and
`deviceMemory` — and `renderQuality` turns a tier into the effect budget:

| tier | pixels | MSAA | cascades | map | taps | bloom | AO |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `ultra` (discrete desktop GPU) | 4.2M | 4x | 3 | 2048 | 9 | 5 | yes |
| `balanced` (masked/integrated desktop) | 2.5M | 4x | 2 | 2048 | 4 | 4 | no |
| `high` (2025 flagship phone) | 2.5M | 4x | 2 | 1024 | 4 | 4 | no |
| `compatibility` | 2.0M | off | 0 | — | — | 0 | no |

Multisampling stays on for `high` because a tile-based mobile GPU resolves it
inside tile memory; the scene pass uses `storeOp: "discard"` with a
`resolveTarget` so the multisampled surface never reaches memory.

Players override the detected tier in Options → Graphics Engine, and
`?graphics=<tier>` forces one for a single session without changing the saved
preference. `adaptResolution` lowers the scene scale to `MIN_RESOLUTION_SCALE`
only after two consecutive slow one-second windows and restores it after six
fast ones, so a chunk stream or a modal cannot visibly resize the scene.

## Lighting and ground shadows

`game/render/sun.ts` owns the single sun direction every backend shades with,
and builds the cascaded shadow matrices. Each cascade bounds its slice of the
camera frustum with a sphere rather than a corner box, so turning cannot resize
the covered area, and its light-space origin is snapped to whole shadow texels
so moving cannot make shadow edges crawl. `viewProjection` accepts a near-plane
override purely so a cascade can slice the real camera; every renderer still
draws with the default near plane.

The cascade pass is depth-only and renders the streamed city boxes, opaque
actors and the ghost buffer — the taxi and the avatar therefore cast. It culls
front faces so the stored depth sits behind the lit surface, which removes
shadow acne without a large bias. Only `ultra` also casts from road, terrain and
vehicle surfaces. Receivers apply the cascade before colour quantization, so the
posterized bands stay crisp, and emissive materials (windows, lamps, markers,
route dots, turn arrows, signs and beacons) are never darkened. When cascades
are active the WebGPU renderer drops the painted `taxiGroundShadow` decal, since
the real shadow already darkens that ground; Canvas keeps it.

`render/lighting.ts` supplies Canvas's warm direct/cool ambient light and short
world-space shadow offset, aligned with the shared WebGPU sun direction.
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

The shared road pose transforms the complete taxi, wheels, loaded
cargo and boost trail. Arcade body load transfer composes with road pitch/bank;
the simulation cab retains its existing rollover model. Cab View follows that
same deck immediately and retains its 1.72-unit seated eye height.
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
Palm Reach uses matching 4.5-unit near-shore bands and coarser distant bands,
with horizon water outside the active union. Cached distant condo and landmark
proxies are derived from the real building builders and omitted when their
owning chunks load. The same shared scene supplies surf, bay boats, seabirds,
and lighthouse/radio beacons. Marine haze replaces painted southeast scenery;
it never adds visual mountains or bridges unrelated to the physical world.
These faces and actors remain inside the existing surface/actor budgets.

Neon City uses six-unit near terrain. Exactly coplanar twelve- or thirty-six-unit
patches merge without changing physical height. Its distant terrain uses
thirty-six-unit quads with fine fan edges wherever a loaded chunk meets the
distant mesh. Cached skyline proxies preserve the position and elevation of
actual buildings and roofs, and disappear when their owning chunks load. Both
GPS views use the same terrain for City shading and four-unit contours.

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
- bridge approach ascent/descent, deck and the water beneath it in all four
  cameras and both renderers; confirm the first-person camera follows the road pose;
- simulation cab at normal roll, two-wheel lift, settled on either side, and on
  its roof in Chase High, Chase Low, Cab, and Canvas views;
- exit/re-enter in every saved taxi camera, preserving the exterior view during
  walking; Cab becomes first-person on foot without hiding the parked taxi;
- standing, walking, running, crouching, jumping, and landing avatar states in
  WebGPU and Canvas, including Cab View eye height and a nearby boom collider;
- street vendors in a dense market/commercial block and a sparse residential
  block, including collision and pedestrian clearance;
- Palm Reach's bay crossing, Deco hotel strip, yacht club, continuous beach
  walk, lighthouse approach and southern loop in every camera and both renderers,
  plus full and compact GPS at desktop/mobile sizes;
- Neon City's starting core, Starfall domes, Ink Quarter, Redline rollers, Titan
  rise, university, commons, skyline gardens, harbor and stadium in every camera
  and both renderers, plus mobile views and full/compact terrain GPS;
- enter/exit an interior, verify the city does not leak into it, then confirm
  the same parked taxi and exterior scene return.
