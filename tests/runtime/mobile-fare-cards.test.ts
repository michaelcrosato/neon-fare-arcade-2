import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EMPTY_HUD } from "../../game/hud";
import type { FareImpact, Hud } from "../../game/model";
import { fareArtAsset, fareArtFrame } from "../../game/fare-presentation";
import { MobileGameHud } from "../../app/mobile-game-hud";
import { TouchDriving } from "../../app/runtime/touch-driving";

const ROOT = resolve(import.meta.dirname, "../..");
const noop = () => {};

function impact(kind: FareImpact["kind"], artCell: number): FareImpact {
  return {
    id: kind === "pickup" ? 1 : 2,
    kind,
    fareId: "rico",
    fareNumber: 7,
    artCell,
    durationMs: 1600,
    rider: "RICO",
    destination: "MARINA ARCADE",
    destinationCard: kind === "dropoff"
      ? {
        id: "marina-arcade",
        placeId: "marina-arcade",
        label: "MARINA ARCADE",
        occasion: "BOARDWALK NIGHTS",
        artCell,
        category: "waterfront",
        kind: "landmark",
        requiresWater: true,
      }
      : undefined,
    eyebrow: kind === "pickup" ? "NEW FARE" : "FARE COMPLETE",
    headline: kind === "pickup" ? "RICO IN!" : "CLEAN DROP",
    detail: kind === "pickup" ? "+8 BOOST" : "+$40 FARE",
  };
}

function renderPlayfield(fareImpact: FareImpact | null) {
  const hud: Hud = { ...EMPTY_HUD, playerMode: "driving", runKind: "timed" };
  return renderToStaticMarkup(createElement(MobileGameHud, {
    mode: "playing",
    hud,
    fareImpact,
    courierImpact: null,
    touchDriving: new TouchDriving(),
    onPulseInteraction: noop,
    onSetMode: noop,
    onTouch: noop,
  }));
}

test("mobile playfield flashes the passenger card on pickup and the destination card on dropoff", () => {
  const pickup = impact("pickup", 0);
  const pickupHtml = renderPlayfield(pickup);
  const pickupArt = fareArtAsset("pickup", fareArtFrame(pickup.artCell).sheet);
  assert.match(pickupHtml, /fare-impact--pickup/);
  assert.match(pickupHtml, /GET IN!/);
  assert.ok(pickupHtml.includes(pickupArt), "pickup must use passenger art");
  assert.equal(pickupHtml.includes("fare-impact--dropoff"), false);
  assert.equal(pickupHtml.includes("is on board"), false, "must not fall back to the small fare notice");

  const dropoff = impact("dropoff", 6);
  const dropoffHtml = renderPlayfield(dropoff);
  const dropoffArt = fareArtAsset("dropoff", fareArtFrame(dropoff.artCell).sheet);
  assert.match(dropoffHtml, /fare-impact--dropoff/);
  assert.match(dropoffHtml, /ARRIVED!/);
  assert.ok(dropoffHtml.includes(dropoffArt), "dropoff must use destination art");
  assert.ok(dropoffHtml.includes("BOARDWALK NIGHTS"));
  assert.equal(dropoffHtml.includes("fare-impact--pickup"), false);
  assert.equal(dropoffHtml.includes("Fare complete"), false, "must not fall back to the small fare notice");
});

test("mobile playfield never mounts the stacked run-card control", () => {
  const pickupHtml = renderPlayfield(impact("pickup", 0));
  const dropoffHtml = renderPlayfield(impact("dropoff", 6));
  const idleHtml = renderPlayfield(null);
  for (const html of [pickupHtml, dropoffHtml, idleHtml]) {
    assert.equal(html.includes("fare-card-stack"), false);
  }

  const mobileHud = readFileSync(resolve(ROOT, "app/mobile-game-hud.tsx"), "utf8");
  assert.match(mobileHud, /FareImpactOverlay/);
  assert.equal(mobileHud.includes("FareCardStack"), false);

  const stage = readFileSync(resolve(ROOT, "app/game-stage-hud.tsx"), "utf8");
  const mobileBranch = stage.split("if (mobile)")[1]?.split("const simulationDriving")[0] ?? "";
  assert.match(mobileBranch, /MobileGameHud/);
  assert.equal(mobileBranch.includes("FareCardStack"), false);
  assert.match(stage, /FareCardStack/);
});
