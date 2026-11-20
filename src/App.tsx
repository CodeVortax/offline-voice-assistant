import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Blocks,
  History,
  Mic,
  Moon,
  Settings,
  Sun,
} from 'lucide-react';
import { ActivityAndContactsView } from './components/ActivityAndContactsView';
import { AppApiStudioView } from './components/AppApiStudioView';
import { AssistantOverlay } from './components/AssistantOverlay';
import { AssistantView } from './components/AssistantView';
import { CameraModal } from './components/CameraModal';
import { ConfirmDialog } from './components/ConfirmDialog';
import { SettingsView } from './components/SettingsView';
import { ToastContainer } from './components/ToastContainer';
import {
  detectSystemLanguage,
  resolveUiLanguage,
  TRANSLATIONS,
} from './i18n/translations';
import { AutomationService } from './services/automationService';
import {
  AUTO_ANSWER_DELAY_SECONDS,
  CallAutoAnswerService,
} from './services/callAutoAnswerService';
import { CommandExecutor } from './services/commandExecutor';
import { NotificationReaderService } from './services/notificationReaderService';
import { fetchCloudAIStatus } from './services/smallIntelligence';
import { soundEffects } from './services/soundEffects';
import { TTSService } from './services/ttsService';
import { VoiceRecognitionService } from './services/voiceRecognitionService';
import { WebSearchHelper } from './services/webSearchHelper';
import {
  ActionLink,
  ActiveTab,
  AppActionDispatch,
  AssistantOverlayState,
  CallAutoAnswerState,
  ContactItem,
  DeviceState,
  InternalPluginRecord,
  LogEntry,
  LogLevel,
  MaterialYouSeed,
  MessageDraft,
  ModelState,
  NotificationPayload,
  NotificationRecord,
  PluginValidationResult,
  RecognitionLanguage,
  RoutineItem,
  ThemeMode,
  ToastMessage,
  UiLanguagePreference,
  VickyAppManifest,
} from './types/assistant';

const SAMPLE_NOTIFICATIONS: NotificationPayload[] = [
  {
    packageName: 'com.whatsapp',
    appName: 'WhatsApp',
    title: 'Ahmed',
    text: 'هل ما زلنا على موعدنا الساعة السادسة؟',
  },
  {
    packageName: 'com.whatsapp',
    appName: 'WhatsApp',
    title: 'Rahul',
    text: 'Hey, are we still meeting at 6 PM today?',
  },
  {
    packageName: 'com.google.android.gm',
    appName: 'Gmail',
    title: 'GitHub',
    text: 'Your Vicky AI voice assistant build finished cleanly.',
  },
  {
    packageName: 'com.android.systemui',
    appName: 'Android System',
    title: 'System Update',
    text: 'This system notification is automatically filtered out.',
  },
];

const SAMPLE_CALLERS = ['+201001234567', '+966501234567', '+919876543210'];

const THEME_STORAGE_KEY = 'vicky.materialyou.theme.v1';
const UI_LANG_STORAGE_KEY = 'vicky.ui.language.v1';

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatExportFileStamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(
    date.getHours(),
  )}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function formatExportReadableDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function readStoredTheme(): { seed: MaterialYouSeed; mode: ThemeMode } {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return { seed: 'lavender', mode: 'light' };
    const parsed = JSON.parse(raw) as Partial<{ seed: MaterialYouSeed; mode: ThemeMode }>;
    const seed =
      parsed.seed === 'sage' || parsed.seed === 'terracotta' || parsed.seed === 'ocean'
        ? parsed.seed
        : 'lavender';
    const mode = parsed.mode === 'dark' ? 'dark' : 'light';
    return { seed, mode };
  } catch {
    return { seed: 'lavender', mode: 'light' };
  }
}

function readStoredUiLangPref(): UiLanguagePreference {
  try {
    const raw = window.localStorage.getItem(UI_LANG_STORAGE_KEY);
    if (raw === 'ar' || raw === 'en' || raw === 'system') return raw;
    return 'system';
  } catch {
    return 'system';
  }
}

