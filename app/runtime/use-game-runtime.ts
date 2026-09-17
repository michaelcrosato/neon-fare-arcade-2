"use client";

import { useEffect } from "react";
import {
  COLLISION_STREAM_RADIUS,
  DISTANT_STREAM_RADIUS,
  FIXED_DT,
  cameraDistanceScale,
  chaseCameraPreset,
} from "@/game/config";
import { makeHud } from "@/game/hud";
import { normalizeAngle } from "@/game/math";
import type {
  Camera,
  CameraMode,
  Game,
  Hud,
  InputState,
  Mode,
  NavigationPlan,
  Renderer,
  WorldView,
} from "@/game/model";
import { NavigationController } from "@/game/navigation";
import { developmentTimeScale, navigationSettingsForGame } from "@/game/development-settings";
import {
  cameraBoomLimit,
  chaseCameraEyeHeight,
  effectiveCameraMode,
} from "@/game/render/camera";
import { runHasExpired } from "@/game/run-rules";
import { stepGame, type SimulationEvent } from "@/game/simulation";
import { advancePathTraffic } from "@/game/traffic";
import { CityStream } from "@/game/world";
import { sceneWorld } from "@/game/exploration";
import {
  controlledPose,
  isDriving,
  isInterior,
  walkingCameraHeightOffset,
} from "@/game/player";
import { Canvas2DRenderer } from "../canvas2d-renderer";
import { subscribeGraphicsPreference } from "../graphics-quality";
import { vehicleDetailSetting } from "../vehicle-graphics";
import {
  createWebGPURenderer,
  type WebGPURenderer,
} from "../webgpu-renderer";
import type { DiagnosticsRecorder } from "./diagnostics";
import { reportRuntimeError } from "./runtime-errors";
import { BackgroundMusic } from "./background-music";
import { getAudioSettings } from "../audio-settings";
import { audioMix } from "./audio-settings";
import { mergeDrivingInput, type TouchDriving } from "./touch-driving";
import { presentPassengerReview } from "./passenger-review";
import { presentTaxiExitAction } from "./taxi-exit-action";
import { presentNavigationDistance } from "./navigation-distance";
import { presentClutchWarning } from "./clutch-warning";
import { presentFareImpact } from "./fare-impact-layout";
import { MOBILE_QUERY } from "../use-mobile-layout";
import { protectGameGestures } from "./game-display";
import { connectedGamepads, GamepadInput, mergeGamepadInput, type GamepadActions } from "./gamepad-input";

type RefBox<T> = { current: T };

export type GameRuntimeOptions = Readonly<{
  passengerReviewRef: RefBox<HTMLDivElement | null>;
  navigationDistanceRef: RefBox<HTMLDivElement | null>;
  clutchWarningRef: RefBox<HTMLDivElement | null>;
  fareImpactRef: RefBox<HTMLDivElement | null>;
  taxiExitRef: RefBox<HTMLButtonElement | null>;
  canvas2dRef: RefBox<HTMLCanvasElement | null>;
  webGpuCanvasRef: RefBox<HTMLCanvasElement | null>;
  gameRef: RefBox<Game>;
  cameraRef: RefBox<Camera>;
  cameraModeRef: RefBox<CameraMode>;
  inputRef: RefBox<InputState>;
  touchDriving: TouchDriving;
  interactionPulseRef: RefBox<boolean>;
  jumpPulseRef: RefBox<boolean>;
  modeRef: RefBox<Mode>;
  audioRef: RefBox<AudioContext | null>;
  ensureAudio?: () => void;
  engineRef: RefBox<{ osc: OscillatorNode; gain: GainNode } | null>;
  boostAudioActiveRef: RefBox<boolean>;
  diagnostics: DiagnosticsRecorder;
  diagnosticsActive: boolean;
  clearInput: () => void;
  finishRun: () => void;
  setMode: (mode: Mode) => void;
  setHud: (hud: Hud) => void;
  setRendererKind: (kind: string) => void;
  setAudioAnnouncement: (message: string) => void;
  tone: (frequency: number, duration: number, type?: OscillatorType, endFrequency?: number) => void;
  onSimulationEvents: (events: readonly SimulationEvent[]) => void;
  onGamepadActions: (actions: GamepadActions) => void;
}>;

