import assert from "node:assert/strict";
import test from "node:test";
import { FARE_CLEARANCE, fitFareImpact, type FareRect } from "../../app/runtime/fare-impact-layout";

function overlaps(a: FareRect, b: FareRect) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

test("mobile fare impact fills the available top space and uses a side when the cab is high", () => {
  const lowCab = { x: 160, y: 560, width: 60, height: 110 };
  const portrait = fitFareImpact(366, 828, [lowCab], "mobile");
  assert.equal(portrait.width, 366);
  assert.ok(portrait.height > 500, "portrait phones should show a large passenger, not a short notice");
  const highCab = { ...lowCab, y: 110 };
  const side = fitFareImpact(820, 390, [highCab], "mobile");
  assert.ok(side.x >= highCab.x + highCab.width + FARE_CLEARANCE);
  assert.ok(side.width * side.height > 820 * (highCab.y - FARE_CLEARANCE));
});

test("mobile fitted cards clear every obstacle and match a brute-force search of usable space", () => {
  for (const [width, height] of [[366, 828], [544, 304], [1256, 712], [1896, 992]]) {
    for (const top of [60, 140, 280, 520]) {
      const obstacles = [{ x: width * .42, y: top, width: width * .16, height: height * .3 },
        { x: width * .2, y: top + 30, width: width * .2, height: 60 }];
      const card = fitFareImpact(width, height, obstacles, "mobile");
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

test("desktop fare cards stay half-width and centered instead of filling a tall side gap", () => {
  for (const [width, height] of [[1001, 704], [1256, 712], [2296, 1224], [2536, 1352]]) {
    const arrow = { x: width * .46, y: height * .43, width: width * .08, height: height * .17 };
    const card = fitFareImpact(width, height, [arrow]);
    assert.equal(card.width, Math.floor(width / 2));
    assert.equal(card.x + card.width / 2, width / 2);
    assert.equal(card.y, 0);
    assert.ok(card.height <= height * .38);
    assert.ok(card.height >= height * .35, "retain the reference banner's vertical impact");
    assert.ok(card.y + card.height <= arrow.y - FARE_CLEARANCE);
  }
});

test("desktop cards shorten for a high arrow and use a centered gap below a first-person arrow", () => {
  const arrow = { x: 540, y: 160, width: 200, height: 180 };
  const card = fitFareImpact(1280, 800, [arrow]);
  assert.deepEqual(card, { x: 320, y: 0, width: 640, height: 142 });
  const firstPerson = { ...arrow, y: -20, height: 240 };
  const lowerObstacle = { x: 0, y: 608, width: 1280, height: 192 };
  const below = fitFareImpact(1280, 800, [firstPerson, lowerObstacle]);
  assert.equal(below.x, 320);
  assert.equal(below.width, 640);
  assert.ok(below.y >= firstPerson.y + firstPerson.height + FARE_CLEARANCE);
  assert.ok(below.y + below.height <= lowerObstacle.y - FARE_CLEARANCE);
});
