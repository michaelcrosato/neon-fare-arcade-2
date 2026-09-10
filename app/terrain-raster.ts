import type { Color } from "@/game/model";

export type RasterVertex = { x: number; y: number; depth: number };

/** A small depth buffer for the Canvas fallback's projected terrain and actors. */
export class TerrainRaster {
  width = 0;
  height = 0;
  pixels = new Uint8ClampedArray(0);
  private colors = new Uint32Array(0);
  private depths = new Float32Array(0);
  private readonly littleEndian = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

  begin(width: number, height: number) {
    if (width !== this.width || height !== this.height) {
      this.width = width; this.height = height;
      this.pixels = new Uint8ClampedArray(width * height * 4);
      this.colors = new Uint32Array(this.pixels.buffer);
      this.depths = new Float32Array(width * height);
    }
    this.colors.fill(0);
    this.depths.fill(-Infinity);
  }

  triangle(a: RasterVertex, b: RasterVertex, c: RasterVertex, color: Color, ghost = false) {
    const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (area <= 1e-8) return;
    const left = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x))), right = Math.min(this.width - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
    const top = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y))), bottom = Math.min(this.height - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
    if (left > right || top > bottom) return;
    const channel = (value: number) => Math.max(0, Math.min(255, Math.round(value * 255)));
    const r = channel(color[0]), g = channel(color[1]), blue = channel(color[2]);
    const packed = this.littleEndian ? (255 << 24) | (blue << 16) | (g << 8) | r : (r << 24) | (g << 16) | (blue << 8) | 255;
    const abX = a.y - b.y, abY = b.x - a.x, bcX = b.y - c.y, bcY = c.x - b.x, caX = c.y - a.y, caY = a.x - c.x;
    const depthX = (bcX * a.depth + caX * b.depth + abX * c.depth) / area;
    const depthY = (bcY * a.depth + caY * b.depth + abY * c.depth) / area;
    let abRow = abX * (left + 0.5 - a.x) + abY * (top + 0.5 - a.y);
    let bcRow = bcX * (left + 0.5 - b.x) + bcY * (top + 0.5 - b.y);
    let caRow = caX * (left + 0.5 - c.x) + caY * (top + 0.5 - c.y);
    let depthRow = (bcRow * a.depth + caRow * b.depth + abRow * c.depth) / area;
    for (let y = top; y <= bottom; y += 1) {
      let ab = abRow, bc = bcRow, ca = caRow, depth = depthRow;
      let pixel = y * this.width + left;
      for (let x = left; x <= right; x += 1) {
        if (ab >= -1e-5 && bc >= -1e-5 && ca >= -1e-5) {
          if (!ghost && depth > this.depths[pixel]) {
            this.depths[pixel] = depth; this.colors[pixel] = packed;
          } else if (ghost && depth < this.depths[pixel]) {
            const offset = pixel * 4, alpha = color[3];
            this.pixels[offset] += (r - this.pixels[offset]) * alpha;
            this.pixels[offset + 1] += (g - this.pixels[offset + 1]) * alpha;
            this.pixels[offset + 2] += (blue - this.pixels[offset + 2]) * alpha;
          }
        }
        ab += abX; bc += bcX; ca += caX; depth += depthX; pixel += 1;
      }
      abRow += abY; bcRow += bcY; caRow += caY; depthRow += depthY;
    }
  }
}
