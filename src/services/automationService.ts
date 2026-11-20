import {
  AppActionDispatch,
  AppCapabilityKind,
  ContactItem,
  InternalPluginRecord,
  MessageDraft,
  PluginActionDefinition,
  PluginValidationResult,
  RoutineItem,
  VickyAppManifest,
} from '../types/assistant';
import { normalizeArabic } from './arabicNlu';
import { PLUGIN_SCHEMA_URL, validatePluginManifest } from './pluginSchema';

const KEYS = {
  routines: 'vicky.v3.routines',
  contacts: 'vicky.v3.contacts',
  plugins: 'vicky.v4.plugins',
  records: 'vicky.v4.records',
  dispatches: 'vicky.v4.dispatches',
} as const;

export const DEFAULT_ROUTINES: RoutineItem[] = [
  {
    id: 'routine-morning',
    name: 'Good Morning',
    englishTrigger: 'good morning',
    arabicTrigger: 'صباح الخير',
    summary: 'Turn Wi-Fi on, DND off, brightness 80%, time & date briefing',
    builtIn: true,
    steps: [
      { command: 'turn off do not disturb', description: 'Disable Do Not Disturb' },
      { command: 'turn on wifi', description: 'Ensure Wi-Fi is enabled' },
      { command: 'set brightness to 80', description: 'Raise brightness to 80%' },
      { command: 'what time is it', description: 'Announce current time' },
    ],
  },
  {
    id: 'routine-night',
    name: 'Good Night',
    englishTrigger: 'good night',
    arabicTrigger: 'تصبح علي خير',
    summary: 'Enable Do Not Disturb, dim brightness, dark mode, Clock 7:00 AM alarm API',
    builtIn: true,
    steps: [
      { command: 'turn on do not disturb', description: 'Enable Do Not Disturb' },
      { command: 'set brightness to 20', description: 'Dim screen brightness' },
      { command: 'turn on dark mode', description: 'Switch to Material You Dark Mode' },
      {
        command: 'set alarm for 7:00 am labeled Morning Wake Up',
        description: 'Dispatch 7:00 AM Clock alarm',
      },
    ],
  },
  {
    id: 'routine-driving',
    name: 'Driving Mode',
    englishTrigger: 'driving mode',
    arabicTrigger: 'وضع القياده',
    summary: 'Turn Bluetooth on, enable notification reading, raise volume, open Maps',
    builtIn: true,
    steps: [
      { command: 'turn on bluetooth', description: 'Enable Bluetooth' },
      { command: 'volume up', description: 'Raise assistant volume' },
      { command: 'open maps', description: 'Prepare Google Maps navigation link' },
    ],
  },
  {
    id: 'routine-focus',
    name: 'Focus Mode',
    englishTrigger: 'focus mode',
    arabicTrigger: 'وضع التركيز',
    summary: 'Enable Do Not Disturb, mute audio, dispatch 25m timer via Clock API',
    builtIn: true,
    steps: [
      { command: 'turn on do not disturb', description: 'Silence interruptions' },
      { command: 'mute volume', description: 'Mute audio alerts' },
      { command: 'set timer for 25 minutes', description: 'Dispatch 25m timer to Clock API' },
    ],
  },
];

export const DEFAULT_CONTACTS: ContactItem[] = [
  {
    id: 'c-ahmed',
    name: 'Ahmed',
    arabicName: 'أحمد',
    phone: '+201001234567',
    whatsapp: '201001234567',
    email: 'ahmed@example.com',
  },
  {
    id: 'c-sara',
    name: 'Sara',
    arabicName: 'سارة',
    phone: '+966501234567',
    whatsapp: '966501234567',
    email: 'sara@example.com',
  },
  {
    id: 'c-rahul',
    name: 'Rahul',
    arabicName: 'راهول',
    phone: '+919876543210',
    whatsapp: '919876543210',
    email: 'rahul@example.com',
  },
  {
    id: 'c-mom',
    name: 'Mom',
    arabicName: 'ماما',
    phone: '+15550192834',
    whatsapp: '15550192834',
  },
];

