import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const mode = process.argv[2] ?? "all";
if (!new Set(["fast", "exhaustive", "all"]).has(mode)) {
  throw new Error(`Unknown game-test tier: ${mode}`);
}

const exhaustive = new Set([
  "cedar-gameplay.test.ts",
  "cedar-driving.test.ts",
  "coastal.test.ts",
  "coast-driving.test.ts",
  "coast-terrain.test.ts",
  "coast-gameplay.test.ts",
  "copper-driving.test.ts",
  "copper-terrain.test.ts",
  "copper-gameplay.test.ts",
  "desert.test.ts",
  "fare-market.test.ts",
  "landmarks.test.ts",
  "mountain-roads.test.ts",
  "northstar-driving.test.ts",
  "pedestrian.test.ts",
  "regional-fares.test.ts",
  "regions.test.ts",
  "road-surfaces.test.ts",
  "street-commerce.test.ts",
  "wetland.test.ts",
  "world.test.ts",
]);

const testDirectory = resolve("tests/game");
const allTests = readdirSync(testDirectory)
  .filter((file) => file.endsWith(".test.ts"))
  .sort();
const selected = allTests.filter((file) => (
  mode === "all"
  || (mode === "exhaustive" ? exhaustive.has(file) : !exhaustive.has(file))
));

const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", ...selected.map((file) => resolve(testDirectory, file))],
  { stdio: "inherit", env: process.env },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
