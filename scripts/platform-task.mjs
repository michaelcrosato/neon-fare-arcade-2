import { spawnSync, execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Preserve the existing hosted/Linux lifecycle and support native Windows npm.
const [task, ...args] = process.argv.slice(2);
const shellTasks = {
  build: ["scripts/build-verified.sh"],
  validate: ["scripts/validate-artifact.sh"],
  lint: ["scripts/sites-env.sh", "--", "eslint", ".", "--ignore-pattern", "dist", "--ignore-pattern", ".next"],
};
if (!(task in shellTasks)) throw new Error(`Unknown platform task: ${task}`);

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, { stdio: "inherit", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (process.platform !== "win32") {
  run("bash", [...shellTasks[task], ...args]);
} else if (task === "lint") {
  run(process.execPath, ["node_modules/eslint/bin/eslint.js", ".", "--ignore-pattern", "dist", "--ignore-pattern", ".next", ...args]);
} else {
  if (task === "build") {
    let buildId = "development";
    try {
      buildId = execFileSync("git", ["rev-parse", "--short=12", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch { /* A source archive may not have Git metadata. */ }
    const manifest = JSON.parse(await readFile("node_modules/vinext/package.json", "utf8"));
    const entry = typeof manifest.bin === "string" ? manifest.bin : manifest.bin.vinext;
    run(process.execPath, [resolve("node_modules/vinext", entry), "build", ...args], {
      timeout: 180_000,
      env: { ...process.env, NEXT_PUBLIC_BUILD_ID: process.env.NEXT_PUBLIC_BUILD_ID ?? buildId },
    });
  }
  JSON.parse(await readFile("dist/.openai/hosting.json", "utf8"));
  const worker = await import(pathToFileURL(resolve("dist/server/index.js")).href);
  if (typeof worker.default?.fetch !== "function") {
    throw new Error("dist/server/index.js must export default.fetch");
  }
  process.stdout.write("Validated Sites artifact: Worker default.fetch and hosting manifest.\n");
}