export const DEFAULT_PLUGINS: VickyAppManifest[] = [
  {
    $schema: PLUGIN_SCHEMA_URL,
    schemaVersion: '1.0',
    id: 'clock-api',
    name: 'Android Clock API',
    arabicName: 'تطبيق الساعة',
    version: '1.0.0',
    author: 'Vicky Core',
    description:
      'Delegates alarms and timers like Google Assistant via Android SET_ALARM and SET_TIMER Intents.',
    descriptionAr:
      'يفوّض ضبط المنبهات والمؤقتات مباشرة إلى تطبيق الساعة مثل مساعد جوجل عبر Android Intent API.',
    enabled: true,
    builtIn: true,
    capabilities: ['set_alarm', 'set_timer'],
    internalHandler: {
      enabled: true,
      storageNamespace: 'clock',
      storeRecords: false,
    },
    actions: [
      {
        id: 'clock_set_alarm',
        capability: 'set_alarm',
        title: 'Set Alarm',
        titleAr: 'ضبط منبه',
        triggers: {
          en: ['set alarm', 'wake me up'],
          ar: ['اضبط منبه', 'منبه الساعة', 'صحيني'],
        },
        parameters: [
          { name: 'time24', type: 'string', source: 'time24', defaultValue: '07:00' },
          { name: 'text', type: 'string', source: 'remainder', defaultValue: 'Vicky Alarm' },
        ],
        uriTemplate:
          'intent:#Intent;action=android.intent.action.SET_ALARM;i.android.intent.extra.alarm.HOUR={{hour}};i.android.intent.extra.alarm.MINUTES={{minute}};S.android.intent.extra.alarm.MESSAGE={{text}};B.android.intent.extra.alarm.SKIP_UI=false;end',
        webhook: { method: 'POST', url: '', headers: { 'Content-Type': 'application/json' } },
        responseTemplateEn: 'Alarm for {{time24}} dispatched to Clock app.',
        responseTemplateAr: 'تم إرسال المنبه ({{time24}}) إلى تطبيق الساعة.',
      },
      {
        id: 'clock_set_timer',
        capability: 'set_timer',
        title: 'Set Timer',
        titleAr: 'ضبط مؤقت',
        triggers: {
          en: ['set timer', 'start timer'],
          ar: ['اضبط مؤقت', 'اعمل مؤقت', 'تايمر'],
        },
        parameters: [
          { name: 'minutes', type: 'number', source: 'duration_minutes', defaultValue: 5 },
        ],
        uriTemplate:
          'intent:#Intent;action=android.intent.action.SET_TIMER;i.android.intent.extra.alarm.LENGTH={{seconds}};S.android.intent.extra.alarm.MESSAGE={{text}};B.android.intent.extra.alarm.SKIP_UI=false;end',
        webhook: { method: 'POST', url: '', headers: { 'Content-Type': 'application/json' } },
        responseTemplateEn: 'Timer for {{minutes}} minutes dispatched to Clock app.',
        responseTemplateAr: 'تم إرسال مؤقت لمدة {{minutes}} دقائق إلى تطبيق الساعة.',
      },
    ],
  },
  {
    $schema: PLUGIN_SCHEMA_URL,
    schemaVersion: '1.0',
    id: 'crystal-api',
    name: 'Crystal App',
    arabicName: 'تطبيق كريستال',
    version: '1.0.0',
    author: 'Vicky Core',
    description:
      'Internal storage, deep-link URI, and optional REST webhook support for Crystal notes, timers, and custom actions.',
    descriptionAr:
      'دعم داخلي كامل لحفظ ملاحظات ومؤقتات وأوامر تطبيق كريستال مع دعم Deep Link و Webhook.',
    enabled: true,
    builtIn: true,
    capabilities: ['create_note', 'set_timer', 'custom_action'],
    internalHandler: {
      enabled: true,
      storageNamespace: 'crystal',
      storeRecords: true,
    },
    actions: [
      {
        id: 'crystal_create_note',
        capability: 'create_note',
        title: 'Save Note in Crystal',
        titleAr: 'حفظ ملاحظة في كريستال',
        triggers: {
          en: ['add note in crystal', 'note in crystal', 'save in crystal', 'crystal note'],
          ar: ['نوت في كريستال', 'ملاحظة في كريستال', 'ملاحظه في كريستال', 'اكتب في كريستال', 'احفظ في كريستال'],
        },
        parameters: [{ name: 'text', type: 'string', required: true, source: 'remainder' }],
        uriTemplate: 'crystal://action?type=create_note&text={{text}}',
        webhook: {
          method: 'POST',
          url: '',
          headers: { 'Content-Type': 'application/json' },
          bodyTemplate: { app: 'crystal', action: 'create_note', text: '{{text}}' },
        },
        responseTemplateEn: 'Saved note in Crystal: "{{text}}".',
        responseTemplateAr: 'تم حفظ الملاحظة داخل كريستال: "{{text}}".',
      },
      {
        id: 'crystal_set_timer',
        capability: 'set_timer',
        title: 'Start Timer in Crystal',
        titleAr: 'تشغيل مؤقت في كريستال',
        triggers: {
          en: ['timer in crystal', 'crystal timer'],
          ar: ['مؤقت في كريستال', 'موقت في كريستال', 'تايمر في كريستال'],
        },
        parameters: [
          { name: 'minutes', type: 'number', source: 'duration_minutes', defaultValue: 5 },
        ],
        uriTemplate: 'crystal://action?type=set_timer&minutes={{minutes}}&seconds={{seconds}}',
        webhook: {
          method: 'POST',
          url: '',
          headers: { 'Content-Type': 'application/json' },
          bodyTemplate: { app: 'crystal', action: 'set_timer', minutes: '{{minutes}}' },
        },
        responseTemplateEn: 'Dispatched {{minutes}}-minute timer to Crystal App.',
        responseTemplateAr: 'تم إرسال مؤقت لمدة {{minutes}} دقائق إلى تطبيق كريستال.',
      },
      {
        id: 'crystal_custom_action',
        capability: 'custom_action',
        title: 'Run Crystal Action',
        titleAr: 'تنفيذ أمر في كريستال',
        triggers: {
          en: ['crystal'],
          ar: ['كريستال'],
        },
        parameters: [{ name: 'text', type: 'string', source: 'remainder' }],
        uriTemplate: 'crystal://action?type=custom_action&text={{text}}',
        webhook: {
          method: 'POST',
          url: '',
          headers: { 'Content-Type': 'application/json' },
          bodyTemplate: { app: 'crystal', action: 'custom_action', text: '{{text}}' },
        },
        responseTemplateEn: 'Triggered Crystal App API: {{text}}',
        responseTemplateAr: 'تم تنفيذ الأمر عبر تطبيق كريستال: {{text}}',
      },
    ],
  },
  {
    $schema: PLUGIN_SCHEMA_URL,
    schemaVersion: '1.0',
    id: 'settings-api',
    name: 'Device Settings API',
    arabicName: 'واجهة إعدادات الجهاز',
    version: '1.0.0',
    author: 'Vicky Core',
    description:
      'Live Google Assistant–style system toggles (Wi-Fi, Bluetooth, DND, Brightness, Volume, Dark Mode) with Android Settings Intents.',
    descriptionAr:
      'التحكم المباشر بإعدادات الجهاز (واي فاي، بلوتوث، عدم الإزعاج، السطوع، الصوت، الوضع الداكن) بأسلوب مساعد جوجل.',
    enabled: true,
    builtIn: true,
    capabilities: ['device_setting'],
    internalHandler: {
      enabled: true,
      storageNamespace: 'device_settings',
      storeRecords: false,
    },
    actions: [
      {
        id: 'device_toggle_setting',
        capability: 'device_setting',
        title: 'Toggle System Setting',
        titleAr: 'تغيير إعداد النظام',
        triggers: {
          en: ['wifi', 'bluetooth', 'brightness', 'volume', 'do not disturb', 'flashlight', 'dark mode'],
          ar: ['واي فاي', 'بلوتوث', 'السطوع', 'الصوت', 'عدم الازعاج', 'الكشاف', 'الوضع الليلي'],
        },
        uriTemplate: 'intent:#Intent;action=android.settings.SETTINGS;end',
        webhook: { method: 'POST', url: '', headers: { 'Content-Type': 'application/json' } },
      },
    ],
  },
  {
    $schema: PLUGIN_SCHEMA_URL,
    schemaVersion: '1.0',
    id: 'messaging-api',
    name: 'WhatsApp & SMS API',
    arabicName: 'واتساب والرسائل',
    version: '1.0.0',
    author: 'Vicky Core',
    description:
      'Bilingual contact resolver and one-tap message dispatch for WhatsApp, SMS, and Email.',
    descriptionAr:
      'التعرف الذكي على جهات الاتصال باللغتين وإرسال رسائل واتساب و SMS والبريد بضغطة واحدة.',
    enabled: true,
    builtIn: true,
    capabilities: ['send_message'],
    internalHandler: {
      enabled: true,
      storageNamespace: 'messaging',
      storeRecords: false,
    },
    actions: [
      {
        id: 'messaging_send',
        capability: 'send_message',
        title: 'Dispatch Message',
        titleAr: 'إرسال رسالة',
        triggers: {
          en: ['send whatsapp', 'send message', 'sms'],
          ar: ['ابعت رساله واتساب', 'ارسل رساله', 'واتساب'],
        },
        uriTemplate: 'https://wa.me/{{phone}}?text={{text}}',
        webhook: { method: 'POST', url: '', headers: { 'Content-Type': 'application/json' } },
      },
    ],
  },
];

