import { createRef, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { StoryCard } from "../../../app/story-card";
import { TowReceipt } from "../../../app/tow-receipt";
import { useDriveEvents } from "../../../app/use-drive-events";
import { useGameRuntime } from "../../../app/runtime/use-game-runtime";
import { presentSimulationEvents } from "../../../app/runtime/present-simulation-events";
import { DiagnosticsRecorder } from "../../../app/runtime/diagnostics";
import { TouchDriving } from "../../../app/runtime/touch-driving";
import { beginAccordTrip, QUANTUM_FACTS } from "../../../game/accord-events";
import { FARE_RIDERS } from "../../../game/passengers";
import { PASSENGER_QUANTUM_RESPONSES } from "../../../game/passenger-quantum-responses";
import { makeGame } from "../../../game/state";
import { makeHud } from "../../../game/hud";
import type { Camera, InputState, Mode } from "../../../game/model";
import type { SimulationEvent } from "../../../game/simulation";

const ref = <T,>(current: T) => ({ current });
const noop = () => {};
const gameRef = ref(makeGame("street-ace", 91, "timed", "arcade", "accord-v6"));
const modeRef = ref<Mode>("paused"), modalDialogRef = createRef<HTMLElement>();
const cameraRef = ref<Camera>({ x: 0, y: 0, zoom: 1, heading: 0, mode: "fixed", boom: 14, heightOffset: 0 });
const cameraModeRef = ref<"fixed">("fixed"), inputRef = ref<InputState>({ up: false, down: false, left: false, right: false, boost: false });
const touchDriving = new TouchDriving(), diagnostics = new DiagnosticsRecorder();
const canvas2dRef = createRef<HTMLCanvasElement>(), webGpuCanvasRef = createRef<HTMLCanvasElement>();
const nullDiv = createRef<HTMLDivElement>(), nullButton = createRef<HTMLButtonElement>();
const interactionPulseRef = ref(false), jumpPulseRef = ref(false), boostAudioActiveRef = ref(false);
const audioRef = ref<AudioContext | null>(null), engineRef = ref<{ osc: OscillatorNode; gain: GainNode } | null>(null);
let setPlaying = noop;
const stories: string[] = [];
function clearInput() { inputRef.current = { up: false, down: false, left: false, right: false, boost: false }; touchDriving.reset(); }
function Scene() {
  const [mode, setModeState] = useState<Mode>("paused");
  const [hud, setHud] = useState(() => makeHud(gameRef.current));
  const [renderer, setRendererKind] = useState("");
  const setMode = useCallback((next: Mode) => { modeRef.current = next; setModeState(next); if (next !== "playing") clearInput(); }, []);
  useEffect(() => { setPlaying = () => setMode("playing"); return () => { setPlaying = noop; }; }, [setMode]);
  const { storyCard, showStoryCard, dismissStoryCard, onGamepadActions } = useDriveEvents({ gameRef, modeRef, modalDialogRef, clearInput, setHud, setMode,
    togglePause: noop, resumeFromPause: noop, cycleCamera: noop });
  const onSimulationEvents = useCallback((events: readonly SimulationEvent[]) => {
    for (const event of events) if (event.type === "story-card") stories.push(event.card.kind);
    presentSimulationEvents(events, { game: () => gameRef.current, tone: noop, announce: noop, warmPassengerArt: noop, triggerFareImpact: noop,
      triggerCourierImpact: noop, setHomeNotice: noop, setCourierNotice: noop, setGasNotice: noop, setHud, openModal: noop, showStoryCard });
  }, [showStoryCard]);
  useGameRuntime({ passengerReviewRef: nullDiv, navigationDistanceRef: nullDiv, clutchWarningRef: nullDiv, fareImpactRef: nullDiv, taxiExitRef: nullButton, pickupReminderRef: nullDiv,
    canvas2dRef, webGpuCanvasRef, gameRef, cameraRef, cameraModeRef, inputRef, touchDriving, interactionPulseRef, jumpPulseRef, modeRef,
    audioRef, engineRef, boostAudioActiveRef, diagnostics, diagnosticsActive: false, clearInput, finishRun: noop, setMode, setHud,
    setRendererKind, setAudioAnnouncement: noop, tone: noop, onSimulationEvents, onGamepadActions });
  return <main className={`arcade-shell mode-${mode}`}><section className="game-stage" style={{ position: "fixed", inset: 0, width: "100vw", height: "100dvh" }}>
    <canvas ref={canvas2dRef} className={`game-canvas ${renderer !== "WEBGPU ACTIVE" ? "is-active" : ""}`} />
    <canvas ref={webGpuCanvasRef} className={`game-canvas ${renderer === "WEBGPU ACTIVE" ? "is-active" : ""}`} />
    <output style={{ position: "absolute", top: 12, left: 12, zIndex: 2 }}>FARE ${hud.fare} · {mode}</output>
    {hud.towReceipt && !storyCard && <TowReceipt receipt={hud.towReceipt} />}
  </section>{storyCard && <StoryCard card={storyCard} onDismiss={dismissStoryCard} />}</main>;
}
const fixture = {
  start(kind: "quantum" | "tires-paid" | "tow", paid = false, content?: { factIndex: number; riderId: string; replyIndex: number }) {
    const game = makeGame("street-ace", 91, "timed", "arcade", "accord-v6");
    game.traffic = []; game.elapsed = 4; game.countdown = 0;
    if (kind === "quantum") {
      game.onboard = true;
      if (content) {
        const rider = FARE_RIDERS.find(rider => rider.id === content.riderId)!;
        Object.assign(game.fareJobs[0], { id: rider.id, rider: rider.rider, passengerArtCell: rider.passengerArtCell });
        const firstReply = ((game.runSeed >>> 0) + rider.passengerArtCell) % 3;
        game.accordReplyCounts = { [rider.id]: (content.replyIndex - firstReply + 3) % 3 };
      }
      beginAccordTrip(game, game.fareJobs[0]);
      const trip = game.accordTrip!;
      if (content) trip.sequence = (content.factIndex - (game.runSeed >>> 0) % QUANTUM_FACTS.length + QUANTUM_FACTS.length) % QUANTUM_FACTS.length;
      let remaining = trip.length * .52;
      for (let i = 1; i < trip.route.length; i++) {
        const a = trip.route[i - 1], b = trip.route[i];
        const length = Math.hypot(b.x - a.x, b.y - a.y, (b.z ?? 0) - (a.z ?? 0));
        if (remaining <= length) { const t = remaining / length; game.x = a.x + (b.x - a.x) * t; game.y = a.y + (b.y - a.y) * t;
          game.z = (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * t; game.heading = Math.atan2(b.y - a.y, b.x - a.x); break; }
        remaining -= length;
      }
    } else if (kind === "tires-paid") game.fare = 5;
    else game.towRecovery = { cost: paid ? 100 : 0, startedAt: 4, path: [{ x: game.x, y: game.y, z: game.z, heading: game.heading }] };
    gameRef.current = game;
    cameraRef.current.x = game.x; cameraRef.current.y = game.y; cameraRef.current.heightOffset = game.z;
    setPlaying();
  },
  longestContent() {
    const factIndex = QUANTUM_FACTS.reduce((longest, fact, index) =>
      fact.title.length + fact.text.length + fact.aside.length > QUANTUM_FACTS[longest].title.length + QUANTUM_FACTS[longest].text.length + QUANTUM_FACTS[longest].aside.length ? index : longest, 0);
    const replies = FARE_RIDERS.flatMap(rider => PASSENGER_QUANTUM_RESPONSES[rider.id].map((response, replyIndex) => ({ riderId: rider.id, replyIndex, response })));
    const reply = replies.reduce((longest, reply) => reply.response.length > longest.response.length ? reply : longest);
    fixture.start("quantum", false, { factIndex, ...reply });
    return { title: QUANTUM_FACTS[factIndex].title, response: reply.response };
  },
  state() { const g = gameRef.current; return { elapsed: g.elapsed, time: g.timeLeft, x: g.x, y: g.y, fare: g.fare, mode: modeRef.current, stories: [...stories] }; },
};
declare global { interface Window { accordEventsScene: typeof fixture } }
window.accordEventsScene = fixture;
const mount = document.createElement("div"); document.body.append(mount); createRoot(mount).render(<Scene />);
