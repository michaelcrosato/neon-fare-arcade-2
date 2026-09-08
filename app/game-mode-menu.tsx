import type { DrivingModel, RunKind } from "@/game/model";

type GameModeMenuProps = Readonly<{
  ready: boolean;
  rendererKind: string;
  careerBank: number;
  best: number;
  onRequestStartRun: (runKind: RunKind, drivingModel?: DrivingModel) => void;
}>;

export function GameModeMenu({
  ready,
  rendererKind,
  careerBank,
  best,
  onRequestStartRun,
}: GameModeMenuProps) {
  return (
    <div className="menu-screen">
      <div className="hero-art" aria-hidden="true" />
      <div className="speed-slashes" aria-hidden="true"><i /><i /><i /></div>
      <div className="menu-copy">
        <div className="title-paper">
          <p className="eyebrow">A WEBGPU ARCADE RUN</p>
          <h1>NEON<br />FARE</h1>
        </div>
        <p className="tagline">PASSENGERS. PARCELS. SIX REGIONS. NO BRAKES.</p>
        <div className="start-mode-picker" role="group" aria-label="Choose game mode">
          <small>CHOOSE YOUR SHIFT</small>
          <div>
            <button
              className="start-mode-button is-timed"
              disabled={!ready}
              onClick={() => onRequestStartRun("timed")}
              aria-label="Start an Arcade Shift. 75 second score attack."
            >
              <span><b>ARCADE SHIFT</b><em>75 SEC · SCORE ATTACK</em></span><i aria-hidden="true">➜</i>
            </button>
            <button
              className="start-mode-button is-free-run"
              disabled={!ready}
              onClick={() => onRequestStartRun("free-run", "arcade")}
              aria-label="Start Free Run with arcade handling. No timer. Explore, take fares, and deliver courier packages."
            >
              <span><b>FREE RUN</b><em>NO TIMER · ARCADE HANDLING</em></span><i aria-hidden="true">∞</i>
            </button>
            <button
              className="start-mode-button is-simulation"
              disabled={!ready}
              onClick={() => onRequestStartRun("free-run", "simulation")}
              aria-label="Start Simulation Free Run. Drive a 1990s Crown Victoria-style taxi with realistic vehicle physics."
            >
              <span><b>SIMULATION</b><em>NO TIMER · CROWN CAB PHYSICS</em></span><i aria-hidden="true">D</i>
            </button>
          </div>
        </div>
        <div className="control-strip">
          <div className="key-cluster" aria-hidden="true"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></div>
          <strong>WASD / ARROWS</strong>
          <span>DRIVE</span>
          <kbd>SPACE</kbd>
          <span>BOOST</span>
          <kbd>E</kbd>
          <span>EXIT / ENTER</span>
        </div>
        <div className="menu-meta">
          <span>{rendererKind}</span>
          <span>ARCADE + SIMULATION FREE RUN</span>
          <span>6 REGIONS · CITY STREETS TO PACIFIC SURF</span>
          <span>BANK ${careerBank}</span>
          <span>BEST {best.toLocaleString().padStart(4, "0")}</span>
        </div>
      </div>
    </div>
  );
}