function safeRead<T>(key: string, fallback: T): T {
  try {
    if (typeof window === 'undefined') return fallback;
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWrite<T>(key: string, data: T): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

export function buildAndroidAlarmIntentUri(time24: string, label: string): string {
  const [hStr, mStr] = time24.split(':');
  const hour = Number(hStr) || 7;
  const minute = Number(mStr) || 0;
  const encodedLabel = encodeURIComponent(label || 'Vicky Alarm');
  return `intent:#Intent;action=android.intent.action.SET_ALARM;i.android.intent.extra.alarm.HOUR=${hour};i.android.intent.extra.alarm.MINUTES=${minute};S.android.intent.extra.alarm.MESSAGE=${encodedLabel};B.android.intent.extra.alarm.SKIP_UI=false;end`;
}

export function buildAndroidTimerIntentUri(seconds: number, label: string): string {
  const safeSec = Math.max(5, Math.round(seconds));
  const encodedLabel = encodeURIComponent(label || 'Vicky Timer');
  return `intent:#Intent;action=android.intent.action.SET_TIMER;i.android.intent.extra.alarm.LENGTH=${safeSec};S.android.intent.extra.alarm.MESSAGE=${encodedLabel};B.android.intent.extra.alarm.SKIP_UI=false;end`;
}

export function buildAndroidSettingsIntentUri(setting: string): string {
  const map: Record<string, string> = {
    wifi: 'android.settings.WIFI_SETTINGS',
    bluetooth: 'android.settings.BLUETOOTH_SETTINGS',
    dnd: 'android.settings.ZEN_MODE_SETTINGS',
    brightness: 'android.settings.DISPLAY_SETTINGS',
    volume: 'android.settings.SOUND_SETTINGS',
    airplane: 'android.settings.AIRPLANE_MODE_SETTINGS',
    battery_saver: 'android.settings.BATTERY_SAVER_SETTINGS',
    dark_mode: 'android.settings.DISPLAY_SETTINGS',
  };
  const action = map[setting] ?? 'android.settings.SETTINGS';
  return `intent:#Intent;action=${action};end`;
}

export function interpolateTemplate(
  template: string,
  vars: Record<string, unknown>,
  encodeUriValues = false,
): string {
  if (!template) return '';
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const raw = vars[key];
    if (raw === undefined || raw === null) return '';
    const str = String(raw);
    return encodeUriValues ? encodeURIComponent(str) : str;
  });
}

