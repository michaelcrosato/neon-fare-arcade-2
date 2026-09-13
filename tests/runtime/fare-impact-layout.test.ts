import assert from "node:assert/strict";
import test from "node:test";
import { FARE_CLEARANCE, fitFareImpact, type FareRect } from "../../app/runtime/fare-impact-layout";

function overlaps(a: FareRect, b: FareRect) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

test("fare impact fills the available top space and uses a side when the cab is high", () => {
  const lowCab = { x: 160, y: 560, width: 60, height: 110 };
  const portrait = fitFareImpact(366, 828, [lowCab]);
  assert.equal(portrait.width, 366);
  assert.ok(portrait.height > 500, "portrait phones should show a large passenger, not a short notice");
  const highCab = { ...lowCab, y: 110 };
  const side = fitFareImpact(820, 390, [highCab]);
  assert.ok(side.x >= highCab.x + highCab.width + FARE_CLEARANCE);
  assert.ok(side.width * side.height > 820 * (highCab.y - FARE_CLEARANCE));
});

test("fitted cards clear every obstacle and match a brute-force search of usable space", () => {
  for (const [width, height] of [[366, 828], [544, 304], [1256, 712], [1896, 992]]) {
    for (const top of [60, 140, 280, 520]) {
      const obstacles = [{ x: width * .42, y: top, width: width * .16, height: height * .3 },
        { x: width * .2, y: top + 30, width: width * .2, height: 60 }];
      const card = fitFareImpact(width, height, obstacles);
      assert.ok(card.x >= 0 && card.x + card.width <= width + 1 && card.height <= height * .64);
      for (const rect of obstacles) assert.equal(overlaps(card, { x: rect.x - 17, y: rect.y - 17, width: rect.width + 34, height: rect.height + 34 }), false);
      // Independent coarse search catches a solver that quietly keeps the old 500px cap.
      for (let x = 0; x < width - 160; x += 24) for (let right = x + 160; right <= width; right += 24) {
        for (let bottom = 48; bottom <= Math.min(height * .64, (right - x) * 1.45); bottom += 24) {
          const candidate = { x, y: 0, width: right - x, height: bottom };
          if (obstacles.some(rect => overlaps(candidate, { x: rect.x - 18, y: rect.y - 18, width: rect.width + 36, height: rect.height + 36 }))) continue;
          assert.ok(card.width * card.height + width * 2 >= candidate.width * candidate.height);
        }
      }
    }
  }
});
