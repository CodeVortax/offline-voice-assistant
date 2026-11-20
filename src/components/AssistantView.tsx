import { FormEvent, useState } from 'react';
import {
  ArrowUpRight,
  Cpu,
  ExternalLink,
  MessageSquare,
  Mic,
  MicOff,
  Send,
  Settings,
  Sparkles,
} from 'lucide-react';
import { Translations } from '../i18n/translations';
import {
  ActionLink,
  AppActionDispatch,
  MessageDraft,
  ModelState,
  QuickCommandItem,
  RecognitionLanguage,
  UiLanguage,
} from '../types/assistant';

interface AssistantViewProps {
  t: Translations;
  uiLang: UiLanguage;
  modelState: ModelState;
  isListening: boolean;
  speechApiSupported: boolean;
  wakeWordActive: boolean;
  recognitionLang: RecognitionLanguage;
  cloudAIEnabled: boolean;
  recognizedText: string;
  interimText: string;
  lastResponse: string;
  activeLink: ActionLink | null;
  messageDraft: MessageDraft | null;
  lastDispatch: AppActionDispatch | null;
  onStartListening: () => void;
  onStopListening: () => void;
  onSubmitCommand: (text: string) => void;
  onOpenSettings: () => void;
}

const QUICK_COMMANDS_EN: QuickCommandItem[] = [
  { phrase: 'Hey Vicky, turn on Wi-Fi', category: 'Settings API' },
  { phrase: 'Hey Vicky, turn on dark mode', category: 'Appearance' },
  { phrase: 'Hey Vicky, set alarm for 7:30 AM', category: 'Clock API' },
  { phrase: 'Hey Vicky, send WhatsApp to Ahmed saying on my way', category: 'Messaging' },
  { phrase: 'Hey Vicky, add note in Crystal buy coffee', category: 'Crystal Plugin' },
  { phrase: 'Hey Vicky, set timer 5 minutes in Crystal', category: 'Crystal Plugin' },
  { phrase: 'Hey Vicky, 25 x 15 / 2', category: 'Fast Math' },
  { phrase: 'Hey Vicky, good morning', category: 'Routine' },
];

const QUICK_COMMANDS_AR: QuickCommandItem[] = [
  { phrase: 'يا فيكي ابعت رسالة واتساب لأحمد أنا في الطريق', category: 'واتساب' },
  { phrase: 'يا فيكي شغل الواي فاي', category: 'إعدادات الجهاز' },
  { phrase: 'يا فيكي شغل الوضع الليلي', category: 'المظهر' },
  { phrase: 'يا فيكي اضبط منبه الساعة 7 ونص صباحاً', category: 'تطبيق الساعة' },
  { phrase: 'يا فيكي اكتب نوت في كريستال اشتري قهوة', category: 'إضافة كريستال' },
  { phrase: 'يا فيكي اعمل مؤقت 5 دقايق في كريستال', category: 'إضافة كريستال' },
  { phrase: '25 x 15 على الاثنين بكام', category: 'حساب فوري' },
  { phrase: '25 x 15 جذر 3', category: 'جذر تربيعي' },
];

function getMicDialectLabel(lang: RecognitionLanguage, uiLang: UiLanguage): string {
  if (uiLang === 'ar') {
    if (lang === 'ar-EG') return 'مصري';
    if (lang === 'ar-SA') return 'العربية';
    if (lang === 'hi-IN') return 'الهندية';
    return 'الإنجليزية';
  }
  if (lang === 'ar-EG') return 'Arabic (Egypt)';
  if (lang === 'ar-SA') return 'Arabic (Saudi)';
  if (lang === 'hi-IN') return 'Hindi';
  return 'English (US)';
}