/** Owns the browser clock, world streaming, renderer fallback, and fixed-step loop. */
export function useGameRuntime(options: GameRuntimeOptions) {
  const {
    passengerReviewRef,
    navigationDistanceRef,
    clutchWarningRef,
    fareImpactRef,
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
    audioRef,
    ensureAudio,
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
    onGamepadActions,
  } = options;

  useEffect(() => {
    const canvas2d = canvas2dRef.current;
    const webGpuCanvas = webGpuCanvasRef.current;
    if (!canvas2d || !webGpuCanvas) return;
    let cancelled = false;
    let raf = 0;
    let last = performance.now();
    let accumulator = 0;
    let hudClock = 0;
    let gpuUnavailable = false;
    let fallbackRenderer: Canvas2DRenderer | null = null;
    let gpuRenderer: WebGPURenderer | null = null;
    let activeRenderer: Renderer | null = null;
    const cityStream = new CityStream();
    const navigationController = new NavigationController();
    const gamepad = new GamepadInput();
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const mobileLayout = window.matchMedia(MOBILE_QUERY);
    const stage = canvas2d.closest<HTMLElement>(".game-stage");
    const releaseGestures = stage ? protectGameGestures(stage, () => mobileLayout.matches
      && (modeRef.current === "playing" || modeRef.current === "countdown")) : undefined;
    let currentCityWorld = cityStream.update(0, 0);
    let currentWorld = sceneWorld(gameRef.current, currentCityWorld);
    let currentNavigation = navigationController.update(gameRef.current, navigationSettingsForGame(gameRef.current));
    let wasInterior = isInterior(gameRef.current);
    let previousEffectiveCameraMode = cameraRef.current.mode;
    const music = new BackgroundMusic(undefined, Math.random, () => audioRef.current);
    const syncMusic = () => music.update(gameRef.current, modeRef.current, getAudioSettings(), document.hidden);
    syncMusic();
    const unlockAudio = () => {
      ensureAudio?.();
      syncMusic();
      music.unlock();
    };
    const audioUnlockEvents = ["pointerdown", "touchstart", "mousedown", "keydown", "click"] as const;
    for (const evt of audioUnlockEvents) {
      window.addEventListener(evt, unlockAudio, { passive: true });
    }

    try {
      fallbackRenderer = new Canvas2DRenderer(canvas2d);
      activeRenderer = fallbackRenderer;
    } catch (error) {
      reportRuntimeError("canvas-init", error);
      queueMicrotask(() => {
        if (!cancelled) setRendererKind("DISPLAY UNAVAILABLE");
      });
    }

    const activateFallback = () => {
      gpuUnavailable = true;
      if (cancelled) return;
      const failedRenderer = gpuRenderer;
      gpuRenderer = null;
      activeRenderer = fallbackRenderer;
      setRendererKind(fallbackRenderer ? "CANVAS FALLBACK" : "DISPLAY UNAVAILABLE");
      failedRenderer?.destroy();
      try { fallbackRenderer?.resize(); } catch (error) {
        reportRuntimeError("canvas-resize", error);
      }
    };

    // `getBoundingClientRect` forces a layout flush. The HUD presenters needed
    // it four times per frame, immediately after the renderers wrote canvas
    // dataset attributes, which invalidated layout again every frame.
    let stageBounds = { width: 0, height: 0 };
    const measureStage = () => {
      // Headless frame-loop tests drive this hook with a stub canvas that has
      // no layout box; the HUD presenters are skipped there anyway.
      const rect = canvas2d.getBoundingClientRect?.();
      stageBounds = { width: rect?.width ?? 0, height: rect?.height ?? 0 };
    };
    measureStage();
    // A resize event is not the only way the stage changes size: entering a
    // mode, rotating, or a CSS change can too. The observer reports the new box
    // without the frame loop having to ask for it.
    const stageObserver = typeof ResizeObserver === "function"
      ? new ResizeObserver((entries) => {
          const box = entries[entries.length - 1]?.contentRect;
          if (box) stageBounds = { width: box.width, height: box.height };
        })
      : null;
    stageObserver?.observe(canvas2d);

    const resize = () => {
      try { fallbackRenderer?.resize(); } catch (error) {
        reportRuntimeError("canvas-resize", error);
      }
      try {
        gpuRenderer?.resize();
      } catch (error) {
        reportRuntimeError("webgpu-resize", error);
        activateFallback();
      }
      measureStage();
    };

    const renderFrame = (game: Game, now: number, world: WorldView, navigation: NavigationPlan) => {
      const renderer = activeRenderer;
      if (!renderer) return;
      const renderSeconds = reducedMotion ? 0 : now / 1000;
      try {
        renderer.render(game, cameraRef.current, renderSeconds, world, navigation);
      } catch (error) {
        reportRuntimeError("render", error, { renderer: renderer.kind });
        if (renderer.kind !== "WebGPU") return;
        activateFallback();
        try {
          fallbackRenderer?.render(game, cameraRef.current, renderSeconds, world, navigation);
        } catch (fallbackError) {
          reportRuntimeError("canvas-fallback-render", fallbackError);
        }
      }
    };

    const requestedStreamRadius = (game: Game) =>
      !isInterior(game) && (!isDriving(game) || cameraModeRef.current !== "fixed")
        ? DISTANT_STREAM_RADIUS
        : COLLISION_STREAM_RADIUS;

    const frame = (now: number) => {
      if (cancelled) return;
      try {
        const wallElapsed = Math.max(0, (now - last) / 1000);
        const elapsed = Math.min(0.05, wallElapsed);
        last = now;
        const game = gameRef.current;
        const pad = gamepad.sample(connectedGamepads(), modeRef.current === "playing", !isDriving(game));
        // Keep edge actions until a fixed tick consumes them, even above 60 Hz.
        if (pad.input.interact) interactionPulseRef.current = true;
        if (pad.input.jump) jumpPulseRef.current = true;
        if (pad.actions.pause || pad.actions.confirm || pad.actions.camera) onGamepadActions(pad.actions);
        accumulator += elapsed * developmentTimeScale(game);
        const currentMode = modeRef.current;
        const preStepFocus = controlledPose(game);
        const preStepStreamFocus = isInterior(game) ? { x: game.x, y: game.y } : preStepFocus;
        const streamRadius = requestedStreamRadius(game);
        currentCityWorld = cityStream.update(
          preStepStreamFocus.x,
          preStepStreamFocus.y,
          streamRadius,
        );
        currentWorld = sceneWorld(game, currentCityWorld);

        if (currentMode === "countdown") {
          game.countdown -= wallElapsed;
          if (game.countdown <= 0) {
            setMode("playing");
            game.message = "GO! GO! GO!";
            game.messageUntil = game.elapsed + 1.2;
            setAudioAnnouncement("Go!");
            tone(720, 0.2, "square", 1040);
          }
        }

        if (currentMode === "playing") {
          while (accumulator >= FIXED_DT && modeRef.current === "playing") {
            touchDriving.tick(FIXED_DT, game.speed);
            const baseInput = isDriving(game)
              ? mergeDrivingInput(inputRef.current, touchDriving.input(game.drivingModel === "simulation"))
              : inputRef.current;
            const input = mergeGamepadInput(baseInput, pad.input);
            const tickInput = interactionPulseRef.current || jumpPulseRef.current
              ? {
                  ...input,
                  interact: interactionPulseRef.current || input.interact,
                  jump: jumpPulseRef.current || input.jump,
                }
              : input;
            let events: readonly SimulationEvent[];
            const randomValues: number[] = [];
            if (diagnosticsActive) {
              diagnostics.beginStep(game, tickInput, {
                focus: { x: preStepStreamFocus.x, y: preStepStreamFocus.y },
                radius: streamRadius,
                worldKey: currentCityWorld.key,
                counts: {
                  chunks: currentCityWorld.chunks.length,
                  boxes: currentCityWorld.boxes.length,
                  colliders: currentCityWorld.colliders.length,
                  interactions: currentCityWorld.interactions.length,
                  surfaceQuads: currentCityWorld.surfaces?.length ?? 0,
                },
              });
            }
            try {
              if (diagnosticsActive) {
                events = stepGame(game, tickInput, FIXED_DT, currentCityWorld, () => {
                  const value = Math.random();
                  randomValues.push(value);
                  return value;
                });
                diagnostics.commitStep(randomValues, events);
              } else {
                events = stepGame(game, tickInput, FIXED_DT, currentCityWorld);
              }
            } catch (error) {
              if (diagnosticsActive) diagnostics.failStep(error, randomValues, game);
              setMode("paused");
              setAudioAnnouncement("Game paused after a simulation error. Copy diagnostics to report it.");
              throw error;
            }
            onSimulationEvents(events);
            pad.input.interact = false;
            pad.input.jump = false;
            interactionPulseRef.current = false;
            jumpPulseRef.current = false;
            accumulator -= FIXED_DT;
          }
          // A service event can open a modal and pause during this frame.
          // Do not run more ticks or carry that paused remainder into resume.
          if (modeRef.current !== "playing") accumulator = 0;
          if (runHasExpired(game)) finishRun();
        } else {
          accumulator = 0;
          for (const traffic of game.traffic) {
            if (currentMode === "menu") {
              const idle = traffic.speed * elapsed * 0.22;
              if (traffic.motion.kind === "path") advancePathTraffic(traffic, idle);
              else if (traffic.motion.axis === "x") traffic.x += traffic.dir * idle;
              else traffic.y += traffic.dir * idle;
            }
          }
        }

        const focus = controlledPose(game);
        const streamFocus = isInterior(game) ? { x: game.x, y: game.y } : focus;
        currentCityWorld = cityStream.update(
          streamFocus.x,
          streamFocus.y,
          requestedStreamRadius(game),
        );
        currentWorld = sceneWorld(game, currentCityWorld);
        const camera = cameraRef.current;
        const interiorNow = isInterior(game);
        const sceneChanged = interiorNow !== wasInterior;
        wasInterior = interiorNow;
        const playerMode = interiorNow ? "interior" : isDriving(game) ? "driving" : "walking";
        camera.mode = effectiveCameraMode(playerMode, cameraModeRef.current);
        camera.onFoot = playerMode !== "driving";
        camera.mobile = mobileLayout.matches;
        camera.vehicleDetail = vehicleDetailSetting(game.vehicleId);
        const cameraModeChanged = camera.mode !== previousEffectiveCameraMode;
        previousEffectiveCameraMode = camera.mode;
        const positionRate = camera.mode === "chase-high" ? 7 : camera.mode === "chase-low" ? 10 : 6;
        const headingRate = camera.mode === "chase-high" ? 8 : camera.mode === "chase-low" ? 11 : camera.mode === "cab" ? 18 : 8;
        const follow = 1 - Math.exp(-positionRate * elapsed);
        if (sceneChanged) {
          camera.x = focus.x;
          camera.y = focus.y;
          camera.heading = focus.heading;
        } else if (camera.mode !== "fixed") {
          camera.x = focus.x;
          camera.y = focus.y;
        } else {
          camera.x += (focus.x - camera.x) * follow;
          camera.y += (focus.y - camera.y) * follow;
        }
        const driftCameraHeading = isDriving(game)
          && !reducedMotion
          && (camera.mode === "chase-high" || camera.mode === "chase-low")
          ? game.driftAngle * game.driftIntensity * 0.5
          : 0;
        const cameraTargetHeading = focus.heading + driftCameraHeading;
        if (camera.mode === "cab" && isDriving(game)) camera.heading = focus.heading;
        else camera.heading += normalizeAngle(cameraTargetHeading - camera.heading) * (1 - Math.exp(-headingRate * elapsed));
        const targetHeightOffset = game.player.kind === "walking"
          ? walkingCameraHeightOffset(game.player.actor, camera.mode, reducedMotion)
          : game.z + (reducedMotion ? 0 : game.roadMotion.heave);
        if (sceneChanged || (camera.mode === "cab" && isDriving(game))) camera.heightOffset = targetHeightOffset;
        else {
          const heightRate = targetHeightOffset < camera.heightOffset ? 18 : 12;
          camera.heightOffset += (targetHeightOffset - camera.heightOffset)
            * (1 - Math.exp(-heightRate * elapsed));
        }
        const boostVisualActive = currentMode === "playing" && isDriving(game) && game.boosting;
        const boostCameraActive = boostVisualActive && !reducedMotion;
        const driftCameraZoom = currentMode === "playing" && isDriving(game) && !reducedMotion
          ? 1 - game.driftIntensity * 0.065
          : 1;
        const targetZoom = isInterior(game)
          ? 1.22
          : playerMode === "walking" && camera.mode === "fixed"
            ? 1.18
            : boostCameraActive
              ? camera.mode === "fixed" ? 0.84 : 0.88
              : driftCameraZoom;
        const zoomRate = boostCameraActive ? 18 : 7;
        camera.zoom += (targetZoom - camera.zoom) * (1 - Math.exp(-zoomRate * elapsed));
        if (camera.mode === "chase-high" || camera.mode === "chase-low") {
          const preset = chaseCameraPreset(camera.mode, camera.onFoot);
          const requested = preset.distance * cameraDistanceScale(camera.distanceScale);
          const requestedHeight = chaseCameraEyeHeight(camera, requested);
          if (cameraModeChanged) camera.boom = requested;
          const limit = cameraBoomLimit(camera, currentWorld, requested, requestedHeight);
          camera.boom = limit < camera.boom
            ? limit
            : camera.boom + (limit - camera.boom) * (1 - Math.exp(-4 * elapsed));
        } else {
          camera.boom = 0;
        }
        currentNavigation = navigationController.update(game, navigationSettingsForGame(game));
        syncMusic();
        renderFrame(game, now, currentWorld, currentNavigation);
        if (navigationDistanceRef.current) {
          if (currentMode !== "playing") navigationDistanceRef.current.hidden = true;
          else {
            presentNavigationDistance(navigationDistanceRef.current, game, camera, reducedMotion ? 0 : now / 1000,
              currentNavigation, stageBounds.width, stageBounds.height);
          }
        }
        if (fareImpactRef.current) {
          presentFareImpact(fareImpactRef.current, Boolean(camera.mobile));
        }
        let taxiExitBounds: ReturnType<typeof presentTaxiExitAction>;
        if (taxiExitRef.current) {
          taxiExitBounds = presentTaxiExitAction(taxiExitRef.current, game, camera, stageBounds.width, stageBounds.height);
        }
        if (clutchWarningRef.current) {
          if (currentMode !== "playing") clutchWarningRef.current.hidden = true;
          else {
            presentClutchWarning(clutchWarningRef.current, game, camera, reducedMotion ? 0 : now / 1000,
              currentNavigation, stageBounds.width, stageBounds.height, taxiExitBounds);
          }
        }
        if (passengerReviewRef.current) {
          if (modeRef.current === "menu" || modeRef.current === "ended" || modeRef.current === "countdown") {
            passengerReviewRef.current.hidden = true;
          } else {
            presentPassengerReview(passengerReviewRef.current, game, cameraRef.current, stageBounds.width, stageBounds.height);
          }
        }

        if (boostVisualActive && !boostAudioActiveRef.current) {
          tone(280, 0.16, "sawtooth", 920);
        }
        boostAudioActiveRef.current = boostVisualActive;
        if (engineRef.current && audioRef.current) {
          const engine = engineRef.current;
          const engineFrequency = game.drivingModel === "simulation"
            ? 46 + game.simulationVehicle.engineRpm * 0.027
            : 58 + game.speed * 4.8 + (boostVisualActive ? 78 : 0);
          engine.osc.frequency.setTargetAtTime(
            engineFrequency,
            audioRef.current.currentTime,
            game.drivingModel === "simulation" ? 0.065 : boostVisualActive ? 0.025 : 0.045,
          );
          engine.gain.gain.setTargetAtTime(
            currentMode === "playing" && isDriving(game) && game.fuel.litres > 0
              ? (game.drivingModel === "simulation"
                ? 0.024 + game.simulationVehicle.throttle * 0.018 + Math.min(0.018, game.speed * 0.0006)
                : 0.028 + game.speed * 0.0015 + (boostVisualActive ? 0.016 : 0)) * audioMix(getAudioSettings(), document.hidden).engine
              : 0,
            audioRef.current.currentTime,
            0.04,
          );
        }
        hudClock += elapsed;
        if (hudClock >= 0.08) {
          hudClock = 0;
          setHud(makeHud(game, currentNavigation, currentWorld));
          if (diagnosticsActive) {
            diagnostics.updateRuntime({
              renderer: activeRenderer?.kind ?? "Unavailable",
              cameraMode: cameraModeRef.current,
              worldKey: currentCityWorld.key,
              playerMode,
              position: { x: focus.x, y: focus.y },
            });
          }
        }
      } catch (error) {
        reportRuntimeError("frame", error, { mode: modeRef.current });
        accumulator = 0;
        last = now;
      } finally {
        if (!cancelled) raf = requestAnimationFrame(frame);
      }
    };

    raf = requestAnimationFrame(frame);
    const activateWebGPU = () => void createWebGPURenderer(
      webGpuCanvas,
      activateFallback,
      () => cancelled || gpuUnavailable,
      (status) => {
        if (!cancelled && !gpuUnavailable) {
          setRendererKind(status);
        }
      },
    ).then((candidate) => {
      if (!candidate) {
        activateFallback();
        return;
      }
      if (cancelled || gpuUnavailable) {
        candidate.destroy();
        return;
      }
      try {
        candidate.resize();
        currentNavigation = navigationController.update(gameRef.current, navigationSettingsForGame(gameRef.current));
        candidate.render(gameRef.current, cameraRef.current, reducedMotion ? 0 : performance.now() / 1000, currentWorld, currentNavigation);
        if (cancelled || gpuUnavailable) {
          candidate.destroy();
          return;
        }
        gpuRenderer = candidate;
        activeRenderer = candidate;
        // Keeping the fallback's WebGL2 context alive costs a second copy of
        // the streamed city plus its horizon textures for the whole session.
        fallbackRenderer?.releaseAcceleratedResources();
        setRendererKind("WEBGPU ACTIVE");
      } catch (error) {
        reportRuntimeError("webgpu-first-frame", error);
        candidate.destroy();
        activateFallback();
      }
    });
    activateWebGPU();

    // A new graphics preset changes the shaders, the bind group layouts and the
    // attachment formats, so the device is rebuilt rather than reconfigured.
    // The Canvas renderer owns the frame while that happens.
    const rebuildGpuRenderer = () => {
      if (cancelled || gpuUnavailable) return;
      const previous = gpuRenderer;
      gpuRenderer = null;
      activeRenderer = fallbackRenderer;
      setRendererKind(fallbackRenderer ? "CANVAS FALLBACK" : "DISPLAY UNAVAILABLE");
      previous?.destroy();
      try { fallbackRenderer?.resize(); } catch (error) {
        reportRuntimeError("canvas-resize", error);
      }
      activateWebGPU();
    };
    const stopGraphicsWatch = subscribeGraphicsPreference(rebuildGpuRenderer);

    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);
    document.addEventListener("fullscreenchange", resize);
    const onVisibility = () => {
      if (document.hidden && modeRef.current === "playing") {
        setMode("paused");
        setAudioAnnouncement("Game paused.");
      }
      syncMusic();
    };
    const onBlur = () => {
      clearInput();
      if (modeRef.current === "playing") {
        setMode("paused");
        setAudioAnnouncement("Game paused.");
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("resize", resize);
      document.removeEventListener("fullscreenchange", resize);
      stageObserver?.disconnect();
      releaseGestures?.();
      stopGraphicsWatch();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      activeRenderer = null;
      gpuRenderer?.destroy();
      fallbackRenderer?.destroy();
      music.destroy();
      for (const evt of audioUnlockEvents) {
        window.removeEventListener(evt, unlockAudio);
      }
      gpuRenderer = null;
      fallbackRenderer = null;
    };
  }, [
    audioRef,
    boostAudioActiveRef,
    passengerReviewRef,
    navigationDistanceRef,
    clutchWarningRef,
    fareImpactRef,
    taxiExitRef,
    cameraModeRef,
    cameraRef,
    canvas2dRef,
    clearInput,
    diagnostics,
    diagnosticsActive,
    engineRef,
    ensureAudio,
    finishRun,
    gameRef,
    inputRef,
    touchDriving,
    interactionPulseRef,
    jumpPulseRef,
    modeRef,
    onSimulationEvents,
    setAudioAnnouncement,
    onGamepadActions,
    setHud,
    setMode,
    setRendererKind,
    tone,
    webGpuCanvasRef,
  ]);
}
