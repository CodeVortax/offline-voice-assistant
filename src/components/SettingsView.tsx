import {
  BatteryCharging,
  Bell,
  BellOff,
  Bluetooth,
  Camera,
  Flashlight,
  Globe,
  Languages,
  MessageSquare,
  Mic,
  Moon,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  Plane,
  Sparkles,
  Sun,
  Volume2,
  VolumeX,
  Wifi,
} from 'lucide-react';
import { Translations } from '../i18n/translations';
import {
  CallAutoAnswerState,
  DeviceState,
  MaterialYouSeed,
  NotificationRecord,
  RecognitionLanguage,
  ThemeMode,
  UiLanguage,
  UiLanguagePreference,
} from '../types/assistant';

interface SettingsViewProps {
  t: Translations;
  uiLang: UiLanguage;
  uiLangPref: UiLanguagePreference;
  detectedSystemLang: UiLanguage;
  recognitionLang: RecognitionLanguage;
  cloudAIEnabled: boolean;
  cloudAIAvailable: boolean;
  deviceState: DeviceState;
  themeMode: ThemeMode;
  themeSeed: MaterialYouSeed;
  notificationsEnabled: boolean;
  notificationAccessGranted: boolean;
  recentNotification: NotificationRecord | null;
  callState: CallAutoAnswerState;
  onChangeUiLangPref: (pref: UiLanguagePreference) => void;
  onChangeRecognitionLang: (lang: RecognitionLanguage) => void;
  onToggleCloudAI: (enabled: boolean) => void;
  onToggleSetting: (
    setting: 'wifi' | 'bluetooth' | 'dnd' | 'flashlight' | 'airplane' | 'battery_saver',
  ) => void;
  onBrightnessChange: (val: number) => void;
  onVolumeChange: (val: number) => void;
  onToggleMute: () => void;
  onThemeModeChange: (mode: ThemeMode) => void;
  onThemeSeedChange: (seed: MaterialYouSeed) => void;
  onOpenCamera: () => void;
  onToggleNotifications: (enabled: boolean) => void;
  onRequestNotificationAccess: () => void;
  onSimulateNotification: () => void;
  onRepeatLastNotification: () => void;
  onSimulateIncomingCall: () => void;
  onSimulateIncomingSms: () => void;
  onAnswerCallManually: () => void;
  onEndCall: () => void;
}

