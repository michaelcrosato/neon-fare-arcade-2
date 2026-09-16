"use client";

import { VehicleGraphicsOptions } from "./vehicle-graphics";
import { MinimapOptions } from "./minimap-settings";
import {
  CAMERA_OPTIONS,
  CAMERA_DISTANCE_SCALES,
  type CameraDistanceScale,
} from "@/game/config";
import type { CameraMode } from "@/game/model";
import { DevelopmentPanel, type DevelopmentPanelProps } from "./development-panel";

import type { SteeringMode, WheelRange } from "./runtime/touch-driving";
import { SteeringWheelRange } from "./steering-wheel-range";
import { useMobileLayout } from "./use-mobile-layout";
import { AudioOptions } from "./audio-options";
import { FullscreenControl } from "./fullscreen-control";
import { DesktopControls } from "./desktop-controls";
import { NavigationLab } from "./navigation-lab";

export type OptionsTab = "game" | "navigation" | "dev";

export type GameOptionsPanelProps = {
  tab: OptionsTab;
  onSelectTab: (tab: OptionsTab) => void;
  cameraMode: CameraMode;
  onSetCameraMode: (mode: CameraMode) => void;
  cameraDistanceScale: CameraDistanceScale;
  onSetCameraDistanceScale: (scale: CameraDistanceScale) => void;
  steeringMode?: SteeringMode;
  wheelRange?: WheelRange;
  onSetWheelRange?: (range: WheelRange) => void;
  onSetSteeringMode?: (mode: SteeringMode) => void;
  rendererKind: string;
  isFreeRun?: boolean;
  fareDispatchEnabled?: boolean;
  onToggleFareDispatch?: () => void;
  development: DevelopmentPanelProps;
  onClose: () => void;
};

