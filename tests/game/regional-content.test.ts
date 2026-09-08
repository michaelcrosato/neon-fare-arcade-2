import assert from "node:assert/strict";
import test from "node:test";

import { WORLD_CAMPUSES } from "../../game/campuses";
import { REGIONAL_CONTENT } from "../../game/regional-content";
import { ACTIVE_WORLD_REGIONS } from "../../game/regions";

test("regional content exhaustively covers every active non-city region", () => {
  const regionalWorld = ACTIVE_WORLD_REGIONS.filter((region) => region.id !== "city-center");
  assert.deepEqual(
    REGIONAL_CONTENT.map((entry) => [entry.id, entry.theme]),
    regionalWorld.map((region) => [region.id, region.theme]),
  );
  const anchorIds = REGIONAL_CONTENT.flatMap((entry) => entry.anchors.map((anchor) => anchor.id));
  assert.equal(new Set(anchorIds).size, anchorIds.length);
});

test("regional manifest preserves the established campus set", () => {
  const regionalCampuses = WORLD_CAMPUSES.filter((campus) => campus.source !== "city");
  const expected = REGIONAL_CONTENT.flatMap((entry) => entry.anchors
    .filter((anchor) => entry.campusPolicy === "bellwether-only"
      ? anchor.id === "bellwether-school"
      : anchor.width > 1 || anchor.height > 1)
    .map((anchor) => [anchor.id, entry.theme]));
  assert.deepEqual(
    regionalCampuses.map((campus) => [campus.id, campus.source]),
    expected,
  );
});