export function SettingsView({
  t,
  uiLang,
  uiLangPref,
  detectedSystemLang,
  recognitionLang,
  cloudAIEnabled,
  cloudAIAvailable,
  deviceState,
  themeMode,
  themeSeed,
  notificationsEnabled,
  notificationAccessGranted,
  recentNotification,
  callState,
  onChangeUiLangPref,
  onChangeRecognitionLang,
  onToggleCloudAI,
  onToggleSetting,
  onBrightnessChange,
  onVolumeChange,
  onToggleMute,
  onThemeModeChange,
  onThemeSeedChange,
  onOpenCamera,
  onToggleNotifications,
  onRequestNotificationAccess,
  onSimulateNotification,
  onRepeatLastNotification,
  onSimulateIncomingCall,
  onSimulateIncomingSms,
  onAnswerCallManually,
  onEndCall,
}: SettingsViewProps) {
  const micOptions: Array<{ code: RecognitionLanguage; label: string }> =
    uiLang === 'ar'
      ? [
          { code: 'ar-EG', label: 'العربية (مصر)' },
          { code: 'ar-SA', label: 'العربية (الفصحى)' },
          { code: 'en-US', label: 'الإنجليزية' },
          { code: 'hi-IN', label: 'الهندية' },
        ]
      : [
          { code: 'en-US', label: 'English (US)' },
          { code: 'ar-SA', label: 'Arabic (Standard)' },
          { code: 'ar-EG', label: 'Arabic (Egypt)' },
          { code: 'hi-IN', label: 'Hindi' },
        ];

  const seedPalettes: Array<{
    id: MaterialYouSeed;
    label: string;
    swatch: string;
    container: string;
  }> = [
    { id: 'lavender', label: t.settings.paletteLavender, swatch: '#6750a4', container: '#eaddff' },
    { id: 'sage', label: t.settings.paletteSage, swatch: '#386a20', container: '#b7f397' },
    { id: 'terracotta', label: t.settings.paletteTerracotta, swatch: '#9a4522', container: '#ffdbce' },
    { id: 'ocean', label: t.settings.paletteOcean, swatch: '#006494', container: '#cbe6ff' },
  ];

  const tiles = [
    {
      id: 'wifi' as const,
      label: t.settings.wifi,
      subtitle: deviceState.wifiOn ? t.settings.wifiOn : t.assistant.off,
      active: deviceState.wifiOn,
      Icon: Wifi,
    },
    {
      id: 'bluetooth' as const,
      label: t.settings.bluetooth,
      subtitle: deviceState.bluetoothOn ? t.settings.bluetoothOn : t.assistant.off,
      active: deviceState.bluetoothOn,
      Icon: Bluetooth,
    },
    {
      id: 'dnd' as const,
      label: t.settings.dnd,
      subtitle: deviceState.dndOn ? t.settings.dndOn : t.assistant.off,
      active: deviceState.dndOn,
      Icon: BellOff,
    },
    {
      id: 'flashlight' as const,
      label: t.settings.flashlight,
      subtitle: deviceState.flashlightOn ? t.settings.flashlightOn : t.assistant.off,
      active: deviceState.flashlightOn,
      Icon: Flashlight,
    },
    {
      id: 'battery_saver' as const,
      label: t.settings.batterySaver,
      subtitle: deviceState.batterySaverOn ? t.settings.batterySaverOn : t.assistant.off,
      active: deviceState.batterySaverOn,
      Icon: BatteryCharging,
    },
    {
      id: 'airplane' as const,
      label: t.settings.airplane,
      subtitle: deviceState.airplaneModeOn ? t.settings.airplaneOn : t.assistant.off,
      active: deviceState.airplaneModeOn,
      Icon: Plane,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Section 1: Pure Interface Language (System Default / Arabic / English) */}
      <section className="m3-surface-container rounded-[28px] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <div className="flex items-center gap-2.5">
              <Languages className="h-5 w-5 m3-text-primary" aria-hidden="true" />
              <h2 className="text-lg font-bold">{t.settings.languageSectionTitle}</h2>
            </div>
            <p className="m3-text-muted mt-1 text-sm">
              {t.settings.languageSectionDesc}
            </p>
            <p className="m3-text-primary mt-2 text-xs font-semibold">
              {t.settings.currentSystemDetected}:{' '}
              {detectedSystemLang === 'ar'
                ? uiLang === 'ar'
                  ? 'العربية'
                  : 'Arabic'
                : uiLang === 'ar'
                  ? 'الإنجليزية'
                  : 'English'}
            </p>
          </div>

          <div className="m3-surface-highest flex flex-wrap items-center gap-1 rounded-full p-1">
            {(
              [
                { id: 'system' as const, label: t.settings.systemDefault },
                { id: 'ar' as const, label: t.settings.arabicLang },
                { id: 'en' as const, label: t.settings.englishLang },
              ] as const
            ).map((opt) => {
              const active = uiLangPref === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeUiLangPref(opt.id)}
                  className={`min-h-[38px] cursor-pointer rounded-full px-4 text-xs font-semibold transition-colors ${
                    active ? 'm3-primary' : 'm3-text-muted hover:opacity-80'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section 2: Voice Recognition Dialect & Small Intelligence Engine */}
      <section className="m3-surface-low rounded-[28px] p-6 space-y-5">
        <div>
          <div className="flex items-center gap-2.5">
            <Mic className="h-5 w-5 m3-text-primary" aria-hidden="true" />
            <h3 className="text-base font-bold">{t.settings.voiceSectionTitle}</h3>
          </div>
          <p className="m3-text-muted mt-0.5 text-xs">
            {t.settings.voiceSectionDesc}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t m3-border pt-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Globe className="h-4 w-4 m3-text-primary" aria-hidden="true" />
            <span>{t.settings.speechMicLang}</span>
          </div>
          <div className="m3-surface-highest flex flex-wrap items-center gap-1 rounded-full p-1">
            {micOptions.map((opt) => {
              const active = recognitionLang === opt.code;
              return (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => onChangeRecognitionLang(opt.code)}
                  className={`min-h-[36px] cursor-pointer rounded-full px-3.5 text-xs font-semibold transition-colors ${
                    active ? 'm3-primary-container' : 'm3-text-muted hover:opacity-80'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t m3-border pt-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 m3-text-primary" aria-hidden="true" />
              <span>{t.settings.intelligenceMode}</span>
            </div>
            <p className="m3-text-muted mt-0.5 text-xs">
              {cloudAIEnabled
                ? cloudAIAvailable
                  ? t.settings.smartAiReadyDesc
                  : t.settings.smartAiMissingKeyDesc
                : t.settings.offlineDesc}
            </p>
          </div>
          <div className="m3-surface-highest flex items-center gap-1 rounded-full p-1">
            <button
              type="button"
              onClick={() => onToggleCloudAI(false)}
              className={`min-h-[36px] cursor-pointer rounded-full px-4 text-xs font-semibold transition-colors ${
                !cloudAIEnabled ? 'm3-primary-container' : 'm3-text-muted'
              }`}
            >
              {t.assistant.fastOffline}
            </button>
            <button
              type="button"
              onClick={() => onToggleCloudAI(true)}
              className={`min-h-[36px] cursor-pointer rounded-full px-4 text-xs font-semibold transition-colors ${
                cloudAIEnabled ? 'm3-primary-container' : 'm3-text-muted'
              }`}
            >
              {t.assistant.smartAi}
            </button>
          </div>
        </div>
      </section>

      {/* Section 3: Material You Dynamic Theme & Appearance */}
      <section className="m3-surface-low rounded-[28px] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold">{t.settings.appearanceTitle}</h3>
            <p className="m3-text-muted mt-0.5 text-xs">
              {t.settings.appearanceDesc}
            </p>
          </div>
          <div className="m3-surface-highest flex items-center gap-1 rounded-full p-1">
            <button
              type="button"
              onClick={() => onThemeModeChange('light')}
              className={`inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full px-4 text-xs font-semibold ${
                themeMode === 'light' ? 'm3-primary-container' : 'm3-text-muted'
              }`}
            >
              <Sun className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t.settings.lightMode}</span>
            </button>
            <button
              type="button"
              onClick={() => onThemeModeChange('dark')}
              className={`inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full px-4 text-xs font-semibold ${
                themeMode === 'dark' ? 'm3-primary-container' : 'm3-text-muted'
              }`}
            >
              <Moon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t.settings.darkMode}</span>
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {seedPalettes.map((palette) => {
            const active = themeSeed === palette.id;
            return (
              <button
                key={palette.id}
                type="button"
                onClick={() => onThemeSeedChange(palette.id)}
                className={`flex min-h-[56px] cursor-pointer items-center gap-3 rounded-[20px] border px-4 py-2.5 text-start transition-all ${
                  active
                    ? 'm3-primary-container border-[var(--md-primary)]'
                    : 'm3-surface-lowest m3-border'
                }`}
              >
                <span
                  className="flex h-8 w-8 shrink-0 overflow-hidden rounded-full border border-black/10"
                  aria-hidden="true"
                >
                  <span className="h-full w-1/2" style={{ backgroundColor: palette.swatch }} />
                  <span className="h-full w-1/2" style={{ backgroundColor: palette.container }} />
                </span>
                <span className="text-xs font-semibold">{palette.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Section 4: Android 15 Quick Device Controls */}
      <section className="m3-surface-low rounded-[28px] p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold">{t.settings.deviceControlsTitle}</h3>
            <p className="m3-text-muted mt-0.5 text-xs">
              {t.settings.deviceControlsDesc}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenCamera}
            className="m3-secondary-container inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-full px-4 text-xs font-semibold"
          >
            <Camera className="h-4 w-4" aria-hidden="true" />
            <span>{t.settings.openCamera}</span>
          </button>
        </div>

        {/* Expressive Thick M3 Brightness & Volume Sliders */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="m3-surface-lowest rounded-[22px] p-4">
            <div className="mb-2.5 flex items-center justify-between text-xs font-semibold">
              <span className="inline-flex items-center gap-2">
                <Sun className="h-4 w-4 m3-text-primary" aria-hidden="true" />
                <span>{t.settings.brightness}</span>
              </span>
              <span className="font-mono-log m3-text-muted">{deviceState.brightness}%</span>
            </div>
            <input
              type="range"
              min={15}
              max={100}
              value={deviceState.brightness}
              onChange={(e) => onBrightnessChange(Number(e.target.value))}
              aria-label={t.settings.brightness}
              className="m3-slider"
            />
          </div>

          <div className="m3-surface-lowest rounded-[22px] p-4">
            <div className="mb-2.5 flex items-center justify-between text-xs font-semibold">
              <span className="inline-flex items-center gap-2">
                {deviceState.muted ? (
                  <VolumeX className="h-4 w-4 m3-text-error" aria-hidden="true" />
                ) : (
                  <Volume2 className="h-4 w-4 m3-text-primary" aria-hidden="true" />
                )}
                <span>{t.settings.volume}</span>
              </span>
              <div className="flex items-center gap-3">
                <span className="font-mono-log m3-text-muted">
                  {deviceState.muted ? t.assistant.muted : `${deviceState.volume}%`}
                </span>
                <button
                  type="button"
                  onClick={onToggleMute}
                  className="m3-text-primary cursor-pointer text-xs font-semibold hover:underline"
                >
                  {deviceState.muted ? t.settings.unmute : t.settings.mute}
                </button>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={deviceState.muted ? 0 : deviceState.volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              aria-label={t.settings.volume}
              className="m3-slider"
            />
          </div>
        </div>

        {/* 2/3-Column Android 15 Quick Settings Tiles */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tiles.map(({ id, label, subtitle, active, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onToggleSetting(id)}
              aria-pressed={active}
              className={`flex min-h-[76px] cursor-pointer items-center gap-3.5 rounded-[24px] px-4 py-3 text-start transition-all active:scale-[0.98] ${
                active ? 'm3-primary-container' : 'm3-surface-high'
              }`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  active ? 'm3-primary' : 'm3-surface-highest m3-text-muted'
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{label}</div>
                <div className="truncate text-xs opacity-75">{subtitle}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Section 5: Auto-Answer Call / SMS & Smart Notification Reader */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="m3-surface-low rounded-[28px] p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold">{t.settings.autoAnswerTitle}</h3>
              <p className="m3-text-muted mt-0.5 text-xs">
                {t.settings.autoAnswerDesc}
              </p>
            </div>
            <span className="font-mono-log m3-text-primary text-xs font-semibold">
              {deviceState.ttsLanguage}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSimulateIncomingCall}
              className="m3-primary-container inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full px-4 text-xs font-semibold"
            >
              <PhoneIncoming className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t.settings.testCall}</span>
            </button>
            <button
              type="button"
              onClick={onSimulateIncomingSms}
              className="m3-secondary-container inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full px-4 text-xs font-semibold"
            >
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t.settings.testSms}</span>
            </button>
          </div>

          {callState.phase !== 'idle' && (
            <div className="m3-tertiary-container mt-4 rounded-[20px] p-4">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>
                  {t.settings.incomingCall}: {callState.callerLabel}
                </span>
                <span className="font-mono-log">
                  {callState.phase === 'ringing'
                    ? `${t.settings.autoAnsweringIn} ${callState.secondsRemaining}s`
                    : callState.phase}
                </span>
              </div>
              {callState.activeMessage && (
                <p dir="auto" className="mt-2 text-xs opacity-90">
                  {callState.activeMessage}
                </p>
              )}
              <div className="mt-3 flex gap-2">
                {callState.phase === 'ringing' && (
                  <button
                    type="button"
                    onClick={onAnswerCallManually}
                    className="m3-primary inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full px-4 text-xs font-semibold"
                  >
                    <PhoneCall className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t.settings.answerNow}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onEndCall}
                  className="m3-error-container inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full px-4 text-xs font-semibold"
                >
                  <PhoneOff className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t.settings.endCall}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="m3-surface-low rounded-[28px] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold">{t.settings.notifTitle}</h3>
              <p className="m3-text-muted mt-0.5 text-xs">
                {t.settings.notifDesc}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={notificationsEnabled}
              onClick={() => onToggleNotifications(!notificationsEnabled)}
              className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full p-1 transition-colors ${
                notificationsEnabled ? 'm3-primary justify-end' : 'm3-surface-highest justify-start'
              }`}
            >
              <span className="inline-block h-6 w-6 rounded-full bg-white shadow" />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSimulateNotification}
              className="m3-primary-container inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full px-4 text-xs font-semibold"
            >
              <Bell className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t.settings.simulateNotif}</span>
            </button>
            {recentNotification && (
              <button
                type="button"
                onClick={onRepeatLastNotification}
                className="m3-secondary-container inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full px-4 text-xs font-semibold"
              >
                <span>{t.settings.testDedup}</span>
              </button>
            )}
            {!notificationAccessGranted && (
              <button
                type="button"
                onClick={onRequestNotificationAccess}
                className="m3-surface-highest inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full px-4 text-xs font-semibold"
              >
                <span>{t.settings.grantPermission}</span>
              </button>
            )}
          </div>

          {recentNotification && (
            <div className="m3-surface-lowest m3-border mt-4 rounded-[18px] border p-3.5 text-xs">
              <div className="flex items-center justify-between m3-text-muted">
                <span className="font-semibold text-[var(--md-on-surface)]">
                  {recentNotification.appName}
                </span>
                <span className="font-mono-log">{recentNotification.timestamp}</span>
              </div>
              <p dir="auto" className="mt-1.5 text-sm">
                {recentNotification.formattedMessage}
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
