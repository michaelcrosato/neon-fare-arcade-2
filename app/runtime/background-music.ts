import type { Game, Mode } from "@/game/model";

export const FARE_TRACKS = [4, 5, 6, 7, 8] as const;

export function shuffledFareTracks(random = Math.random): number[] {
  const tracks: number[] = [...FARE_TRACKS];
  for (let i = tracks.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
  }
  return tracks;
}

/** One player, one shuffled deck per run; no overlap with venue/menu music. */
export class BackgroundMusic {
  private audio: HTMLAudioElement;
  private game: Game | null = null;
  private order: number[] = [];
  private cursor = 0;
  private fareTrack: number | null = null;
  private onboard = false;
  private current: number | null = null;
  private desired: number | null = null;
  private paused = false;
  private pending = false;
  private disposed = false;
  private blocked = false;
  private farePosition = 0;

  constructor(audio = new Audio(), private random = Math.random) {
    this.audio = audio;
    audio.volume = 0.38;
    audio.preload = "metadata";
    audio.addEventListener("ended", this.ended);
  }

  private ended = () => {
    if (this.current !== null && this.current >= 4 && this.onboard) {
      this.fareTrack = this.nextFare();
      this.desired = this.fareTrack;
      this.sync();
    }
  };

  private nextFare() {
    this.farePosition = 0;
    return this.order[this.cursor++ % this.order.length];
  }

  update(game: Game, mode: Mode, muted: boolean, hidden: boolean, selectingDriver = false) {
    if (game !== this.game) {
      this.game = game;
      this.order = shuffledFareTracks(this.random);
      this.cursor = 0;
      this.onboard = false;
      this.fareTrack = null;
      this.farePosition = 0;
    }
    if (game.onboard && !this.onboard) this.fareTrack = this.nextFare();
    if (!game.onboard) this.fareTrack = null;
    this.onboard = game.onboard;
    const inside = game.player.kind === "walking" && game.player.location.kind === "interior";
    this.desired = mode === "menu" || selectingDriver ? 2
      : mode === "ended" || mode === "countdown" ? null
      : inside ? 1 : this.fareTrack;
    this.paused = (mode === "paused" && !selectingDriver) || hidden;
    this.audio.muted = muted;
    this.sync();
  }

  /** Retry blocked autoplay inside the next user gesture. */
  unlock = () => { this.blocked = false; this.sync(); };

  private sync() {
    if (this.disposed) return;
    if (this.current !== this.desired) {
      if (this.current !== null && this.current >= 4 && this.desired === 1) this.farePosition = this.audio.currentTime;
      this.audio.pause();
      this.current = this.desired;
      if (this.current !== null) {
        this.audio.src = `/music/bgm_${String(this.current).padStart(2, "0")}.mp3`;
        this.audio.loop = this.current < 4;
        this.audio.currentTime = this.current >= 4 ? this.farePosition : 0;
      }
    }
    if (this.current === null || this.paused) { this.audio.pause(); return; }
    if (this.audio.paused && !this.pending && !this.blocked) {
      this.pending = true;
      void this.audio.play().catch((error: unknown) => {
        // Browsers require a user gesture before audible playback.
        this.blocked = !(error instanceof DOMException && error.name === "AbortError");
      }).finally(() => { this.pending = false; });
    }
  }

  destroy() {
    this.disposed = true;
    this.audio.pause();
    this.audio.removeEventListener("ended", this.ended);
    this.audio.removeAttribute("src");
    this.audio.load();
  }
}
