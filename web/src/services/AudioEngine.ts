export type AudioState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export class AudioEngine {
  private static instance: AudioEngine;
  private audio: HTMLAudioElement | null = null;
  private onEndedCallback: (() => void) | null = null;
  private onStateChangeCallback: ((state: AudioState) => void) | null = null;
  private state: AudioState = 'idle';
  private fadeInterval: ReturnType<typeof setInterval> | null = null;

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
      this.audio.preload = 'metadata';
      
      this.audio.addEventListener('ended', () => {
        this.setState('idle');
        if (this.onEndedCallback) this.onEndedCallback();
      });

      this.audio.addEventListener('waiting', () => this.setState('loading'));
      this.audio.addEventListener('playing', () => this.setState('playing'));
      this.audio.addEventListener('pause', () => {
        if (this.state !== 'loading') this.setState('paused');
      });
      
      this.audio.addEventListener('error', (e) => {
        // Ignora erro se não houver SRC (comum ao limpar a faixa)
        if (!this.audio?.src || this.audio.src === window.location.href) return;
        
        console.warn("[AudioEngine] Elemento de áudio reportou um problema:", e);
        this.setState('error');
      });
    }
  }

  private setState(newState: AudioState) {
    if (this.state !== newState) {
      this.state = newState;
      if (this.onStateChangeCallback) this.onStateChangeCallback(newState);
    }
  }

  public loadTrack(url: string) {
    this.init();
    if (this.audio) {
      try {
        this.setState('loading');
        this.audio.src = url;
        this.audio.load();
      } catch (error) {
        console.error("[AudioEngine] Erro ao carregar faixa:", error);
        this.setState('error');
      }
    }
  }

  public async play(): Promise<void> {
    if (this.audio && this.audio.src) {
      try {
        if (this.fadeInterval) {
          clearInterval(this.fadeInterval);
          this.fadeInterval = null;
        }

        // Fade in suave (0.15s) para evitar estalos
        const targetVolume = this.audio.volume || 1.0;
        this.audio.volume = 0;
        
        await this.audio.play();
        this.fadeVolume(targetVolume, 150);
      } catch (error) {
        console.warn("[AudioEngine] Autoplay bloqueado ou erro ao reproduzir:", error);
        this.setState('error');
        throw error;
      }
    }
  }

  public pause() {
    if (this.audio && this.state === 'playing') {
      // Fade out suave antes de pausar
      this.fadeVolume(0, 100, () => {
        this.audio?.pause();
      });
    }
  }

  public stop() {
    if (this.audio) {
      this.fadeVolume(0, 100, () => {
        if (this.audio) {
          this.audio.pause();
          this.audio.currentTime = 0;
          this.setState('idle');
        }
      });
    }
  }

  private fadeVolume(target: number, duration: number, onComplete?: () => void) {
    if (!this.audio) return;
    
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
    }

    const startVol = this.audio.volume;
    const steps = 10;
    const stepTime = duration / steps;
    const volStep = (target - startVol) / steps;
    let currentStep = 0;

    this.fadeInterval = setInterval(() => {
      if (!this.audio) {
        if (this.fadeInterval) clearInterval(this.fadeInterval);
        return;
      }

      currentStep++;
      const nextVol = startVol + (volStep * currentStep);
      this.audio.volume = Math.max(0, Math.min(1, nextVol));

      if (currentStep >= steps) {
        if (this.fadeInterval) clearInterval(this.fadeInterval);
        this.fadeInterval = null;
        this.audio.volume = target;
        if (onComplete) onComplete();
      }
    }, stepTime);
  }

  public setVolume(volume: number) {
    this.init();
    if (this.audio) {
      // Volume de 0 a 1 no HTML5 Audio
      const val = Math.max(0, Math.min(100, volume)) / 100;
      this.audio.volume = val;
    }
  }

  public setOnEnded(callback: () => void) {
    this.onEndedCallback = callback;
  }

  public setOnStateChange(callback: (state: AudioState) => void) {
    this.onStateChangeCallback = callback;
  }

  public getState(): AudioState {
    return this.state;
  }

  public clearTrack() {
    if (this.audio) {
      if (this.fadeInterval) {
        clearInterval(this.fadeInterval);
        this.fadeInterval = null;
      }
      this.audio.pause();
      this.audio.src = '';
      this.setState('idle');
    }
  }
}

export const audioEngine = AudioEngine.getInstance();
