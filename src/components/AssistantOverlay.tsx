import { FormEvent, useState } from 'react';
import {
  ArrowUpRight,
  Cpu,
  ExternalLink,
  MessageSquare,
  Mic,
  MicOff,
  Send,
  X,
} from 'lucide-react';
import { Translations } from '../i18n/translations';
import { AssistantOverlayState, UiLanguage } from '../types/assistant';

interface AssistantOverlayProps {
  t: Translations;
  uiLang: UiLanguage;
  state: AssistantOverlayState;
  isListening: boolean;
  onOpenAndListen: () => void;
  onClose: () => void;
  onToggleListening: () => void;
  onSubmitCommand: (command: string) => void;
}

const SUGGESTIONS_EN = [
  'Turn on Wi-Fi',
  'Set alarm for 7:30 AM',
  'Send WhatsApp to Ahmed saying on my way',
  'Add note in Crystal buy coffee',
];

const SUGGESTIONS_AR = [
  'شغل الواي فاي',
  'ابعت رسالة واتساب لأحمد أنا في الطريق',
  'اكتب نوت في كريستال اشتري قهوة',
  '25 x 15 على الاثنين بكام',
];

export function AssistantOverlay({
  t,
  uiLang,
  state,
  isListening,
  onOpenAndListen,
  onClose,
  onToggleListening,
  onSubmitCommand,
}: AssistantOverlayProps) {
  const [quickInput, setQuickInput] = useState('');
  const suggestions = uiLang === 'ar' ? SUGGESTIONS_AR : SUGGESTIONS_EN;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = quickInput.trim();
    if (!trimmed) return;
    onSubmitCommand(trimmed);
    setQuickInput('');
  };

  return (
    <>
      {/* Floating Material You Assistant Dock Pill (RTL/LTR logical end-5) */}
      {!state.open && (
        <div className="fixed end-5 bottom-20 z-40 lg:bottom-6">
          <button
            type="button"
            onClick={onOpenAndListen}
            aria-label={t.overlay.dockLabel}
            className="m3-primary-container flex h-14 cursor-pointer items-center gap-3 rounded-[20px] px-5 shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <span className="m3-primary flex h-9 w-9 items-center justify-center rounded-full">
              <Mic className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="text-sm font-bold">{t.overlay.dockLabel}</span>
          </button>
        </div>
      )}

      {/* Material You Assistant Bottom Sheet */}
      {state.open && (
        <div
          className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-3 sm:px-6 sm:pb-5"
          role="dialog"
          aria-modal="false"
          aria-label={t.overlay.dockLabel}
        >
          <div className="animate-vicky-sheet m3-surface-high m3-border relative w-full max-w-2xl overflow-hidden rounded-[28px] border shadow-2xl">
            <div className="px-5 pt-5 pb-5 sm:px-6">
              {/* Top Row */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-sm font-bold">
                  <span className="m3-primary-container flex h-8 w-8 items-center justify-center rounded-full">
                    <Mic className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span>
                    {state.phase === 'thinking'
                      ? t.overlay.thinking
                      : state.phase === 'listening'
                        ? t.overlay.listening
                        : t.overlay.dockLabel}
                  </span>
                  {state.latencyMs !== null && state.phase === 'responding' && (
                    <span dir="ltr" className="font-mono-log m3-text-muted text-xs font-normal">
                      · {state.latencyMs}ms
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={onToggleListening}
                    aria-label={isListening ? t.assistant.stop : t.assistant.listen}
                    className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition-colors ${
                      isListening ? 'm3-primary' : 'm3-surface-highest m3-text-muted'
                    }`}
                  >
                    {isListening ? (
                      <Mic className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <MicOff className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label={t.dialogs.cancel}
                    className="m3-surface-highest m3-text-muted flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition-opacity hover:opacity-80"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* 4-Bar Assistant Equalizer */}
              {(state.phase === 'listening' || state.phase === 'thinking') && (
                <div className="mt-4 flex h-8 items-center justify-center gap-2" aria-hidden="true">
                  {[0, 140, 280, 420].map((delay, idx) => (
                    <span
                      key={delay}
                      className="animate-vicky-wave h-7 w-1.5 rounded-full"
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

              {/* Live Transcript & Reply (dir="auto" for multilingual commands) */}
              <div className="mt-3 space-y-2">
                {(state.interimTranscript || state.transcript) && (
                  <p dir="auto" className="m3-text-muted text-sm">
                    {state.interimTranscript || state.transcript}
                  </p>
                )}

                {state.reply && (
                  <p dir="auto" className="text-lg font-semibold leading-snug">
                    {state.reply}
                  </p>
                )}

                {/* Message Draft Card */}
                {state.messageDraft && (
                  <div className="m3-surface-lowest m3-border mt-3 rounded-[20px] border p-4">
                    <div className="flex items-center justify-between text-xs m3-text-muted">
                      <span className="inline-flex items-center gap-1.5 font-semibold m3-text-primary">
                        <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                        {state.messageDraft.channel.toUpperCase()}
                      </span>
                      <span dir="auto">
                        {state.messageDraft.recipientName} · {state.messageDraft.phone}
                      </span>
                    </div>
                    <p dir="auto" className="mt-1.5 text-sm font-medium">
                      &ldquo;{state.messageDraft.message}&rdquo;
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <a
                        href={state.messageDraft.actionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="m3-primary inline-flex min-h-[38px] items-center gap-1.5 rounded-full px-4 text-xs font-semibold"
                      >
                        <span>{t.overlay.sendNow}</span>
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                      {state.messageDraft.smsFallbackUrl && (
                        <a
                          href={state.messageDraft.smsFallbackUrl}
                          className="m3-secondary-container inline-flex min-h-[38px] items-center gap-1.5 rounded-full px-4 text-xs font-semibold"
                        >
                          <span>{t.overlay.smsFallback}</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* App API Dispatch Card */}
                {!state.messageDraft && state.lastDispatch && (
                  <div className="m3-surface-lowest m3-border mt-3 flex flex-wrap items-center justify-between gap-2.5 rounded-[20px] border p-3.5">
                    <div className="min-w-0">
                      <div className="inline-flex items-center gap-1.5 text-xs font-semibold m3-text-primary">
                        <Cpu className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{state.lastDispatch.appName}</span>
                      </div>
                      <p dir="auto" className="mt-0.5 text-xs">
                        {state.lastDispatch.summary}
                      </p>
                    </div>
                    {state.lastDispatch.uri && (
                      <a
                        href={state.lastDispatch.uri}
                        target={state.lastDispatch.uri.startsWith('http') ? '_blank' : undefined}
                        rel={state.lastDispatch.uri.startsWith('http') ? 'noopener noreferrer' : undefined}
                        className="m3-primary-container inline-flex min-h-[36px] items-center gap-1 rounded-full px-3.5 text-xs font-semibold"
                      >
                        <span>{t.overlay.open}</span>
                        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                )}

                {/* Generic Action Link */}
                {!state.messageDraft && !state.lastDispatch && state.actionLink && (
                  <div className="m3-surface-lowest m3-border mt-3 flex items-center justify-between gap-3 rounded-[20px] border p-3.5">
                    <div className="min-w-0">
                      <p dir="auto" className="truncate text-xs font-semibold">
                        {state.actionLink.label}
                      </p>
                      <p dir="auto" className="m3-text-muted truncate text-[11px]">
                        {state.actionLink.description}
                      </p>
                    </div>
                    <a
                      href={state.actionLink.url}
                      target={state.actionLink.url.startsWith('http') ? '_blank' : undefined}
                      rel={state.actionLink.url.startsWith('http') ? 'noopener noreferrer' : undefined}
                      className="m3-primary inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-full px-4 text-xs font-semibold"
                    >
                      <span>{t.overlay.open}</span>
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  </div>
                )}
              </div>

              {/* Multilingual Input Bar */}
              <form onSubmit={handleSubmit} className="mt-4 flex items-center gap-2">
                <input
                  type="text"
                  dir="auto"
                  value={quickInput}
                  onChange={(e) => setQuickInput(e.target.value)}
                  placeholder={t.overlay.placeholder}
                  className="m3-surface-lowest m3-border min-h-[44px] flex-1 rounded-full border px-4 text-sm outline-none focus:border-[var(--md-primary)]"
                />
                <button
                  type="submit"
                  aria-label={t.assistant.send}
                  className="m3-primary flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                </button>
              </form>

              {/* Pure UI-language suggestions */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {suggestions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => onSubmitCommand(item)}
                    className="m3-surface-lowest m3-border cursor-pointer rounded-full border px-3 py-1.5 text-xs transition-colors hover:border-[var(--md-primary)]"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {/* 4-Color Assistant Bottom Glow Edge */}
            <div className="m3-assistant-glow h-1.5 w-full" aria-hidden="true" />
          </div>
        </div>
      )}
    </>
  );
}
