import { CallAutoAnswerState } from '../types/assistant';
import { TTSService } from './ttsService';

export const AUTO_ANSWER_DELAY_SECONDS = 10;
const CONNECT_DELAY_MS = 2000;
const DISCONNECT_DELAY_MS = 500;
const OFFLINE_AUTO_ANSWER_MESSAGE =
  'Hello, I am AI made by Vicky and sir is not near phone. Please call later. Bye.';

const LOCAL_CONTACTS: Record<string, string> = {
  '9876543210': 'Rahul',
  '919876543210': 'Rahul',
  '9811223344': 'Priya',
  '919811223344': 'Priya',
  '5550192834': 'Mom',
};

export interface CallAutoAnswerCallback {
  onStateChange: (state: CallAutoAnswerState) => void;
  onLog: (message: string, level?: 'info' | 'success' | 'warning' | 'error') => void;
}

/**
 * Port of CallAutoAnswerService.java and CallSmsReceiver.java.
 * Preserves Hindi/English caller announcement, 10-second auto-answer countdown,
 * 2-second call connect wait, mic mute during TTS playback of the offline AI message,
 * and automatic hang-up 500ms after speech completes.
 *
 * TODO: Browsers cannot intercept cellular telephony broadcasts (TelephonyManager /
 * TelecomManager / SMS_RECEIVED). Incoming call and SMS triggers are provided in-app
 * so the complete auto-answer workflow can be tested on the web.
 */
export class CallAutoAnswerService {
  private ttsService: TTSService;
  private callback: CallAutoAnswerCallback | null = null;
  private countdownIntervalId: number | null = null;
  private connectTimeoutId: number | null = null;
  private disconnectTimeoutId: number | null = null;
  private state: CallAutoAnswerState = {
    phase: 'idle',
    callerLabel: '',
    phoneNumber: '',
    secondsRemaining: AUTO_ANSWER_DELAY_SECONDS,
    microphoneMuted: false,
    activeMessage: null,
  };

  constructor(ttsService: TTSService) {
    this.ttsService = ttsService;
  }

  public setCallback(callback: CallAutoAnswerCallback): void {
    this.callback = callback;
  }

  public getState(): CallAutoAnswerState {
    return { ...this.state };
  }

  public lookupContactName(phoneNumber: string): string | null {
    const digits = phoneNumber.replace(/[^0-9]/g, '');
    if (!digits) {
      return null;
    }
    return LOCAL_CONTACTS[digits] ?? LOCAL_CONTACTS[digits.slice(-10)] ?? null;
  }

  public formatPhoneNumber(phoneNumber: string): string {
    const digits = phoneNumber.replace(/[^0-9]/g, '');
    return digits.split('').join(' ');
  }

