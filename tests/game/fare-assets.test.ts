import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { DESTINATION_ART_CELL_COUNT, PASSENGER_ART_CELL_COUNT } from "../../game/config";
import { FARE_RIDERS } from "../../game/passengers";
import { fareArtAsset } from "../../game/fare-presentation";
import type { WorldRegionId } from "../../game/region-types";

type Sheet = {
  file: string;
  cells: [number, number];
  sha256: string;
};

type PassengerSheet = Sheet & {
  riderIds: string[];
  region: "shared" | WorldRegionId;
};

type FareArtManifest = {
  atlas: { width: number; height: number; columns: number; rows: number; cellWidth: number; cellHeight: number };
  passengerSheets: PassengerSheet[];
  destinationSheets: Sheet[];
};

const manifest = JSON.parse(readFileSync(
  new URL("../../assets/fare-art-manifest.json", import.meta.url),
  "utf8",
)) as FareArtManifest;

function uint24(buffer: Buffer, offset: number) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function webpDimensions(buffer: Buffer) {
  assert.equal(buffer.toString("ascii", 0, 4), "RIFF");
  assert.equal(buffer.toString("ascii", 8, 12), "WEBP");
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const kind = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (kind === "VP8X") {
      return { width: uint24(buffer, data + 4) + 1, height: uint24(buffer, data + 7) + 1 };
    }
    if (kind === "VP8L") {
      const bits = buffer.readUInt32LE(data + 1);
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
    if (kind === "VP8 ") {
      return {
        width: buffer.readUInt16LE(data + 6) & 0x3fff,
        height: buffer.readUInt16LE(data + 8) & 0x3fff,
      };
    }
    offset = data + size + (size % 2);
  }
  throw new Error("WebP dimensions were not found");
}

function assetBytes(file: string) {
  return readFileSync(new URL(`../../public${file}`, import.meta.url));
}

function verifySheet(sheet: Sheet) {
  const bytes = assetBytes(sheet.file);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), sheet.sha256, sheet.file);
  assert.deepEqual(webpDimensions(bytes), {
    width: manifest.atlas.width,
    height: manifest.atlas.height,
  }, sheet.file);
}

test("fare art manifest covers every ordered passenger cell and physical atlas", () => {
  assert.deepEqual(manifest.atlas, {
    width: 1536,
    height: 1024,
    columns: 3,
    rows: 2,
    cellWidth: 512,
    cellHeight: 512,
  });
  const coveredIds: string[] = [];
  for (const [sheetIndex, sheet] of manifest.passengerSheets.entries()) {
    assert.equal(fareArtAsset("pickup", sheetIndex), sheet.file);
    const firstCell = sheetIndex * 6;
    assert.deepEqual(sheet.cells, [firstCell, firstCell + 5]);
    const riders = FARE_RIDERS.slice(firstCell, firstCell + 6);
    assert.deepEqual(sheet.riderIds, riders.map((rider) => rider.id));
    assert.ok(riders.every((rider) => (rider.exclusiveRegionId ?? "shared") === sheet.region));
    coveredIds.push(...sheet.riderIds);
    verifySheet(sheet);
  }
  assert.equal(coveredIds.length, PASSENGER_ART_CELL_COUNT);
  assert.deepEqual(coveredIds, FARE_RIDERS.map((rider) => rider.id));
});

test("destination art manifest covers its independent cells and physical atlases", () => {
  const coveredCells: number[] = [];
  for (const [sheetIndex, sheet] of manifest.destinationSheets.entries()) {
    assert.equal(fareArtAsset("dropoff", sheetIndex), sheet.file);
    const firstCell = sheetIndex * 6;
    assert.deepEqual(sheet.cells, [firstCell, firstCell + 5]);
    coveredCells.push(...Array.from({ length: 6 }, (_, index) => firstCell + index));
    verifySheet(sheet);
  }
  assert.deepEqual(
    coveredCells,
    Array.from({ length: DESTINATION_ART_CELL_COUNT }, (_, index) => index),
  );
});