export function GameOptionsPanel({
  tab,
  onSelectTab,
  cameraMode,
  onSetCameraMode,
  cameraDistanceScale,
  onSetCameraDistanceScale,
  steeringMode,
  wheelRange,
  onSetWheelRange,
  onSetSteeringMode,
  rendererKind,
  isFreeRun,
  fareDispatchEnabled,
  onToggleFareDispatch,
  development,
  onClose,
}: GameOptionsPanelProps) {
  const isMobile = useMobileLayout();
  return (
    <div className="game-options-panel">
      <p className="modal-kicker">NEON FARE · CONFIGURATION</p>
      <h2 id="modal-title">OPTIONS</h2>

      <div className="options-tab-strip" role="tablist" aria-label="Options categories">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "game"}
          className={`options-tab ${tab === "game" ? "is-active" : ""}`}
          onClick={() => onSelectTab("game")}
        >
          GAME SETTINGS
        </button>
        <button type="button" role="tab" aria-selected={tab === "navigation"}
          className={`options-tab ${tab === "navigation" ? "is-active" : ""}`}
          onClick={() => onSelectTab("navigation")}>NAVIGATION LAB</button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "dev"}
          className={`options-tab ${tab === "dev" ? "is-active" : ""}`}
          onClick={() => onSelectTab("dev")}
        >
          DEV TOOLS
        </button>
      </div>

      {tab === "game" ? (
        <div className="game-settings-content">
          <button type="button" className="navigation-lab-entry" onClick={() => onSelectTab("navigation")}>
            <strong>NAVIGATION LAB →</strong><small>Cab arrow, GPS realignment &amp; vertical route dots</small>
          </button>
          <FullscreenControl />
          <AudioOptions />
          {!isMobile && <DesktopControls />}

          {isMobile && (
          <fieldset className="game-options-section">
            <legend>STEERING SYSTEM</legend>
            <p>Vehicle control interface:</p>
            <div className="game-options-grid camera-grid">
              <button
                type="button"
                className={`options-choice-button ${(steeringMode ?? "default") === "default" ? "is-active" : ""}`}
                aria-pressed={(steeringMode ?? "default") === "default"}
                onClick={() => onSetSteeringMode?.("default")}
              >
                <b>DEFAULT</b>
                <small>2 Hand · Drag</small>
              </button>
              <button
                type="button"
                className={`options-choice-button ${steeringMode === "joystick" ? "is-active" : ""}`}
                aria-pressed={steeringMode === "joystick"}
                onClick={() => onSetSteeringMode?.("joystick")}
              >
                <b>JOYSTICK</b>
                <small>1 Hand · Thumb</small>
              </button>
              <button
                type="button"
                className={`options-choice-button ${steeringMode === "wheel" ? "is-active" : ""}`}
                aria-pressed={steeringMode === "wheel"}
                onClick={() => onSetSteeringMode?.("wheel")}
              >
                <b>WHEEL · RETURN</b>
                <small>Adjustable · Auto return</small>
              </button>
            </div>
            {steeringMode === "wheel" && <SteeringWheelRange value={wheelRange} onChange={onSetWheelRange} />}
            <p className="options-hint">Touch anywhere on the playfield to steer. Joystick and wheel appear at your thumb; pedal touches stay separate.</p>
          </fieldset>
          )}

          <fieldset className="game-options-section">
            <legend>CAMERA VIEW &amp; FRAMING</legend>
            <p>Driving perspective:</p>
            <div className="game-options-grid camera-grid">
              {CAMERA_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`options-choice-button ${cameraMode === option.id ? "is-active" : ""}`}
                  aria-pressed={cameraMode === option.id}
                  onClick={() => onSetCameraMode(option.id)}
                >
                  <b>{option.label}</b>
                  <small>
                    {option.id === "fixed"
                      ? "Fixed isometric"
                      : option.id === "cab"
                        ? "Cockpit view"
                        : option.id === "chase-high"
                          ? "High follow"
                          : "Low street view"}
                  </small>
                </button>
              ))}
            </div>

            <p style={{ marginTop: "14px" }}>Camera distance:</p>
            <div className="game-options-grid distance-grid">
              {CAMERA_DISTANCE_SCALES.map((scale) => (
                <button
                  key={scale}
                  type="button"
                  className={`options-choice-button ${cameraDistanceScale === scale ? "is-active" : ""}`}
                  aria-pressed={cameraDistanceScale === scale}
                  onClick={() => onSetCameraDistanceScale(scale)}
                >
                  <b>{scale}×</b>
                  <small>{scale === 1 ? "Standard" : scale === 2 ? "Wide" : scale === 4 ? "Far" : "Maximum"}</small>
                </button>
              ))}
            </div>
            <p className="options-hint">Quick shortcut: Press <kbd>C</kbd> while driving to cycle camera modes.</p>
          </fieldset>

          <MinimapOptions mobile={isMobile} />

          <fieldset className="game-options-section">
            <legend>GRAPHICS ENGINE</legend>
            <VehicleGraphicsOptions />
            <div className="graphics-status-box">
              <span className="graphics-status-label">ACTIVE BACKEND</span>
              <strong className="graphics-status-val">{rendererKind}</strong>
              <small>
                {rendererKind === "WEBGPU ACTIVE"
                  ? "Direct GPU hardware acceleration with WGSL shaders and 60FPS target."
                  : "Canvas 2D fallback rendering engine."}
              </small>
            </div>
          </fieldset>

          <fieldset className="game-options-section">
            <legend>CONTROLS REFERENCE</legend>
            <div className="options-key-guide">
              <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / <kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd> DRIVE / STEER</span>
              <span><kbd>SPACE</kbd> ARCADE BOOST / SIM HANDBRAKE</span>
              <span><kbd>SHIFT</kbd> ACCORD CLUTCH · <kbd>Z</kbd><kbd>X</kbd> MANUAL GEAR DOWN / UP</span>
              <span><kbd>E</kbd> ENTER / EXIT TAXI / INTERACT</span>
              <span><kbd>C</kbd> CYCLE CAMERA</span>
              <span><kbd>G</kbd> REGIONAL GPS MAP</span>
              <span><kbd>P</kbd> PAUSE GAME</span>
              <span><kbd>M</kbd> MUTE / UNMUTE</span>
            </div>
          </fieldset>

          {isFreeRun && onToggleFareDispatch && (
            <fieldset className="game-options-section">
              <legend>FREE RUN PASSENGER DISPATCH</legend>
              <button
                type="button"
                className={`game-options-toggle ${fareDispatchEnabled ? "is-on" : "is-off"}`}
                onClick={onToggleFareDispatch}
              >
                <span>{fareDispatchEnabled ? "🚖" : "🏖"}</span>
                <div>
                  <strong>{fareDispatchEnabled ? "ON DUTY (FINDING FARES)" : "OFF DUTY (FREE ROAM)"}</strong>
                  <small>{fareDispatchEnabled ? "Passenger fare calls enabled" : "No fare calls. Roam the map freely."}</small>
                </div>
              </button>
            </fieldset>
          )}

          <div className="dev-tools-callout">
            <div>
              <strong>DEVELOPER &amp; PLAYTEST TOOLS</strong>
              <small>GPS tuning, seed selector, time freeze, infinite boost, and landmark teleport</small>
            </div>
            <button
              type="button"
              className="dev-switch-btn"
              onClick={() => onSelectTab("dev")}
            >
              SWITCH TO DEV TOOLS ➜
            </button>
          </div>

          <button className="primary-small" onClick={onClose}>CLOSE OPTIONS</button>
        </div>
      ) : tab === "navigation" ? <NavigationLab {...development} onClose={onClose} /> : (
        <div className="dev-settings-content">
          <div className="dev-back-strip">
            <button
              type="button"
              className="dev-back-btn"
              onClick={() => onSelectTab("game")}
            >
              ⮜ BACK TO GAME SETTINGS
            </button>
          </div>
          <DevelopmentPanel {...development} hideHeader onClose={onClose} />
        </div>
      )}
    </div>
  );
}
