import {
  CloudAIActionResponse,
  DetectedLanguage,
  MaterialYouSeed,
  RecognitionLanguage,
  SpeechRecognitionErrorEventLike,
  SpeechRecognitionEventLike,
  SpeechRecognitionInstance,
} from '../types/assistant';
import {
  detectTextLanguage,
  detectWakeWord,
  normalizeArabic,
  parseDurationSeconds,
  parseTimeExpression,
} from './arabicNlu';
import { AutomationService } from './automationService';
import { CommandExecutor } from './commandExecutor';
import {
  askCloudSmallIntelligence,
  runLocalSmallIntelligence,
} from './smallIntelligence';
import { soundEffects } from './soundEffects';
import { WebSearchHelper } from './webSearchHelper';

const WAKE_WINDOW_MS = 10_000;
const WAKE_DEDUPE_MS = 2_800;

export interface CommandExecutionMeta {
  lang: DetectedLanguage;
  latencyMs: number;
  source: 'local' | 'wikipedia' | 'ai' | 'api';
}

export interface VoiceCallback {
  onVoiceResult: (text: string) => void;
  onPartialResult?: (text: string, wakeWordActive: boolean) => void;
  onVoiceError: (error: string) => void;
  onCommandExecuted: (
    command: string,
    success: boolean,
    meta?: CommandExecutionMeta,
  ) => void;
  onCommandThinking?: (transcript: string, lang: DetectedLanguage) => void;
  onModelReady: (speechApiSupported: boolean) => void;
  onModelError: (error: string) => void;
  onWakeWordStateChange?: (detected: boolean, wakePhrase?: string | null) => void;
}

export class VoiceRecognitionService {
  private recognition: SpeechRecognitionInstance | null = null;
  private callback: VoiceCallback | null = null;
  private commandExecutor: CommandExecutor;
  private webSearchHelper: WebSearchHelper;
  private automationService: AutomationService;
  private wakeWordDetected = false;
  private lastWakeTriggeredAt = 0;
  private wakeWindowTimerId: number | null = null;
  private isListening = false;
  private speechApiSupported = false;
  private restartTimerId: number | null = null;
  private recognitionLanguage: RecognitionLanguage = 'en-US';
  private cloudAIEnabled = false;
  private assistantSpeaking = false;
  private ignoreInputUntilMs = 0;

  constructor(
    commandExecutor: CommandExecutor,
    webSearchHelper: WebSearchHelper,
    automationService: AutomationService,
  ) {
    this.commandExecutor = commandExecutor;
    this.webSearchHelper = webSearchHelper;
    this.automationService = automationService;
  }

  public setCallback(callback: VoiceCallback): void {
    this.callback = callback;
  }

  public setCloudAIEnabled(enabled: boolean): void {
    this.cloudAIEnabled = enabled;
  }

  /**
   * Prevents the microphone from self-triggering on Vicky's own TTS voice output.
   */
  public setAssistantSpeaking(speaking: boolean): void {
    this.assistantSpeaking = speaking;
    if (!speaking) {
      this.ignoreInputUntilMs = Date.now() + 450;
    }
  }

