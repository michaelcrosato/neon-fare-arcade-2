import assert from "node:assert/strict";
import test from "node:test";
import { MAT_GENERIC } from "../../game/config";
import type { MeshFace } from "../../game/model";
import { packSurfaceQuads } from "../../game/render/surfaces";

test("mixed triangles and nonplanar quads preserve vertex order, normals and every packed field", () => {
  const a = { x: 0, y: 0, z: 0 }, b = { x: 2, y: 0, z: 0 };
  const c = { x: 2, y: 2, z: 0 }, d = { x: 0, y: 2, z: 2 };
  const e = { x: 3, y: 1, z: 0 }, f = { x: 3, y: 2, z: 0 }, g = { x: 3, y: 2, z: 3 };
  const faces: MeshFace[] = [
    { corners: [a, b, c, d], material: MAT_GENERIC, color: [.2, .4, .6, .8] },
    { corners: [e, f, g], material: MAT_GENERIC, color: [.2, .4, .6, .8] },
    { corners: [g, f, e], material: MAT_GENERIC, color: [.2, .4, .6, .8] },
  ];
  const diagonal = 1 / Math.sqrt(3);
  const vertices = [a, b, c, a, c, d, e, f, g, g, f, e];
  const normals = [[0, 0, 1], [diagonal, -diagonal, diagonal], [1, 0, 0], [-1, 0, -0]];
  const expected = new Float32Array(vertices.flatMap((point, index) => [
    point.x, point.y, point.z, MAT_GENERIC,
    ...normals[Math.floor(index / 3)], 1, .2, .4, .6, .8,
  ]));
  assert.deepEqual(packSurfaceQuads(faces), expected);
});

test("invalid triangles reject degenerate and nonfinite normals", () => {
  for (const x of [0, Number.NaN, Number.POSITIVE_INFINITY]) {
    const face: MeshFace = { corners: [{ x: 0, y: 0, z: 0 }, { x, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }],
      material: MAT_GENERIC, color: [1, 1, 1, 1] };
    assert.throws(() => packSurfaceQuads([face]), /Degenerate/);
  }
});
