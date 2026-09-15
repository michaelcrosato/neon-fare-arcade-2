import type { Game, Mode } from "@/game/model";
import { audioMix, DEFAULT_AUDIO_SETTINGS, type AudioSettings } from "./audio-settings";

export const MENU_MUSIC_TRACK = 1;
export const MUSIC_TRACKS = [2, 4, 5, 6, 7, 8] as const;
const trackSource = (track: number) => `/music/bgm_${String(track).padStart(2, "0")}.mp3`;

export function shuffledMusicTracks(random = Math.random): number[] {
  const tracks: number[] = [...MUSIC_TRACKS];
  for (let i = tracks.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
  }
  return tracks;
}

/** Each transport retains its own position when the other one is playing. */
class MusicChannel {
  private pending = false;
  private blocked = false;
  private disposed = false;
  private gain: GainNode | null = null;
  private source: MediaElementAudioSourceNode | null = null;

  constructor(readonly audio: HTMLAudioElement, private getContext: () => AudioContext | null) {
    audio.preload = "auto";
  }

  setVolume(volume: number, muted: boolean) {
    const context = this.getContext();
    if (!this.source && context && context.state !== "closed") {
      // iOS ignores media.volume, so route through the unlocked Web Audio context.
      const media = this.audio as HTMLAudioElement & { __sourceNode?: MediaElementAudioSourceNode };
      try { media.__sourceNode ??= context.createMediaElementSource(this.audio); } catch { /* Native volume fallback. */ }
      if (media.__sourceNode) {
        this.source = media.__sourceNode;
        this.gain = context.createGain();
        this.source.connect(this.gain);
        this.gain.connect(context.destination);
      }
    }
    this.audio.muted = muted;
    if (this.gain) { this.audio.volume = 1; this.gain.gain.value = volume; }
    else this.audio.volume = volume;
  }

  play(active: boolean) {
    if (this.disposed) return;
    if (!active) { if (!this.audio.paused) this.audio.pause(); return; }
    if (!this.audio.paused || this.pending || this.blocked) return;
    this.pending = true;
    void this.audio.play().catch((error: unknown) => {
      this.blocked = !(error instanceof DOMException && error.name === "AbortError");
    }).finally(() => { this.pending = false; });
  }

  unlock() { this.blocked = false; }
  destroy() {
    this.disposed = true;
    this.audio.pause(); this.audio.removeAttribute("src"); this.audio.load();
    this.source?.disconnect(); this.gain?.disconnect();
    this.source = null; this.gain = null;
  }
}

/** Menu and pause share a theme; gameplay resumes its own shuffled playlist. */
export class BackgroundMusic {
  private run: MusicChannel;
  private menu: MusicChannel;
  private game: Game | null = null;
  private order: number[] = [];
  private cursor = 0;
  private playing = false;
  private hidden = false;
  private settings = DEFAULT_AUDIO_SETTINGS;
  private disposed = false;

  constructor(audio?: HTMLAudioElement, private random = Math.random,
    private getContext: () => AudioContext | null = () => null, menuAudio?: HTMLAudioElement) {
    const element = (supplied: HTMLAudioElement | undefined, id: string) => supplied
      ?? (typeof document !== "undefined" ? document.getElementById(id) as HTMLAudioElement | null : null) ?? new Audio();
    this.run = new MusicChannel(element(audio, "neon-fare-bgm"), getContext);
    this.menu = new MusicChannel(element(menuAudio, "neon-fare-menu-bgm"), getContext);
    this.run.audio.loop = false;
    this.run.audio.addEventListener("ended", this.ended);
    this.menu.audio.src = trackSource(MENU_MUSIC_TRACK);
    this.menu.audio.loop = true;
  }

  private ended = () => {
    if (this.disposed || !this.order.length) return;
    this.cursor = (this.cursor + 1) % this.order.length;
    this.selectTrack(); this.sync();
  };
  private selectTrack() {
    this.run.audio.src = trackSource(this.order[this.cursor]);
    this.run.audio.currentTime = 0;
  }

  update(game: Game, mode: Mode, settings: AudioSettings = DEFAULT_AUDIO_SETTINGS, hidden = false) {
    if (this.disposed) return;
    this.playing = mode === "countdown" || mode === "playing";
    if (game !== this.game && this.playing) {
      this.game = game; this.order = shuffledMusicTracks(this.random); this.cursor = 0;
      this.selectTrack();
    }
    this.settings = settings; this.hidden = hidden; this.sync();
  }

  private sync() {
    if (this.disposed) return;
    const mix = audioMix(this.settings, this.hidden);
    this.run.setVolume(mix.music, mix.muted);
    this.menu.setVolume(mix.music, mix.muted);
    const audibleTab = !this.hidden || !this.settings.muteWhenHidden;
    // Pause the previous transport before starting the next: never overlap songs.
    if (this.playing) { this.menu.play(false); this.run.play(audibleTab && this.order.length > 0); }
    else { this.run.play(false); this.menu.play(audibleTab); }
  }

  unlock = () => {
    if (this.disposed) return;
    this.run.unlock(); this.menu.unlock();
    const context = this.getContext();
    if (context && context.state !== "running" && context.state !== "closed") void context.resume().catch(() => {});
    this.sync();
  };

  destroy() {
    this.disposed = true;
    this.run.audio.removeEventListener("ended", this.ended);
    this.run.destroy(); this.menu.destroy();
  }
}