  public setRecognitionLanguage(lang: RecognitionLanguage): void {
    this.recognitionLanguage = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
      if (this.isListening) {
        try {
          this.recognition.stop();
        } catch {
          // Will auto-restart with new language in onend
        }
      }
    }
  }

  public getRecognitionLanguage(): RecognitionLanguage {
    return this.recognitionLanguage;
  }

  public isSpeechApiSupported(): boolean {
    return this.speechApiSupported;
  }

  public initialize(): void {
    const SpeechRecognitionCtor =
      typeof window !== 'undefined'
        ? window.SpeechRecognition ?? window.webkitSpeechRecognition
        : undefined;

    if (SpeechRecognitionCtor) {
      try {
        this.recognition = new SpeechRecognitionCtor();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = this.recognitionLanguage;
        this.recognition.maxAlternatives = 3;
        this.attachListeners(this.recognition);
        this.speechApiSupported = true;
        this.callback?.onModelReady(true);
      } catch (error) {
        this.speechApiSupported = false;
        this.callback?.onModelError(
          error instanceof Error
            ? error.message
            : 'Failed to initialize browser speech recognition',
        );
      }
    } else {
      this.speechApiSupported = false;
      this.callback?.onModelReady(false);
    }
  }

  public retryInitialization(): void {
    this.shutdown();
    this.initialize();
  }

  public activateWakeWordManually(): void {
    const phrase = this.recognitionLanguage.startsWith('ar') ? 'يا فيكي' : 'Hey Vicky';
    this.activateWakeWindow(phrase, true);
    if (this.speechApiSupported && !this.isListening) {
      this.startListening();
    }
  }

  public startListening(): boolean {
    if (!this.recognition || !this.speechApiSupported) {
      this.callback?.onVoiceError(
        'Microphone recognition is unavailable in this browser. Type a command or tap Quick Commands.',
      );
      return false;
    }

    try {
      this.clearRestartTimer();
      this.recognition.lang = this.recognitionLanguage;
      this.isListening = true;
      this.recognition.start();
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.toLowerCase().includes('already started')) {
        return true;
      }
      this.isListening = false;
      this.callback?.onVoiceError(`Failed to start recognition: ${msg}`);
      return false;
    }
  }

  public stopListening(): void {
    this.isListening = false;
    this.clearRestartTimer();
    this.clearWakeWindow();
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // Ignore if already stopped
      }
    }
  }

  public shutdown(): void {
    this.stopListening();
    this.commandExecutor.cleanup();
    this.webSearchHelper.cleanup();
    if (this.recognition) {
      this.recognition.onresult = null;
      this.recognition.onerror = null;
      this.recognition.onend = null;
      this.recognition = null;
    }
  }

  public submitManualInput(text: string, bypassWakeRequirement = false): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    this.callback?.onVoiceResult(trimmed);

    const wake = detectWakeWord(trimmed);
    if (wake.matched) {
      this.activateWakeWindow(wake.wakePhrase ?? 'Hey Vicky');
      if (wake.remainder) {
        void this.processCommand(wake.remainder, wake.lang);
        this.clearWakeWindow();
      }
      return;
    }

    if (bypassWakeRequirement || this.wakeWordDetected) {
      void this.processCommand(trimmed, wake.lang);
      this.clearWakeWindow();
    } else {
      void this.processCommand(trimmed, wake.lang);
    }
  }

  public async runRoutineById(routineId: string): Promise<void> {
    const routine = this.automationService
      .getRoutines()
      .find((item) => item.id === routineId);
    if (!routine) return;
    await this.executeRoutine(routine.name, routine.steps, 'en');
  }

  private attachListeners(recognizer: SpeechRecognitionInstance): void {
    recognizer.onresult = (event: SpeechRecognitionEventLike) => {
      if (this.assistantSpeaking || Date.now() < this.ignoreInputUntilMs) {
        return;
      }

      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        let bestTranscript = result[0]?.transcript ?? '';
        for (let altIdx = 0; altIdx < result.length; altIdx += 1) {
          const altText = result[altIdx]?.transcript ?? '';
          if (detectWakeWord(altText).matched) {
            bestTranscript = altText;
            break;
          }
        }

        if (result.isFinal) {
          finalTranscript += `${bestTranscript} `;
        } else {
          interimTranscript += `${bestTranscript} `;
        }
      }

      if (interimTranscript.trim()) {
        const partial = interimTranscript.trim();
        const wake = detectWakeWord(partial);
        if (wake.matched) {
          this.activateWakeWindow(wake.wakePhrase ?? 'Hey Vicky');
        }
        this.callback?.onPartialResult?.(partial, this.wakeWordDetected);
      }

      if (finalTranscript.trim()) {
        const finalText = finalTranscript.trim();
        this.callback?.onVoiceResult(finalText);
        this.processRecognizedText(finalText);
      }
    };

    recognizer.onerror = (event: SpeechRecognitionErrorEventLike) => {
      const errorCode = event.error;
      if (errorCode === 'aborted' || errorCode === 'no-speech') {
        if (this.isListening && errorCode === 'no-speech') {
          this.scheduleRestart(400);
        }
        return;
      }

      // Transient network hiccups in Chrome Web Speech recover automatically without breaking session
      if (errorCode === 'network') {
        if (this.isListening) {
          this.scheduleRestart(1400);
        }
        return;
      }

      const errorMessage = this.getErrorText(errorCode);
      this.callback?.onVoiceError(errorMessage);

      if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed') {
        this.isListening = false;
        return;
      }

      if (this.isListening) {
        this.scheduleRestart(900);
      }
    };

    recognizer.onend = () => {
      if (this.isListening) {
        this.scheduleRestart(350);
      }
    };
  }

  /**
   * Activates the 10s listening window while deduplicating interim + final wake triggers.
   */
  private activateWakeWindow(wakePhrase: string, forceNotify = false): void {
    const now = Date.now();
    const alreadyActive = this.wakeWordDetected && now - this.lastWakeTriggeredAt < WAKE_DEDUPE_MS;
    this.wakeWordDetected = true;

    if (!alreadyActive || forceNotify) {
      this.lastWakeTriggeredAt = now;
      soundEffects.playWakeChime();
      this.callback?.onWakeWordStateChange?.(true, wakePhrase);
    }

    if (this.wakeWindowTimerId !== null) {
      window.clearTimeout(this.wakeWindowTimerId);
    }
    this.wakeWindowTimerId = window.setTimeout(() => {
      this.clearWakeWindow();
    }, WAKE_WINDOW_MS);
  }

  private clearWakeWindow(): void {
    if (this.wakeWindowTimerId !== null) {
      window.clearTimeout(this.wakeWindowTimerId);
      this.wakeWindowTimerId = null;
    }
    if (this.wakeWordDetected) {
      this.wakeWordDetected = false;
      this.callback?.onWakeWordStateChange?.(false, null);
    }
  }

  private scheduleRestart(delayMs: number): void {
    this.clearRestartTimer();
    this.restartTimerId = window.setTimeout(() => {
      if (this.isListening && this.recognition) {
        try {
          this.recognition.lang = this.recognitionLanguage;
          this.recognition.start();
        } catch {
          // Recognizer already running
        }
      }
    }, delayMs);
  }

  private clearRestartTimer(): void {
    if (this.restartTimerId !== null) {
      window.clearTimeout(this.restartTimerId);
      this.restartTimerId = null;
    }
  }

  private processRecognizedText(text: string): void {
    if (!text.trim()) return;

    const wake = detectWakeWord(text);
    if (wake.matched) {
      this.activateWakeWindow(wake.wakePhrase ?? 'Hey Vicky');
      if (wake.remainder) {
        void this.processCommand(wake.remainder, wake.lang);
        this.clearWakeWindow();
      }
    } else if (this.wakeWordDetected) {
      void this.processCommand(text.trim(), wake.lang);
      this.clearWakeWindow();
    }
  }

  private async executeRoutine(
    name: string,
    steps: Array<{ command: string; description: string }>,
    lang: DetectedLanguage,
  ): Promise<void> {
    const start = performance.now();
    const summarySteps: string[] = [];

    for (const step of steps) {
      const cmd = step.command.toLowerCase();
      if (cmd.includes('turn on wifi')) {
        this.commandExecutor.setDeviceToggle('wifi', true);
        summarySteps.push('Wi-Fi on');
      } else if (cmd.includes('turn off wifi')) {
        this.commandExecutor.setDeviceToggle('wifi', false);
        summarySteps.push('Wi-Fi off');
      } else if (cmd.includes('turn on bluetooth')) {
        this.commandExecutor.setDeviceToggle('bluetooth', true);
        summarySteps.push('Bluetooth on');
      } else if (cmd.includes('turn on do not disturb')) {
        this.commandExecutor.setDeviceToggle('dnd', true);
        summarySteps.push('DND on');
      } else if (cmd.includes('turn off do not disturb')) {
        this.commandExecutor.setDeviceToggle('dnd', false);
        summarySteps.push('DND off');
      } else if (cmd.includes('turn on dark mode')) {
        this.commandExecutor.setDarkMode(true);
        summarySteps.push('Dark Mode');
      } else if (cmd.includes('brightness')) {
        const num = cmd.match(/(\d+)/);
        this.commandExecutor.setBrightnessLevel(num ? Number(num[1]) : 75);
        summarySteps.push(`brightness ${num ? num[1] : 75}%`);
      } else if (cmd.includes('flashlight off')) {
        this.commandExecutor.toggleFlashlight(false);
        summarySteps.push('flashlight off');
      } else if (cmd.includes('flashlight on')) {
        this.commandExecutor.toggleFlashlight(true);
        summarySteps.push('flashlight on');
      } else if (cmd.includes('volume up')) {
        this.commandExecutor.adjustVolume(true);
        summarySteps.push('volume up');
      } else if (cmd.includes('volume down')) {
        this.commandExecutor.adjustVolume(false);
        summarySteps.push('volume down');
      } else if (cmd.includes('mute')) {
        this.commandExecutor.muteVolume();
        summarySteps.push('muted audio');
      } else if (cmd.includes('alarm')) {
        const parsed = parseTimeExpression(cmd);
        await this.commandExecutor.dispatchClockAlarm(parsed?.time24 ?? '07:00', `${name} Alarm`);
        summarySteps.push(`Clock alarm ${parsed?.formatted12h ?? '7:00 AM'}`);
      } else if (cmd.includes('timer')) {
        const secs = parseDurationSeconds(cmd) ?? 25 * 60;
        await this.commandExecutor.dispatchClockTimer(secs, `${name} Timer`);
        summarySteps.push(`Clock timer ${Math.round(secs / 60)}m`);
      } else if (cmd.includes('maps')) {
        this.commandExecutor.openApp('com.google.android.apps.maps');
        summarySteps.push('Maps ready');
      } else if (cmd.includes('time')) {
        summarySteps.push(`time is ${this.getCurrentTime(lang)}`);
      }
    }

    if (name.toLowerCase().includes('driving')) {
      this.commandExecutor.setNotificationsEnabled(true);
    } else if (name.toLowerCase().includes('focus')) {
      this.commandExecutor.setNotificationsEnabled(false);
    }

    soundEffects.playSuccessChime();
    const reply =
      lang === 'ar'
        ? `تم تشغيل روتين ${name}: ${summarySteps.join('، ')}.`
        : `${name} routine completed: ${summarySteps.join(', ')}.`;

    this.callback?.onCommandExecuted(reply, true, {
      lang,
      latencyMs: Math.max(1, Math.round(performance.now() - start)),
      source: 'api',
    });
  }

  private async processCommand(rawText: string, hintLang?: DetectedLanguage): Promise<void> {
    const start = performance.now();
    const lang: DetectedLanguage =
      hintLang ??
      (detectTextLanguage(rawText) === 'en' && this.recognitionLanguage.startsWith('ar')
        ? 'ar'
        : detectTextLanguage(rawText));
    const norm = normalizeArabic(rawText).toLowerCase().trim();
    const emitResult = (
      reply: string,
      success: boolean,
      source: 'local' | 'wikipedia' | 'ai' | 'api' = 'local',
    ) => {
      if (success) {
        soundEffects.playSuccessChime();
      }
      this.callback?.onCommandExecuted(reply, success, {
        lang: detectTextLanguage(reply) || lang,
        latencyMs: Math.max(1, Math.round(performance.now() - start)),
        source,
      });
    };

    // 1. Multi-step Routines
    const matchedRoutine = this.automationService.findRoutineByText(rawText);
    if (matchedRoutine) {
      await this.executeRoutine(matchedRoutine.name, matchedRoutine.steps, lang);
      return;
    }

    // 2. Dynamic JSON Plugin & Internal App API Router (Custom Imported JSON Plugins + Crystal App)
    const matchedPluginAction = this.automationService.findPluginActionByText(rawText);
    if (matchedPluginAction) {
      const { plugin, action, matchedTrigger } = matchedPluginAction;
      const capability = action.capability;
      const durationSec = parseDurationSeconds(rawText);
      const parsedTime = parseTimeExpression(rawText);
      const cleanedText = this.stripAppPluginTokens(
        rawText,
        plugin.name,
        plugin.arabicName,
        matchedTrigger,
      );

      // Build structured payload according to action parameters & parsed NLU values
      const payload: Record<string, unknown> = {
        text: cleanedText || rawText,
        rawText,
      };

      if (capability === 'set_timer' || durationSec) {
        const defaultMins =
          Number(
            action.parameters?.find((p) => p.name === 'minutes')?.defaultValue,
          ) || 5;
        const effectiveSec = durationSec ?? defaultMins * 60;
        const mins = Math.max(1, Math.round(effectiveSec / 60));
        payload.seconds = effectiveSec;
        payload.minutes = mins;
        payload.text = cleanedText || `${mins}m`;
      }

      if (capability === 'set_alarm' && parsedTime) {
        payload.time24 = parsedTime.time24;
        payload.hour = parsedTime.hour24;
        payload.minute = parsedTime.minute;
        payload.text = cleanedText || parsedTime.formatted12h;
      }

      await this.commandExecutor.dispatchToAppApi(plugin.id, capability, payload, {
        actionId: action.id,
        summary: `${plugin.name} → ${lang === 'ar' ? action.titleAr || action.title : action.title}${
          payload.text ? `: ${String(payload.text)}` : ''
        }`,
      });

      const reply = this.automationService.formatPluginReply(
        plugin,
        action,
        payload,
        lang === 'ar' ? 'ar' : 'en',
      );
      emitResult(reply, true, 'api');
      return;
    }

    // 3. Google Assistant-Style Device Settings Control (Wi-Fi, Bluetooth, DND, Brightness, Volume, Dark Mode, Palette, Airplane, Battery Saver, Flashlight)
    const settingHandled = this.tryHandleDeviceSettingCommand(norm, lang);
    if (settingHandled) {
      emitResult(settingHandled, true, 'api');
      return;
    }

    // 4. Clock App API Delegation — Alarm (delegates to Android Clock API instead of local timer)
    if (
      norm.includes('alarm') ||
      norm.includes('wake me') ||
      norm.includes('منبه') ||
      norm.includes('صحيني') ||
      norm.includes('صحي')
    ) {
      const parsedTime = parseTimeExpression(rawText);
      const time24 = parsedTime?.time24 ?? '07:00';
      const labelMatch = rawText.match(/(?:labeled|called|named|باسم|بعنوان)\s+(.+)$/i);
      const rawLabel = labelMatch?.[1]?.trim() ?? '';
      const cleanLabel =
        rawLabel && !/^\d/.test(rawLabel)
          ? rawLabel
          : lang === 'ar'
            ? 'منبه فيكي'
            : 'Vicky Alarm';
      const { formatted12h } = await this.commandExecutor.dispatchClockAlarm(time24, cleanLabel);
      emitResult(
        lang === 'ar'
          ? `تم إرسال المنبه (${formatted12h}) إلى تطبيق الساعة.`
          : `Alarm for ${formatted12h} dispatched to Clock app.`,
        true,
        'api',
      );
      return;
    }

    // 5. Clock App API Delegation — Timer (delegates to Android Clock SET_TIMER API)
    if (norm.includes('timer') || norm.includes('موقت') || norm.includes('تايمر')) {
      const durationSec = parseDurationSeconds(rawText) ?? 5 * 60;
      const mins = Math.floor(durationSec / 60);
      const secs = durationSec % 60;
      const readable =
        mins > 0
          ? secs > 0
            ? `${mins}m ${secs}s`
            : `${mins} ${lang === 'ar' ? 'دقائق' : mins === 1 ? 'minute' : 'minutes'}`
          : `${secs} ${lang === 'ar' ? 'ثانية' : 'seconds'}`;
      await this.commandExecutor.dispatchClockTimer(durationSec, readable);
      emitResult(
        lang === 'ar'
          ? `تم إرسال مؤقت لمدة ${readable} إلى تطبيق الساعة.`
          : `Timer for ${readable} dispatched to Clock app.`,
        true,
        'api',
      );
      return;
    }

    // 6. Generic Quick Note (routes to Crystal Internal Note API)
    if (
      norm.includes('take a note') ||
      norm.includes('add note') ||
      norm.includes('save note') ||
      norm.includes('اكتب نوت') ||
      norm.includes('سجل ملاحظه') ||
      norm.includes('احفظ ملاحظه')
    ) {
      const noteText = rawText
        .replace(
          /(?:take a note|add note|save note|اكتب نوت|سجل ملاحظة|سجل ملاحظه|احفظ ملاحظة|احفظ ملاحظه)/gi,
          '',
        )
        .replace(/^[:\s-]+/, '')
        .trim();
      await this.commandExecutor.dispatchToAppApi(
        'crystal-api',
        'create_note',
        { text: noteText || 'Quick note' },
        {
          actionId: 'crystal_create_note',
          summary: `Crystal Note API → "${noteText || 'Quick note'}"`,
        },
      );
      emitResult(
        lang === 'ar'
          ? `تم حفظ الملاحظة في كريستال: "${noteText || 'ملاحظة سريعة'}".`
          : `Saved note in Crystal: "${noteText || 'Quick note'}".`,
        true,
        'api',
      );
      return;
    }

    // 7. Messaging Automation (Fixed Arabic & English WhatsApp / SMS / Email extraction!)
    if (
      norm.includes('send message') ||
      norm.includes('send a message') ||
      norm.includes('send msg') ||
      norm.includes('send whatsapp') ||
      norm.includes('send a whatsapp') ||
      norm.includes('whatsapp message') ||
      norm.startsWith('text ') ||
      norm.includes('ابعت رساله') ||
      norm.includes('ارسل رساله') ||
      norm.includes('ابعت مسج') ||
      norm.includes('رساله واتساب') ||
      norm.includes('ابعت واتساب') ||
      norm.includes('ارسل واتساب') ||
      norm.includes('ابعت ل') ||
      norm.includes('ارسل ل')
    ) {
      const channel: 'whatsapp' | 'sms' | 'email' =
        norm.includes('whatsapp') || norm.includes('واتساب') || norm.includes('واتس')
          ? 'whatsapp'
          : norm.includes('email') || norm.includes('mail') || norm.includes('ايميل')
            ? 'email'
            : 'sms';

      const parsedMsg = this.extractMessageRecipientAndBody(rawText);
      const draft = this.commandExecutor.prepareAndSendMessage(
        parsedMsg.recipient,
        parsedMsg.body,
        channel,
      );
      emitResult(
        lang === 'ar'
          ? `تم تجهيز رسالة ${channel === 'whatsapp' ? 'واتساب' : channel === 'email' ? 'بريد' : 'نصية'} إلى ${draft.recipientName}: "${draft.message}".`
          : `Ready to send ${channel} message to ${draft.recipientName}: "${draft.message}".`,
        true,
        'api',
      );
      return;
    }

    // 8. Maps Navigation
    if (
      norm.startsWith('navigate to ') ||
      norm.startsWith('directions to ') ||
      norm.includes('take me to ') ||
      norm.includes('وديني ') ||
      norm.includes('خريطه ') ||
      norm.includes('اتجاهات ')
    ) {
      const destination = rawText
        .replace(/(?:navigate to|directions to|take me to|وديني|خريطة|خريطه|اتجاهات|إلى|الى|لـ)/gi, '')
        .trim();
      this.commandExecutor.navigateTo(destination);
      emitResult(
        lang === 'ar'
          ? `جاري فتح الاتجاهات إلى ${destination || 'الخرائط'}.`
          : `Opening directions to ${destination || 'Google Maps'}.`,
        true,
        'api',
      );
      return;
    }

    // 9. Time / Date / Day
    if (
      norm.includes('what time') ||
      norm === 'time' ||
      norm.includes('الساعه كام') ||
      norm.includes('كم الساعه') ||
      norm.includes('ما الوقت') ||
      norm.includes('الوقت الان')
    ) {
      const response = this.getCurrentTime(lang);
      emitResult(
        lang === 'ar' ? `الساعة الآن ${response}` : `Time is ${response}`,
        true,
      );
      return;
    }

    if (
      norm.includes('what day') ||
      norm.includes('which day') ||
      norm.includes('النهارده ايه') ||
      norm.includes('اليوم ايه')
    ) {
      const response = this.getCurrentDay(lang);
      emitResult(
        lang === 'ar' ? `اليوم هو ${response}` : `Today is ${response}`,
        true,
      );
      return;
    }

    if (
      norm.includes('date') ||
      norm.includes('today') ||
      norm.includes('تاريخ اليوم') ||
      norm.includes('التاريخ')
    ) {
      const response = this.getCurrentDate(lang);
      emitResult(
        lang === 'ar' ? `تاريخ اليوم هو ${response}` : `Today is ${response}`,
        true,
      );
      return;
    }

    // 10. Call Contact
    if (norm.startsWith('call ') || norm.startsWith('اتصل ') || norm.startsWith('كلم ')) {
      const contact = rawText
        .replace(/^(?:call|اتصل بـ|اتصل ب|اتصل على|اتصل علي|اتصل|كلم)\s*/i, '')
        .trim();
      const ok = this.commandExecutor.makeCall(contact);
      emitResult(
        lang === 'ar' ? `جاري الاتصال بـ ${contact || 'جهة الاتصال'}` : `Calling ${contact || 'contact'}`,
        ok,
        'api',
      );
      return;
    }

    // 11. Tier 1 Fast Local Small Intelligence (Arabic/English Math, sqrt, Units, Greetings)
    const localBrain = runLocalSmallIntelligence(rawText, lang);
    if (localBrain.handled) {
      emitResult(localBrain.reply, true, 'local');
      return;
    }

    // 12. App Launching & YouTube Search
    if (
      (norm.includes('youtube') || norm.includes('يوتيوب')) &&
      (norm.includes('search') || norm.includes('ابحث') || norm.startsWith('play ') || norm.startsWith('شغل '))
    ) {
      const query = rawText
        .replace(/(?:search youtube for|youtube search|search on youtube|play|youtube|ابحث في يوتيوب عن|شغل|يوتيوب)/gi, '')
        .trim();
      this.commandExecutor.openYouTubeWithSearch(query);
      emitResult(
        lang === 'ar' ? `جاري البحث في يوتيوب عن ${query}` : `Searching YouTube for ${query}`,
        true,
      );
      return;
    }

    const appCommandResult = this.tryOpenAppCommand(norm, lang);
    if (appCommandResult) {
      emitResult(appCommandResult.reply, appCommandResult.success);
      return;
    }

    // 13. Google Search
    if (
      norm.startsWith('search ') ||
      norm.startsWith('google ') ||
      norm.includes('search for ') ||
      norm.startsWith('ابحث عن ') ||
      norm.startsWith('جوجل ')
    ) {
      const query = this.extractSearchQuery(rawText);
      const ok = this.commandExecutor.searchOnGoogle(query);
      emitResult(
        lang === 'ar' ? `جاري البحث عن ${query}` : `Searching for ${query}`,
        ok,
      );
      return;
    }

    // 14. Tier 2 Optional Cloud Small Intelligence (Gemini 3.1 Flash-Lite)
    if (this.cloudAIEnabled) {
      this.callback?.onCommandThinking?.(rawText, lang);
      try {
        const aiResult = await askCloudSmallIntelligence({
          query: rawText,
          language: this.recognitionLanguage,
          contacts: this.automationService
            .getContacts()
            .map((c) => (c.arabicName ? `${c.name} (${c.arabicName})` : c.name)),
          routines: this.automationService.getRoutines().map((r) => r.name),
          apps: this.automationService
            .getPlugins()
            .filter((p) => p.enabled)
            .map((p) => `${p.name} [${p.capabilities.join(', ')}]`),
        });
        await this.applyCloudAIAction(aiResult, lang);
        emitResult(aiResult.reply, true, 'ai');
        return;
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Smart Cloud AI error';
        this.callback?.onVoiceError(errMsg);
        emitResult(errMsg, false, 'ai');
        return;
      }
    }

    // 15. Offline / Wikipedia EN & AR Knowledge Query
    if (
      norm.includes('what is') ||
      norm.includes('what are') ||
      norm.includes('who is') ||
      norm.includes('tell me about') ||
      norm.includes('ما هو') ||
      norm.includes('ما هي') ||
      norm.includes('من هو') ||
      norm.includes('احكي لي عن') ||
      norm.includes('عرفني عن') ||
      norm.endsWith('?') ||
      norm.endsWith('؟')
    ) {
      const query = this.extractSearchQuery(rawText);
      if (query) {
        this.callback?.onCommandThinking?.(rawText, lang);
        try {
          const summary = await this.webSearchHelper.searchAndGetResult(query);
          this.commandExecutor.searchOnGoogle(query);
          emitResult(`${query}: ${summary}`, true, 'wikipedia');
        } catch {
          emitResult(
            lang === 'ar' ? 'عذراً، فشل البحث.' : 'Sorry, search failed.',
            false,
            'wikipedia',
          );
        }
        return;
      }
    }

    emitResult(
      lang === 'ar'
        ? `لم أفهم الأمر "${rawText}". جرب: "شغل الواي فاي"، "اضبط منبه 7 صباحاً"، أو "25 × 15".`
        : `Didn't catch "${rawText}". Try "Turn on Wi-Fi", "Set alarm for 7 AM", or enable Smart AI.`,
      false,
      'local',
    );
  }

  private tryHandleDeviceSettingCommand(norm: string, lang: DetectedLanguage): string | null {
    const wantsOff =
      norm.includes('off') ||
      norm.includes('disable') ||
      norm.includes('اقفل') ||
      norm.includes('اطفي') ||
      norm.includes('اوقف') ||
      norm.includes('عطل');
    const wantsOn =
      !wantsOff &&
      (norm.includes('on') ||
        norm.includes('enable') ||
        norm.includes('شغل') ||
        norm.includes('افتح') ||
        norm.includes('فعل') ||
        norm.includes('نور'));

    // Wi-Fi
    if (norm.includes('wifi') || norm.includes('wi-fi') || norm.includes('واي فاي') || norm.includes('الواي فاي')) {
      const turnOn = !wantsOff;
      this.commandExecutor.setDeviceToggle('wifi', turnOn);
      return lang === 'ar'
        ? turnOn
          ? 'تم تشغيل الواي فاي.'
          : 'تم إيقاف الواي فاي.'
        : turnOn
          ? 'Wi-Fi turned on.'
          : 'Wi-Fi turned off.';
    }

    // Bluetooth
    if (norm.includes('bluetooth') || norm.includes('بلوتوث') || norm.includes('البلوتوث')) {
      const turnOn = !wantsOff;
      this.commandExecutor.setDeviceToggle('bluetooth', turnOn);
      return lang === 'ar'
        ? turnOn
          ? 'تم تشغيل البلوتوث.'
          : 'تم إيقاف البلوتوث.'
        : turnOn
          ? 'Bluetooth turned on.'
          : 'Bluetooth turned off.';
    }

    // Do Not Disturb
    if (
      norm.includes('do not disturb') ||
      norm.includes('dnd') ||
      norm.includes('عدم الازعاج') ||
      norm.includes('عدم ازعاج')
    ) {
      const turnOn = !wantsOff;
      this.commandExecutor.setDeviceToggle('dnd', turnOn);
      return lang === 'ar'
        ? turnOn
          ? 'تم تفعيل وضع عدم الإزعاج.'
          : 'تم إيقاف وضع عدم الإزعاج.'
        : turnOn
          ? 'Do Not Disturb enabled.'
          : 'Do Not Disturb disabled.';
    }

    // Airplane Mode
    if (norm.includes('airplane') || norm.includes('flight mode') || norm.includes('وضع الطيران') || norm.includes('الطيران')) {
      const turnOn = !wantsOff;
      this.commandExecutor.setDeviceToggle('airplane', turnOn);
      return lang === 'ar'
        ? turnOn
          ? 'تم تفعيل وضع الطيران.'
          : 'تم إيقاف وضع الطيران.'
        : turnOn
          ? 'Airplane Mode turned on.'
          : 'Airplane Mode turned off.';
    }

    // Battery Saver
    if (norm.includes('battery saver') || norm.includes('power saver') || norm.includes('توفير الطاقه') || norm.includes('وفر البطاريه')) {
      const turnOn = !wantsOff;
      this.commandExecutor.setDeviceToggle('battery_saver', turnOn);
      return lang === 'ar'
        ? turnOn
          ? 'تم تفعيل وضع توفير الطاقة.'
          : 'تم إيقاف وضع توفير الطاقة.'
        : turnOn
          ? 'Battery Saver enabled.'
          : 'Battery Saver disabled.';
    }

    // Flashlight / Torch
    if (
      norm.includes('flashlight') ||
      norm.includes('torch') ||
      norm.includes('الكشاف') ||
      norm.includes('كشاف') ||
      norm.includes('الفلاش')
    ) {
      const turnOn = wantsOn || !wantsOff;
      this.commandExecutor.toggleFlashlight(turnOn);
      return lang === 'ar'
        ? turnOn
          ? 'تم تشغيل الكشاف.'
          : 'تم إطفاء الكشاف.'
        : turnOn
          ? 'Flashlight turned on.'
          : 'Flashlight turned off.';
    }

    // Dark Mode / Light Mode
    if (
      norm.includes('dark mode') ||
      norm.includes('night mode') ||
      norm.includes('الوضع الليلي') ||
      norm.includes('الوضع الداكن')
    ) {
      const dark = !wantsOff;
      this.commandExecutor.setDarkMode(dark);
      return lang === 'ar'
        ? dark
          ? 'تم تفعيل الوضع الداكن.'
          : 'تم التبديل للوضع الفاتح.'
        : dark
          ? 'Switched to Dark Mode.'
          : 'Switched to Light Mode.';
    }
    if (norm.includes('light mode') || norm.includes('الوضع الفاتح') || norm.includes('الوضع النهاري')) {
      this.commandExecutor.setDarkMode(false);
      return lang === 'ar' ? 'تم تفعيل الوضع الفاتح.' : 'Switched to Light Mode.';
    }

    // Material You Color Seed by voice
    if (
      norm.includes('theme') ||
      norm.includes('color') ||
      norm.includes('اللون') ||
      norm.includes('الثيم')
    ) {
      let seed: MaterialYouSeed | null = null;
      if (norm.includes('green') || norm.includes('sage') || norm.includes('اخضر') || norm.includes('الاخضر')) seed = 'sage';
      else if (norm.includes('blue') || norm.includes('ocean') || norm.includes('ازرق') || norm.includes('الازرق')) seed = 'ocean';
      else if (norm.includes('orange') || norm.includes('coral') || norm.includes('terracotta') || norm.includes('برتقالي') || norm.includes('احمر')) seed = 'terracotta';
      else if (norm.includes('purple') || norm.includes('lavender') || norm.includes('بنفسجي')) seed = 'lavender';

      if (seed) {
        this.commandExecutor.setThemeSeed(seed);
        return lang === 'ar'
          ? `تم تغيير ألوان ماتيريال يو.`
          : `Updated Material You palette to ${seed}.`;
      }
    }

    // Brightness
    if (norm.includes('brightness') || norm.includes('السطوع') || norm.includes('الاضاءه')) {
      const pctMatch = norm.match(/(\d{1,3})\s*%?/);
      if (pctMatch) {
        const val = Number(pctMatch[1]);
        this.commandExecutor.setBrightnessLevel(val);
        return lang === 'ar' ? `تم ضبط السطوع إلى ${this.commandExecutor.getBrightness()}%.` : `Brightness set to ${this.commandExecutor.getBrightness()}%.`;
      }
      const increase =
        norm.includes('up') ||
        norm.includes('increase') ||
        norm.includes('higher') ||
        norm.includes('زود') ||
        norm.includes('علي') ||
        norm.includes('ارفع');
      this.commandExecutor.adjustBrightness(increase);
      return lang === 'ar'
        ? `تم ${increase ? 'رفع' : 'خفض'} السطوع إلى ${this.commandExecutor.getBrightness()}%.`
        : `Brightness ${increase ? 'increased' : 'decreased'} to ${this.commandExecutor.getBrightness()}%.`;
    }

    // Volume & Mute
    if (norm.includes('mute') || norm.includes('اكتم الصوت') || norm.includes('كتم الصوت') || norm.includes('صامت')) {
      this.commandExecutor.muteVolume();
      return lang === 'ar' ? 'تم كتم الصوت.' : 'Volume muted.';
    }
    if (
      norm.includes('volume') ||
      norm.includes('الصوت')
    ) {
      const pctMatch = norm.match(/(\d{1,3})\s*%?/);
      if (pctMatch) {
        this.commandExecutor.setVolumeLevel(Number(pctMatch[1]));
        return lang === 'ar' ? `تم ضبط الصوت إلى ${this.commandExecutor.getVolume()}%.` : `Volume set to ${this.commandExecutor.getVolume()}%.`;
      }
      const increase =
        norm.includes('up') ||
        norm.includes('increase') ||
        norm.includes('louder') ||
        norm.includes('علي') ||
        norm.includes('ارفع') ||
        norm.includes('زود');
      const decrease =
        norm.includes('down') ||
        norm.includes('decrease') ||
        norm.includes('lower') ||
        norm.includes('وطي') ||
        norm.includes('اخفض') ||
        norm.includes('قلل');
      if (increase || decrease) {
        this.commandExecutor.adjustVolume(increase);
        return lang === 'ar'
          ? `تم ${increase ? 'رفع' : 'خفض'} الصوت إلى ${this.commandExecutor.getVolume()}%.`
          : `Volume ${increase ? 'increased' : 'decreased'} to ${this.commandExecutor.getVolume()}%.`;
      }
    }

    return null;
  }

  private stripAppPluginTokens(
    rawText: string,
    appName: string,
    arabicName: string,
    matchedTrigger: string,
  ): string {
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const removals = [appName, arabicName, matchedTrigger, 'crystal', 'كريستال']
      .map((s) => s.trim())
      .filter((s) => s.length >= 2)
      .sort((a, b) => b.length - a.length)
      .map(esc);

    let out = rawText;
    if (removals.length > 0) {
      out = out.replace(new RegExp(`(?:${removals.join('|')})`, 'gi'), ' ');
    }

    return out
      .replace(
        /(?:open|launch|add a note in|add note in|add note to|save note in|take a note in|set timer in|set alarm in|run in|trigger|in|to|افتح|شغل|اكتب نوت في|اكتب ملاحظة في|اكتب ملاحظه في|سجل ملاحظة في|سجل ملاحظه في|احفظ ملاحظة في|احفظ في|اعمل مؤقت في|اضبط مؤقت في|نوت|ملاحظة|ملاحظه|مؤقت|تايمر|منبه|في)/gi,
        ' ',
      )
      .replace(/^\s*(?:اكتب|سجل|احفظ|اعمل|اضبط|add|save|write|create|take)\s+/i, '')
      .replace(/^[:\s-]+/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private tryOpenAppCommand(
    norm: string,
    lang: DetectedLanguage,
  ): { reply: string; success: boolean } | null {
    const isExplicitAppVerb =
      norm.includes('open ') ||
      norm.includes('launch ') ||
      norm.includes('افتح ') ||
      norm.includes('شغل ');

    const checks: Array<{ keywords: string[]; pkg: string; en: string; ar: string }> = [
      { keywords: ['whatsapp', 'واتساب', 'واتس'], pkg: 'com.whatsapp', en: 'Opening WhatsApp', ar: 'جاري فتح واتساب' },
      { keywords: ['youtube', 'يوتيوب'], pkg: 'com.google.android.youtube', en: 'Opening YouTube', ar: 'جاري فتح يوتيوب' },
      { keywords: ['instagram', 'انستجرام', 'انستغرام', 'انستا'], pkg: 'com.instagram.android', en: 'Opening Instagram', ar: 'جاري فتح إنستغرام' },
      { keywords: ['gmail', 'email', 'جيميل'], pkg: 'com.google.android.gm', en: 'Opening Gmail', ar: 'جاري فتح جيميل' },
      { keywords: ['maps', 'خرائط', 'الخرائط'], pkg: 'com.google.android.apps.maps', en: 'Opening Google Maps', ar: 'جاري فتح خرائط جوجل' },
      { keywords: ['chrome', 'browser', 'كروم', 'المتصفح'], pkg: 'com.android.chrome', en: 'Opening Chrome', ar: 'جاري فتح كروم' },
      { keywords: ['calendar', 'التقويم'], pkg: 'com.google.android.calendar', en: 'Opening Calendar', ar: 'جاري فتح التقويم' },
      { keywords: ['clock', 'الساعه'], pkg: 'com.google.android.deskclock', en: 'Opening Clock', ar: 'جاري فتح تطبيق الساعة' },
      { keywords: ['calculator', 'الاله الحاسبه', 'حاسبه'], pkg: 'com.google.android.calculator', en: 'Opening Calculator', ar: 'جاري فتح الآلة الحاسبة' },
      { keywords: ['spotify', 'music', 'سبوتيفاي', 'موسيقي'], pkg: 'com.spotify.music', en: 'Opening Music Player', ar: 'جاري فتح مشغل الموسيقى' },
    ];

    if (norm.includes('camera') || norm.includes('الكاميرا') || norm.includes('كاميرا')) {
      return {
        success: this.commandExecutor.openCamera(),
        reply: lang === 'ar' ? 'جاري فتح الكاميرا' : 'Opening Camera',
      };
    }

    if (norm.includes('settings') || norm.includes('الاعدادات')) {
      return {
        success: this.commandExecutor.openSettings(),
        reply: lang === 'ar' ? 'جاري فتح الإعدادات' : 'Opening Settings',
      };
    }

    for (const item of checks) {
      if (
        item.keywords.some((kw) =>
          isExplicitAppVerb ? norm.includes(kw) : norm === kw || norm.startsWith(`open ${kw}`),
        )
      ) {
        return {
          success: this.commandExecutor.openApp(item.pkg),
          reply: lang === 'ar' ? item.ar : item.en,
        };
      }
    }

    return null;
  }

  private async applyCloudAIAction(
    aiResult: CloudAIActionResponse,
    lang: DetectedLanguage,
  ): Promise<void> {
    switch (aiResult.action) {
      case 'set_alarm':
        if (aiResult.time24) {
          await this.commandExecutor.dispatchClockAlarm(aiResult.time24, aiResult.label || 'Vicky Alarm');
        }
        break;
      case 'set_timer':
        if (aiResult.minutes && aiResult.minutes > 0) {
          await this.commandExecutor.dispatchClockTimer(aiResult.minutes * 60, aiResult.label || `${aiResult.minutes}m`);
        }
        break;
      case 'send_message':
        this.commandExecutor.prepareAndSendMessage(
          aiResult.recipient || 'Contact',
          aiResult.messageText || '',
          aiResult.channel || 'whatsapp',
        );
        break;
      case 'add_note':
        await this.commandExecutor.dispatchToAppApi(
          'crystal-api',
          'create_note',
          { text: aiResult.label || aiResult.apiText || aiResult.reply },
        );
        break;
      case 'navigate':
        if (aiResult.destination) {
          this.commandExecutor.navigateTo(aiResult.destination);
        }
        break;
      case 'device_setting': {
        const s = aiResult.settingName;
        const turnOn = aiResult.settingState !== 'off';
        if (s === 'wifi' || s === 'bluetooth' || s === 'dnd' || s === 'airplane' || s === 'battery_saver') {
          this.commandExecutor.setDeviceToggle(s, turnOn);
        } else if (s === 'flashlight') {
          this.commandExecutor.toggleFlashlight(turnOn);
        } else if (s === 'dark_mode') {
          this.commandExecutor.setDarkMode(turnOn);
        } else if (s === 'brightness') {
          if (typeof aiResult.settingValue === 'number') {
            this.commandExecutor.setBrightnessLevel(aiResult.settingValue);
          } else {
            this.commandExecutor.adjustBrightness(aiResult.settingState !== 'down');
          }
        } else if (s === 'volume') {
          if (aiResult.settingState === 'mute') {
            this.commandExecutor.muteVolume();
          } else if (typeof aiResult.settingValue === 'number') {
            this.commandExecutor.setVolumeLevel(aiResult.settingValue);
          } else {
            this.commandExecutor.adjustVolume(aiResult.settingState !== 'down');
          }
        }
        break;
      }
      case 'app_api': {
        const target = aiResult.appName || 'crystal-api';
        const cap = aiResult.apiCapability || 'custom_action';
        await this.commandExecutor.dispatchToAppApi(target, cap, {
          text: aiResult.apiText || aiResult.label || '',
          minutes: aiResult.minutes,
        });
        break;
      }
      case 'open_app': {
        const app = (aiResult.appName || '').toLowerCase();
        if (app.includes('crystal')) this.commandExecutor.openApp('app.crystal');
        else if (app.includes('camera')) this.commandExecutor.openCamera();
        else if (app.includes('whatsapp')) this.commandExecutor.openApp('com.whatsapp');
        else if (app.includes('youtube')) this.commandExecutor.openApp('com.google.android.youtube');
        else if (app.includes('maps')) this.commandExecutor.openApp('com.google.android.apps.maps');
        else if (app.includes('clock')) this.commandExecutor.openApp('com.google.android.deskclock');
        else if (app.includes('gmail')) this.commandExecutor.openApp('com.google.android.gm');
        break;
      }
      case 'run_routine': {
        const routine = this.automationService.findRoutineByText(aiResult.routineName || '');
        if (routine) {
          await this.executeRoutine(routine.name, routine.steps, lang);
        }
        break;
      }
      default:
        break;
    }
  }

  /**
   * Robust bilingual recipient + message body parser.
   * Strips verb + channel words FIRST so Arabic "رسالة" never matches "ل" mid-word!
   */
  private extractMessageRecipientAndBody(rawText: string): {
    recipient: string;
    body: string;
  } {
    // 1. English pattern: "send whatsapp to Ahmed saying I am on my way"
    const enMatch = rawText.match(
      /(?:to|text)\s+([^,]+?)\s+(?:saying|that|message|:)\s+(.+)$/i,
    );
    if (enMatch) {
      return { recipient: enMatch[1].trim(), body: enMatch[2].trim() };
    }

    // 2. Strip leading command verb + channel words cleanly BEFORE Arabic preposition scan
    const stripped = rawText
      .replace(
        /^\s*(?:send\s+(?:a\s+)?(?:whatsapp|sms|email|text)?\s*(?:message|msg)?|text|ابعتلي|ابعت|ارسل|ارسلي|ابعث|أرسل)\s*/i,
        '',
      )
      .replace(
        /^\s*(?:رسالة|رساله|مسج|نصية|نصيه)\s*/i,
        '',
      )
      .replace(
        /^\s*(?:على|علي|في|عبر|بال)?\s*(?:الواتساب|واتساب|الواتس|واتس|اس ام اس|ايميل|whatsapp|sms|email)\s*/i,
        '',
      )
      .trim();

    // 3. Arabic with explicit body delimiter ("لأحمد بتقول أنا في الطريق" / "إلى سارة فيها مرحباً")
    const arSayingMatch = stripped.match(
      /^(?:لـ\s*|إلى\s+|الى\s+|الي\s+|ل(?=[\u0600-\u06FF]))([^\s,،]+)\s+(?:بتقول|تقول|فيها|مكتوب فيها|مضمونها|نصها|ان|أن|:)\s+(.+)$/i,
    );
    if (arSayingMatch) {
      return { recipient: arSayingMatch[1].trim(), body: arSayingMatch[2].trim() };
    }

    // 4. Arabic direct recipient + message ("لأحمد أنا في الطريق" / "إلى أحمد صباح الخير")
    const arDirectMatch = stripped.match(
      /^(?:لـ\s*|إلى\s+|الى\s+|الي\s+|ل(?=[\u0600-\u06FF]))([^\s,،]+)(?:\s+(.+))?$/i,
    );
    if (arDirectMatch) {
      return {
        recipient: arDirectMatch[1].trim(),
        body: (arDirectMatch[2] ?? '').trim(),
      };
    }

    // 5. Fallback: match any saved contact by normalized English or Arabic name
    const normStripped = normalizeArabic(stripped).toLowerCase();
    for (const contact of this.automationService.getContacts()) {
      const enName = normalizeArabic(contact.name).toLowerCase();
      const arName = contact.arabicName
        ? normalizeArabic(contact.arabicName).toLowerCase()
        : '';
      if ((enName && normStripped.includes(enName)) || (arName && normStripped.includes(arName))) {
        const body = stripped
          .replace(new RegExp(`(?:لـ?|إلى|الى|to)?\\s*${contact.name}`, 'gi'), '')
          .replace(
            contact.arabicName
              ? new RegExp(`(?:لـ?|إلى|الى)?\\s*${contact.arabicName}`, 'gi')
              : /$^/,
            '',
          )
          .replace(/^[\s,،:]+/, '')
          .trim();
        return { recipient: contact.arabicName && /[\u0600-\u06FF]/.test(stripped) ? contact.arabicName : contact.name, body };
      }
    }

    // 6. English simple fallback ("text Rahul I'm here")
    const simpleWords = stripped.replace(/^to\s+/i, '').trim().split(/\s+/);
    if (simpleWords.length >= 2) {
      return {
        recipient: simpleWords[0],
        body: simpleWords.slice(1).join(' '),
      };
    }

    return { recipient: stripped || 'Contact', body: '' };
  }

  private getCurrentTime(lang: DetectedLanguage): string {
    return new Date().toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  private getCurrentDate(lang: DetectedLanguage): string {
    return new Date().toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', {
      weekday: 'long',
      month: 'long',
      day: '2-digit',
      year: 'numeric',
    });
  }

  private getCurrentDay(lang: DetectedLanguage): string {
    return new Date().toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', {
      weekday: 'long',
    });
  }

  private extractSearchQuery(command: string): string {
    return command
      .replace(
        /(?:what is|what are|who is|tell me about|search for|search|google|ما هو|ما هي|من هو|احكي لي عن|عرفني عن|ابحث عن|جوجل)/gi,
        '',
      )
      .replace(/[?!.؟]+$/, '')
      .trim();
  }

  private getErrorText(errorCode: string): string {
    switch (errorCode) {
      case 'audio-capture':
        return 'Audio recording error (no microphone found)';
      case 'not-allowed':
      case 'service-not-allowed':
        return 'Insufficient microphone permissions';
      case 'network':
        return 'Network error during speech recognition';
      case 'no-speech':
        return 'No speech input detected';
      case 'bad-grammar':
      case 'language-not-supported':
        return 'Speech language not supported on this browser';
      default:
        return `Speech recognition error: ${errorCode}`;
    }
  }
}
