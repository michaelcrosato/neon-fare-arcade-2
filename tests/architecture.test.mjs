import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

const ROOT = resolve(import.meta.dirname, "..");
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".mjs"]);
const GLOBAL_STYLE_SLICES = [
  "./styles/00-foundation.css",
  "./styles/10-stage-effects.css",
  "./styles/20-fare-presentation.css",
  "./styles/30-cab-menu.css",
  "./styles/40-hud-navigation.css",
  "./styles/50-overlays-controls.css",
  "./styles/60-modals-map.css",
  "./styles/70-career-services.css",
  "./styles/80-accessibility-motion-responsive.css",
  "./styles/90-courier.css",
];

function sourceFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(path));
    else if (SOURCE_EXTENSIONS.has(extname(entry.name))) files.push(path);
  }
  return files;
}

function importsFor(file) {
  const source = readFileSync(file, "utf8");
  const tree = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const imports = [];
  for (const statement of tree.statements) {
    if ((ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement))
      && statement.moduleSpecifier
      && ts.isStringLiteral(statement.moduleSpecifier)) {
      imports.push(statement.moduleSpecifier.text);
    }
  }
  return imports;
}

function forbiddenGlobalUses(file) {
  const source = readFileSync(file, "utf8");
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const forbidden = new Set([
    "window",
    "document",
    "navigator",
    "localStorage",
    "sessionStorage",
    "requestAnimationFrame",
    "performance",
    "setTimeout",
    "setInterval",
    "console",
    "Date",
    "Audio",
    "AudioContext",
  ]);
  const uses = [];
  function visit(node) {
    if (ts.isIdentifier(node) && forbidden.has(node.text)) {
      const parent = node.parent;
      const isPropertyName = (ts.isPropertyAccessExpression(parent) && parent.name === node)
        || ((ts.isPropertyAssignment(parent) || ts.isPropertySignature(parent)) && parent.name === node);
      if (!isPropertyName) uses.push(node.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return uses;
}

function resolveLocalImport(file, specifier) {
  const base = specifier.startsWith("@/")
    ? resolve(ROOT, specifier.slice(2))
    : specifier.startsWith(".")
      ? resolve(dirname(file), specifier)
      : null;
  if (!base) return null;
  const candidates = [
    base,
    ...[".ts", ".tsx", ".mts", ".mjs"].map((extension) => `${base}${extension}`),
    ...[".ts", ".tsx", ".mts", ".mjs"].map((extension) => resolve(base, `index${extension}`)),
  ];
  return candidates.find((candidate) => {
    try {
      return statSync(candidate).isFile();
    } catch {
      return false;
    }
  }) ?? null;
}

test("deterministic game modules stay independent from app and browser frameworks", () => {
  const forbidden = [];
  for (const file of sourceFiles(resolve(ROOT, "game"))) {
    for (const specifier of importsFor(file)) {
      if (specifier === "react" || specifier.startsWith("react/")
        || specifier === "next" || specifier.startsWith("next/")
        || specifier.startsWith("@/app")
        || resolveLocalImport(file, specifier)?.startsWith(resolve(ROOT, "app"))) {
        forbidden.push(`${relative(ROOT, file)} -> ${specifier}`);
      }
    }
  }
  assert.deepEqual(forbidden, []);
});

test("source import graph remains acyclic", () => {
  const files = sourceFiles(resolve(ROOT, "game"));
  const graph = new Map(files.map((file) => [
    file,
    importsFor(file)
      .map((specifier) => resolveLocalImport(file, specifier))
      .filter((target) => target && target.startsWith(resolve(ROOT, "game"))),
  ]));
  const visiting = new Set();
  const visited = new Set();
  const stack = [];
  const cycles = [];

  function visit(file) {
    if (visiting.has(file)) {
      const start = stack.indexOf(file);
      cycles.push([...stack.slice(start), file].map((entry) => relative(ROOT, entry)).join(" -> "));
      return;
    }
    if (visited.has(file)) return;
    visiting.add(file);
    stack.push(file);
    for (const target of graph.get(file) ?? []) visit(target);
    stack.pop();
    visiting.delete(file);
    visited.add(file);
  }

  for (const file of files) visit(file);
  assert.deepEqual(cycles, []);
});

test("deterministic modules do not use browser globals", () => {
  const offenders = sourceFiles(resolve(ROOT, "game")).flatMap((file) => (
    forbiddenGlobalUses(file).map((name) => `${relative(ROOT, file)} -> ${name}`)
  ));
  assert.deepEqual(offenders, []);
});

test("route and math consumers use their canonical dependency layer", () => {
  assert.ok(importsFor(resolve(ROOT, "game/fare-selection.ts")).includes("./route-geometry"));
  assert.ok(importsFor(resolve(ROOT, "game/render/scene.ts")).includes("../route-geometry"));
  assert.equal(importsFor(resolve(ROOT, "game/math.ts")).includes("./road-network"), false);
});

test("game tests never import the browser runtime page", () => {
  const offenders = [];
  for (const file of sourceFiles(resolve(ROOT, "tests/game"))) {
    for (const specifier of importsFor(file)) {
      const target = resolveLocalImport(file, specifier);
      if (specifier.startsWith("@/app/page") || target === resolve(ROOT, "app/page.tsx")) {
        offenders.push(`${relative(ROOT, file)} -> ${specifier}`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test("browser support modules never depend back on the runtime page", () => {
  const page = resolve(ROOT, "app/page.tsx");
  const offenders = [];
  for (const file of sourceFiles(resolve(ROOT, "app"))) {
    if (file === page) continue;
    for (const specifier of importsFor(file)) {
      if (resolveLocalImport(file, specifier) === page) {
        offenders.push(`${relative(ROOT, file)} -> ${specifier}`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test("the browser shell delegates GPS and concrete rendering", () => {
  const pagePath = resolve(ROOT, "app/page.tsx");
  const page = readFileSync(pagePath, "utf8");
  const runtimeImports = importsFor(resolve(ROOT, "app/runtime/use-game-runtime.ts"));
  const stageImports = importsFor(resolve(ROOT, "app/game-stage-hud.tsx"));
  assert.ok(stageImports.includes("./gps-map"));
  assert.ok(runtimeImports.includes("../canvas2d-renderer"));
  assert.ok(runtimeImports.includes("../webgpu-renderer"));
  assert.equal(page.includes("function GpsMap("), false);
  assert.equal(page.includes("class Canvas2DRenderer"), false);
  assert.equal(page.includes("class WebGPURenderer"), false);
  assert.equal(page.includes("async function createWebGPURenderer("), false);
  assert.equal(page.includes("@vertex fn vsMain"), false);

  for (const file of ["canvas2d-renderer.ts", "webgpu-renderer.ts"]) {
    assert.equal(importsFor(resolve(ROOT, "app", file)).includes("react"), false);
  }
});

test("the runtime page delegates browser orchestration and presentation surfaces", () => {
  const pagePath = resolve(ROOT, "app/page.tsx");
  const page = readFileSync(pagePath, "utf8");
  const imports = importsFor(pagePath);
  for (const delegate of [
    "./runtime/use-game-runtime",
    "./runtime/present-simulation-events",
    "./runtime/diagnostics",
    "./runtime/steering-mode",
    "./game-modal-host",
    "./game-mode-menu",
    "./game-session-overlays",
    "./game-stage-hud",
  ]) {
    assert.ok(imports.includes(delegate), `page.tsx should import ${delegate}`);
  }
  assert.equal(page.includes("new CityStream("), false);
  assert.equal(page.includes("stepGame("), false);
  assert.ok(page.split("\n").length < 1_000, "page.tsx should stay an orchestration shell");
});

test("global styles retain their explicit cascade manifest", () => {
  const manifestPath = resolve(ROOT, "app/globals.css");
  const manifest = readFileSync(manifestPath, "utf8");
  const imports = [...manifest.matchAll(/@import\s+["']([^"']+)["'];/g)].map((match) => match[1]);
  assert.deepEqual(imports, ["tailwindcss", ...GLOBAL_STYLE_SLICES]);
  assert.equal(manifest.replace(/@import\s+["'][^"']+["'];\s*/g, ""), "");

  const cascade = GLOBAL_STYLE_SLICES.map((specifier) => (
    readFileSync(resolve(dirname(manifestPath), specifier), "utf8")
  )).join("\n\n");
  const sentinels = [
    ":root {",
    ".arcade-shell {",
    ".fare-impact {",
    ".gps-panel {",
    ".comic-modal {",
    ".gas-station__header {",
    "@media (max-width: 1080px)",
    ".courier-task-strip {",
  ];
  const positions = sentinels.map((sentinel) => cascade.indexOf(sentinel));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
});
