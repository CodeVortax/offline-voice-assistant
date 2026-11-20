import { FormEvent, useEffect, useRef, useState } from 'react';
import { Download, MessageSquare, Plus, Trash2, Users } from 'lucide-react';
import { Translations } from '../i18n/translations';
import { ContactItem, LogEntry, UiLanguage } from '../types/assistant';

interface ActivityAndContactsViewProps {
  t: Translations;
  uiLang: UiLanguage;
  contacts: ContactItem[];
  logs: LogEntry[];
  onAddContact: (contact: Omit<ContactItem, 'id'>) => void;
  onDeleteContact: (id: string) => void;
  onQuickMessageContact: (name: string) => void;
  onClearLogsRequest: () => void;
  onExportLogs: () => void;
}

export function ActivityAndContactsView({
  t,
  uiLang,
  contacts,
  logs,
  onAddContact,
  onDeleteContact,
  onQuickMessageContact,
  onClearLogsRequest,
  onExportLogs,
}: ActivityAndContactsViewProps) {
  const [contactName, setContactName] = useState('');
  const [contactAlt, setContactAlt] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const logBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (logBoxRef.current) {
      logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
    }
  }, [logs]);

  const handleAddContact = (event: FormEvent) => {
    event.preventDefault();
    if (!contactName.trim() || !contactPhone.trim()) return;
    const digits = contactPhone.replace(/[^0-9]/g, '');
    onAddContact({
      name: uiLang === 'ar' ? contactAlt.trim() || contactName.trim() : contactName.trim(),
      arabicName:
        uiLang === 'ar' ? contactName.trim() : contactAlt.trim() || undefined,
      phone: contactPhone.trim(),
      whatsapp: digits,
    });
    setContactName('');
    setContactAlt('');
    setContactPhone('');
  };

  return (
    <div className="space-y-6">
      {/* Contacts Directory */}
      <section className="m3-surface-container rounded-[28px] p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <Users className="h-5 w-5 m3-text-primary" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-bold">{t.activity.contactsTitle}</h2>
            <p className="m3-text-muted text-xs">{t.activity.contactsDesc}</p>
          </div>
        </div>

        <form onSubmit={handleAddContact} className="mb-5 grid grid-cols-1 gap-2.5 sm:grid-cols-4">
          <input
            type="text"
            dir="auto"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder={t.activity.contactNamePlaceholder}
            className="m3-surface-lowest m3-border min-h-[42px] rounded-[16px] border px-4 text-xs outline-none focus:border-[var(--md-primary)]"
          />
          <input
            type="text"
            dir="auto"
            value={contactAlt}
            onChange={(e) => setContactAlt(e.target.value)}
            placeholder={t.activity.contactAltNamePlaceholder}
            className="m3-surface-lowest m3-border min-h-[42px] rounded-[16px] border px-4 text-xs outline-none focus:border-[var(--md-primary)]"
          />
          <input
            type="tel"
            dir="ltr"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder={t.activity.contactPhonePlaceholder}
            className="m3-surface-lowest m3-border min-h-[42px] rounded-[16px] border px-4 text-xs outline-none focus:border-[var(--md-primary)]"
          />
          <button
            type="submit"
            className="m3-primary inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-1.5 rounded-full px-5 text-xs font-semibold"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>{t.activity.addContactBtn}</span>
          </button>
        </form>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {contacts.map((c) => {
            const displayName =
              uiLang === 'ar' ? c.arabicName || c.name : c.name;
            return (
              <div
                key={c.id}
                className="m3-surface-lowest m3-border flex items-center justify-between gap-3 rounded-[20px] border px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{displayName}</div>
                  <div dir="ltr" className="font-mono-log m3-text-muted text-xs">
                    {c.phone}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onQuickMessageContact(displayName)}
                    className="m3-primary-container inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold"
                  >
                    <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t.activity.messageBtn}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteContact(c.id)}
                    aria-label={displayName}
                    className="m3-text-error cursor-pointer p-1.5 opacity-75 hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Activity Log */}
      <section className="m3-surface-low rounded-[28px] p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">{t.activity.logsTitle}</h2>
            <p className="m3-text-muted text-xs">
              {logs.length} {t.activity.logsCount}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClearLogsRequest}
              className="m3-error-container inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-full px-4 text-xs font-semibold"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t.activity.clearBtn}</span>
            </button>
            <button
              type="button"
              onClick={onExportLogs}
              className="m3-primary-container inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-full px-4 text-xs font-semibold"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t.activity.exportBtn}</span>
            </button>
          </div>
        </div>

        <div
          ref={logBoxRef}
          className="font-mono-log m3-surface-lowest m3-border max-h-[360px] overflow-y-auto rounded-[20px] border p-4 text-xs leading-relaxed"
        >
          {logs.length === 0 ? (
            <p className="m3-text-muted">{t.activity.noLogs}</p>
          ) : (
            <ul className="space-y-1.5">
              {logs.map((entry) => (
                <li
                  key={entry.id}
                  dir="auto"
                  className={
                    entry.level === 'error'
                      ? 'm3-text-error'
                      : entry.level === 'success'
                        ? 'm3-text-primary font-medium'
                        : 'm3-text-muted'
                  }
                >
                  <span className="opacity-70">[{entry.timestamp}]</span> {entry.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
