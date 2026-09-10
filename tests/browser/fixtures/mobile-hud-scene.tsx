import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { EMPTY_HUD } from "../../../game/hud";
import type { FareImpact, Hud } from "../../../game/model";
import { MobileGameHud } from "../../../app/mobile-game-hud";
import { GameModalHost } from "../../../app/game-modal-host";
import { GameSessionOverlays } from "../../../app/game-session-overlays";
import { makeCareerState } from "../../../game/career";
import { createRef } from "react";
import { TouchDriving } from "../../../app/runtime/touch-driving";
import { normalizeDevelopmentSettings } from "../../../game/development-settings";

const host = document.createElement("div");
document.body.appendChild(host);
const root = createRoot(host);
const noop = () => {};
const touchDriving = new TouchDriving();
const fare: FareImpact = {
  id: 1, kind: "dropoff", fareId: "test-fare", fareNumber: 1, artCell: 0, durationMs: 2000,
  rider: "ALEXANDER", destination: "NORTHSTAR MOUNTAIN OBSERVATORY", eyebrow: "FARE COMPLETE",
  headline: "CLEAN DROP", detail: "+$120 FARE · +$24 TIP · FIVE STARS",
};

type Scenario = "meter" | "fare" | "courier" | "simulation";
function render(scenario: Scenario) {
  const hud: Hud = { ...EMPTY_HUD, runKind: "timed", playerMode: "driving", time: 9, fare: 98765,
    message: "", gpsInstruction: "TURN LEFT", objective: "NORTHSTAR MOUNTAIN OBSERVATORY", distance: 450 };
  if (scenario === "meter") Object.assign(hud, { playerMode: "walking", clockPaused: true, interactionPrompt: "E · ENTER NEON LOFTS" });
  if (scenario === "courier") Object.assign(hud, { playerMode: "interior", courierActive: true, courierStage: "pickup", courierAtTargetVenue: true, courierTaxiAtTarget: true, interactionPrompt: "E · COLLECT COURIER PARCEL" });
  if (scenario === "simulation") hud.drivingModel = "simulation";
  flushSync(() => root.render(<main className="arcade-shell mode-playing"><section className="game-stage">
    <MobileGameHud mode="playing" hud={hud} fareImpact={scenario === "fare" ? fare : null}
      courierImpact={scenario === "courier" ? { id: 1, kind: "pickup", cargo: "FRAGILE SOUND EQUIPMENT", destination: "NEON CITY", detail: "RETURN TO YOUR TAXI" } : null}
      touchDriving={touchDriving} onPulseInteraction={noop} onSetMode={noop} onTouch={noop} />
  </section></main>));
}

function renderModal(modal: "home" | "gas" | "courier" | "how" | "traits" | "scores") {
  flushSync(() => root.render(<GameModalHost modal={modal} modalParent={null} mode="paused"
    pendingRunKind="free-run" pendingDrivingModel="arcade" hud={EMPTY_HUD} career={makeCareerState()} records={[]}
    mapNotice="" homeNotice="" courierNotice="" gasNotice=""
    development={{ settings: normalizeDevelopmentSettings(null), activeRun: false, notice: "", onChange: noop, onAction: noop }}
    dialogRef={createRef()} onClose={noop} onBeginRun={noop} onSelectDestination={noop}
    onRemoveDestination={noop} onToggleFareDispatch={noop} onPurchaseHomeItem={noop}
    onRechargeAtHome={noop} onOpenHomeSubview={noop} onPurchaseGasOffer={noop}
    onTakeCourierContract={() => { throw new Error("Layout fixture only"); }} onRequestStartRun={noop} />));
}

function renderEnd() {
  flushSync(() => root.render(<main className="arcade-shell mode-ended"><section className="game-stage">
    <GameSessionOverlays mode="ended" hud={{ ...EMPTY_HUD, runKind: "timed", score: 9876543, fare: 98765 }} cameraMode="chase-low"
      careerBank={98765} fareCards={[]} diagnosticsActive={false} diagnosticsNotice="" muted={false}
      onToggleMute={noop} onOpenMap={noop} onSetCameraMode={noop} onSetMode={noop} onOpenHow={noop} onOpenOptions={noop}
      onFinishRun={noop} onToggleFareDispatch={noop} onRequestStartRun={noop} onOpenScores={noop} onCopyDiagnostics={noop} onRecover={noop} />
  </section></main>));
}

declare global { interface Window { mobileHudFixture: { render: typeof render; renderModal: typeof renderModal; renderEnd: typeof renderEnd } } }
window.mobileHudFixture = { render, renderModal, renderEnd };
