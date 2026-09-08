import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRunRecords } from "../../app/runtime/run-records";
import { careerFromRunRecords } from "../../game/career";

const VALID = { score: 1_000, fare: 48, deliveries: 1, rank: "C", date: "AUG 9" };

test("run log rejects malformed rows without discarding valid saved runs", () => {
  for (const input of [null, {}, 7, "[]"]) assert.deepEqual(normalizeRunRecords(input), []);
  const raw: unknown = [
    null, {}, [], "bad", { ...VALID, score: "1000" },
    { ...VALID, fare: -1 }, { ...VALID, score: Infinity },
    { ...VALID, deliveries: NaN }, { ...VALID, rank: {} },
    { ...VALID, date: null }, VALID,
  ];
  const records = normalizeRunRecords(raw);
  assert.deepEqual(records, [VALID]);
  assert.equal(records[0].score.toLocaleString("en-US"), "1,000");
  assert.equal(records.reduce((best, record) => Math.max(best, record.score), 0), 1_000);
  const migrated = careerFromRunRecords(records);
  assert.equal(migrated.bank, 48);
  assert.equal(migrated.runsCompleted, 1);
});

test("run log keeps five valid rows in stored order and copies only known fields", () => {
  const raw = Array.from({ length: 7 }, (_, index) => ({ ...VALID, score: 7 - index, extra: true }));
  const records = normalizeRunRecords([null, ...raw]);
  assert.deepEqual(records, Array.from({ length: 5 }, (_, index) => ({ ...VALID, score: 7 - index })));
  records[0].score = 0;
  assert.equal(raw[0].score, 7);
});
