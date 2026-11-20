import {
  AppCapabilityKind,
  PluginActionDefinition,
  PluginValidationResult,
  VickyAppManifest,
} from '../types/assistant';

export const PLUGIN_SCHEMA_URL = 'https://vicky-ai.dev/schemas/plugin-v1.json';

const ALLOWED_CAPABILITIES: AppCapabilityKind[] = [
  'set_alarm',
  'set_timer',
  'create_note',
  'device_setting',
  'send_message',
  'custom_action',
];

/**
 * Validates any raw JSON string or parsed object against Vicky Plugin Schema v1.0.
 */
export function validatePluginManifest(input: string | unknown): PluginValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  let parsed: unknown = input;
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) {
      return { valid: false, errors: ['JSON input is empty.'], warnings: [] };
    }
    try {
      parsed = JSON.parse(trimmed);
    } catch (err) {
      return {
        valid: false,
        errors: [
          `Invalid JSON syntax: ${err instanceof Error ? err.message : 'parse failed'}`,
        ],
        warnings: [],
      };
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      valid: false,
      errors: ['Root manifest must be a JSON object.'],
      warnings: [],
    };
  }

  const obj = parsed as Record<string, unknown>;

  if (obj.schemaVersion !== '1.0') {
    errors.push('Field "schemaVersion" must be "1.0".');
  }

  if (typeof obj.id !== 'string' || !/^[a-z0-9][a-z0-9_-]{1,48}$/i.test(obj.id.trim())) {
    errors.push('Field "id" must be a slug (2-49 alphanumeric, dash, or underscore characters).');
  }

  if (typeof obj.name !== 'string' || !obj.name.trim()) {
    errors.push('Field "name" is required and must be a non-empty string.');
  }

  if (typeof obj.description !== 'string' || !obj.description.trim()) {
    warnings.push('Field "description" is missing; a default description will be used.');
  }

  if (!Array.isArray(obj.actions) || obj.actions.length === 0) {
    errors.push('Field "actions" must be a non-empty array of action definitions.');
  }

  const validatedActions: PluginActionDefinition[] = [];
  const discoveredCaps = new Set<AppCapabilityKind>();

  if (Array.isArray(obj.actions)) {
    obj.actions.forEach((rawAct, idx) => {
      if (!rawAct || typeof rawAct !== 'object') {
        errors.push(`actions[${idx}] must be an object.`);
        return;
      }
      const act = rawAct as Record<string, unknown>;
      const actId = typeof act.id === 'string' && act.id.trim() ? act.id.trim() : '';
      if (!actId) {
        errors.push(`actions[${idx}].id is required.`);
      }

      const cap = act.capability as AppCapabilityKind;
      if (!ALLOWED_CAPABILITIES.includes(cap)) {
        errors.push(
          `actions[${idx}].capability must be one of: ${ALLOWED_CAPABILITIES.join(', ')}.`,
        );
      } else {
        discoveredCaps.add(cap);
      }

      const triggersObj = (act.triggers ?? {}) as Record<string, unknown>;
      const triggersEn = Array.isArray(triggersObj.en)
        ? triggersObj.en.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
        : [];
      const triggersAr = Array.isArray(triggersObj.ar)
        ? triggersObj.ar.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
        : [];

      if (triggersEn.length === 0 && triggersAr.length === 0) {
        errors.push(`actions[${idx}].triggers must include at least one English or Arabic trigger.`);
      }

      let webhook: PluginActionDefinition['webhook'];
      if (act.webhook && typeof act.webhook === 'object') {
        const wh = act.webhook as Record<string, unknown>;
        const method = wh.method === 'GET' || wh.method === 'PUT' ? wh.method : 'POST';
        const url = typeof wh.url === 'string' ? wh.url.trim() : '';
        if (url && !/^https?:\/\//i.test(url)) {
          errors.push(`actions[${idx}].webhook.url must start with http:// or https://.`);
        }
        webhook = {
          method,
          url,
          headers:
            wh.headers && typeof wh.headers === 'object'
              ? (wh.headers as Record<string, string>)
              : { 'Content-Type': 'application/json' },
          bodyTemplate:
            wh.bodyTemplate && typeof wh.bodyTemplate === 'object'
              ? (wh.bodyTemplate as Record<string, unknown>)
              : undefined,
        };
      }

      validatedActions.push({
        id: actId || `action_${idx + 1}`,
        capability: ALLOWED_CAPABILITIES.includes(cap) ? cap : 'custom_action',
        title: typeof act.title === 'string' && act.title.trim() ? act.title.trim() : actId || `Action ${idx + 1}`,
        titleAr: typeof act.titleAr === 'string' ? act.titleAr.trim() : undefined,
        triggers: { en: triggersEn, ar: triggersAr },
        parameters: Array.isArray(act.parameters)
          ? (act.parameters as PluginActionDefinition['parameters'])
          : undefined,
        uriTemplate: typeof act.uriTemplate === 'string' ? act.uriTemplate.trim() : undefined,
        webhook,
        responseTemplateEn:
          typeof act.responseTemplateEn === 'string' ? act.responseTemplateEn.trim() : undefined,
        responseTemplateAr:
          typeof act.responseTemplateAr === 'string' ? act.responseTemplateAr.trim() : undefined,
      });
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  const rawInternal = (obj.internalHandler ?? {}) as Record<string, unknown>;
  const safeId = String(obj.id).trim().toLowerCase();
  const explicitCaps = Array.isArray(obj.capabilities)
    ? obj.capabilities.filter((c): c is AppCapabilityKind =>
        ALLOWED_CAPABILITIES.includes(c as AppCapabilityKind),
      )
    : [];
  const mergedCaps = Array.from(new Set([...explicitCaps, ...discoveredCaps]));

  const manifest: VickyAppManifest = {
    $schema: PLUGIN_SCHEMA_URL,
    schemaVersion: '1.0',
    id: safeId,
    name: String(obj.name).trim(),
    arabicName:
      typeof obj.arabicName === 'string' && obj.arabicName.trim()
        ? obj.arabicName.trim()
        : String(obj.name).trim(),
    version: typeof obj.version === 'string' && obj.version.trim() ? obj.version.trim() : '1.0.0',
    author: typeof obj.author === 'string' && obj.author.trim() ? obj.author.trim() : 'Custom',
    description:
      typeof obj.description === 'string' && obj.description.trim()
        ? obj.description.trim()
        : `Vicky AI plugin for ${String(obj.name).trim()}`,
    descriptionAr:
      typeof obj.descriptionAr === 'string' && obj.descriptionAr.trim()
        ? obj.descriptionAr.trim()
        : undefined,
    enabled: obj.enabled !== false,
    builtIn: false,
    capabilities: mergedCaps.length > 0 ? mergedCaps : ['custom_action'],
    internalHandler: {
      enabled: rawInternal.enabled !== false,
      storageNamespace:
        typeof rawInternal.storageNamespace === 'string' && rawInternal.storageNamespace.trim()
          ? rawInternal.storageNamespace.trim()
          : safeId,
      storeRecords: rawInternal.storeRecords !== false,
      responseTemplateEn:
        typeof rawInternal.responseTemplateEn === 'string'
          ? rawInternal.responseTemplateEn.trim()
          : undefined,
      responseTemplateAr:
        typeof rawInternal.responseTemplateAr === 'string'
          ? rawInternal.responseTemplateAr.trim()
          : undefined,
    },
    actions: validatedActions,
  };

  return { valid: true, errors: [], warnings, manifest };
}

/**
 * Ready-to-import advanced JSON plugin presets for the gallery & developer docs.
 */
export const PRESET_PLUGIN_TEMPLATES: Array<{
  key: string;
  labelEn: string;
  labelAr: string;
  manifest: VickyAppManifest;
}> = [
  {
    key: 'home-assistant',
    labelEn: 'Home Assistant Smart Home',
    labelAr: 'البيت الذكي (Home Assistant)',
    manifest: {
      $schema: PLUGIN_SCHEMA_URL,
      schemaVersion: '1.0',
      id: 'home-assistant',
      name: 'Home Assistant',
      arabicName: 'البيت الذكي',
      version: '1.0.0',
      author: 'Vicky Templates',
      description: 'Control smart lights, scenes, and AC via Home Assistant webhook APIs.',
      descriptionAr: 'التحكم بالإضاءة والتكييف والمشاهد الذكية عبر واجهة Home Assistant.',
      enabled: true,
      capabilities: ['custom_action'],
      internalHandler: {
        enabled: true,
        storageNamespace: 'home_assistant',
        storeRecords: true,
        responseTemplateEn: 'Sent smart home command: {{text}}',
        responseTemplateAr: 'تم إرسال أمر البيت الذكي: {{text}}',
      },
      actions: [
        {
          id: 'toggle_lights',
          capability: 'custom_action',
          title: 'Control Lights',
          titleAr: 'التحكم بالإضاءة',
          triggers: {
            en: ['lights', 'living room light', 'bedroom light', 'home assistant'],
            ar: ['شغل النور', 'اطفي النور', 'نور الصالة', 'البيت الذكي'],
          },
          parameters: [{ name: 'text', type: 'string', required: true, source: 'remainder' }],
          uriTemplate: 'homeassistant://navigate/lovelace',
          webhook: {
            method: 'POST',
            url: 'http://homeassistant.local:8123/api/webhook/vicky_lights',
            headers: { 'Content-Type': 'application/json' },
            bodyTemplate: { command: '{{text}}', source: 'vicky-ai' },
          },
          responseTemplateEn: 'Home Assistant lights command sent: {{text}}',
          responseTemplateAr: 'تم إرسال أمر الإضاءة إلى البيت الذكي: {{text}}',
        },
      ],
    },
  },
  {
    key: 'notion-capture',
    labelEn: 'Notion Quick Capture',
    labelAr: 'ملاحظات نوشن (Notion)',
    manifest: {
      $schema: PLUGIN_SCHEMA_URL,
      schemaVersion: '1.0',
      id: 'notion-capture',
      name: 'Notion Capture',
      arabicName: 'نوشن',
      version: '1.0.0',
      author: 'Vicky Templates',
      description: 'Capture voice notes and tasks into internal storage and sync with a Notion webhook.',
      descriptionAr: 'حفظ الملاحظات والمهام الصوتية داخلياً ومزامنتها مع نوشن عبر Webhook.',
      enabled: true,
      capabilities: ['create_note'],
      internalHandler: {
        enabled: true,
        storageNamespace: 'notion',
        storeRecords: true,
      },
      actions: [
        {
          id: 'save_notion_note',
          capability: 'create_note',
          title: 'Save to Notion',
          titleAr: 'حفظ في نوشن',
          triggers: {
            en: ['add to notion', 'notion note', 'save in notion'],
            ar: ['نوشن', 'احفظ في نوشن', 'اكتب في نوشن'],
          },
          parameters: [{ name: 'text', type: 'string', required: true, source: 'remainder' }],
          uriTemplate: 'notion://www.notion.so',
          webhook: {
            method: 'POST',
            url: '',
            headers: { 'Content-Type': 'application/json' },
            bodyTemplate: { title: '{{text}}', database: 'inbox' },
          },
          responseTemplateEn: 'Captured in Notion: "{{text}}"',
          responseTemplateAr: 'تم الحفظ في نوشن: "{{text}}"',
        },
      ],
    },
  },
  {
    key: 'pomodoro-pro',
    labelEn: 'Pomodoro Focus Timer API',
    labelAr: 'مؤقت بومودورو (Pomodoro API)',
    manifest: {
      $schema: PLUGIN_SCHEMA_URL,
      schemaVersion: '1.0',
      id: 'pomodoro-pro',
      name: 'Pomodoro Pro',
      arabicName: 'بومودورو',
      version: '1.0.0',
      author: 'Vicky Templates',
      description: 'Dispatch focus sessions and break timers to external Pomodoro apps or Android Clock.',
      descriptionAr: 'إرسال جلسات التركيز والاستراحة إلى تطبيقات بومودورو أو ساعة أندرويد.',
      enabled: true,
      capabilities: ['set_timer'],
      internalHandler: {
        enabled: true,
        storageNamespace: 'pomodoro',
        storeRecords: true,
      },
      actions: [
        {
          id: 'start_pomodoro',
          capability: 'set_timer',
          title: 'Start Focus Timer',
          titleAr: 'بدء جلسة تركيز',
          triggers: {
            en: ['pomodoro', 'start focus session', 'study timer'],
            ar: ['بومودورو', 'جلسة تركيز', 'مؤقت مذاكرة'],
          },
          parameters: [
            { name: 'minutes', type: 'number', source: 'duration_minutes', defaultValue: 25 },
          ],
          uriTemplate:
            'intent:#Intent;action=android.intent.action.SET_TIMER;i.android.intent.extra.alarm.LENGTH={{seconds}};S.android.intent.extra.alarm.MESSAGE=Pomodoro;end',
          responseTemplateEn: 'Started {{minutes}}-minute Pomodoro session.',
          responseTemplateAr: 'تم بدء جلسة بومودورو لمدة {{minutes}} دقيقة.',
        },
      ],
    },
  },
];

/**
 * Generates an AI system prompt that users can copy into ANY external LLM
 * (Gemini, ChatGPT, Claude, Ollama) to get back a 100% valid Vicky Plugin JSON manifest.
 */
export function buildAiPluginPrompt(userGoal?: string): string {
  const goalBlock = userGoal?.trim()
    ? `\nApp / Automation Goal:\n${userGoal.trim()}\n`
    : '\nApp / Automation Goal:\n[Describe your app, triggers, and actions here]\n';

  return `Generate ONLY a valid JSON object conforming strictly to Vicky Plugin Schema v1.0 (no markdown fences, no commentary).

Schema Rules:
- "schemaVersion": "1.0"
- "id": lowercase slug (2-48 chars, e.g. "my-notes-app")
- "name": English app name
- "arabicName": Arabic app name
- "version": "1.0.0"
- "description": concise English description
- "descriptionAr": concise Arabic description
- "enabled": true
- "capabilities": array using ONLY: "create_note" | "set_timer" | "set_alarm" | "device_setting" | "send_message" | "custom_action"
- "internalHandler": { "enabled": true, "storageNamespace": "<slug>", "storeRecords": true }
- "actions": non-empty array of:
  {
    "id": "action_slug",
    "capability": "create_note" | "set_timer" | "set_alarm" | "custom_action",
    "title": "Action Title",
    "titleAr": "اسم الأمر",
    "triggers": { "en": ["english phrase"], "ar": ["عبارة عربية"] },
    "parameters": [{ "name": "text", "type": "string", "required": true, "source": "remainder" }],
    "uriTemplate": "app://action?text={{text}}&minutes={{minutes}}",
    "webhook": { "method": "POST", "url": "", "headers": { "Content-Type": "application/json" }, "bodyTemplate": { "text": "{{text}}" } },
    "responseTemplateEn": "Done: {{text}}",
    "responseTemplateAr": "تم التنفيذ: {{text}}"
  }

Available template placeholders: {{text}}, {{minutes}}, {{seconds}}, {{hour}}, {{minute}}, {{time24}}, {{value}}, {{capability}}, {{phone}}.
${goalBlock}`;
}

/**
 * Instant offline fallback manifest synthesizer when Smart Cloud AI is not configured.
 */
export function synthesizeOfflinePluginManifest(description: string): VickyAppManifest {
  const clean = description.trim();
  const lower = clean.toLowerCase();
  const hasTimer = /timer|pomodoro|countdown|مؤقت|موقت|تايمر|دقيق/.test(lower);
  const hasAlarm = /alarm|wake|منبه|صحيني/.test(lower);
  const hasNote = /note|todo|task|list|journal|نوت|ملاحظ|مهم|قائم/.test(lower);

  const capabilities: AppCapabilityKind[] = [];
  if (hasNote) capabilities.push('create_note');
  if (hasTimer) capabilities.push('set_timer');
  if (hasAlarm) capabilities.push('set_alarm');
  if (capabilities.length === 0) capabilities.push('custom_action');

  const urlMatch = clean.match(/https?:\/\/[^\s]+/i);
  const schemeMatch = clean.match(/([a-z][a-z0-9+.-]*:\/\/[^\s]+)/i);
  const englishWords = clean.match(/[A-Za-z][A-Za-z0-9]{2,}/g) ?? [];
  const baseName = englishWords[0]
    ? `${englishWords[0][0].toUpperCase()}${englishWords[0].slice(1)}`
    : 'Custom App';
  const slug =
    baseName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || `plugin-${Date.now().toString().slice(-4)}`;

  const actions: PluginActionDefinition[] = capabilities.map((cap) => ({
    id: `${slug}_${cap}`,
    capability: cap,
    title:
      cap === 'create_note'
        ? `Save Note in ${baseName}`
        : cap === 'set_timer'
          ? `Start Timer in ${baseName}`
          : cap === 'set_alarm'
            ? `Set Alarm in ${baseName}`
            : `Run ${baseName} Action`,
    titleAr:
      cap === 'create_note'
        ? `حفظ ملاحظة في ${baseName}`
        : cap === 'set_timer'
          ? `تشغيل مؤقت في ${baseName}`
          : cap === 'set_alarm'
            ? `ضبط منبه في ${baseName}`
            : `تشغيل أمر في ${baseName}`,
    triggers: {
      en: [
        baseName.toLowerCase(),
        cap === 'create_note'
          ? `note in ${baseName.toLowerCase()}`
          : cap === 'set_timer'
            ? `timer in ${baseName.toLowerCase()}`
            : `run ${baseName.toLowerCase()}`,
      ],
      ar: [
        baseName,
        cap === 'create_note'
          ? `نوت في ${baseName}`
          : cap === 'set_timer'
            ? `مؤقت في ${baseName}`
            : `شغل ${baseName}`,
      ],
    },
    parameters:
      cap === 'set_timer'
        ? [{ name: 'minutes', type: 'number', source: 'duration_minutes', defaultValue: 5 }]
        : [{ name: 'text', type: 'string', required: true, source: 'remainder' }],
    uriTemplate: schemeMatch?.[1] ?? `${slug}://action?type={{capability}}&text={{text}}&minutes={{minutes}}`,
    webhook: {
      method: 'POST',
      url: urlMatch?.[0] ?? '',
      headers: { 'Content-Type': 'application/json' },
      bodyTemplate: { app: slug, action: cap, text: '{{text}}', minutes: '{{minutes}}' },
    },
    responseTemplateEn: `Executed ${cap.replace('_', ' ')} in ${baseName}: {{text}}`,
    responseTemplateAr: `تم التنفيذ داخل ${baseName}: {{text}}`,
  }));

  return {
    $schema: PLUGIN_SCHEMA_URL,
    schemaVersion: '1.0',
    id: slug,
    name: baseName,
    arabicName: baseName,
    version: '1.0.0',
    author: 'Vicky Template Generator',
    description: clean || `Custom plugin for ${baseName}`,
    descriptionAr: clean || `إضافة مخصصة لتطبيق ${baseName}`,
    enabled: true,
    capabilities,
    internalHandler: {
      enabled: true,
      storageNamespace: slug.replace(/-/g, '_'),
      storeRecords: true,
    },
    actions,
  };
}

/**
 * Calls server-side Gemini Flash-Lite to generate a Vicky Plugin v1.0 JSON manifest,
 * transparently falling back to the local synthesizer only if cloud AI is unconfigured (503).
 */
export async function generatePluginManifestWithAI(
  prompt: string,
): Promise<{ manifest: VickyAppManifest; source: 'ai' | 'local-template' }> {
  try {
    const res = await fetch('/api/plugins/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (res.ok) {
      const data = (await res.json()) as { manifest?: unknown };
      const check = validatePluginManifest(data.manifest);
      if (check.valid && check.manifest) {
        return { manifest: check.manifest, source: 'ai' };
      }
    }
  } catch {
    // Fall through to deterministic local synthesizer
  }

  return {
    manifest: synthesizeOfflinePluginManifest(prompt),
    source: 'local-template',
  };
}
