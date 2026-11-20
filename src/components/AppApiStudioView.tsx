import { ChangeEvent, FormEvent, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  Blocks,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Database,
  Download,
  FileJson,
  FlaskConical,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  Webhook,
  Zap,
} from 'lucide-react';
import { Translations } from '../i18n/translations';
import {
  buildAiPluginPrompt,
  generatePluginManifestWithAI,
  PRESET_PLUGIN_TEMPLATES,
  validatePluginManifest,
} from '../services/pluginSchema';
import {
  AppActionDispatch,
  AppCapabilityKind,
  InternalPluginRecord,
  PluginValidationResult,
  RoutineItem,
  UiLanguage,
  VickyAppManifest,
} from '../types/assistant';

interface AppApiStudioViewProps {
  t: Translations;
  uiLang: UiLanguage;
  plugins: VickyAppManifest[];
  dispatches: AppActionDispatch[];
  records: InternalPluginRecord[];
  routines: RoutineItem[];
  onImportPluginJson: (rawJson: string) => PluginValidationResult;
  onUpdatePlugin: (
    id: string,
    patch: {
      enabled?: boolean;
      uriTemplate?: string;
      webhookUrl?: string;
      internalEnabled?: boolean;
    },
  ) => void;
  onDeletePlugin: (id: string) => void;
  onExecutePluginAction: (
    appId: string,
    capability: AppCapabilityKind,
    payload: Record<string, unknown>,
    actionId?: string,
  ) => void;
  onClearDispatches: () => void;
  onAddRecord: (appId: string, appName: string, text: string) => void;
  onDeleteRecord: (id: string) => void;
  onRunRoutine: (id: string) => void;
  onAddRoutine: (name: string, enTrigger: string, arTrigger: string, cmds: string[]) => void;
  onDeleteRoutine: (id: string) => void;
  onShowToast: (message: string, tone?: 'info' | 'success' | 'error') => void;
  initialTab?: StudioTab;
}

type StudioTab = 'installed' | 'import' | 'sandbox' | 'records' | 'routines';

const INITIAL_EDITOR_JSON = JSON.stringify(PRESET_PLUGIN_TEMPLATES[0].manifest, null, 2);

