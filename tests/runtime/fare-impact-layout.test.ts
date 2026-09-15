import assert from "node:assert/strict";
import test from "node:test";
import { fitFareImpact } from "../../app/runtime/fare-impact-layout";

test("each viewport gets one compact, centered card with room for the road", () => {
  for (const [width, height] of [[296, 552], [366, 828], [544, 304], [820, 374], [744, 1008], [1000, 752], [1256, 712], [1896, 992]]) {
    for (const layout of ["desktop", "mobile"] as const) {
      const card = fitFareImpact(width, height, layout);
      assert.equal(card.x + card.width / 2, width / 2);
      assert.equal(card.y, 0);
      assert.ok(card.width <= width && card.height <= height * .3);
      assert.ok(card.width / card.height >= 1.8, "always use the smaller horizontal composition");
      if (layout === "desktop") assert.equal(card.width, Math.floor(width / 2));
      else assert.ok(card.height >= 90, "small landscape screens retain readable copy space");
      // Returning to the same viewport always returns the same frame, without retained fit state.
      fitFareImpact(height, width, layout);
      assert.deepEqual(fitFareImpact(width, height, layout), card);
    }
  }
});