export function App() {
  const initialTheme = readStoredTheme();
  const detectedSystemLang = detectSystemLanguage();
  const [uiLangPref, setUiLangPref] = useState<UiLanguagePreference>(readStoredUiLangPref);
  const uiLang = resolveUiLanguage(uiLangPref);
  const t = TRANSLATIONS[uiLang];

  const [themeSeed, setThemeSeed] = useState<MaterialYouSeed>(initialTheme.seed);
  const [themeMode, setThemeMode] = useState<ThemeMode>(initialTheme.mode);
  const [activeTab, setActiveTab] = useState<ActiveTab>('assistant');

  const [modelState, setModelState] = useState<ModelState>('loading');
  const [isListening, setIsListening] = useState(false);
  const [speechApiSupported, setSpeechApiSupported] = useState(true);
  const [recognitionLang, setRecognitionLang] = useState<RecognitionLanguage>(
    detectedSystemLang === 'ar' ? 'ar-EG' : 'en-US',
  );
  const [cloudAIEnabled, setCloudAIEnabled] = useState(false);
  const [cloudAIAvailable, setCloudAIAvailable] = useState(false);

  const [wakeWordActive, setWakeWordActive] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [lastResponse, setLastResponse] = useState('');
  const [activeLink, setActiveLink] = useState<ActionLink | null>(null);
  const [messageDraft, setMessageDraft] = useState<MessageDraft | null>(null);
  const [lastDispatch, setLastDispatch] = useState<AppActionDispatch | null>(null);

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notificationAccessGranted, setNotificationAccessGranted] = useState(false);
  const [recentNotification, setRecentNotification] =
    useState<NotificationRecord | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [modelErrorMessage, setModelErrorMessage] = useState<string | null>(null);

  // Synced from AutomationService (JSON Plugin Manifests, Dispatches, Records, Routines, Contacts)
  const [plugins, setPlugins] = useState<VickyAppManifest[]>([]);
  const [dispatches, setDispatches] = useState<AppActionDispatch[]>([]);
  const [records, setRecords] = useState<InternalPluginRecord[]>([]);
  const [routines, setRoutines] = useState<RoutineItem[]>([]);
  const [contacts, setContacts] = useState<ContactItem[]>([]);

  const [overlayState, setOverlayState] = useState<AssistantOverlayState>({
    open: false,
    phase: 'idle',
    wakePhraseMatched: null,
    transcript: '',
    interimTranscript: '',
    reply: '',
    messageDraft: null,
    actionLink: null,
    lastDispatch: null,
    detectedLang: detectedSystemLang,
    latencyMs: null,
    source: null,
  });

  const [deviceState, setDeviceState] = useState<DeviceState>({
    wifiOn: true,
    bluetoothOn: false,
    dndOn: false,
    airplaneModeOn: false,
    batterySaverOn: false,
    flashlightOn: false,
    brightness: 85,
    volume: 80,
    muted: false,
    cameraOpen: false,
    ttsLanguage: '...',
    ttsReady: false,
    microphoneMuted: false,
    lastOpenedApp: null,
  });

  const [callState, setCallState] = useState<CallAutoAnswerState>({
    phase: 'idle',
    callerLabel: '',
    phoneNumber: '',
    secondsRemaining: AUTO_ANSWER_DELAY_SECONDS,
    microphoneMuted: false,
    activeMessage: null,
  });

  const ttsServiceRef = useRef<TTSService | null>(null);
  const automationServiceRef = useRef<AutomationService | null>(null);
  const voiceServiceRef = useRef<VoiceRecognitionService | null>(null);
  const commandExecutorRef = useRef<CommandExecutor | null>(null);
  const notificationServiceRef = useRef<NotificationReaderService | null>(null);
  const callServiceRef = useRef<CallAutoAnswerService | null>(null);
  const sampleNotificationIndexRef = useRef(0);
  const lastSampleNotificationRef = useRef<NotificationPayload | null>(null);
  const sampleCallerIndexRef = useRef(0);
  const hasLoggedStartupRef = useRef(false);
  const initialMicLangRef = useRef<RecognitionLanguage>(
    detectedSystemLang === 'ar' ? 'ar-EG' : 'en-US',
  );

  // Sync HTML dir/lang with resolved pure UI language & persist preference
  useEffect(() => {
    document.documentElement.lang = uiLang;
    document.documentElement.dir = uiLang === 'ar' ? 'rtl' : 'ltr';
    try {
      window.localStorage.setItem(UI_LANG_STORAGE_KEY, uiLangPref);
    } catch {
      // Ignore storage errors
    }
  }, [uiLang, uiLangPref]);

  // Apply Material You Dynamic Color seed & mode to root element
  useEffect(() => {
    document.documentElement.dataset.themeSeed = themeSeed;
    document.documentElement.dataset.themeMode = themeMode;
    try {
      window.localStorage.setItem(
        THEME_STORAGE_KEY,
        JSON.stringify({ seed: themeSeed, mode: themeMode }),
      );
    } catch {
      // Ignore storage errors
    }
  }, [themeSeed, themeMode]);

  const addLog = useCallback((message: string, level: LogLevel = 'info') => {
    const entry: LogEntry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: formatTimestamp(new Date()),
      message,
      level,
    };
    setLogs((prev) => [...prev, entry]);
  }, []);

  const showToast = useCallback(
    (message: string, tone: 'info' | 'success' | 'error' = 'info') => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-2), { id, message, tone }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== id));
      }, 3400);
    },
    [],
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const speakResponse = useCallback(
    (text: string) => {
      const tts = ttsServiceRef.current;
      if (tts && tts.getIsReady()) {
        tts.speak(text, {
          onStart: () => voiceServiceRef.current?.setAssistantSpeaking(true),
          onDone: () => voiceServiceRef.current?.setAssistantSpeaking(false),
          onError: () => voiceServiceRef.current?.setAssistantSpeaking(false),
        });
        addLog(`TTS: ${text}`, 'info');
      }
    },
    [addLog],
  );

  const syncAutomationSnapshot = useCallback((service: AutomationService) => {
    setPlugins(service.getPlugins());
    setDispatches(service.getDispatches());
    setRecords(service.getPluginRecords());
    setRoutines(service.getRoutines());
    setContacts(service.getContacts());
  }, []);

  useEffect(() => {
    const ttsService = new TTSService();
    const webSearchHelper = new WebSearchHelper();
    const automationService = new AutomationService();
    const notificationService = new NotificationReaderService(ttsService);

    const commandExecutor = new CommandExecutor(
      {
        onToast: (message, tone) => showToast(message, tone),
        onActionLink: (link) => {
          setActiveLink(link);
          setOverlayState((prev) => ({ ...prev, actionLink: link }));
        },
        onMessageDraft: (draft) => {
          setMessageDraft(draft);
          setOverlayState((prev) => ({ ...prev, messageDraft: draft }));
        },
        onAppDispatch: (dispatch) => {
          setLastDispatch(dispatch);
          setOverlayState((prev) => ({ ...prev, lastDispatch: dispatch }));
        },
        onDeviceStatePatch: (patch) =>
          setDeviceState((prev) => ({ ...prev, ...patch })),
        onVolumeChange: (volume, muted) => {
          ttsService.setVolume(volume / 100);
          ttsService.setMuted(muted);
          setDeviceState((prev) => ({ ...prev, volume, muted }));
        },
        onThemeModeChange: (mode) => setThemeMode(mode),
        onThemeSeedChange: (seed) => setThemeSeed(seed),
        onOpenCamera: () =>
          setDeviceState((prev) => ({ ...prev, cameraOpen: true })),
        onSetNotificationsEnabled: (enabled) => {
          setNotificationsEnabled(enabled);
          notificationService.setEnabled(enabled);
        },
      },
      webSearchHelper,
      automationService,
    );

    const voiceService = new VoiceRecognitionService(
      commandExecutor,
      webSearchHelper,
      automationService,
    );
    voiceService.setRecognitionLanguage(initialMicLangRef.current);

    const callService = new CallAutoAnswerService(ttsService);

    ttsServiceRef.current = ttsService;
    automationServiceRef.current = automationService;
    commandExecutorRef.current = commandExecutor;
    voiceServiceRef.current = voiceService;
    notificationServiceRef.current = notificationService;
    callServiceRef.current = callService;

    syncAutomationSnapshot(automationService);
    const unsubscribeAutomation = automationService.subscribe(() => {
      syncAutomationSnapshot(automationService);
    });

    void fetchCloudAIStatus().then((status) => {
      setCloudAIAvailable(status.aiAvailable);
      if (status.aiAvailable) {
        setCloudAIEnabled(true);
        voiceService.setCloudAIEnabled(true);
      }
    });

    ttsService.setVolume(0.8);
    ttsService.initialize((ttsResult) => {
      setDeviceState((prev) => ({
        ...prev,
        ttsReady: ttsResult.ready,
        ttsLanguage: ttsResult.languageLabel,
      }));
    });

    const initialNotifEnabled = notificationService.isEnabled();
    setNotificationsEnabled(initialNotifEnabled);
    const hasNotifAccess = notificationService.isNotificationAccessGranted();
    setNotificationAccessGranted(hasNotifAccess);

    notificationService.setCallback({
      onNotificationRead: (record) => {
        setRecentNotification(record);
        addLog(`Notification: ${record.formattedMessage}`, 'info');
      },
      onNotificationSkipped: (reason) => {
        addLog(`Notification skipped: ${reason}`, 'warning');
        showToast(reason, 'info');
      },
    });

    callService.setCallback({
      onStateChange: (nextState) => {
        setCallState(nextState);
        setDeviceState((prev) => ({
          ...prev,
          microphoneMuted: nextState.microphoneMuted,
        }));
      },
      onLog: (message, level = 'info') => addLog(message, level),
    });

    voiceService.setCallback({
      onVoiceResult: (text) => {
        setInterimText('');
        setRecognizedText(text);
        setOverlayState((prev) => ({
          ...prev,
          transcript: text,
          interimTranscript: '',
        }));
        addLog(`Input: ${text}`, 'info');
      },
      onPartialResult: (partial, isWakeActive) => {
        setInterimText(partial);
        setWakeWordActive(isWakeActive);
        setOverlayState((prev) => ({
          ...prev,
          interimTranscript: partial,
          phase: isWakeActive ? 'listening' : prev.phase,
        }));
      },
      onVoiceError: (error) => {
        showToast(error, 'error');
        addLog(`Error: ${error}`, 'error');
        if (
          error.toLowerCase().includes('permission') ||
          error.toLowerCase().includes('unavailable')
        ) {
          setIsListening(false);
        }
      },
      onCommandThinking: (transcript, lang) => {
        setOverlayState((prev) => ({
          ...prev,
          open: true,
          phase: 'thinking',
          transcript,
          detectedLang: lang,
        }));
      },
      onCommandExecuted: (command, success, meta) => {
        const message = success ? `Executed: ${command}` : `Notice: ${command}`;
        addLog(message, success ? 'success' : 'error');
        setLastResponse(command);
        setOverlayState((prev) => ({
          ...prev,
          open: true,
          phase: 'responding',
          reply: command,
          detectedLang: meta?.lang ?? prev.detectedLang,
          latencyMs: meta?.latencyMs ?? null,
          source: meta?.source ?? 'local',
        }));
        showToast(command, success ? 'success' : 'error');
        if (success) {
          speakResponse(command);
        }
      },
      onModelReady: (hasSpeechApi) => {
        setModelState('ready');
        setSpeechApiSupported(hasSpeechApi);
        if (!hasLoggedStartupRef.current) {
          hasLoggedStartupRef.current = true;
          addLog(
            hasSpeechApi
              ? 'Vicky AI v2.2 ready — JSON Plugin Engine & multilingual wake active'
              : 'Vicky AI v2.2 ready (typed & JSON Plugin Engine active)',
            'success',
          );
        }
      },
      onModelError: (error) => {
        setModelState('error');
        setModelErrorMessage(error);
        addLog(`Model initialization failed: ${error}`, 'error');
      },
      onWakeWordStateChange: (detected, wakePhrase) => {
        setWakeWordActive(detected);
        if (detected) {
          addLog(`Wake word "${wakePhrase ?? 'Hey Vicky'}" detected`, 'success');
          setOverlayState((prev) => ({
            ...prev,
            open: true,
            phase: 'listening',
            wakePhraseMatched: wakePhrase ?? 'Hey Vicky',
          }));
        }
      },
    });

    voiceService.initialize();

    return () => {
      unsubscribeAutomation();
      voiceService.shutdown();
      callService.shutdown();
      ttsService.shutdown();
      soundEffects.stopAlarmRing();
    };
  }, [addLog, showToast, speakResponse, syncAutomationSnapshot]);

  // Global Ctrl+Space shortcut to summon Assistant overlay
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.code === 'Space') {
        event.preventDefault();
        soundEffects.playWakeChime();
        setOverlayState((prev) => ({
          ...prev,
          open: true,
          phase: 'listening',
          wakePhraseMatched: uiLang === 'ar' ? 'يا فيكي' : 'Hey Vicky',
        }));
        if (voiceServiceRef.current?.isSpeechApiSupported() && !isListening) {
          if (voiceServiceRef.current.startListening()) {
            setIsListening(true);
          }
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isListening, uiLang]);

  const handleStartListening = () => {
    if (modelState !== 'ready' || !voiceServiceRef.current) {
      showToast(t.assistant.loadingStatus, 'error');
      return;
    }
    if (voiceServiceRef.current.startListening()) {
      setIsListening(true);
      addLog(`Started listening (${recognitionLang})`, 'success');
    }
  };

  const handleStopListening = () => {
    voiceServiceRef.current?.stopListening();
    setIsListening(false);
    setInterimText('');
    setOverlayState((prev) => ({ ...prev, phase: 'idle' }));
    addLog('Stopped listening', 'info');
  };

  const handleChangeRecognitionLang = (lang: RecognitionLanguage) => {
    setRecognitionLang(lang);
    voiceServiceRef.current?.setRecognitionLanguage(lang);
    addLog(`Mic language set to ${lang}`, 'info');
  };

  const handleToggleCloudAI = (enabled: boolean) => {
    setCloudAIEnabled(enabled);
    voiceServiceRef.current?.setCloudAIEnabled(enabled);
    addLog(
      enabled
        ? 'Smart Cloud AI mode enabled (gemini-3.1-flash-lite)'
        : 'Switched to Fast Offline mode',
      'info',
    );
  };

  const handleOpenHeyVickySheet = () => {
    voiceServiceRef.current?.activateWakeWordManually();
    setOverlayState((prev) => ({
      ...prev,
      open: true,
      phase: 'listening',
      wakePhraseMatched: uiLang === 'ar' ? 'يا فيكي' : 'Hey Vicky',
    }));
    if (voiceServiceRef.current?.isSpeechApiSupported() && !isListening) {
      setIsListening(true);
    }
  };

  const handleManualCommandSubmit = (commandText: string, bypassWake = true) => {
    voiceServiceRef.current?.submitManualInput(commandText, bypassWake);
  };

  const handleToggleDeviceSetting = (
    setting: 'wifi' | 'bluetooth' | 'dnd' | 'flashlight' | 'airplane' | 'battery_saver',
  ) => {
    const executor = commandExecutorRef.current;
    if (!executor) return;
    if (setting === 'flashlight') {
      const next = !deviceState.flashlightOn;
      executor.toggleFlashlight(next);
      addLog(`Flashlight ${next ? 'ON' : 'OFF'}`, 'success');
      return;
    }
    const currentVal =
      setting === 'wifi'
        ? deviceState.wifiOn
        : setting === 'bluetooth'
          ? deviceState.bluetoothOn
          : setting === 'dnd'
            ? deviceState.dndOn
            : setting === 'airplane'
              ? deviceState.airplaneModeOn
              : deviceState.batterySaverOn;
    const next = !currentVal;
    executor.setDeviceToggle(setting, next);
    addLog(`${setting.toUpperCase()} set to ${next ? 'ON' : 'OFF'}`, 'success');
  };

  const handleToggleNotifications = (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    notificationServiceRef.current?.setEnabled(enabled);
    addLog(
      enabled ? 'Notification reading enabled' : 'Notification reading disabled',
      enabled ? 'success' : 'info',
    );
  };

  const handleRequestNotificationAccess = async () => {
    const service = notificationServiceRef.current;
    if (!service) return;
    const permission = await service.requestNotificationAccess();
    if (permission === 'granted') {
      setNotificationAccessGranted(true);
      showToast(
        uiLang === 'ar' ? 'تم منح إذن الإشعارات' : 'Notification access granted',
        'success',
      );
    } else if (permission === 'denied') {
      setNotificationAccessGranted(false);
      showToast(
        uiLang === 'ar'
          ? 'يرجى تفعيل الإشعارات من إعدادات المتصفح'
          : 'Allow notifications in browser site settings.',
        'error',
      );
    } else {
      showToast(
        uiLang === 'ar'
          ? 'واجهة الإشعارات غير مدعومة في هذا المتصفح'
          : 'Browser Notification API is not supported here',
        'info',
      );
    }
  };

  const handleSimulateNotification = () => {
    const service = notificationServiceRef.current;
    if (!service) return;
    const payload =
      SAMPLE_NOTIFICATIONS[
        sampleNotificationIndexRef.current % SAMPLE_NOTIFICATIONS.length
      ];
    sampleNotificationIndexRef.current += 1;
    lastSampleNotificationRef.current = payload;
    service.onNotificationPosted({ ...payload, postTime: Date.now() });
  };

  const handleRepeatLastNotification = () => {
    const service = notificationServiceRef.current;
    const lastPayload = lastSampleNotificationRef.current;
    if (!service || !lastPayload) return;
    service.onNotificationPosted({ ...lastPayload, postTime: Date.now() });
  };

  const handleSimulateIncomingCall = () => {
    const phone =
      SAMPLE_CALLERS[sampleCallerIndexRef.current % SAMPLE_CALLERS.length];
    sampleCallerIndexRef.current += 1;
    callServiceRef.current?.handleIncomingCall(phone);
  };

  const handleSimulateIncomingSms = () => {
    const phone =
      SAMPLE_CALLERS[sampleCallerIndexRef.current % SAMPLE_CALLERS.length];
    sampleCallerIndexRef.current += 1;
    callServiceRef.current?.handleIncomingSms(
      phone,
      uiLang === 'ar'
        ? 'من فضلك عاود الاتصال بي عندما تكون متاحاً.'
        : 'Please call me back when you are free.',
    );
  };

  const handleImportPluginJson = (rawJson: string): PluginValidationResult => {
    const service = automationServiceRef.current;
    if (!service) {
      return { valid: false, errors: ['Service not initialized'], warnings: [] };
    }
    const result = service.importPluginManifest(rawJson);
    if (result.valid && result.manifest) {
      const displayName =
        uiLang === 'ar' ? result.manifest.arabicName : result.manifest.name;
      showToast(
        uiLang === 'ar'
          ? `تم استيراد الإضافة "${displayName}" بنجاح`
          : `Imported plugin "${displayName}"`,
        'success',
      );
      addLog(`Imported JSON plugin: ${result.manifest.id} (v${result.manifest.version})`, 'success');
    } else {
      showToast(result.errors[0] || t.apis.invalidSchema, 'error');
    }
    return result;
  };

  const handleClearLogsConfirm = () => {
    setClearDialogOpen(false);
    setLogs([
      {
        id: `${Date.now()}_cleared`,
        timestamp: formatTimestamp(new Date()),
        message: uiLang === 'ar' ? 'تم مسح السجل' : 'Logs cleared',
        level: 'info',
      },
    ]);
  };

  const handleExportLogs = () => {
    if (logs.length === 0) {
      showToast(t.activity.noLogs, 'info');
      return;
    }
    try {
      const now = new Date();
      const lines = [
        'Vicky AI Voice Assistant - Activity Logs (GNU AGPL-3.0)',
        `Exported: ${formatExportReadableDate(now)}`,
        '='.repeat(54),
        '',
        ...logs.map((entry) => `[${entry.timestamp}] ${entry.message}`),
      ];
      const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `logs_${formatExportFileStamp(now)}.txt`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      showToast(`logs_${formatExportFileStamp(now)}.txt`, 'success');
      addLog('Logs exported successfully', 'success');
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Export failed',
        'error',
      );
    }
  };

  const seedSwatches: Array<{ id: MaterialYouSeed; color: string; label: string }> = [
    { id: 'lavender', color: '#6750a4', label: t.settings.paletteLavender },
    { id: 'sage', color: '#386a20', label: t.settings.paletteSage },
    { id: 'terracotta', color: '#9a4522', label: t.settings.paletteTerracotta },
    { id: 'ocean', color: '#006494', label: t.settings.paletteOcean },
  ];

  const navItems: Array<{ id: ActiveTab; label: string; Icon: typeof Mic }> = [
    { id: 'assistant', label: t.nav.assistant, Icon: Mic },
    { id: 'apis', label: t.nav.apis, Icon: Blocks },
    { id: 'activity', label: t.nav.activity, Icon: History },
    { id: 'settings', label: t.nav.settings, Icon: Settings },
  ];

  const dimmingOpacity = Math.max(0, Math.min(0.45, ((100 - deviceState.brightness) / 100) * 0.5));

  return (
    <div className="m3-surface min-h-screen">
      {/* Subtle Display Brightness Simulation Layer */}
      {dimmingOpacity > 0.01 && (
        <div
          className="pointer-events-none fixed inset-0 z-40 bg-black transition-opacity duration-200"
          style={{ opacity: dimmingOpacity }}
          aria-hidden="true"
        />
      )}

      <div className="mx-auto flex min-h-screen max-w-[1380px]">
        {/* Desktop Material 3 Navigation Rail */}
        <aside className="m3-surface-low m3-border hidden w-64 shrink-0 flex-col justify-between border-e px-4 py-6 lg:flex">
          <div>
            {/* Brand Identity */}
            <div className="flex items-center gap-3 px-3 pb-6">
              <span className="m3-primary-container flex h-11 w-11 items-center justify-center rounded-[16px]">
                <Mic className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-extrabold tracking-tight">
                  {t.brand.name}
                </h1>
                <p className="m3-text-muted truncate text-xs">{t.brand.subtitle}</p>
              </div>
            </div>

            {/* M3 Navigation Drawer Items */}
            <nav className="space-y-1.5" aria-label={t.brand.name}>
              {navItems.map(({ id, label, Icon }) => {
                const active = activeTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-h-[48px] w-full cursor-pointer items-center gap-3.5 rounded-full px-4 text-sm font-semibold transition-colors ${
                      active
                        ? 'm3-secondary-container'
                        : 'm3-text-muted hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Quiet Sidebar Footer with GNU AGPL-3.0 License */}
          <div className="px-3 pt-6 text-xs m3-text-muted">
            <p className="font-semibold text-[var(--md-on-surface)]">{t.brand.version}</p>
            <p className="mt-0.5">{t.brand.licenseFull}</p>
          </div>
        </aside>

        {/* Main Workspace Column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Material 3 Top App Bar */}
          <header className="sticky top-0 z-30 m3-surface/90 backdrop-blur-md">
            <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-2.5 lg:hidden">
                <span className="m3-primary-container flex h-9 w-9 items-center justify-center rounded-[12px]">
                  <Mic className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="text-base font-extrabold tracking-tight">
                  {t.brand.name}
                </span>
              </div>

              <div className="hidden text-sm font-semibold m3-text-muted lg:block">
                {t.header[activeTab]}
              </div>

              {/* Dynamic Material You Seed Swatches + Light/Dark Toggle */}
              <div className="flex items-center gap-2">
                <div
                  className="m3-surface-container flex items-center gap-1.5 rounded-full px-2.5 py-1.5"
                  role="group"
                  aria-label={t.header.paletteLabel}
                >
                  {seedSwatches.map((swatch) => {
                    const active = themeSeed === swatch.id;
                    return (
                      <button
                        key={swatch.id}
                        type="button"
                        onClick={() => setThemeSeed(swatch.id)}
                        aria-label={swatch.label}
                        aria-pressed={active}
                        className={`h-5 w-5 cursor-pointer rounded-full transition-transform ${
                          active
                            ? 'scale-110 ring-2 ring-[var(--md-on-surface)] ring-offset-2 ring-offset-[var(--md-surface-container)]'
                            : 'opacity-75 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: swatch.color }}
                      />
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setThemeMode((m) => (m === 'dark' ? 'light' : 'dark'))}
                  aria-label={
                    themeMode === 'dark' ? t.header.switchToLight : t.header.switchToDark
                  }
                  className="m3-surface-container flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition-opacity hover:opacity-80"
                >
                  {themeMode === 'dark' ? (
                    <Sun className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Moon className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-3 pb-28 sm:px-6 lg:px-8 lg:pb-16">
            {activeTab === 'assistant' && (
              <AssistantView
                t={t}
                uiLang={uiLang}
                modelState={modelState}
                isListening={isListening}
                speechApiSupported={speechApiSupported}
                wakeWordActive={wakeWordActive}
                recognitionLang={recognitionLang}
                cloudAIEnabled={cloudAIEnabled}
                recognizedText={recognizedText}
                interimText={interimText}
                lastResponse={lastResponse}
                activeLink={activeLink}
                messageDraft={messageDraft}
                lastDispatch={lastDispatch}
                onStartListening={handleStartListening}
                onStopListening={handleStopListening}
                onSubmitCommand={(text) => handleManualCommandSubmit(text, true)}
                onOpenSettings={() => setActiveTab('settings')}
              />
            )}

            {activeTab === 'apis' && (
              <AppApiStudioView
                t={t}
                uiLang={uiLang}
                plugins={plugins}
                dispatches={dispatches}
                records={records}
                routines={routines}
                onImportPluginJson={handleImportPluginJson}
                onUpdatePlugin={(id, patch) =>
                  automationServiceRef.current?.updatePlugin(id, patch)
                }
                onDeletePlugin={(id) => {
                  const deleted = automationServiceRef.current?.deletePlugin(id);
                  if (deleted) {
                    showToast(
                      uiLang === 'ar' ? 'تم حذف الإضافة' : 'Plugin deleted',
                      'info',
                    );
                  }
                }}
                onExecutePluginAction={(appId, cap, payload, actionId) => {
                  void commandExecutorRef.current
                    ?.dispatchToAppApi(appId, cap, payload, { actionId })
                    .then((res) => {
                      if (res) {
                        showToast(res.summary, 'success');
                        addLog(`Plugin Dispatch: ${res.summary}`, 'success');
                      }
                    });
                }}
                onClearDispatches={() => automationServiceRef.current?.clearDispatches()}
                onAddRecord={(appId, appName, text) => {
                  void commandExecutorRef.current?.dispatchToAppApi(
                    appId,
                    'create_note',
                    { text },
                    { summary: `${appName} → "${text}"` },
                  );
                  showToast(
                    uiLang === 'ar'
                      ? `تم حفظ السجل في ${appName}`
                      : `Saved record in ${appName}`,
                    'success',
                  );
                  addLog(`Saved internal record in ${appName}: ${text}`, 'success');
                }}
                onDeleteRecord={(id) =>
                  automationServiceRef.current?.deletePluginRecord(id)
                }
                onRunRoutine={(id) => void voiceServiceRef.current?.runRoutineById(id)}
                onAddRoutine={(name, en, ar, cmds) => {
                  automationServiceRef.current?.addCustomRoutine(name, en, ar, cmds);
                  showToast(
                    uiLang === 'ar' ? `تم حفظ الروتين "${name}"` : `Routine "${name}" saved`,
                    'success',
                  );
                  addLog(`Custom routine created: ${name}`, 'success');
                }}
                onDeleteRoutine={(id) => automationServiceRef.current?.deleteRoutine(id)}
                onShowToast={showToast}
              />
            )}

            {activeTab === 'activity' && (
              <ActivityAndContactsView
                t={t}
                uiLang={uiLang}
                contacts={contacts}
                logs={logs}
                onAddContact={(contact) => {
                  automationServiceRef.current?.addContact(contact);
                  showToast(
                    uiLang === 'ar'
                      ? `تم حفظ جهة الاتصال "${contact.arabicName || contact.name}"`
                      : `Saved contact "${contact.name}"`,
                    'success',
                  );
                  addLog(`Saved contact: ${contact.name}`, 'success');
                }}
                onDeleteContact={(id) => automationServiceRef.current?.deleteContact(id)}
                onQuickMessageContact={(name) => {
                  setActiveTab('assistant');
                  handleManualCommandSubmit(
                    uiLang === 'ar'
                      ? `يا فيكي ابعت رسالة واتساب لـ ${name} مرحباً`
                      : `Hey Vicky, send WhatsApp to ${name} saying Hi`,
                    true,
                  );
                }}
                onClearLogsRequest={() => setClearDialogOpen(true)}
                onExportLogs={handleExportLogs}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                t={t}
                uiLang={uiLang}
                uiLangPref={uiLangPref}
                detectedSystemLang={detectedSystemLang}
                recognitionLang={recognitionLang}
                cloudAIEnabled={cloudAIEnabled}
                cloudAIAvailable={cloudAIAvailable}
                deviceState={deviceState}
                themeMode={themeMode}
                themeSeed={themeSeed}
                notificationsEnabled={notificationsEnabled}
                notificationAccessGranted={notificationAccessGranted}
                recentNotification={recentNotification}
                callState={callState}
                onChangeUiLangPref={(pref) => setUiLangPref(pref)}
                onChangeRecognitionLang={handleChangeRecognitionLang}
                onToggleCloudAI={handleToggleCloudAI}
                onToggleSetting={handleToggleDeviceSetting}
                onBrightnessChange={(val) => {
                  commandExecutorRef.current?.setBrightnessLevel(val);
                }}
                onVolumeChange={(val) => {
                  commandExecutorRef.current?.setVolumeLevel(val);
                }}
                onToggleMute={() => {
                  if (deviceState.muted) {
                    commandExecutorRef.current?.setVolumeLevel(Math.max(50, deviceState.volume));
                  } else {
                    commandExecutorRef.current?.muteVolume();
                  }
                }}
                onThemeModeChange={(mode) => setThemeMode(mode)}
                onThemeSeedChange={(seed) => setThemeSeed(seed)}
                onOpenCamera={() => commandExecutorRef.current?.openCamera()}
                onToggleNotifications={handleToggleNotifications}
                onRequestNotificationAccess={() => void handleRequestNotificationAccess()}
                onSimulateNotification={handleSimulateNotification}
                onRepeatLastNotification={handleRepeatLastNotification}
                onSimulateIncomingCall={handleSimulateIncomingCall}
                onSimulateIncomingSms={handleSimulateIncomingSms}
                onAnswerCallManually={() => callServiceRef.current?.handleManualAnswer()}
                onEndCall={() => callServiceRef.current?.handleCallEnded()}
              />
            )}

            {/* Quiet Material You Footer (AGPL-3.0) */}
            <footer className="mt-10 flex flex-wrap items-center justify-center gap-3 pb-4 text-xs m3-text-muted lg:hidden">
              <span>{t.brand.version}</span>
              <span aria-hidden="true">·</span>
              <span>{t.brand.licenseShort}</span>
            </footer>
          </main>
        </div>
      </div>

      {/* Mobile Material 3 Bottom Navigation Bar (4 Tabs) */}
      <nav
        aria-label={t.brand.name}
        className="m3-surface-container m3-border fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t px-2 py-2 lg:hidden"
      >
        {navItems.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              aria-current={active ? 'page' : undefined}
              className="flex cursor-pointer flex-col items-center justify-center gap-1 py-1"
            >
              <span
                className={`flex h-8 w-16 items-center justify-center rounded-full transition-colors ${
                  active ? 'm3-secondary-container' : 'm3-text-muted'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span
                className={`truncate max-w-full px-0.5 text-[11px] font-semibold ${
                  active ? 'text-[var(--md-on-surface)]' : 'm3-text-muted'
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Pixel Material You Assistant Floating Overlay */}
      <AssistantOverlay
        t={t}
        uiLang={uiLang}
        state={overlayState}
        isListening={isListening}
        onOpenAndListen={handleOpenHeyVickySheet}
        onClose={() =>
          setOverlayState((prev) => ({ ...prev, open: false, phase: 'idle' }))
        }
        onToggleListening={() => {
          if (isListening) handleStopListening();
          else handleStartListening();
        }}
        onSubmitCommand={(cmd) => handleManualCommandSubmit(cmd, true)}
      />

      {/* Material 3 Dialogs & Modals */}
      <ConfirmDialog
        open={clearDialogOpen}
        title={t.dialogs.clearLogsTitle}
        message={t.dialogs.clearLogsMsg}
        confirmLabel={t.dialogs.clearConfirm}
        cancelLabel={t.dialogs.cancel}
        confirmTone="danger"
        onConfirm={handleClearLogsConfirm}
        onCancel={() => setClearDialogOpen(false)}
      />

      <ConfirmDialog
        open={modelErrorMessage !== null}
        title={t.dialogs.voiceErrorTitle}
        message={modelErrorMessage ?? ''}
        confirmLabel={t.dialogs.retry}
        cancelLabel={t.dialogs.cancel}
        confirmTone="primary"
        onConfirm={() => {
          setModelErrorMessage(null);
          setModelState('loading');
          voiceServiceRef.current?.retryInitialization();
        }}
        onCancel={() => setModelErrorMessage(null)}
      />

      <CameraModal
        t={t}
        open={deviceState.cameraOpen}
        onClose={() => setDeviceState((prev) => ({ ...prev, cameraOpen: false }))}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
