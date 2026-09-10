"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  CAMERA_OPTIONS,
  CAMERA_STORAGE_KEY,
  DEFAULT_CAMERA_MODE,
  cameraLabel,
  defaultCameraBoom,
  isCameraMode,
} from "@/game/config";
import { EMPTY_HUD, makeHud } from "@/game/hud";
import { TouchDriving } from "./runtime/touch-driving";
import { rankFor } from "@/game/math";
import {
  clearCustomDestination,
  setCustomDestination,
} from "@/game/custom-destination";
import type {
  Camera,
  CameraMode,
  DrivingModel,
  DrivingTraitId,
  Game,
  Hud,
  InputState,
  Modal,
  Mode,
  RunKind,
  RunRecord,
  WorldPoint,
} from "@/game/model";
import { drivingTraitPackage } from "@/game/driving-traits";
import { regionalPlaceName } from "@/game/regions";
import { makeGame } from "@/game/state";
import {
  refreshFareDispatch,
  setFareDispatchEnabled,
} from "@/game/fare-selection";
import {
  acceptCourierContract,
} from "@/game/courier";
import { districtName } from "@/game/world";
import { effectiveCameraMode } from "@/game/render/camera";
import {
  isDriving,
  isInterior,
} from "@/game/player";
import {
  applyCareerRunBonuses,
  rechargeTaxiAtHome,
  type CareerItemId,
} from "@/game/career";
import { gasStationOfferName, type GasStationOfferId } from "@/game/gas-station";
import {
  fareArtAsset,
  fareArtFrame,
} from "@/game/fare-presentation";
import type { CourierImpact } from "./courier-impact-overlay";
import { useCareer } from "./use-career";
import { normalizeRunRecords } from "./runtime/run-records";
import { useFareCardDeck } from "./use-fare-card-deck";
import { GameModalHost } from "./game-modal-host";
import { GameModeMenu } from "./game-mode-menu";
import { GameSessionOverlays } from "./game-session-overlays";
import { GameStageHud } from "./game-stage-hud";
import {
  DiagnosticsRecorder,
  diagnosticsEnabled,
} from "./runtime/diagnostics";
import { presentSimulationEvents } from "./runtime/present-simulation-events";
import { reportRuntimeError } from "./runtime/runtime-errors";
import { useGameRuntime } from "./runtime/use-game-runtime";
import { copyText } from "./runtime/copy-text";
import { recoverToRoad } from "@/game/recovery";


function freshRunSeed() {
  const values = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(values);
    return values[0];
  }
  return (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0;
}

/** Warm only the portrait sheets represented by the active six-fare market. */
function warmPassengerArt(jobs: Game["fareJobs"]) {
  if (typeof window === "undefined") return;
  const sheets = new Set(jobs.map((job) => fareArtFrame(job.passengerArtCell).sheet));
  for (const sheet of sheets) {
    const image = new window.Image();
    image.src = fareArtAsset("pickup", sheet);
  }
}