export function AppApiStudioView({
  t,
  uiLang,
  plugins,
  dispatches,
  records,
  routines,
  onImportPluginJson,
  onUpdatePlugin,
  onDeletePlugin,
  onExecutePluginAction,
  onClearDispatches,
  onAddRecord,
  onDeleteRecord,
  onRunRoutine,
  onAddRoutine,
  onDeleteRoutine,
  onShowToast,
  initialTab = 'installed',
}: AppApiStudioViewProps) {
  const [tab, setTab] = useState<StudioTab>(initialTab);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // AI Generator + JSON Editor state
  const [aiGoal, setAiGoal] = useState('');
  const [generatingAi, setGeneratingAi] = useState(false);
  const [jsonEditorValue, setJsonEditorValue] = useState(INITIAL_EDITOR_JSON);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Live Sandbox state
  const [sandboxPluginId, setSandboxPluginId] = useState<string>(
    plugins[1]?.id ?? plugins[0]?.id ?? 'crystal-api',
  );
  const [sandboxActionId, setSandboxActionId] = useState<string>('');
  const [sandboxText, setSandboxText] = useState(
    uiLang === 'ar' ? 'اختبار أمر من منصة فيكي' : 'Test payload from Vicky Sandbox',
  );
  const [sandboxMinutes, setSandboxMinutes] = useState<string>('5');

  // Internal Storage quick add state
  const [recordTargetId, setRecordTargetId] = useState('crystal-api');
  const [recordText, setRecordText] = useState('');

  // Routine creator state
  const [routineName, setRoutineName] = useState('');
  const [routineSteps, setRoutineSteps] = useState('');

  const liveValidation = useMemo(
    () => validatePluginManifest(jsonEditorValue),
    [jsonEditorValue],
  );

  const activeSandboxPlugin =
    plugins.find((p) => p.id === sandboxPluginId) ?? plugins[0];
  const activeSandboxAction =
    activeSandboxPlugin?.actions.find((a) => a.id === sandboxActionId) ??
    activeSandboxPlugin?.actions[0];

  const handleCopyText = async (key: string, value: string, toastMsg?: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(key);
      if (toastMsg) onShowToast(toastMsg, 'success');
      window.setTimeout(() => setCopiedId((curr) => (curr === key ? null : curr)), 2000);
    } catch {
      onShowToast(uiLang === 'ar' ? 'تعذر النسخ للحافظة' : 'Clipboard copy unavailable', 'error');
    }
  };

  const handleExportPlugin = (plugin: VickyAppManifest) => {
    const json = JSON.stringify(plugin, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${plugin.id}.vicky.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    onShowToast(
      uiLang === 'ar'
        ? `تم تصدير ${plugin.id}.vicky.json`
        : `Exported ${plugin.id}.vicky.json`,
      'success',
    );
  };

  const handleGenerateWithAI = async (event: FormEvent) => {
    event.preventDefault();
    if (!aiGoal.trim()) return;
    setGeneratingAi(true);
    try {
      const { manifest, source } = await generatePluginManifestWithAI(aiGoal.trim());
      setJsonEditorValue(JSON.stringify(manifest, null, 2));
      onShowToast(
        source === 'ai'
          ? uiLang === 'ar'
            ? 'تم توليد قالب JSON عبر Gemini AI — راجعه ثم اضغط استيراد'
            : 'Generated JSON manifest with AI — review and click Import'
          : uiLang === 'ar'
            ? 'تم توليد قالب JSON بالمحرك المحلي — جاهز للتعديل والاستيراد'
            : 'Generated JSON manifest locally — ready to edit and import',
        'success',
      );
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleUploadJsonFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      setJsonEditorValue(content);
      onShowToast(
        uiLang === 'ar' ? `تم تحميل الملف ${file.name}` : `Loaded ${file.name}`,
        'info',
      );
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleImportSubmit = () => {
    const res = onImportPluginJson(jsonEditorValue);
    if (res.valid && res.manifest) {
      setTab('installed');
    }
  };

  const handleSandboxExecute = (event: FormEvent) => {
    event.preventDefault();
    if (!activeSandboxPlugin || !activeSandboxAction) return;
    const mins = Number(sandboxMinutes);
    const payload: Record<string, unknown> = {
      text: sandboxText.trim(),
    };
    if (!Number.isNaN(mins) && mins > 0) {
      payload.minutes = mins;
      payload.seconds = Math.round(mins * 60);
    }
    onExecutePluginAction(
      activeSandboxPlugin.id,
      activeSandboxAction.capability,
      payload,
      activeSandboxAction.id,
    );
  };

  const handleAddRecordSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!recordText.trim()) return;
    const target = plugins.find((p) => p.id === recordTargetId) ?? plugins[0];
    if (!target) return;
    onAddRecord(target.id, uiLang === 'ar' ? target.arabicName : target.name, recordText.trim());
    setRecordText('');
  };

  const handleCreateRoutine = (event: FormEvent) => {
    event.preventDefault();
    if (!routineName.trim() || !routineSteps.trim()) return;
    const steps = routineSteps
      .split(/[,،]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (steps.length === 0) return;
    onAddRoutine(routineName.trim(), routineName.trim().toLowerCase(), routineName.trim(), steps);
    setRoutineName('');
    setRoutineSteps('');
  };

  const studioTabs: Array<{ id: StudioTab; label: string; Icon: typeof Blocks }> = [
    { id: 'installed', label: `${t.apis.tabInstalled} (${plugins.length})`, Icon: Blocks },
    { id: 'import', label: t.apis.tabImportAi, Icon: FileJson },
    { id: 'sandbox', label: t.apis.tabSandbox, Icon: FlaskConical },
    { id: 'records', label: `${t.apis.tabRecords} (${records.length})`, Icon: Database },
    { id: 'routines', label: `${t.apis.tabRoutines} (${routines.length})`, Icon: Zap },
  ];

  return (
    <div className="space-y-6">
      {/* Studio Header & Sub-Navigation */}
      <section className="m3-surface-container rounded-[28px] p-6">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-bold">{t.apis.title}</h2>
            <p className="m3-text-muted mt-1 text-sm">{t.apis.subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {studioTabs.map(({ id, label, Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full px-4 text-xs font-semibold transition-colors ${
                    active ? 'm3-primary' : 'm3-surface-highest m3-text-muted hover:opacity-85'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* TAB 1: INSTALLED PLUGINS */}
      {tab === 'installed' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {plugins.map((plugin) => {
            const displayName = uiLang === 'ar' ? plugin.arabicName || plugin.name : plugin.name;
            const displayDesc =
              uiLang === 'ar' ? plugin.descriptionAr || plugin.description : plugin.description;
            const primaryAction = plugin.actions[0];
            const triggerPreview = plugin.actions
              .flatMap((a) => (uiLang === 'ar' ? a.triggers.ar : a.triggers.en))
              .slice(0, 4)
              .join(' · ');

            return (
              <article
                key={plugin.id}
                className="m3-surface-low flex flex-col justify-between gap-4 rounded-[26px] p-5"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold">{displayName}</h3>
                        <span className="font-mono-log m3-text-muted text-[11px]">
                          v{plugin.version}
                        </span>
                      </div>
                      <p className="m3-text-muted mt-1 text-xs leading-relaxed">
                        {displayDesc}
                      </p>
                      <p className="m3-text-primary mt-2 text-xs font-medium">
                        {plugin.actions.length} {t.apis.actionsCount}
                        {plugin.internalHandler.enabled ? ` · ${t.apis.internalBadge}` : ''} ·{' '}
                        <span className="font-mono-log">{plugin.id}</span>
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={plugin.enabled}
                        onClick={() => onUpdatePlugin(plugin.id, { enabled: !plugin.enabled })}
                        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full p-1 transition-colors ${
                          plugin.enabled ? 'm3-primary justify-end' : 'm3-surface-highest justify-start'
                        }`}
                      >
                        <span className="inline-block h-5 w-5 rounded-full bg-white shadow" />
                      </button>
                      {!plugin.builtIn && (
                        <button
                          type="button"
                          onClick={() => onDeletePlugin(plugin.id)}
                          aria-label={t.apis.deletePlugin}
                          className="m3-text-error cursor-pointer p-1.5 opacity-80 hover:opacity-100"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline URI Template & Optional Webhook URL */}
                  {primaryAction && (
                    <div className="space-y-2 pt-1">
                      <input
                        type="text"
                        dir="ltr"
                        value={primaryAction.uriTemplate ?? ''}
                        onChange={(e) =>
                          onUpdatePlugin(plugin.id, { uriTemplate: e.target.value })
                        }
                        placeholder={t.apis.uriPlaceholder}
                        aria-label={`${displayName} URI`}
                        className="font-mono-log m3-surface-lowest m3-border min-h-[38px] w-full rounded-[14px] border px-3 text-[11px] outline-none focus:border-[var(--md-primary)]"
                      />
                      <div className="relative" dir="ltr">
                        <Webhook
                          className="m3-text-muted pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2"
                          aria-hidden="true"
                        />
                        <input
                          type="url"
                          dir="ltr"
                          value={primaryAction.webhook?.url ?? ''}
                          onChange={(e) =>
                            onUpdatePlugin(plugin.id, { webhookUrl: e.target.value })
                          }
                          placeholder={t.apis.webhookPlaceholder}
                          aria-label={`${displayName} Webhook`}
                          className="font-mono-log m3-surface-lowest m3-border min-h-[38px] w-full rounded-[14px] border pl-9 pr-3 text-left text-[11px] outline-none focus:border-[var(--md-primary)]"
                        />
                      </div>
                    </div>
                  )}

                  {triggerPreview && (
                    <p className="m3-text-muted text-[11px] leading-relaxed">
                      <span className="font-semibold">{t.apis.triggersLabel}:</span> {triggerPreview}
                    </p>
                  )}
                </div>

                {/* Card Actions: Test / Copy JSON / Export JSON */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t m3-border pt-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        void handleCopyText(
                          plugin.id,
                          JSON.stringify(plugin, null, 2),
                          uiLang === 'ar' ? 'تم نسخ كود JSON للإضافة' : 'Plugin JSON copied',
                        )
                      }
                      className="m3-surface-highest inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold"
                    >
                      {copiedId === plugin.id ? (
                        <Check className="h-3.5 w-3.5 m3-text-primary" aria-hidden="true" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      <span>{t.apis.copyJson}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportPlugin(plugin)}
                      className="m3-surface-highest inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t.apis.exportJson}</span>
                    </button>
                  </div>

                  {primaryAction && (
                    <button
                      type="button"
                      onClick={() =>
                        onExecutePluginAction(
                          plugin.id,
                          primaryAction.capability,
                          {
                            text:
                              uiLang === 'ar'
                                ? `اختبار ${displayName}`
                                : `Test ${displayName}`,
                            minutes: primaryAction.capability === 'set_timer' ? 5 : undefined,
                            hour: primaryAction.capability === 'set_alarm' ? 7 : undefined,
                            minute: primaryAction.capability === 'set_alarm' ? 30 : undefined,
                          },
                          primaryAction.id,
                        )
                      }
                      className="m3-primary-container inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold"
                    >
                      <Play className="h-3 w-3" aria-hidden="true" />
                      <span>{t.apis.testAction}</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* TAB 2: AI JSON GENERATOR & MANIFEST IMPORTER */}
      {tab === 'import' && (
        <div className="space-y-6">
          {/* AI Generator Card */}
          <form
            onSubmit={handleGenerateWithAI}
            className="m3-surface-low rounded-[28px] p-6 space-y-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 m3-text-primary" aria-hidden="true" />
                  <h3 className="text-base font-bold">{t.apis.aiGenTitle}</h3>
                </div>
                <p className="m3-text-muted mt-1 text-xs leading-relaxed">
                  {t.apis.aiGenDesc}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  void handleCopyText(
                    'external-ai-prompt',
                    buildAiPluginPrompt(aiGoal),
                    t.apis.copiedPromptToast,
                  )
                }
                className="m3-secondary-container inline-flex min-h-[38px] cursor-pointer items-center gap-2 rounded-full px-4 text-xs font-semibold"
              >
                {copiedId === 'external-ai-prompt' ? (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>{t.apis.copyAiPromptBtn}</span>
              </button>
            </div>

            <textarea
              dir="auto"
              rows={3}
              value={aiGoal}
              onChange={(e) => setAiGoal(e.target.value)}
              placeholder={t.apis.aiPromptPlaceholder}
              className="m3-surface-lowest m3-border w-full rounded-[18px] border p-4 text-sm outline-none focus:border-[var(--md-primary)]"
            />

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="submit"
                disabled={generatingAi || !aiGoal.trim()}
                className="m3-primary inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-full px-5 text-xs font-semibold disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                <span>{generatingAi ? t.apis.generatingBtn : t.apis.generateBtn}</span>
              </button>
            </div>
          </form>

          {/* Ready-to-Import Preset Gallery */}
          <section className="m3-surface-low rounded-[28px] p-6">
            <h3 className="text-base font-bold">{t.apis.presetGalleryTitle}</h3>
            <p className="m3-text-muted mt-0.5 text-xs">{t.apis.presetGalleryDesc}</p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {PRESET_PLUGIN_TEMPLATES.map((preset) => (
                <div
                  key={preset.key}
                  className="m3-surface-lowest m3-border flex flex-col justify-between gap-3 rounded-[20px] border p-4"
                >
                  <div>
                    <div className="text-sm font-bold">
                      {uiLang === 'ar' ? preset.labelAr : preset.labelEn}
                    </div>
                    <p className="m3-text-muted mt-1 text-xs leading-relaxed">
                      {uiLang === 'ar'
                        ? preset.manifest.descriptionAr || preset.manifest.description
                        : preset.manifest.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setJsonEditorValue(JSON.stringify(preset.manifest, null, 2));
                      onShowToast(
                        uiLang === 'ar'
                          ? `تم تحميل قالب ${preset.labelAr} في المحرر`
                          : `Loaded ${preset.labelEn} into JSON editor`,
                        'info',
                      );
                    }}
                    className="m3-primary-container inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-1.5 rounded-full px-4 text-xs font-semibold"
                  >
                    <FileJson className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t.apis.loadPreset}</span>
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Live Validated JSON Manifest Editor & Importer */}
          <section className="m3-surface-low rounded-[28px] p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold">{t.apis.jsonEditorTitle}</h3>
                <p className="m3-text-muted mt-0.5 text-xs">{t.apis.jsonEditorDesc}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleUploadJsonFile}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="m3-secondary-container inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full px-4 text-xs font-semibold"
                >
                  <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t.apis.uploadJsonFile}</span>
                </button>
                <button
                  type="button"
                  disabled={!liveValidation.valid}
                  onClick={handleImportSubmit}
                  className="m3-primary inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full px-5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>{t.apis.validateAndImport}</span>
                </button>
              </div>
            </div>

            <textarea
              dir="ltr"
              spellCheck={false}
              rows={16}
              value={jsonEditorValue}
              onChange={(e) => setJsonEditorValue(e.target.value)}
              aria-label={t.apis.jsonEditorTitle}
              className="font-mono-log m3-surface-lowest m3-border w-full rounded-[20px] border p-4 text-xs leading-relaxed outline-none focus:border-[var(--md-primary)]"
            />

            {/* Real-time Schema Validation Feedback */}
            <div
              className={`rounded-[18px] p-4 text-xs ${
                liveValidation.valid ? 'm3-primary-container' : 'm3-error-container'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                {liveValidation.valid ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>
                      {t.apis.validSchema}
                      {liveValidation.manifest
                        ? ` · ${liveValidation.manifest.id} (${liveValidation.manifest.actions.length} ${t.apis.actionsCount})`
                        : ''}
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{t.apis.invalidSchema}</span>
                  </>
                )}
              </div>

              {liveValidation.errors.length > 0 && (
                <ul dir="ltr" className="font-mono-log mt-2 list-disc space-y-1 ps-5">
                  {liveValidation.errors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              )}

              {liveValidation.warnings.length > 0 && (
                <div className="mt-2 opacity-85">
                  <span className="font-semibold">{t.apis.warningsLabel}: </span>
                  <span dir="ltr" className="font-mono-log">
                    {liveValidation.warnings.join(' · ')}
                  </span>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* TAB 3: LIVE INTERACTIVE PLUGIN SANDBOX + DISPATCH STREAM */}
      {tab === 'sandbox' && (
        <div className="space-y-6">
          <form
            onSubmit={handleSandboxExecute}
            className="m3-surface-low rounded-[28px] p-6 space-y-4"
          >
            <div>
              <h3 className="text-base font-bold">{t.apis.sandboxTitle}</h3>
              <p className="m3-text-muted mt-0.5 text-xs">{t.apis.sandboxDesc}</p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="space-y-1.5 text-xs font-semibold">
                <span className="m3-text-muted">{t.apis.selectPlugin}</span>
                <select
                  value={activeSandboxPlugin?.id ?? ''}
                  onChange={(e) => {
                    setSandboxPluginId(e.target.value);
                    const nextPlugin = plugins.find((p) => p.id === e.target.value);
                    setSandboxActionId(nextPlugin?.actions[0]?.id ?? '');
                  }}
                  className="m3-surface-lowest m3-border min-h-[44px] w-full rounded-[16px] border px-3.5 text-xs font-semibold outline-none"
                >
                  {plugins.map((p) => (
                    <option key={p.id} value={p.id}>
                      {uiLang === 'ar' ? p.arabicName : p.name} ({p.id})
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5 text-xs font-semibold">
                <span className="m3-text-muted">{t.apis.selectAction}</span>
                <select
                  value={activeSandboxAction?.id ?? ''}
                  onChange={(e) => setSandboxActionId(e.target.value)}
                  className="m3-surface-lowest m3-border min-h-[44px] w-full rounded-[16px] border px-3.5 text-xs font-semibold outline-none"
                >
                  {(activeSandboxPlugin?.actions ?? []).map((act) => (
                    <option key={act.id} value={act.id}>
                      {uiLang === 'ar' ? act.titleAr || act.title : act.title} [{act.capability}]
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="space-y-1.5 text-xs font-semibold sm:col-span-2">
                <span className="m3-text-muted">{t.apis.paramTextLabel}</span>
                <input
                  type="text"
                  dir="auto"
                  value={sandboxText}
                  onChange={(e) => setSandboxText(e.target.value)}
                  className="m3-surface-lowest m3-border min-h-[44px] w-full rounded-[16px] border px-4 text-sm outline-none focus:border-[var(--md-primary)]"
                />
              </label>
              <label className="space-y-1.5 text-xs font-semibold">
                <span className="m3-text-muted">{t.apis.paramMinutesLabel}</span>
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={sandboxMinutes}
                  onChange={(e) => setSandboxMinutes(e.target.value)}
                  className="m3-surface-lowest m3-border min-h-[44px] w-full rounded-[16px] border px-4 text-sm outline-none focus:border-[var(--md-primary)]"
                />
              </label>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="m3-primary inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-full px-6 text-xs font-semibold"
              >
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t.apis.runDispatchBtn}</span>
              </button>
            </div>
          </form>

          {/* Live API Dispatch Stream */}
          <section className="m3-surface-low rounded-[28px] p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 m3-text-primary" aria-hidden="true" />
                <h3 className="text-base font-bold">{t.apis.dispatchFeedTitle}</h3>
              </div>
              {dispatches.length > 0 && (
                <button
                  type="button"
                  onClick={onClearDispatches}
                  className="m3-text-muted cursor-pointer text-xs font-semibold hover:underline"
                >
                  {t.apis.clearFeed}
                </button>
              )}
            </div>

            {dispatches.length === 0 ? (
              <p className="m3-text-muted text-sm">{t.apis.noDispatches}</p>
            ) : (
              <div className="space-y-3">
                {dispatches.slice(0, 12).map((disp) => (
                  <div
                    key={disp.id}
                    className="m3-surface-lowest m3-border rounded-[18px] border p-4 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs m3-text-muted">
                        <span className="font-semibold text-[var(--md-on-surface)]">
                          {disp.appName}
                        </span>
                        <span>·</span>
                        <span className="font-mono-log">{disp.actionId || disp.capability}</span>
                        <span>·</span>
                        <span className="font-mono-log">{disp.transport}</span>
                        {disp.webhookStatus !== undefined && (
                          <>
                            <span>·</span>
                            <span className="font-mono-log">HTTP {disp.webhookStatus}</span>
                          </>
                        )}
                        <span>·</span>
                        <span className="font-mono-log">{disp.timestamp}</span>
                      </div>
                      {disp.uri && (
                        <a
                          href={disp.uri}
                          target={disp.uri.startsWith('http') ? '_blank' : undefined}
                          rel={disp.uri.startsWith('http') ? 'noopener noreferrer' : undefined}
                          className="m3-primary-container inline-flex min-h-[32px] items-center gap-1 rounded-full px-3 text-xs font-semibold"
                        >
                          <span>{t.apis.launchUri}</span>
                          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      )}
                    </div>
                    <p dir="auto" className="text-sm font-medium">
                      {disp.summary}
                    </p>
                    <pre
                      dir="ltr"
                      className="font-mono-log m3-surface-low overflow-x-auto rounded-[12px] p-2.5 text-left text-[11px] m3-text-muted"
                    >
                      {JSON.stringify(disp.payload)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 4: INTERNAL PLUGIN STORAGE RECORDS */}
      {tab === 'records' && (
        <section className="m3-surface-low rounded-[28px] p-6 space-y-5">
          <div>
            <h3 className="text-base font-bold">{t.apis.recordsTitle}</h3>
            <p className="m3-text-muted mt-0.5 text-xs">{t.apis.recordsDesc}</p>
          </div>

          <form onSubmit={handleAddRecordSubmit} className="flex flex-wrap gap-2.5">
            <select
              value={recordTargetId}
              onChange={(e) => setRecordTargetId(e.target.value)}
              aria-label={t.apis.selectPlugin}
              className="m3-surface-lowest m3-border min-h-[44px] rounded-[16px] border px-3.5 text-xs font-semibold outline-none"
            >
              {plugins
                .filter((p) => p.internalHandler.enabled)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {uiLang === 'ar' ? p.arabicName : p.name}
                  </option>
                ))}
            </select>
            <input
              type="text"
              dir="auto"
              value={recordText}
              onChange={(e) => setRecordText(e.target.value)}
              placeholder={t.apis.recordPlaceholder}
              className="m3-surface-lowest m3-border min-h-[44px] min-w-[200px] flex-1 rounded-[16px] border px-4 text-sm outline-none focus:border-[var(--md-primary)]"
            />
            <button
              type="submit"
              className="m3-primary inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full px-5 text-xs font-semibold"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>{t.apis.saveRecordBtn}</span>
            </button>
          </form>

          {records.length === 0 ? (
            <p className="m3-text-muted text-sm">{t.apis.noRecords}</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {records.map((rec) => (
                <div
                  key={rec.id}
                  className="m3-surface-lowest m3-border flex items-start justify-between gap-3 rounded-[20px] border p-4"
                >
                  <div className="min-w-0">
                    <div className="m3-text-muted text-xs">
                      {rec.appName} · <span className="font-mono-log">{rec.namespace}</span> ·{' '}
                      {rec.createdAt}
                    </div>
                    <p dir="auto" className="mt-1.5 text-sm font-medium">
                      {rec.text}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteRecord(rec.id)}
                    aria-label={t.apis.deletePlugin}
                    className="m3-text-error cursor-pointer p-1 opacity-75 hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 5: MULTI-STEP ROUTINES */}
      {tab === 'routines' && (
        <section className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {routines.map((routine) => (
              <div
                key={routine.id}
                className="m3-surface-low flex items-start justify-between gap-3 rounded-[24px] p-5"
              >
                <div className="min-w-0">
                  <div className="text-sm font-bold">
                    {uiLang === 'ar' ? routine.arabicTrigger || routine.name : routine.name}
                  </div>
                  <p className="m3-text-muted mt-1 text-xs leading-relaxed">
                    {routine.summary}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onRunRoutine(routine.id)}
                    className="m3-primary-container inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-full px-4 text-xs font-semibold"
                  >
                    <Play className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t.apis.runRoutine}</span>
                  </button>
                  {!routine.builtIn && (
                    <button
                      type="button"
                      onClick={() => onDeleteRoutine(routine.id)}
                      aria-label={t.apis.deletePlugin}
                      className="m3-text-error cursor-pointer p-1.5 opacity-80 hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={handleCreateRoutine}
            className="m3-surface-low rounded-[24px] p-5 space-y-3"
          >
            <h3 className="text-sm font-bold">{t.apis.createRoutineTitle}</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                type="text"
                dir="auto"
                value={routineName}
                onChange={(e) => setRoutineName(e.target.value)}
                placeholder={t.apis.routineNamePlaceholder}
                className="m3-surface-lowest m3-border min-h-[42px] rounded-[16px] border px-4 text-xs outline-none focus:border-[var(--md-primary)]"
              />
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  dir="auto"
                  value={routineSteps}
                  onChange={(e) => setRoutineSteps(e.target.value)}
                  placeholder={t.apis.routineStepsPlaceholder}
                  className="m3-surface-lowest m3-border min-h-[42px] min-w-[200px] flex-1 rounded-[16px] border px-4 text-xs outline-none focus:border-[var(--md-primary)]"
                />
                <button
                  type="submit"
                  className="m3-primary inline-flex min-h-[42px] cursor-pointer items-center gap-1.5 rounded-full px-5 text-xs font-semibold"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>{t.apis.addRoutineBtn}</span>
                </button>
              </div>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
