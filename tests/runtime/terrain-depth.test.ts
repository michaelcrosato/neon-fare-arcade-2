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
