import { detectTextLanguage } from './arabicNlu';

export interface SpeakOptions {
  preferredLang?: 'hi-IN' | 'en-US' | 'ar-SA' | 'ar-EG';
  onStart?: () => void;
  onDone?: () => void;
  onError?: (reason: string) => void;
}

export interface TTSInitResult {
  ready: boolean;
  languageLabel: string;
  langCode: string;
  fallbackUsed: boolean;
  supportsArabic: boolean;
}

/**
 * Web Speech Synthesis wrapper with automatic script-based voice matching
 * across Arabic (ar-SA / ar-EG), Hindi (hi-IN), and English (en-US).
 */
export class TTSService {
  private isReady = false;
  private preferredLang = 'en-US';
  private languageLabel = 'Unavailable';
  private volume = 0.8;
  private muted = false;
  private voices: SpeechSynthesisVoice[] = [];

  public initialize(onReady?: (result: TTSInitResult) => void): TTSInitResult {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.isReady = false;
      this.languageLabel = 'Unavailable';
      const unavailable: TTSInitResult = {
        ready: false,
        languageLabel: 'Unavailable',
        langCode: '',
        fallbackUsed: false,
        supportsArabic: false,
      };
      onReady?.(unavailable);
      return unavailable;
    }

    const resolveVoices = (): TTSInitResult => {
      this.voices = window.speechSynthesis.getVoices();
      const arabicVoice = this.voices.find((v) => v.lang.toLowerCase().startsWith('ar'));
      const hindiVoice = this.voices.find((v) => v.lang.toLowerCase().startsWith('hi'));
      const englishVoice = this.voices.find((v) => v.lang.toLowerCase().startsWith('en'));

      const langs: string[] = [];
      if (englishVoice || this.voices.length === 0) langs.push('EN');
      if (arabicVoice) langs.push('AR');
      if (hindiVoice) langs.push('HI');

      this.isReady = true;
      this.preferredLang = englishVoice?.lang ?? hindiVoice?.lang ?? arabicVoice?.lang ?? 'en-US';
      this.languageLabel = langs.length > 0 ? langs.join(' / ') : 'English';

      return {
        ready: true,
        languageLabel: this.languageLabel,
        langCode: this.preferredLang,
        fallbackUsed: !hindiVoice,
        supportsArabic: Boolean(arabicVoice),
      };
    };

    const initialResult = resolveVoices();
    if (this.voices.length === 0 && 'onvoiceschanged' in window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => {
        const updated = resolveVoices();
        onReady?.(updated);
      };
    } else {
      onReady?.(initialResult);
    }

    return initialResult;
  }

  public getIsReady(): boolean {
    return this.isReady;
  }

  public getLanguageLabel(): string {
    return this.languageLabel;
  }

  public setVolume(level: number): void {
    this.volume = Math.max(0, Math.min(1, level));
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public stop(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  public speak(text: string, options: SpeakOptions = {}): boolean {
    const cleanText = text.trim();
    if (!cleanText) {
      options.onDone?.();
      return false;
    }

    if (!this.isReady || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      options.onStart?.();
      window.setTimeout(() => {
        options.onDone?.();
      }, 1200);
      return false;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanText);

      // Automatically match voice language to spoken script (Arabic, Hindi, or English)
      const detectedScript = detectTextLanguage(cleanText);
      const targetLang =
        options.preferredLang ??
        (detectedScript === 'ar'
          ? 'ar-SA'
          : detectedScript === 'hi'
            ? 'hi-IN'
            : this.preferredLang || 'en-US');

      utterance.lang = targetLang;
      utterance.volume = this.muted ? 0 : this.volume;
      utterance.rate = 1.03;
      utterance.pitch = 1;

      const availableVoices =
        this.voices.length > 0 ? this.voices : window.speechSynthesis.getVoices();
      const langPrefix = targetLang.split('-')[0].toLowerCase();
      const matchedVoice =
        availableVoices.find((v) => v.lang.toLowerCase() === targetLang.toLowerCase()) ??
        availableVoices.find((v) => v.lang.toLowerCase().startsWith(langPrefix));
      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }

      let finished = false;
      const finishOnce = () => {
        if (!finished) {
          finished = true;
          window.clearTimeout(fallbackTimer);
          options.onDone?.();
        }
      };

      const estimatedDurationMs = Math.max(2400, Math.min(12000, cleanText.length * 80));
      const fallbackTimer = window.setTimeout(() => {
        finishOnce();
      }, estimatedDurationMs);

      utterance.onstart = () => {
        options.onStart?.();
      };
      utterance.onend = () => {
        finishOnce();
      };
      utterance.onerror = (event) => {
        if (!finished) {
          finished = true;
          window.clearTimeout(fallbackTimer);
          options.onError?.(event.error || 'TTS speech error');
        }
      };

      window.speechSynthesis.speak(utterance);
      return true;
    } catch (error) {
      options.onError?.(error instanceof Error ? error.message : 'TTS failed');
      return false;
    }
  }

  public shutdown(): void {
    this.stop();
  }
}