function interpolateJsonObject(
  value: unknown,
  vars: Record<string, unknown>,
): unknown {
  if (typeof value === 'string') {
    return interpolateTemplate(value, vars, false);
  }
  if (Array.isArray(value)) {
    return value.map((item) => interpolateJsonObject(item, vars));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = interpolateJsonObject(v, vars);
    }
    return out;
  }
  return value;
}

export interface PluginActionMatch {
  plugin: VickyAppManifest;
  action: PluginActionDefinition;
  matchedTrigger: string;
}

export class AutomationService {
  private routines: RoutineItem[];
  private contacts: ContactItem[];
  private plugins: VickyAppManifest[];
  private records: InternalPluginRecord[];
  private dispatches: AppActionDispatch[];
  private listeners = new Set<() => void>();

  constructor() {
    this.routines = safeRead<RoutineItem[]>(KEYS.routines, DEFAULT_ROUTINES);
    this.contacts = safeRead<ContactItem[]>(KEYS.contacts, DEFAULT_CONTACTS);
    this.plugins = this.loadInitialPlugins();
    this.records = safeRead<InternalPluginRecord[]>(KEYS.records, []);
    this.dispatches = safeRead<AppActionDispatch[]>(KEYS.dispatches, []);
    this.installWindowBridge();
  }

  private loadInitialPlugins(): VickyAppManifest[] {
    const stored = safeRead<VickyAppManifest[]>(KEYS.plugins, []);
    if (!Array.isArray(stored) || stored.length === 0) {
      return DEFAULT_PLUGINS.map((p) => ({ ...p }));
    }
    // Ensure core built-in plugins exist even if user clears custom entries
    const byId = new Map<string, VickyAppManifest>();
    for (const def of DEFAULT_PLUGINS) {
      byId.set(def.id, { ...def });
    }
    for (const item of stored) {
      if (item && typeof item.id === 'string' && Array.isArray(item.actions)) {
        byId.set(item.id, item);
      }
    }
    return Array.from(byId.values());
  }

  private installWindowBridge(): void {
    if (typeof window === 'undefined') return;
    window.VickyAppBridge = {
      version: '2.2.0',
      schemaVersion: '1.0',
      listPlugins: () => this.getPlugins(),
      registerPlugin: (manifest) => this.importPluginManifest(manifest),
      unregisterPlugin: (pluginId) => this.deletePlugin(pluginId),
      dispatch: (appId, capability, payload, actionId) =>
        this.dispatchAppAction(appId, capability, payload, { actionId }),
      getRecords: (namespace) => this.getPluginRecords(namespace),
      onAction: (handler) => {
        const listener = (event: Event) => {
          const custom = event as CustomEvent<AppActionDispatch>;
          if (custom.detail) handler(custom.detail);
        };
        window.addEventListener('vicky:app-action', listener);
        return () => window.removeEventListener('vicky:app-action', listener);
      },
    };
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }

