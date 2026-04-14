export class AudioEngine {
  private static instance: AudioEngine;
  private audio: HTMLAudioElement | null = null;
  private onEndedCallback: (() => void) | null = null;
  private constructor() {}
  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }
  public init() {
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.preload = 'auto';
      this.audio.addEventListener('ended', () => {
        if (this.onEndedCallback) this.onEndedCallback();
      });
    }
  }
  public loadTrack(url: string) {
    this.init();
    if (this.audio) {
      this.audio.src = url;
    }
  }
  public play() {
    if (this.audio && this.audio.src) {
      this.audio.play().catch(console.error);
    }
  }
  public pause() {
    if (this.audio) {
      this.audio.pause();
    }
  }
  public stop() {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
  }
  public setVolume(volume: number) {
    this.init();
    if (this.audio) {
      this.audio.volume = Math.max(0, Math.min(100, volume)) / 100;
    }
  }
  public setOnEnded(callback: () => void) {
    this.onEndedCallback = callback;
  }
  public clearTrack() {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
    }
  }
}
export const audioEngine = AudioEngine.getInstance();
