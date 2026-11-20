/**
 * Lightweight Web Audio synthesizer for Android Assistant-style activation chimes,
 * command confirmations, and alarm/timer alert rings (zero external audio files).
 */
class SoundEffectsEngine {
  private ctx: AudioContext | null = null;
  private alarmIntervalId: number | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private playTone(
    frequency: number,
    startOffsetSec: number,
    durationSec: number,
    peakGain = 0.08,
    type: OscillatorType = 'sine',
  ): void {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime + startOffsetSec;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + durationSec + 0.02);
    } catch {
      // Ignore Web Audio autoplay blocks until user interacts
    }
  }

  public playWakeChime(): void {
    this.playTone(587.33, 0, 0.12, 0.09, 'sine'); // D5
    this.playTone(880.0, 0.09, 0.16, 0.09, 'sine'); // A5
  }

  public playSuccessChime(): void {
    this.playTone(659.25, 0, 0.09, 0.06, 'triangle'); // E5
    this.playTone(987.77, 0.07, 0.14, 0.06, 'triangle'); // B5
  }

  public playAlarmRing(): void {
    this.stopAlarmRing();
    const pulse = () => {
      this.playTone(880, 0, 0.18, 0.11, 'sine');
      this.playTone(1046.5, 0.2, 0.18, 0.11, 'sine');
      this.playTone(880, 0.4, 0.22, 0.11, 'sine');
    };
    pulse();
    this.alarmIntervalId = window.setInterval(pulse, 1800);
  }

  public stopAlarmRing(): void {
    if (this.alarmIntervalId !== null) {
      window.clearInterval(this.alarmIntervalId);
      this.alarmIntervalId = null;
    }
  }
}

export const soundEffects = new SoundEffectsEngine();
