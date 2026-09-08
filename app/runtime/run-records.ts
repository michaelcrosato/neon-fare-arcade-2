import type { RunRecord } from "../../game/model";

function isNonnegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** Untrusted local saves must not reach React or career migration unchecked. */
export function normalizeRunRecords(raw: unknown): RunRecord[] {
  if (!Array.isArray(raw)) return [];
  const records: RunRecord[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Partial<RunRecord>;
    if (!isNonnegativeNumber(row.score)
      || !isNonnegativeNumber(row.fare)
      || !isNonnegativeNumber(row.deliveries)
      || typeof row.rank !== "string"
      || typeof row.date !== "string") continue;
    records.push({
      score: row.score,
      fare: row.fare,
      deliveries: row.deliveries,
      rank: row.rank,
      date: row.date,
    });
    if (records.length === 5) break;
  }
  return records;
}