  // ---- JSON Plugin Manifest Registry ----
  public getPlugins(): VickyAppManifest[] {
    return [...this.plugins];
  }

  public getPluginById(id: string): VickyAppManifest | undefined {
    return this.plugins.find((p) => p.id === id);
  }

  public importPluginManifest(rawInput: string | unknown): PluginValidationResult {
    const result = validatePluginManifest(rawInput);
    if (!result.valid || !result.manifest) {
      return result;
    }

    const incoming = result.manifest;
    const existing = this.plugins.find((p) => p.id === incoming.id);
    const merged: VickyAppManifest = existing
      ? { ...incoming, builtIn: existing.builtIn }
      : incoming;

    if (existing) {
      this.plugins = this.plugins.map((p) => (p.id === incoming.id ? merged : p));
    } else {
      this.plugins = [...this.plugins, merged];
    }

    safeWrite(KEYS.plugins, this.plugins);
    this.emit();
    return { ...result, manifest: merged };
  }

  public exportPluginJson(id: string): string {
    const plugin = this.plugins.find((p) => p.id === id);
    if (!plugin) return '';
    return JSON.stringify(plugin, null, 2);
  }

  public updatePlugin(
    id: string,
    patch: {
      enabled?: boolean;
      uriTemplate?: string;
      webhookUrl?: string;
      internalEnabled?: boolean;
    },
  ): void {
    this.plugins = this.plugins.map((plugin) => {
      if (plugin.id !== id) return plugin;
      const nextActions = plugin.actions.map((action, idx) => {
        if (idx !== 0) return action;
        return {
          ...action,
          uriTemplate: patch.uriTemplate !== undefined ? patch.uriTemplate : action.uriTemplate,
          webhook:
            patch.webhookUrl !== undefined
              ? {
                  method: action.webhook?.method ?? 'POST',
                  url: patch.webhookUrl,
                  headers: action.webhook?.headers ?? { 'Content-Type': 'application/json' },
                  bodyTemplate: action.webhook?.bodyTemplate,
                }
              : action.webhook,
        };
      });
      return {
        ...plugin,
        enabled: patch.enabled !== undefined ? patch.enabled : plugin.enabled,
        internalHandler:
          patch.internalEnabled !== undefined
            ? { ...plugin.internalHandler, enabled: patch.internalEnabled }
            : plugin.internalHandler,
        actions: nextActions,
      };
    });
    safeWrite(KEYS.plugins, this.plugins);
    this.emit();
  }

  public deletePlugin(id: string): boolean {
    const target = this.plugins.find((p) => p.id === id);
    if (!target || target.builtIn) return false;
    this.plugins = this.plugins.filter((p) => p.id !== id);
    safeWrite(KEYS.plugins, this.plugins);
    this.emit();
    return true;
  }

  /**
   * Matches incoming natural-language commands (English or Arabic) against
   * custom imported JSON plugins and Crystal App triggers (longest trigger wins).
   */
  public findPluginActionByText(rawText: string): PluginActionMatch | null {
    const norm = normalizeArabic(rawText).toLowerCase().trim();
    if (!norm) return null;

    // Exclude generic system plugins handled by dedicated core NLU branches
    const CORE_RESERVED_IDS = new Set(['clock-api', 'settings-api', 'messaging-api']);
    const candidates = [
      // User-imported custom JSON plugins take top priority
      ...this.plugins.filter((p) => p.enabled && !p.builtIn),
      // Built-in non-reserved plugins (e.g. Crystal App)
      ...this.plugins.filter((p) => p.enabled && p.builtIn && !CORE_RESERVED_IDS.has(p.id)),
    ];

    let bestMatch: (PluginActionMatch & { score: number }) | null = null;

    for (const plugin of candidates) {
      for (const action of plugin.actions) {
        const allTriggers = [...(action.triggers?.en ?? []), ...(action.triggers?.ar ?? [])];
        for (const trigger of allTriggers) {
          const normTrigger = normalizeArabic(trigger).toLowerCase().trim();
          if (!normTrigger) continue;
          if (norm.includes(normTrigger)) {
            const score = normTrigger.length + (plugin.builtIn ? 0 : 100);
            if (!bestMatch || score > bestMatch.score) {
              bestMatch = { plugin, action, matchedTrigger: trigger, score };
            }
          }
        }
      }

      // Fallback: match plugin name or Arabic name directly if no specific action trigger matched
      const nameEn = normalizeArabic(plugin.name).toLowerCase().trim();
      const nameAr = normalizeArabic(plugin.arabicName).toLowerCase().trim();
      const matchedName =
        (nameEn && norm.includes(nameEn) && plugin.name) ||
        (nameAr && norm.includes(nameAr) && plugin.arabicName) ||
        '';
      if (matchedName && plugin.actions.length > 0) {
        const picked = this.pickBestActionForText(norm, plugin.actions);
        const score = matchedName.length + (plugin.builtIn ? 0 : 50);
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { plugin, action: picked, matchedTrigger: matchedName, score };
        }
      }
    }

