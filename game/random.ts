/** Deterministic random helpers kept below world/road ownership. */
export function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function blockRandom(blockX: number, blockY: number, salt = 0) {
  const seed = (
    0xfafade ^
    Math.imul(blockX, 0x9e3779b1) ^
    Math.imul(blockY, 0x85ebca77) ^
    Math.imul(salt, 0xc2b2ae3d)
  ) >>> 0;
  return mulberry32(seed);
}