export default function Home() {
  const canvas2dRef = useRef<HTMLCanvasElement>(null);
  const webGpuCanvasRef = useRef<HTMLCanvasElement>(null);
  const passengerReviewRef = useRef<HTMLDivElement>(null);
  const navigationDistanceRef = useRef<HTMLDivElement>(null);
  const taxiExitRef = useRef<HTMLButtonElement>(null);
  const selectingDriverRef = useRef(false);
  const [initialGame] = useState(() => makeGame());
  const gameRef = useRef<Game>(initialGame);
  const cameraRef = useRef<Camera>({ x: 0, y: 0, zoom: 1, heading: -Math.PI / 2, mode: DEFAULT_CAMERA_MODE, boom: defaultCameraBoom(DEFAULT_CAMERA_MODE), heightOffset: 0, onFoot: false });
  const cameraModeRef = useRef<CameraMode>(DEFAULT_CAMERA_MODE);
  const inputRef = useRef<InputState>({
    up: false,
    down: false,
    left: false,
    right: false,
    boost: false,
    sprint: false,
    jump: false,
    crouch: false,
  });
  const interactionPulseRef = useRef(false);
  const [touchDriving] = useState(() => new TouchDriving());
  const jumpPulseRef = useRef(false);
  const modeRef = useRef<Mode>("menu");
  const mutedRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const engineRef = useRef<{ osc: OscillatorNode; gain: GainNode } | null>(null);
  const boostAudioActiveRef = useRef(false);
  const uTurnActiveRef = useRef(false);
  const modalDialogRef = useRef<HTMLElement | null>(null);
  const modalTriggerRef = useRef<HTMLElement | null>(null);
  const previousModalRef = useRef<Modal>(null);
  const resumeAfterModalRef = useRef(false);
  const courierImpactTimerRef = useRef<number | null>(null);
  const runResultBankedRef = useRef(false);
  const [mode, setModeState] = useState<Mode>("menu");
  const [pendingRunKind, setPendingRunKind] = useState<RunKind>("timed");
  const [pendingDrivingModel, setPendingDrivingModel] = useState<DrivingModel>("arcade");
  const [modal, setModal] = useState<Modal>(null);
  useEffect(() => { selectingDriverRef.current = modal === "traits"; }, [modal]);
  const [modalParent, setModalParent] = useState<"home" | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraMode, setCameraModeState] = useState<CameraMode>(DEFAULT_CAMERA_MODE);
  const [hud, setHud] = useState<Hud>(EMPTY_HUD);
  const [rendererKind, setRendererKind] = useState("CANVAS FALLBACK");
  const [records, setRecords] = useState<RunRecord[]>([]);
  const [best, setBest] = useState(0);
  const [audioAnnouncement, setAudioAnnouncement] = useState("");
  const [homeNotice, setHomeNotice] = useState("");
  const [courierNotice, setCourierNotice] = useState("");
  const [gasNotice, setGasNotice] = useState("");
  const [mapNotice, setMapNotice] = useState("TAP A STREET TO SET GPS");
  const [courierImpact, setCourierImpact] = useState<CourierImpact | null>(null);
  const [diagnostics] = useState(() => new DiagnosticsRecorder());
  const [diagnosticsActive] = useState(() => diagnosticsEnabled());
  const [diagnosticsNotice, setDiagnosticsNotice] = useState("");
  const { career, careerRef, ready: careerReady, bankRun, buyItem, buyGasStationOffer } = useCareer();
  const {
    history: fareCards,
    docked: dockedFareCards,
    active: fareImpact,
    addFareCard: triggerFareImpact,
    resetFareCards,
  } = useFareCardDeck(mode === "paused");

  const clearInput = useCallback(() => {
    touchDriving.reset();
    inputRef.current = {
      up: false,
      down: false,
      left: false,
      right: false,
      boost: false,
      sprint: false,
      jump: false,
      crouch: false,
      interact: false,
    };
    interactionPulseRef.current = false;
    jumpPulseRef.current = false;
  }, [touchDriving]);

  const checkpointExternalGameChange = useCallback((reason: string) => {
    if (diagnosticsActive) diagnostics.recordExternalCheckpoint(reason, gameRef.current);
  }, [diagnostics, diagnosticsActive]);

  const triggerCourierImpact = useCallback((impact: Omit<CourierImpact, "id">) => {
    if (courierImpactTimerRef.current !== null) window.clearTimeout(courierImpactTimerRef.current);
    const next = { ...impact, id: Date.now() };
    setCourierImpact(next);
    courierImpactTimerRef.current = window.setTimeout(() => {
      setCourierImpact((current) => current?.id === next.id ? null : current);
      courierImpactTimerRef.current = null;
    }, impact.kind === "pickup" ? 900 : 1040);
  }, []);

  useEffect(() => () => {
    if (courierImpactTimerRef.current !== null) window.clearTimeout(courierImpactTimerRef.current);
  }, []);

  const setMode = useCallback((next: Mode) => {
    const leavingPlay = modeRef.current === "playing" && next !== "playing";
    if (next !== "playing") {
      clearInput();
      gameRef.current.boosting = false;
      boostAudioActiveRef.current = false;
      setHud((current) => current.boosting ? { ...current, boosting: false } : current);
    }
    if (leavingPlay) checkpointExternalGameChange(`mode:${next}`);
    modeRef.current = next;
    setModeState(next);
    if (next === "menu") {
      resetFareCards();
      setCourierImpact(null);
    }
  }, [checkpointExternalGameChange, clearInput, resetFareCards]);

  const setCameraMode = useCallback((next: CameraMode) => {
    cameraModeRef.current = next;
    cameraRef.current.mode = next;
    cameraRef.current.heading = gameRef.current.heading;
    cameraRef.current.boom = defaultCameraBoom(next);
    setCameraModeState(next);
    setAudioAnnouncement(`Camera changed to ${cameraLabel(next)}.`);
    try { localStorage.setItem(CAMERA_STORAGE_KEY, next); } catch {}
  }, []);

  const cycleCamera = useCallback(() => {
    const index = CAMERA_OPTIONS.findIndex((option) => option.id === cameraModeRef.current);
    setCameraMode(CAMERA_OPTIONS[(index + 1) % CAMERA_OPTIONS.length].id);
  }, [setCameraMode]);

  const tone = useCallback((frequency: number, duration: number, type: OscillatorType = "square", endFrequency = frequency) => {
    if (mutedRef.current || !audioRef.current || !masterRef.current) return;
    const context = audioRef.current;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), context.currentTime + duration);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.13, context.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    osc.connect(gain).connect(masterRef.current);
    osc.start();
    osc.stop(context.currentTime + duration + 0.02);
  }, []);

  useEffect(() => {
    if (hud.needsUTurn && !uTurnActiveRef.current && mode !== "menu") {
      setAudioAnnouncement("Wrong way. Make a U-turn when safe.");
      tone(760, 0.09, "square", 520);
      window.setTimeout(() => tone(520, 0.12, "square", 300), 95);
    }
    uTurnActiveRef.current = hud.needsUTurn;
  }, [hud.needsUTurn, mode, tone]);

  const ensureAudio = useCallback(() => {
    if (audioRef.current) {
      void audioRef.current.resume();
      return;
    }
    const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    const context = new AudioCtor();
    const master = context.createGain();
    master.gain.value = mutedRef.current ? 0 : 0.24;
    master.connect(context.destination);
    const osc = context.createOscillator();
    const engineGain = context.createGain();
    osc.type = "triangle";
    osc.frequency.value = 58;
    engineGain.gain.value = 0.0001;
    osc.connect(engineGain).connect(master);
    osc.start();
    audioRef.current = context;
    masterRef.current = master;
    engineRef.current = { osc, gain: engineGain };
  }, []);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    if (masterRef.current && audioRef.current) {
      masterRef.current.gain.setTargetAtTime(next ? 0 : 0.24, audioRef.current.currentTime, 0.03);
    }
  }, []);

  const openModal = useCallback((next: Exclude<Modal, null>) => {
    const shouldResume = modeRef.current === "playing";
    resumeAfterModalRef.current = shouldResume;
    setModalParent(null);
    if (next === "map") {
      const game = gameRef.current;
      const destination = game.customDestination;
      setMapNotice(destination
        ? game.fareDispatchEnabled
          ? "CUSTOM ROUTE ACTIVE · MOVE THE PIN OR RETURN TO THE JOB"
          : "CUSTOM ROUTE ACTIVE · MOVE THE PIN OR CLEAR THE ROUTE"
        : game.fareDispatchEnabled
          ? "TAP A STREET TO SET GPS"
          : "OFF DUTY · TAP A STREET FOR AN OPTIONAL ROUTE");
    }
    if (shouldResume) {
      setMode("paused");
      setAudioAnnouncement("Game paused.");
    }
    setModal(next);
  }, [setMode]);

  const closeModal = useCallback(() => {
    if (modalParent === "home" && modal !== "home") {
      setModalParent(null);
      setModal("home");
      setAudioAnnouncement("Back at the Home Hub.");
      return;
    }
    const shouldResume = resumeAfterModalRef.current;
    resumeAfterModalRef.current = false;
    setModalParent(null);
    setModal(null);
    if (shouldResume && modeRef.current === "paused") setMode("playing");
  }, [modal, modalParent, setMode]);

  const openHomeSubview = useCallback((next: "map" | "scores" | "courier") => {
    setModalParent("home");
    if (next === "map") {
      const game = gameRef.current;
      const destination = game.customDestination;
      setMapNotice(destination
        ? game.fareDispatchEnabled
          ? "CUSTOM ROUTE ACTIVE · MOVE THE PIN OR RETURN TO THE JOB"
          : "CUSTOM ROUTE ACTIVE · MOVE THE PIN OR CLEAR THE ROUTE"
        : game.fareDispatchEnabled
          ? "TAP A STREET TO SET GPS"
          : "OFF DUTY · TAP A STREET FOR AN OPTIONAL ROUTE");
    }
    setModal(next);
  }, []);

  const selectCustomDestination = useCallback((point: WorldPoint) => {
    const destination = setCustomDestination(gameRef.current, point);
    if (!destination) {
      setMapNotice("CHOOSE A STREET INSIDE AN ACTIVE REGION");
      setAudioAnnouncement("That point is outside the active road network.");
      return;
    }
    const place = regionalPlaceName(destination.x, destination.y) ?? districtName(destination.x, destination.y);
    const game = gameRef.current;
    checkpointExternalGameChange("custom-destination:set");
    setHud(makeHud(game));
    setMapNotice(`ROUTE SET · ${place}`);
    setAudioAnnouncement(game.fareDispatchEnabled
      ? `Custom GPS route set for ${place}. Your current job remains active.`
      : `Custom GPS route set for ${place}. Passenger dispatch remains off.`);
    tone(660, 0.13, "square", 940);
  }, [checkpointExternalGameChange, tone]);

  const removeCustomDestination = useCallback(() => {
    const game = gameRef.current;
    if (!clearCustomDestination(game)) return;
    const streamed = game.fareDispatchEnabled && refreshFareDispatch(game);
    if (streamed) warmPassengerArt(game.fareJobs);
    checkpointExternalGameChange("custom-destination:clear");
    setHud(makeHud(game));
    setMapNotice(game.fareDispatchEnabled
      ? "CUSTOM ROUTE CLEARED · JOB ROUTE RESTORED"
      : "CUSTOM ROUTE CLEARED · OFF DUTY");
    setAudioAnnouncement(game.fareDispatchEnabled
      ? "Custom GPS route cleared. Job route restored."
      : "Custom GPS route cleared. Remaining off duty.");
    tone(310, 0.1, "square", 180);
  }, [checkpointExternalGameChange, tone]);

  const getUnstuck = useCallback(() => {
    if (modeRef.current !== "paused") return;
    clearInput();
    const game = gameRef.current;
    const recovery = recoverToRoad(game);
    if (!recovery) {
      setAudioAnnouncement("Rescue is not ready. Resume your run and try again.");
      return;
    }
    Object.assign(cameraRef.current, { x: game.x, y: game.y, heading: game.heading, heightOffset: game.z,
      onFoot: false, boom: defaultCameraBoom(cameraModeRef.current), zoom: 1 });
    checkpointExternalGameChange("roadside-recovery");
    setHud(makeHud(game));
    setMode("playing");
    setAudioAnnouncement(recovery.cost ? `Back on the nearest clear road. Tow paid: ${recovery.cost} dollars from run fare.`
      : "Back on the nearest clear road. This tow is on the house.");
    tone(220, .13, "triangle", 440);
  }, [checkpointExternalGameChange, clearInput, setMode, tone]);

  const toggleFareDispatch = useCallback(() => {
    const game = gameRef.current;
    if (game.onboard || game.activeCourier) {
      const message = "FINISH THE CURRENT JOB BEFORE CHANGING DUTY STATUS.";
      setMapNotice(message);
      setAudioAnnouncement(message);
      return;
    }
    const enabled = !game.fareDispatchEnabled;
    const fareJobsBefore = game.fareJobs;
    if (!setFareDispatchEnabled(game, enabled)) return;
    if (game.fareJobs !== fareJobsBefore) warmPassengerArt(game.fareJobs);
    checkpointExternalGameChange(`fare-dispatch:${enabled ? "on" : "off"}`);
    setHud(makeHud(game));
    if (enabled) {
      const customRouteActive = Boolean(game.customDestination);
      setMapNotice(customRouteActive
        ? "ON DUTY · CUSTOM ROUTE STAYS ACTIVE"
        : "ON DUTY · NEAREST FARE GUIDANCE RESTORED");
      setAudioAnnouncement(customRouteActive
        ? "Fare dispatch on. Your custom GPS route remains active; fare guidance will resume when it is cleared."
        : "Fare dispatch on. Nearest fare guidance restored.");
      tone(520, 0.09, "square", 760);
    } else {
      setMapNotice("OFF DUTY · PASSENGER MARKERS AND FARE GUIDANCE HIDDEN");
      setAudioAnnouncement("Fare dispatch off. Passenger markers and fare guidance hidden. Custom GPS remains available.");
      tone(310, 0.09, "square", 220);
    }
  }, [checkpointExternalGameChange, tone]);

  const requestStartRun = useCallback((runKind: RunKind = "timed", requestedModel: DrivingModel = "arcade") => {
    selectingDriverRef.current = true;
    clearInput();
    ensureAudio();
    const drivingModel: DrivingModel = runKind === "free-run" ? requestedModel : "arcade";
    setPendingRunKind(runKind);
    setPendingDrivingModel(drivingModel);
    resumeAfterModalRef.current = false;
    setModalParent(null);
    setModal("traits");
    setAudioAnnouncement(drivingModel === "simulation"
      ? "Simulation Free Run with no timer. Review the Crown Cab specification, then start the simulation."
      : `${runKind === "free-run" ? "Arcade Free Run with no timer" : "Timed arcade shift"}. Choose Street Ace, Drift Demon, or Redline Rush.`);
    tone(300, 0.08, "square", 520);
  }, [clearInput, ensureAudio, tone]);

  const beginRun = useCallback((drivingTraitId: DrivingTraitId) => {
    selectingDriverRef.current = false;
    clearInput();
    ensureAudio();
    resetFareCards();
    setCourierImpact(null);
    setCourierNotice("");
    setDiagnosticsNotice("");
    diagnostics.reset();
    uTurnActiveRef.current = false;
    const runKind = pendingRunKind;
    const drivingModel = pendingDrivingModel;
    const game = makeGame(drivingTraitId, freshRunSeed(), runKind, drivingModel);
    warmPassengerArt(game.fareJobs);
    runResultBankedRef.current = false;
    applyCareerRunBonuses(game, careerRef.current);
    gameRef.current = game;
    cameraRef.current = {
      x: game.x,
      y: game.y,
      zoom: 1,
      heading: game.heading,
      mode: cameraModeRef.current,
      boom: defaultCameraBoom(cameraModeRef.current),
      heightOffset: 0,
      onFoot: false,
    };
    setHud(makeHud(game));
    resumeAfterModalRef.current = false;
    setModalParent(null);
    setModal(null);
    setMode("countdown");
    setAudioAnnouncement(drivingModel === "simulation"
      ? "Crown Cab simulation ready. Automatic transmission in drive. Three, two, one."
      : `${drivingTraitPackage(drivingTraitId).name} locked in. ${runKind === "free-run" ? "Free Run" : "Arcade shift"} starting. Three, two, one.`);
    tone(420, 0.08, "square", 350);
  }, [careerRef, clearInput, diagnostics, ensureAudio, pendingDrivingModel, pendingRunKind, resetFareCards, setMode, tone]);

  const finishRun = useCallback(() => {
    if (runResultBankedRef.current) return;
    runResultBankedRef.current = true;
    const game = gameRef.current;
    const nextCareer = bankRun(game);
    const rank = rankFor(game.score);
    const record: RunRecord = {
      score: game.score,
      fare: game.fare,
      deliveries: game.deliveries,
      rank,
      date: new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    };
    if (game.runKind === "timed") {
      setRecords((current) => {
        const next = [record, ...current].sort((a, b) => b.score - a.score).slice(0, 5);
        try {
          localStorage.setItem("neon-fare-runs", JSON.stringify(next));
        } catch {}
        return next;
      });
      setBest((current) => Math.max(current, game.score));
    }
    setMode("ended");
    setAudioAnnouncement(game.runKind === "free-run"
      ? `Free Run parked. Score ${game.score}. ${game.fare} dollars banked. Career balance ${nextCareer.bank} dollars.`
      : `Run over. Rank ${rank}. Score ${game.score}. ${game.fare} dollars banked. Career balance ${nextCareer.bank} dollars.`);
    tone(520, 0.45, "sawtooth", 90);
  }, [bankRun, setMode, tone]);

  const purchaseHomeItem = useCallback((id: CareerItemId) => {
    const result = buyItem(id);
    const message = result.status === "purchased"
      ? `${result.item.name} PURCHASED!`
      : result.status === "owned"
        ? `${result.item.name} ALREADY OWNED.`
        : result.status === "locked"
          ? `${result.item.name} IS STILL LOCKED.`
          : `NEED $${result.item.cost - result.state.bank} MORE FOR ${result.item.name}.`;
    setHomeNotice(message);
    setAudioAnnouncement(message);
    tone(result.status === "purchased" ? 760 : 190, 0.12, "square", result.status === "purchased" ? 1040 : 130);
  }, [buyItem, tone]);

  const rechargeAtHome = useCallback(() => {
    const result = rechargeTaxiAtHome(gameRef.current, careerRef.current);
    if (result === "recharged") checkpointExternalGameChange("home:recharge");
    const message = result === "recharged"
      ? "BOOST REFILLED TO 100%!"
      : result === "simulation-disabled"
        ? "THE SIMULATION TAXI HAS NO ARCADE BOOST TANK."
      : result === "used"
        ? "GARAGE REFILL ALREADY USED THIS RUN."
        : result === "locked"
          ? "BUY THE GARAGE HOME BASE FIRST."
          : "RETURN TO NEON LOFTS TO USE THE GARAGE.";
    setHomeNotice(message);
    setAudioAnnouncement(message);
    tone(result === "recharged" ? 620 : 180, 0.12, "square", result === "recharged" ? 980 : 120);
  }, [careerRef, checkpointExternalGameChange, tone]);

  const purchaseGasOffer = useCallback((id: GasStationOfferId) => {
    const game = gameRef.current;
    const result = buyGasStationOffer(game, id);
    if (result.status === "purchased") checkpointExternalGameChange(`gas:${id}`);
    const name = gasStationOfferName(id);
    const message = result.status === "purchased"
      ? id === "time-splash"
        ? `TIME SPLASH! +${result.secondsAdded.toFixed(result.secondsAdded % 1 ? 1 : 0)} SEC · $${result.cost} SPENT.`
        : `${name} INSTALLED! ACTIVE NOW AND ON FUTURE RUNS.`
      : result.status === "owned"
        ? `${name} IS ALREADY INSTALLED.`
        : result.status === "insufficient"
          ? `NEED $${Math.max(0, result.cost - result.state.bank)} MORE BANKED FARE FOR ${name}.`
          : result.status === "timer-disabled"
            ? "FREE RUN HAS NO CLOCK TO REFILL."
          : result.status === "meter-full"
            ? "RUN CLOCK IS ALREADY FULL."
            : result.status === "limit-reached"
              ? "GO-GO GAS PUMPS ARE EMPTY FOR THIS SHIFT."
              : result.status === "taxi-too-far"
                ? "PARK THE TAXI NEAR THE GO-GO GAS ENTRANCE."
                : result.status === "passenger-onboard"
                  ? "DROP OFF YOUR PASSENGER BEFORE SERVICING THE TAXI."
                  : result.status === "locked"
                    ? `${name} IS STILL LOCKED.`
                    : "USE THE COUNTER INSIDE GO-GO GAS.";
    setGasNotice(message);
    setAudioAnnouncement(message);
    setHud(makeHud(game));
    tone(result.status === "purchased" ? 760 : 180, 0.12, "square", result.status === "purchased" ? 1120 : 120);
  }, [buyGasStationOffer, checkpointExternalGameChange, tone]);

  const takeCourierContract = useCallback((id: Parameters<typeof acceptCourierContract>[1]) => {
    const game = gameRef.current;
    const result = acceptCourierContract(game, id);
    if (result.status === "accepted") checkpointExternalGameChange(`courier:${id}`);
    const message = result.status === "accepted"
      ? game.runKind === "free-run"
        ? `${result.contract.cargo} ACCEPTED. PICK UP AT ${result.contract.origin.venue.label}. NO TIMER.`
        : result.bonusSeconds > 0
          ? `${result.contract.cargo} ACCEPTED. +${result.bonusSeconds} SECONDS FOR THE ROUTE. PICK UP AT ${result.contract.origin.venue.label}.`
          : `${result.contract.cargo} ACCEPTED. RUN CLOCK IS FULL. PICK UP AT ${result.contract.origin.venue.label}.`
      : result.status === "passenger-onboard"
        ? "FINISH THE PASSENGER FARE BEFORE TAKING A COURIER JOB."
        : result.status === "active"
          ? "FINISH THE ACTIVE COURIER JOB FIRST."
          : "THAT CONTRACT IS NO LONGER AVAILABLE.";
    setCourierNotice(message);
    setAudioAnnouncement(message);
    setHud(makeHud(game));
    tone(result.status === "accepted" ? 720 : 170, 0.1, "square", result.status === "accepted" ? 980 : 120);
    return result;
  }, [checkpointExternalGameChange, tone]);

  const openFareDeck = useCallback(() => {
    setMode("paused");
    setAudioAnnouncement(`Game paused. Fare deck contains ${fareCards.length} ${fareCards.length === 1 ? "card" : "cards"}.`);
  }, [fareCards.length, setMode]);

  useEffect(() => {
    let saved: unknown;
    try { saved = localStorage.getItem(CAMERA_STORAGE_KEY); } catch {}
    if (!isCameraMode(saved)) return;
    cameraModeRef.current = saved;
    cameraRef.current.mode = saved;
    cameraRef.current.boom = defaultCameraBoom(saved);
    const frame = window.requestAnimationFrame(() => setCameraModeState(saved));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    try {
      const cleaned = normalizeRunRecords(JSON.parse(localStorage.getItem("neon-fare-runs") || "[]"));
      const frame = window.requestAnimationFrame(() => {
        setRecords(cleaned);
        setBest(cleaned.reduce((top, record) => Math.max(top, record.score), 0));
      });
      return () => window.cancelAnimationFrame(frame);
    } catch {}
  }, []);

  const onSimulationEvents = useCallback((events: Parameters<typeof presentSimulationEvents>[0]) => {
    presentSimulationEvents(events, {
      game: () => gameRef.current,
      tone,
      announce: setAudioAnnouncement,
      warmPassengerArt,
      triggerFareImpact,
      triggerCourierImpact,
      setHomeNotice,
      setCourierNotice,
      setGasNotice,
      setHud,
      openModal,
    });
  }, [openModal, tone, triggerCourierImpact, triggerFareImpact]);

  useGameRuntime({
    selectingDriverRef,
    passengerReviewRef,
    navigationDistanceRef,
    taxiExitRef,
    canvas2dRef,
    webGpuCanvasRef,
    gameRef,
    cameraRef,
    cameraModeRef,
    inputRef,
    touchDriving,
    interactionPulseRef,
    jumpPulseRef,
    modeRef,
    mutedRef,
    audioRef,
    engineRef,
    boostAudioActiveRef,
    diagnostics,
    diagnosticsActive,
    clearInput,
    finishRun,
    setMode,
    setHud,
    setRendererKind,
    setAudioAnnouncement,
    tone,
    onSimulationEvents,
  });

  const copyDiagnostics = useCallback(async () => {
    if (!diagnosticsActive) return;
    try {
      const snapshot = diagnostics.snapshot(gameRef.current, modal, modeRef.current);
      await copyText(JSON.stringify(snapshot, null, 2));
      setDiagnosticsNotice("DIAGNOSTICS COPIED");
      setAudioAnnouncement("Diagnostics copied to clipboard.");
    } catch (error) {
      setDiagnosticsNotice("COPY FAILED");
      setAudioAnnouncement("Diagnostics could not be copied.");
      reportRuntimeError("diagnostics-copy", error);
    }
  }, [diagnostics, diagnosticsActive, modal]);

  useEffect(() => () => {
    try { engineRef.current?.osc.stop(); } catch {}
    const context = audioRef.current;
    engineRef.current = null;
    masterRef.current = null;
    audioRef.current = null;
    if (context && context.state !== "closed") void context.close().catch(() => {});
  }, []);

  useEffect(() => {
    if (!modal) {
      if (previousModalRef.current) {
        modalTriggerRef.current?.focus();
        modalTriggerRef.current = null;
      }
      previousModalRef.current = null;
      return;
    }

    if (!previousModalRef.current) {
      modalTriggerRef.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    }
    previousModalRef.current = modal;

    const focusableSelector = [
      "button:not([disabled])",
      "a[href]",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");
    const frame = window.requestAnimationFrame(() => {
      const dialog = modalDialogRef.current;
      const first = modal === "traits"
        ? dialog?.querySelector<HTMLElement>("[data-modal-autofocus='true']")
        : dialog?.querySelector<HTMLElement>(focusableSelector);
      (first ?? dialog)?.focus();
    });
    const onModalKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = modalDialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onModalKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onModalKeyDown);
    };
  }, [closeModal, modal]);

  useEffect(() => {
    const keyFor = (event: KeyboardEvent, pressed: boolean) => {
      const key = event.key.toLowerCase();
      if (modal !== null) return;
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
      const walkingNow = !isDriving(gameRef.current);
      if (key === "w" || key === "arrowup") inputRef.current.up = pressed;
      if (key === "s" || key === "arrowdown") inputRef.current.down = pressed;
      if (key === "a" || key === "arrowleft") inputRef.current.left = pressed;
      if (key === "d" || key === "arrowright") inputRef.current.right = pressed;
      if (key === " ") {
        if (!pressed) {
          inputRef.current.boost = false;
          inputRef.current.jump = false;
        } else if (walkingNow) {
          inputRef.current.boost = false;
          inputRef.current.jump = true;
        } else {
          inputRef.current.jump = false;
          inputRef.current.boost = true;
        }
      }
      if (key === "shift") inputRef.current.sprint = pressed;
      if (key === "control") inputRef.current.crouch = pressed;
      if (key === "c") {
        inputRef.current.crouch = walkingNow ? pressed : false;
      }
      if (key === "e" && !event.repeat) inputRef.current.interact = pressed && modeRef.current === "playing" && modal === null;
      if (!pressed) return;
      if ((key === "p" || key === "escape") && modal === null) {
        if (modeRef.current === "playing") {
          setMode("paused");
          setAudioAnnouncement("Game paused.");
        } else if (modeRef.current === "paused") {
          setMode("playing");
          setAudioAnnouncement("Game resumed.");
        }
      }
      if (key === "m") toggleMute();
      if (key === "g" && modal === null && modeRef.current !== "menu" && !isInterior(gameRef.current)) openModal("map");
      if (key === "c" && !event.repeat && modal === null && modeRef.current !== "menu" && !walkingNow) cycleCamera();
    };
    const down = (event: KeyboardEvent) => keyFor(event, true);
    const up = (event: KeyboardEvent) => keyFor(event, false);
    window.addEventListener("keydown", down, { passive: false });
    window.addEventListener("keyup", up, { passive: false });
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [cycleCamera, modal, openModal, setMode, toggleMute]);

  const handleTouch = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const key = event.currentTarget.dataset.input as Exclude<keyof InputState, "steer">;
    const active = event.type === "pointerdown";
    if (active && modeRef.current !== "playing") return;
    inputRef.current[key] = active;
    event.currentTarget.toggleAttribute("data-held", active);
    if (active && key === "jump") jumpPulseRef.current = true;
    if (active) event.currentTarget.setPointerCapture?.(event.pointerId);
  }, []);

  const pulseInteraction = useCallback(() => {
    interactionPulseRef.current = true;
  }, []);

  const returnHome = useCallback(() => {
    if (mode === "menu") return;
    const game = gameRef.current;
    if (game.runKind === "free-run" && mode !== "ended") {
      setMode("paused");
      setAudioAnnouncement("Free Run paused. Resume the city or end the session to bank your fare.");
      return;
    }
    setMode("menu");
  }, [mode, setMode]);

  return (
    <main className={`arcade-shell mode-${mode}`}>
      <header className="topbar" inert={modal ? true : undefined} aria-hidden={modal ? true : undefined}>
        <button className="brand" onClick={returnHome} aria-label="Neon Fare home" disabled={!careerReady}>
          <span>NEON FARE</span>
          <i aria-hidden="true"><b /><b /><b /><b /><b /><b /></i>
        </button>
        <nav aria-label="Game navigation">
          <button onClick={() => openModal("how")} disabled={!careerReady}>HOW TO PLAY</button>
          <span aria-hidden="true" />
          <button onClick={() => openModal("scores")} disabled={!careerReady}>RUN LOG</button>
          <span aria-hidden="true" />
          <button onClick={toggleMute} disabled={!careerReady}>{muted ? "AUDIO OFF" : "AUDIO ON"}</button>
        </nav>
      </header>

      <section
        className={`game-stage camera-${effectiveCameraMode(hud.playerMode, cameraMode)} player-${hud.playerMode} driving-${hud.drivingModel} ${hud.playerMode !== "driving" ? `on-foot-${hud.onFootAction}` : ""} ${mode === "playing" && hud.boosting ? "is-boosting" : ""} ${hud.drifting ? "is-drifting" : ""} ${hud.message.startsWith("KRAK") || hud.message.startsWith("WHAM") ? "is-crashed" : ""}`}
        style={{ "--drift-intensity": hud.driftIntensity } as CSSProperties}
        aria-label="Neon Fare arcade game"
        inert={modal ? true : undefined}
        aria-hidden={modal ? true : undefined}
      >
        <canvas
          ref={canvas2dRef}
          className={`game-canvas ${rendererKind !== "WEBGPU ACTIVE" ? "is-active" : ""}`}
          aria-hidden={rendererKind === "WEBGPU ACTIVE"}
        />
        <canvas
          ref={webGpuCanvasRef}
          className={`game-canvas ${rendererKind === "WEBGPU ACTIVE" ? "is-active" : ""}`}
          aria-hidden={rendererKind !== "WEBGPU ACTIVE"}
        />
        <div className="print-noise" aria-hidden="true" />
        <div ref={passengerReviewRef} className="passenger-review" role="status" hidden />
        <div ref={navigationDistanceRef} className="navigation-distance" role="img" aria-label="Road guidance" hidden>
          <span /><strong /><small />
        </div>
        <div className="speed-fx" aria-hidden="true">
          <i /><i /><i /><i /><i /><i /><i /><i />
          <i /><i /><i /><i /><i /><i /><i /><i />
          <b className="speed-fx__hit">BOOST!</b>
          <span className="speed-fx__slash speed-fx__slash--left" />
          <span className="speed-fx__slash speed-fx__slash--right" />
        </div>
        <GameStageHud
          mode={mode}
          hud={hud}
          cameraMode={cameraMode}
          rendererKind={rendererKind}
          fareImpact={fareImpact}
          courierImpact={courierImpact}
          dockedFareCards={dockedFareCards}
          onOpenFareDeck={openFareDeck}
          onOpenMap={() => openModal("map")}
          onCycleCamera={cycleCamera}
          onPulseInteraction={pulseInteraction}
          onSetMode={setMode}
          onTouch={handleTouch}
          touchDriving={touchDriving}
          taxiExitRef={taxiExitRef}
        />
        {mode === "menu" && (
          <GameModeMenu
            ready={careerReady}
            rendererKind={rendererKind}
            careerBank={career.bank}
            best={best}
            onRequestStartRun={requestStartRun}
          />
        )}

        <GameSessionOverlays
          mode={mode}
          hud={hud}
          cameraMode={cameraMode}
          careerBank={career.bank}
          fareCards={fareCards}
          diagnosticsActive={diagnosticsActive}
          diagnosticsNotice={diagnosticsNotice}
          muted={muted}
          onToggleMute={toggleMute}
          onOpenMap={() => openModal("map")}
          onSetCameraMode={setCameraMode}
          onSetMode={setMode}
          onOpenHow={() => openModal("how")}
          onFinishRun={finishRun}
          onToggleFareDispatch={toggleFareDispatch}
          onRequestStartRun={requestStartRun}
          onOpenScores={() => openModal("scores")}
          onCopyDiagnostics={copyDiagnostics}
          onRecover={getUnstuck}
        />
      </section>

      <GameModalHost
        modal={modal}
        modalParent={modalParent}
        mode={mode}
        pendingRunKind={pendingRunKind}
        pendingDrivingModel={pendingDrivingModel}
        hud={hud}
        career={career}
        records={records}
        mapNotice={mapNotice}
        homeNotice={homeNotice}
        courierNotice={courierNotice}
        gasNotice={gasNotice}
        dialogRef={modalDialogRef}
        onClose={closeModal}
        onBeginRun={beginRun}
        onSelectDestination={selectCustomDestination}
        onRemoveDestination={removeCustomDestination}
        onToggleFareDispatch={toggleFareDispatch}
        onPurchaseHomeItem={purchaseHomeItem}
        onRechargeAtHome={rechargeAtHome}
        onOpenHomeSubview={openHomeSubview}
        onPurchaseGasOffer={purchaseGasOffer}
        onTakeCourierContract={takeCourierContract}
        onRequestStartRun={requestStartRun}
      />

      <div className="sr-only" aria-live="polite" aria-atomic="true">{audioAnnouncement}</div>
    </main>
  );
}