  public handleIncomingCall(phoneNumber: string): void {
    this.clearTimers();

    const contactName = this.lookupContactName(phoneNumber);
    const callerLabel = contactName || phoneNumber;
    const announcement = contactName
      ? `कॉल आ रहा है ${contactName} से`
      : `कॉल आ रहा है नंबर ${this.formatPhoneNumber(phoneNumber)} से`;

    this.callback?.onLog(`Incoming call: ${announcement}`, 'info');
    this.callback?.onLog('Auto-answer timer started (10 seconds)', 'info');

    this.updateState({
      phase: 'ringing',
      callerLabel,
      phoneNumber,
      secondsRemaining: AUTO_ANSWER_DELAY_SECONDS,
      microphoneMuted: false,
      activeMessage: announcement,
    });

    this.ttsService.speak(announcement, { preferredLang: 'hi-IN' });

    let remaining = AUTO_ANSWER_DELAY_SECONDS;
    this.countdownIntervalId = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        this.clearCountdown();
        this.answerCallAutomatically();
      } else {
        this.updateState({
          ...this.state,
          secondsRemaining: remaining,
        });
      }
    }, 1000);
  }

  public handleManualAnswer(): void {
    if (this.state.phase === 'idle') {
      return;
    }
    this.clearTimers();
    this.ttsService.stop();
    this.callback?.onLog('Call answered manually — auto-answer timer cancelled', 'success');
    this.updateState({
      phase: 'idle',
      callerLabel: '',
      phoneNumber: '',
      secondsRemaining: AUTO_ANSWER_DELAY_SECONDS,
      microphoneMuted: false,
      activeMessage: null,
    });
  }

  public handleCallEnded(): void {
    if (this.state.phase === 'idle') {
      return;
    }
    this.clearTimers();
    this.ttsService.stop();
    this.callback?.onLog('Call ended', 'info');
    this.updateState({
      phase: 'idle',
      callerLabel: '',
      phoneNumber: '',
      secondsRemaining: AUTO_ANSWER_DELAY_SECONDS,
      microphoneMuted: false,
      activeMessage: null,
    });
  }

  public handleIncomingSms(sender: string, body: string): void {
    const contactName = this.lookupContactName(sender);
    const announcement = contactName
      ? `संदेश आया है ${contactName} से`
      : `संदेश आया है नंबर ${this.formatPhoneNumber(sender)} से`;

    this.callback?.onLog(`Incoming SMS: ${announcement} ("${body}")`, 'info');
    this.ttsService.speak(announcement, { preferredLang: 'hi-IN' });
  }

  private answerCallAutomatically(): void {
    this.callback?.onLog('Auto-answering call after 10s delay...', 'success');
    this.updateState({
      ...this.state,
      phase: 'connecting',
      secondsRemaining: 0,
      activeMessage: 'Call answered — connecting audio...',
    });

    this.connectTimeoutId = window.setTimeout(() => {
      this.speakOfflineMessage();
    }, CONNECT_DELAY_MS);
  }

  private speakOfflineMessage(): void {
    this.callback?.onLog(`Speaking offline message: "${OFFLINE_AUTO_ANSWER_MESSAGE}"`, 'info');
    this.updateState({
      ...this.state,
      phase: 'speaking',
      microphoneMuted: true,
      activeMessage: OFFLINE_AUTO_ANSWER_MESSAGE,
    });

    this.ttsService.speak(OFFLINE_AUTO_ANSWER_MESSAGE, {
      preferredLang: 'en-US',
      onStart: () => {
        this.updateState({
          ...this.state,
          phase: 'speaking',
          microphoneMuted: true,
        });
      },
      onDone: () => {
        this.finishAndDisconnect();
      },
      onError: () => {
        this.finishAndDisconnect();
      },
    });
  }

  private finishAndDisconnect(): void {
    this.updateState({
      ...this.state,
      microphoneMuted: false,
      phase: 'disconnected',
      activeMessage: 'Disconnecting call...',
    });

    this.disconnectTimeoutId = window.setTimeout(() => {
      this.callback?.onLog('Call automatically disconnected after AI message', 'success');
      this.updateState({
        phase: 'idle',
        callerLabel: '',
        phoneNumber: '',
        secondsRemaining: AUTO_ANSWER_DELAY_SECONDS,
        microphoneMuted: false,
        activeMessage: null,
      });
    }, DISCONNECT_DELAY_MS);
  }

  private updateState(next: CallAutoAnswerState): void {
    this.state = next;
    this.callback?.onStateChange({ ...this.state });
  }

  private clearCountdown(): void {
    if (this.countdownIntervalId !== null) {
      window.clearInterval(this.countdownIntervalId);
      this.countdownIntervalId = null;
    }
  }

  private clearTimers(): void {
    this.clearCountdown();
    if (this.connectTimeoutId !== null) {
      window.clearTimeout(this.connectTimeoutId);
      this.connectTimeoutId = null;
    }
    if (this.disconnectTimeoutId !== null) {
      window.clearTimeout(this.disconnectTimeoutId);
      this.disconnectTimeoutId = null;
    }
  }

  public shutdown(): void {
    this.clearTimers();
  }
}
