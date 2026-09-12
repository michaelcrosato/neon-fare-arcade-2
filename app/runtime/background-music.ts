import type { Game, Mode } from "@/game/model";

export const MUSIC_TRACKS = [1, 2, 4, 5, 6, 7, 8] as const;
const MUSIC_VOLUME = 0.38;

export function shuffledMusicTracks(random = Math.random): number[] {
  const tracks: number[] = [...MUSIC_TRACKS];
  for (let i = tracks.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
  }
  return tracks;
}

/** Start with the run, then repeat its shuffled playlist regardless of gameplay. */
export class BackgroundMusic {
  private audio: HTMLAudioElement;
  private game: Game | null = null;
  private order: number[] = [];
  private cursor = 0;
  private current: number | null = null;
  private pending = false;
  private disposed = false;
  private blocked = false;
  private gain: GainNode | null = null;
  private source: MediaElementAudioSourceNode | null = null;

  constructor(
    audio?: HTMLAudioElement,
    private random = Math.random,
    private getContext: () => AudioContext | null = () => null,
  ) {
    const existing = audio ?? (typeof document !== "undefined" ? (document.getElementById("neon-fare-bgm") as HTMLAudioElement | null) : null);
    this.audio = existing ?? new Audio();
    this.setVolume(MUSIC_VOLUME);
    this.audio.preload = "auto";
    this.audio.loop = false;
    this.audio.addEventListener("ended", this.ended);
  }

  private ended = () => {
    if (!this.disposed && this.current !== null) {
      this.cursor = (this.cursor + 1) % this.order.length;
      this.selectTrack();
      this.sync();
    }
  };

  private selectTrack() {
    this.current = this.order[this.cursor];
    this.audio.src = `/music/bgm_${String(this.current).padStart(2, "0")}.mp3`;
    this.audio.currentTime = 0;
  }

  update(game: Game, mode: Mode, muted: boolean) {
    if (this.disposed) return;
    // A fresh run is the only gameplay transition that changes the playlist.
    if (game !== this.game && (mode === "countdown" || mode === "playing")) {
      this.game = game;
      this.order = shuffledMusicTracks(this.random);
      this.cursor = 0;
      this.selectTrack();
    }
    this.audio.muted = muted;
    this.sync();
  }

  /** Retry blocked autoplay inside the next user gesture. */
  unlock = () => {
    if (this.disposed) return;
    this.blocked = false;
    const context = this.getContext();
    if (context && context.state !== "running" && context.state !== "closed") void context.resume().catch(() => {});
    this.setVolume(MUSIC_VOLUME);
    this.sync();
  };

  private setVolume(volume: number) {
    const context = this.getContext();
    if (!this.gain && context && context.state !== "closed") {
      // iOS ignores HTMLMediaElement.volume; share the game's unlocked audio context.
      this.gain = context.createGain();
      const media = this.audio as HTMLAudioElement & { __sourceNode?: MediaElementAudioSourceNode };
      if (!media.__sourceNode) {
        try {
          media.__sourceNode = context.createMediaElementSource(this.audio);
        } catch {
          // If already connected or unsupported, continue with native volume
        }
      }
      this.source = media.__sourceNode ?? null;
      if (this.source) {
        this.source.connect(this.gain);
        this.gain.connect(context.destination);
      }
    }
    if (this.gain) {
      this.audio.volume = 1;
      this.gain.gain.value = volume;
    } else this.audio.volume = volume;
  }

  private sync() {
    if (this.disposed || this.current === null) return;
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
    this.source?.disconnect();
    this.gain?.disconnect();
    this.source = null;
    this.gain = null;
  }
}
