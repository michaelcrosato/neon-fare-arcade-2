import type { Box, MeshFace, WorldView } from "@/game/model";
import { boxSurfaceFaces } from "@/game/render/surfaces";
import { litSurfaceColor } from "@/game/render/lighting";
import { clipPolygon, clipVertex, sphereInView } from "@/game/render/clip";
import { TerrainRaster } from "./terrain-raster";
import type { CompatibilityScene } from "./compatibility-scene";

/** A real perspective/depth renderer even when every graphics API is disabled. */
export class SoftwareScene {
  private raster = new TerrainRaster();
  private faces = new WeakMap<Box, MeshFace[]>();

  render(matrix: Float32Array, width: number, height: number, world: WorldView, scene: CompatibilityScene) {
    this.raster.begin(width, height);
    const face = (surface: MeshFace, ghost = false) => {
      const clipped = clipPolygon(surface.corners.map(p => clipVertex(matrix, p)));
      if (clipped.length < 3) return;
      const [a, b, c] = surface.corners;
      const nx = (b.y - a.y) * (c.z - a.z) - (b.z - a.z) * (c.y - a.y);
      const ny = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);
      const nz = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      const length = Math.hypot(nx, ny, nz) || 1;
      const color = ghost ? [0.05, 0.9, 0.95, 0.28] as const : litSurfaceColor(surface.color, nx / length, ny / length, nz / length);
      const projected = clipped.map(v => ({ x: (v.x / v.w + 1) * width / 2,
        y: (1 - v.y / v.w) * height / 2, depth: 1 - v.z / v.w }));
      for (let i = 1; i < projected.length - 1; i++) {
        const a = projected[0], b = projected[i], c = projected[i + 1];
        const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
        this.raster.triangle(a, area < 0 ? c : b, area < 0 ? b : c, color, ghost);
      }
    };
    const box = (box: Box, ghost = false) => {
      if (!sphereInView(matrix, box.x, box.y, box.z, Math.hypot(box.sx, box.sy, box.sz) / 2)) return;
      let faces = this.faces.get(box);
      if (!faces) { faces = boxSurfaceFaces(box); this.faces.set(box, faces); }
      for (const surface of faces) face(surface, ghost);
    };
    for (const surface of world.landscapeSurfaces ?? []) face(surface);
    for (const surface of world.surfaces ?? []) face(surface);
    for (const shape of world.boxes) box(shape);
    const opaqueActors = scene.actors.filter(shape => (shape.color[3] ?? 1) >= 0.99);
    const transparentActors = scene.actors.filter(shape => (shape.color[3] ?? 1) < 0.99);
    for (const shape of opaqueActors) box(shape);
    for (const shape of [...scene.focus, ...scene.navigation]) box(shape, true);
    for (const shape of [...scene.focus, ...scene.navigation]) box(shape);
    for (const shape of transparentActors) box(shape);
    return new ImageData(new Uint8ClampedArray(this.raster.pixels), width, height);
  }
}