    if (!bestMatch) return null;
    return {
      plugin: bestMatch.plugin,
      action: bestMatch.action,
      matchedTrigger: bestMatch.matchedTrigger,
    };
  }

  private pickBestActionForText(
    norm: string,
    actions: PluginActionDefinition[],
  ): PluginActionDefinition {
    if (norm.includes('timer') || norm.includes('موقت') || norm.includes('تايمر')) {
      const found = actions.find((a) => a.capability === 'set_timer');
      if (found) return found;
    }
    if (norm.includes('alarm') || norm.includes('منبه') || norm.includes('صحيني')) {
      const found = actions.find((a) => a.capability === 'set_alarm');
      if (found) return found;
    }
    if (
      norm.includes('note') ||
      norm.includes('نوت') ||
      norm.includes('ملاحظه') ||
      norm.includes('اكتب') ||
      norm.includes('احفظ')
    ) {
      const found = actions.find((a) => a.capability === 'create_note');
      if (found) return found;
    }
    return actions[0];
  }

  public formatPluginReply(
    plugin: VickyAppManifest,
    action: PluginActionDefinition | undefined,
    vars: Record<string, unknown>,
    lang: 'en' | 'ar',
  ): string {
    const template =
      lang === 'ar'
        ? action?.responseTemplateAr ?? plugin.internalHandler.responseTemplateAr
        : action?.responseTemplateEn ?? plugin.internalHandler.responseTemplateEn;

    if (template) {
      const interpolated = interpolateTemplate(template, vars, false).trim();
      if (interpolated) return interpolated;
    }

    const displayText = vars.text ? `: "${String(vars.text)}"` : '';
    return lang === 'ar'
      ? `تم تنفيذ الأمر عبر إضافة ${plugin.arabicName || plugin.name}${displayText}.`
      : `Executed action in ${plugin.name}${displayText}.`;
  }

  // ---- Internal Plugin Dispatch Engine ----
  public getDispatches(): AppActionDispatch[] {
    return [...this.dispatches];
  }

  public clearDispatches(): void {
    this.dispatches = [];
    safeWrite(KEYS.dispatches, this.dispatches);
    this.emit();
  }

  public async dispatchAppAction(
    appId: string,
    capability: AppCapabilityKind,
    payload: Record<string, unknown>,
    options?: {
      actionId?: string;
      summary?: string;
      overrideUri?: string;
    },
  ): Promise<AppActionDispatch | null> {
    const plugin =
      this.plugins.find((p) => p.id === appId) ??
      this.plugins.find(
        (p) => normalizeArabic(p.name).toLowerCase() === normalizeArabic(appId).toLowerCase(),
      );

    if (!plugin) return null;

    const action =
      (options?.actionId
        ? plugin.actions.find((a) => a.id === options.actionId)
        : undefined) ??
      plugin.actions.find((a) => a.capability === capability) ??
      plugin.actions[0];

    const templateVars: Record<string, unknown> = {
      capability,
      appId: plugin.id,
      actionId: action?.id ?? capability,
      text: payload.text !== undefined ? String(payload.text) : '',
      minutes: payload.minutes !== undefined ? payload.minutes : '',
      seconds:
        payload.seconds !== undefined
          ? payload.seconds
          : typeof payload.minutes === 'number'
            ? Math.round(payload.minutes * 60)
            : '',
      hour: payload.hour !== undefined ? payload.hour : '',
      minute: payload.minute !== undefined ? payload.minute : '',
      time24: payload.time24 !== undefined ? String(payload.time24) : '',
      phone: payload.phone !== undefined ? String(payload.phone) : '',
      value: payload.value !== undefined ? String(payload.value) : '',
    };

    // Persist record internally when internalHandler allows storage
    if (plugin.internalHandler.enabled && plugin.internalHandler.storeRecords !== false) {
      const recordText =
        String(payload.text ?? '').trim() ||
        (payload.minutes ? `${String(payload.minutes)}m timer` : action?.title ?? capability);
      this.addPluginRecord(
        plugin.id,
        plugin.name,
        plugin.internalHandler.storageNamespace || plugin.id,
        action?.id ?? capability,
        capability,
        recordText,
        payload,
      );
    }

    const rawUriTemplate = options?.overrideUri ?? action?.uriTemplate ?? '';
    const resolvedUri = options?.overrideUri
      ? options.overrideUri
      : interpolateTemplate(rawUriTemplate, templateVars, true);

    let transport: AppActionDispatch['transport'] = plugin.internalHandler.enabled
      ? 'internal'
      : 'intent';
    let status: AppActionDispatch['status'] = plugin.internalHandler.enabled
      ? 'executed'
      : 'dispatched';
    let webhookStatus: number | undefined;

    const summary =
      options?.summary ||
      `${plugin.name} → ${action?.title ?? capability.replace('_', ' ')}${
        payload.text ? `: ${String(payload.text)}` : ''
      }`;

    const entry: AppActionDispatch = {
      id: `disp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      appId: plugin.id,
      appName: plugin.name,
      actionId: action?.id,
      capability,
      summary,
      payload,
      uri: resolvedUri || undefined,
      transport,
      status,
      timestamp: new Date().toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }),
    };

    // Execute optional HTTP Webhook defined on the action
    const webhook = action?.webhook;
    if (plugin.enabled && webhook?.url?.trim()) {
      const targetUrl = interpolateTemplate(webhook.url.trim(), templateVars, true);
      const method = webhook.method ?? 'POST';
      const headers = {
        'Content-Type': 'application/json',
        ...(webhook.headers ?? {}),
      };
      const bodyPayload = webhook.bodyTemplate
        ? interpolateJsonObject(webhook.bodyTemplate, templateVars)
        : {
            source: 'vicky-ai',
            schemaVersion: '1.0',
            appId: plugin.id,
            actionId: action?.id,
            capability,
            payload,
            timestamp: new Date().toISOString(),
          };

      try {
        const res = await fetch(targetUrl, {
          method,
          headers,
          body: method === 'GET' ? undefined : JSON.stringify(bodyPayload),
        });
        webhookStatus = res.status;
        transport = plugin.internalHandler.enabled ? 'internal+webhook' : 'webhook';
        status = res.ok ? 'executed' : 'webhook_error';
      } catch {
        transport = plugin.internalHandler.enabled ? 'internal+webhook' : 'webhook';
        status = plugin.internalHandler.enabled ? 'executed' : 'webhook_error';
      }
      entry.transport = transport;
      entry.status = status;
      entry.webhookStatus = webhookStatus;
    }

    // Broadcast CustomEvent for web SDK + Android WebView JavascriptInterface
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent<AppActionDispatch>('vicky:app-action', { detail: entry }),
      );
      try {
        window.AndroidBridge?.onVickyAction?.(JSON.stringify(entry));
      } catch {
        // Ignore bridge invocation errors outside Android WebView
      }
    }

    this.dispatches = [entry, ...this.dispatches].slice(0, 40);
    safeWrite(KEYS.dispatches, this.dispatches);
    this.emit();
    return entry;
  }

  // ---- Internal Plugin Records Store ----
  public getPluginRecords(namespace?: string): InternalPluginRecord[] {
    if (!namespace) return [...this.records];
    return this.records.filter((r) => r.namespace === namespace);
  }

  public addPluginRecord(
    appId: string,
    appName: string,
    namespace: string,
    actionId: string,
    capability: AppCapabilityKind,
    text: string,
    data: Record<string, unknown> = {},
  ): InternalPluginRecord {
    const item: InternalPluginRecord = {
      id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      appId,
      appName,
      namespace,
      actionId,
      capability,
      text: text.trim(),
      data,
      createdAt: new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    this.records = [item, ...this.records].slice(0, 100);
    safeWrite(KEYS.records, this.records);
    this.emit();
    return item;
  }

  public deletePluginRecord(id: string): void {
    this.records = this.records.filter((r) => r.id !== id);
    safeWrite(KEYS.records, this.records);
    this.emit();
  }

  // ---- Routines ----
  public getRoutines(): RoutineItem[] {
    return [...this.routines];
  }

  public findRoutineByText(rawText: string): RoutineItem | null {
    const norm = normalizeArabic(rawText).toLowerCase();
    for (const routine of this.routines) {
      const en = normalizeArabic(routine.englishTrigger).toLowerCase();
      const ar = normalizeArabic(routine.arabicTrigger).toLowerCase();
      const nm = normalizeArabic(routine.name).toLowerCase();
      if ((en && norm.includes(en)) || (ar && norm.includes(ar)) || (nm && norm.includes(nm))) {
        return routine;
      }
    }
    return null;
  }

  public addCustomRoutine(
    name: string,
    englishTrigger: string,
    arabicTrigger: string,
    commands: string[],
  ): RoutineItem {
    const steps = commands
      .map((cmd) => cmd.trim())
      .filter(Boolean)
      .map((cmd) => ({ command: cmd, description: cmd }));
    const item: RoutineItem = {
      id: `routine_${Date.now()}`,
      name: name.trim(),
      englishTrigger: englishTrigger.trim() || name.trim().toLowerCase(),
      arabicTrigger: arabicTrigger.trim() || name.trim(),
      summary: steps.map((s) => s.command).join(' → '),
      steps,
      builtIn: false,
    };
    this.routines = [...this.routines, item];
    safeWrite(KEYS.routines, this.routines);
    this.emit();
    return item;
  }

  public deleteRoutine(id: string): void {
    this.routines = this.routines.filter((r) => r.id !== id || r.builtIn);
    safeWrite(KEYS.routines, this.routines);
    this.emit();
  }

  // ---- Contacts & Message Deep Links ----
  public getContacts(): ContactItem[] {
    return [...this.contacts];
  }

  public addContact(contact: Omit<ContactItem, 'id'>): ContactItem {
    const item: ContactItem = {
      ...contact,
      id: `contact_${Date.now()}`,
    };
    this.contacts = [item, ...this.contacts];
    safeWrite(KEYS.contacts, this.contacts);
    this.emit();
    return item;
  }

  public deleteContact(id: string): void {
    this.contacts = this.contacts.filter((c) => c.id !== id);
    safeWrite(KEYS.contacts, this.contacts);
    this.emit();
  }

  public findContact(query: string): ContactItem | null {
    const norm = normalizeArabic(query).toLowerCase().trim();
    if (!norm) return null;

    const strippedL = norm.startsWith('ل') && norm.length >= 3 ? norm.slice(1) : norm;

    for (const c of this.contacts) {
      const enName = normalizeArabic(c.name).toLowerCase();
      const arName = c.arabicName ? normalizeArabic(c.arabicName).toLowerCase() : '';
      const digits = c.phone.replace(/[^0-9]/g, '');
      const queryDigits = norm.replace(/[^0-9]/g, '');

      if (
        enName === norm ||
        enName === strippedL ||
        (arName && (arName === norm || arName === strippedL)) ||
        (queryDigits && digits && queryDigits === digits)
      ) {
        return c;
      }
    }

    for (const c of this.contacts) {
      const enName = normalizeArabic(c.name).toLowerCase();
      const arName = c.arabicName ? normalizeArabic(c.arabicName).toLowerCase() : '';
      if (
        (enName && (norm.includes(enName) || strippedL.includes(enName))) ||
        (arName && (norm.includes(arName) || strippedL.includes(arName)))
      ) {
        return c;
      }
    }
    return null;
  }

  public buildMessageDraft(
    recipientInput: string,
    messageText: string,
    channel: 'whatsapp' | 'sms' | 'email',
  ): MessageDraft {
    const cleanInput = recipientInput.trim();
    const contact = this.findContact(cleanInput);
    const recipientName = contact
      ? contact.arabicName && /[\u0600-\u06FF]/.test(cleanInput)
        ? `${contact.arabicName} (${contact.name})`
        : contact.name
      : cleanInput || 'Contact';
    const rawPhone = contact?.phone ?? cleanInput.replace(/[^0-9+]/g, '');
    const digitsPhone = (contact?.whatsapp ?? rawPhone).replace(/[^0-9]/g, '');
    const cleanBody = messageText.trim() || 'Hello from Vicky AI';
    const encodedBody = encodeURIComponent(cleanBody);

    let actionUrl = `sms:${rawPhone}?body=${encodedBody}`;
    let smsFallbackUrl: string | undefined;

    if (channel === 'whatsapp') {
      actionUrl = digitsPhone
        ? `https://wa.me/${digitsPhone}?text=${encodedBody}`
        : `https://api.whatsapp.com/send?text=${encodedBody}`;
      smsFallbackUrl = `sms:${rawPhone}?body=${encodedBody}`;
    } else if (channel === 'email') {
      const emailAddr = contact?.email ?? '';
      actionUrl = `mailto:${emailAddr}?subject=${encodeURIComponent('Message via Vicky AI')}&body=${encodedBody}`;
    }

    return {
      recipientName,
      phone: rawPhone || 'Not saved',
      message: cleanBody,
      channel,
      actionUrl,
      smsFallbackUrl,
    };
  }
}
