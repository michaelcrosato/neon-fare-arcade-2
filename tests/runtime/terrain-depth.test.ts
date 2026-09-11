import assert from "node:assert/strict";
import test from "node:test";
import { TerrainRaster } from "../../app/terrain-raster";

test("projected terrain and road depth is resolved per pixel, independent of face submission order", () => {
  const render = (reverse: boolean) => {
    const raster = new TerrainRaster(); raster.begin(12, 12);
    const ground = () => raster.triangle({ x: 0, y: 0, depth: 0 }, { x: 12, y: 0, depth: 12 }, { x: 0, y: 12, depth: 0 }, [0, 1, 0, 1]);
    const road = () => raster.triangle({ x: 0, y: 0, depth: 5 }, { x: 12, y: 0, depth: 5 }, { x: 0, y: 12, depth: 5 }, [1, 0, 0, 1]);
    if (reverse) { road(); ground(); } else { ground(); road(); }
    return raster.pixels;
  };
  const first = render(false);
  assert.deepEqual(first, render(true));
  assert.deepEqual([...first.slice((1 * 12 + 1) * 4, (1 * 12 + 1) * 4 + 4)], [255, 0, 0, 255]);
  assert.deepEqual([...first.slice((1 * 12 + 8) * 4, (1 * 12 + 8) * 4 + 4)], [0, 255, 0, 255]);
  assert.deepEqual([...first.slice((11 * 12 + 11) * 4, (11 * 12 + 11) * 4 + 4)], [0, 0, 0, 0]);
});

test("semi-transparent surfaces blend smoothly over existing pixels without updating depth buffer", () => {
  const raster = new TerrainRaster();
  raster.begin(10, 10);
  // Opaque green background at depth 0
  raster.triangle({ x: 0, y: 0, depth: 0 }, { x: 10, y: 0, depth: 0 }, { x: 0, y: 10, depth: 0 }, [0, 1, 0, 1]);
  // Semi-transparent blue surface (alpha 0.5) in front at depth 2
  raster.triangle({ x: 0, y: 0, depth: 2 }, { x: 10, y: 0, depth: 2 }, { x: 0, y: 10, depth: 2 }, [0, 0, 1, 0.5]);
  const pixel = [...raster.pixels.slice((2 * 10 + 2) * 4, (2 * 10 + 2) * 4 + 4)];
  // Blended: red = 0, green = 255 - (255 - 0)*0.5 = 127.5 ~ 128, blue = 0 + (255 - 0)*0.5 ~ 128
  assert.equal(pixel[0], 0);
  assert.ok(pixel[1] >= 120 && pixel[1] <= 135, `green was ${pixel[1]}`);
  assert.ok(pixel[2] >= 120 && pixel[2] <= 135, `blue was ${pixel[2]}`);
});