export function AssistantView({
  t,
  uiLang,
  modelState,
  isListening,
  speechApiSupported,
  wakeWordActive,
  recognitionLang,
  cloudAIEnabled,
  recognizedText,
  interimText,
  lastResponse,
  activeLink,
  messageDraft,
  lastDispatch,
  onStartListening,
  onStopListening,
  onSubmitCommand,
  onOpenSettings,
}: AssistantViewProps) {
  const [commandInput, setCommandInput] = useState('');

  const isModelReady = modelState === 'ready';
  const activeQuickList = uiLang === 'ar' ? QUICK_COMMANDS_AR : QUICK_COMMANDS_EN;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = commandInput.trim();
    if (!trimmed) return;
    onSubmitCommand(trimmed);
    setCommandInput('');
  };

  return (
    <div className="space-y-6">
      {/* Primary Material You Assistant Hero Surface */}
      <section className="m3-surface-container rounded-[28px] p-6 sm:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <p className="m3-text-muted text-sm font-medium">
              {wakeWordActive
                ? t.assistant.awakeStatus
                : isListening
                  ? t.assistant.listeningStatus
                  : isModelReady
                    ? t.assistant.readyStatus
                    : t.assistant.loadingStatus}
            </p>
            <h2
              dir="auto"
              className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl"
            >
              {interimText
                ? interimText
                : lastResponse || t.assistant.defaultGreeting}
            </h2>
            {recognizedText && (
              <p dir="auto" className="m3-text-muted mt-2 text-sm">
                {recognizedText}
              </p>
            )}
          </div>

          {/* Material 3 Expressive Large Mic FAB */}
          <div className="flex items-center gap-3 self-start md:self-center">
            {isListening && (
              <div
                className="flex h-12 items-center gap-1.5 px-2"
                aria-hidden="true"
              >
                {[0, 120, 240, 360].map((delay, idx) => (
                  <span
                    key={delay}
                    className="animate-vicky-wave h-8 w-1.5 rounded-full"
                    style={{
                      animationDelay: `${delay}ms`,
                      backgroundColor:
                        idx === 0
                          ? '#4285f4'
                          : idx === 1
                            ? '#ea4335'
                            : idx === 2
                              ? '#fbbc05'
                              : '#34a853',
                    }}
                  />
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={isListening ? onStopListening : onStartListening}
              disabled={!isModelReady || !speechApiSupported}
              aria-label={isListening ? t.assistant.stop : t.assistant.listen}
              className={`inline-flex h-16 cursor-pointer items-center gap-3 rounded-[20px] px-6 text-base font-semibold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
                isListening ? 'm3-error-container' : 'm3-primary'
              }`}
            >
              {isListening ? (
                <>
                  <MicOff className="h-6 w-6" aria-hidden="true" />
                  <span>{t.assistant.stop}</span>
                </>
              ) : (
                <>
                  <Mic className="h-6 w-6" aria-hidden="true" />
                  <span>{t.assistant.listen}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Interactive Message Dispatch Card (WhatsApp / SMS / Email) */}
        {messageDraft && (
          <div className="m3-surface-lowest mt-6 rounded-[22px] border m3-border p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs m3-text-muted">
              <span className="inline-flex items-center gap-1.5 font-semibold m3-text-primary">
                <MessageSquare className="h-4 w-4" aria-hidden="true" />
                {t.assistant.messageReady} · {messageDraft.channel.toUpperCase()}
              </span>
              <span dir="auto">
                {messageDraft.recipientName} · {messageDraft.phone}
              </span>
            </div>
            <p dir="auto" className="mt-2.5 text-base font-semibold">
              &ldquo;{messageDraft.message}&rdquo;
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <a
                href={messageDraft.actionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="m3-primary inline-flex min-h-[42px] items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
              >
                <span>
                  {t.assistant.sendVia} {messageDraft.channel.toUpperCase()}
                </span>
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
              {messageDraft.smsFallbackUrl && (
                <a
                  href={messageDraft.smsFallbackUrl}
                  className="m3-secondary-container inline-flex min-h-[42px] items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
                >
                  <span>{t.assistant.smsFallback}</span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Structured Plugin Dispatch Result Card */}
        {!messageDraft && lastDispatch && (
          <div className="m3-surface-lowest mt-6 rounded-[22px] border m3-border p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs m3-text-muted">
              <span className="inline-flex items-center gap-1.5 font-semibold m3-text-primary">
                <Cpu className="h-4 w-4" aria-hidden="true" />
                {lastDispatch.appName}
              </span>
              <span className="font-mono-log" dir="ltr">
                {lastDispatch.actionId || lastDispatch.capability} · {lastDispatch.transport} · {lastDispatch.timestamp}
              </span>
            </div>
            <p dir="auto" className="mt-2 text-sm font-semibold">
              {lastDispatch.summary}
            </p>
            {lastDispatch.uri && (
              <div className="mt-3.5 flex flex-wrap items-center gap-3">
                <a
                  href={lastDispatch.uri}
                  target={lastDispatch.uri.startsWith('http') ? '_blank' : undefined}
                  rel={lastDispatch.uri.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className="m3-primary-container inline-flex min-h-[40px] items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-opacity hover:opacity-90"
                >
                  <span>
                    {t.assistant.openIn} {lastDispatch.appName}
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
                <span dir="ltr" className="font-mono-log m3-text-muted max-w-md truncate text-[11px]">
                  {lastDispatch.uri}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Generic Action Link (Search / Maps / App Launch) */}
        {!messageDraft && !lastDispatch && activeLink && (
          <div className="m3-surface-lowest mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border m3-border p-4">
            <div className="min-w-0">
              <p dir="auto" className="text-sm font-semibold">
                {activeLink.label}
              </p>
              <p dir="auto" className="m3-text-muted mt-0.5 text-xs">
                {activeLink.description}
              </p>
            </div>
            <a
              href={activeLink.url}
              target={activeLink.url.startsWith('http') ? '_blank' : undefined}
              rel={activeLink.url.startsWith('http') ? 'noopener noreferrer' : undefined}
              className="m3-primary inline-flex min-h-[40px] items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold"
            >
              <span>{t.assistant.open}</span>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        )}

        {/* Multilingual Command Bar (accepts ANY language regardless of UI language) */}
        <form onSubmit={handleSubmit} className="mt-6 flex items-center gap-2.5">
          <input
            type="text"
            dir="auto"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            placeholder={t.assistant.inputPlaceholder}
            aria-label={t.assistant.inputPlaceholder}
            className="m3-surface-lowest m3-border min-h-[52px] flex-1 rounded-full border px-5 text-sm outline-none transition-colors focus:border-[var(--md-primary)]"
          />
          <button
            type="submit"
            className="m3-primary inline-flex h-[52px] cursor-pointer items-center gap-2 rounded-full px-6 text-sm font-semibold transition-opacity hover:opacity-90 active:scale-[0.98]"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            <span>{t.assistant.send}</span>
          </button>
        </form>

        {/* Quiet multilingual note + direct link to standalone Settings */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs m3-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 m3-text-primary shrink-0" aria-hidden="true" />
            <span>{t.assistant.multilingualHint}</span>
          </span>
          <button
            type="button"
            onClick={onOpenSettings}
            className="m3-text-primary inline-flex cursor-pointer items-center gap-1.5 font-semibold hover:underline"
          >
            <Settings className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {t.assistant.micLangLabel}: {getMicDialectLabel(recognitionLang, uiLang)} ·{' '}
              {cloudAIEnabled ? t.assistant.smartAi : t.assistant.fastOffline}
            </span>
          </button>
        </div>
      </section>

      {/* Pure UI-Language Quick Commands Grid */}
      <section className="m3-surface-low rounded-[28px] p-5 sm:p-6">
        <div className="mb-4">
          <h3 className="text-base font-bold">{t.assistant.quickCommandsTitle}</h3>
          <p className="m3-text-muted mt-0.5 text-xs">
            {t.assistant.quickCommandsSubtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {activeQuickList.map((item) => (
            <button
              key={item.phrase}
              type="button"
              onClick={() => onSubmitCommand(item.phrase)}
              className="m3-surface-lowest m3-border group flex min-h-[54px] cursor-pointer items-center justify-between gap-3 rounded-[18px] border px-4 py-3 text-start transition-colors hover:border-[var(--md-primary)]"
            >
              <span className="text-sm font-medium leading-snug">
                {item.phrase}
              </span>
              <span className="m3-text-muted shrink-0 text-xs">
                {item.category}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
