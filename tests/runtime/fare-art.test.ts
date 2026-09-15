import assert from "node:assert/strict";
import test from "node:test";
import { createImageWarmQueue } from "../../app/runtime/fare-art";

test("art warming deduplicates sheets, bounds retained images, and yields between decodes", async () => {
  const scheduled: (() => void)[] = [], loaded: string[] = [];
  let finish: (image: object) => void = () => {};
  const queue = createImageWarmQueue(url => {
    loaded.push(url); return new Promise<object>(resolve => { finish = resolve; });
  }, work => scheduled.push(work), 2);
  queue("portrait"); queue("portrait"); queue("destination");
  assert.equal(scheduled.length, 1);
  scheduled.shift()!();
  assert.deepEqual(loaded, ["portrait"]);
  finish({}); await new Promise(resolve => setImmediate(resolve));
  assert.equal(scheduled.length, 1, "the next decode waits for another idle callback");
  scheduled.shift()!(); finish({}); await new Promise(resolve => setImmediate(resolve));
  queue("portrait"); assert.equal(scheduled.length, 0, "decoded art remains warm");
  queue("third"); scheduled.shift()!(); finish({}); await new Promise(resolve => setImmediate(resolve));
  queue("destination"); scheduled.shift()!();
  assert.deepEqual(loaded, ["portrait", "destination", "third", "destination"], "least recently used decoded art is released");
  finish({});
});

test("failed art does not stop subsequent warming and can be retried", async () => {
  const scheduled: (() => void)[] = [], loaded: string[] = [];
  const queue = createImageWarmQueue(async url => {
    loaded.push(url); if (loaded.length === 1) throw new Error("offline"); return {};
  }, work => scheduled.push(work));
  queue("first"); queue("next"); scheduled.shift()!();
  await new Promise(resolve => setImmediate(resolve));
  scheduled.shift()!(); await new Promise(resolve => setImmediate(resolve));
  queue("first"); scheduled.shift()!(); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(loaded, ["first", "next", "first"]);
});
