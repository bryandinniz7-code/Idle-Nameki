class RetroSoundEngine {
  private ctx: AudioContext | null = null;
  public muted = false;

  private getContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    durationSec: number,
    type: OscillatorType = 'square',
    volume = 0.04
  ) {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freqStart, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + durationSec);

      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + durationSec);
    } catch {
      // Ignore audio errors if blocked by browser autoplay policy
    }
  }

  playHit() {
    this.playTone(210, 90, 0.08, 'square', 0.03);
  }

  playCrit() {
    this.playTone(540, 140, 0.14, 'sawtooth', 0.045);
  }

  playLevelUp() {
    const ctx = this.getContext();
    if (!ctx) return;
    this.playTone(440, 554, 0.1, 'triangle', 0.05);
    setTimeout(() => this.playTone(554, 659, 0.1, 'triangle', 0.05), 90);
    setTimeout(() => this.playTone(659, 880, 0.22, 'triangle', 0.05), 180);
  }

  playTransform() {
    this.playTone(220, 880, 0.35, 'sawtooth', 0.045);
  }

  playRareDrop() {
    this.playTone(587, 784, 0.12, 'sine', 0.05);
    setTimeout(() => this.playTone(784, 1174, 0.2, 'sine', 0.05), 100);
  }
}

export const soundFx = new RetroSoundEngine();
