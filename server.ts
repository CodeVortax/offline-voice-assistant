import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const MODEL_NAME = 'gemini-3.1-flash-lite';

function createGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface AskRequestBody {
  query?: string;
  language?: string;
  contacts?: string[];
  routines?: string[];
  apps?: string[];
  currentTimeIso?: string;
}

const assistantResponseSchema = {
  type: Type.OBJECT,
  properties: {
    reply: {
      type: Type.STRING,
      description:
        'A concise, helpful, natural spoken response (1-2 short sentences) in the exact same language as the user (Arabic, English, or Hindi).',
    },
    action: {
      type: Type.STRING,
      description:
        'Structured intent to execute: none, set_alarm, set_timer, send_message, open_app, run_routine, add_note, navigate, device_setting, or app_api.',
    },
    time24: {
      type: Type.STRING,
      description: '24-hour HH:MM time when action is set_alarm (e.g. "07:30").',
    },
    minutes: {
      type: Type.NUMBER,
      description: 'Duration in minutes when action is set_timer or app_api timer.',
    },
    label: {
      type: Type.STRING,
      description: 'Label or title for alarm, timer, or note.',
    },
    recipient: {
      type: Type.STRING,
      description: 'Contact name or phone number when action is send_message.',
    },
    messageText: {
      type: Type.STRING,
      description: 'Message body when action is send_message.',
    },
    channel: {
      type: Type.STRING,
      description: 'Messaging channel: whatsapp, sms, or email.',
    },
    appName: {
      type: Type.STRING,
      description:
        'Target app name for open_app or app_api (e.g. crystal, clock, whatsapp, youtube, camera, maps, spotify, gmail, or a custom registered plugin).',
    },
    routineName: {
      type: Type.STRING,
      description: 'Routine name when action is run_routine.',
    },
    destination: {
      type: Type.STRING,
      description: 'Destination address or place name when action is navigate.',
    },
    settingName: {
      type: Type.STRING,
      description:
        'Target device setting when action is device_setting: wifi, bluetooth, dnd, flashlight, airplane, battery_saver, brightness, volume, dark_mode, or theme_seed.',
    },
    settingState: {
      type: Type.STRING,
      description: 'Target state for device_setting: on, off, up, down, or mute.',
    },
    settingValue: {
      type: Type.NUMBER,
      description: 'Optional numeric percentage (0-100) for brightness or volume.',
    },
    apiCapability: {
      type: Type.STRING,
      description:
        'Capability to invoke when action is app_api: create_note, set_timer, set_alarm, or custom_action.',
    },
    apiText: {
      type: Type.STRING,
      description: 'Payload text when action is app_api.',
    },
  },
  required: ['reply', 'action'],
};

const pluginManifestSchema = {
  type: Type.OBJECT,
  properties: {
    schemaVersion: { type: Type.STRING, description: 'Must always be "1.0".' },
    id: { type: Type.STRING, description: 'Lowercase slug ID (e.g. "home-lights").' },
    name: { type: Type.STRING, description: 'English plugin name.' },
    arabicName: { type: Type.STRING, description: 'Arabic plugin name.' },
    version: { type: Type.STRING, description: 'Semantic version, e.g. "1.0.0".' },
    description: { type: Type.STRING, description: 'Concise English description.' },
    descriptionAr: { type: Type.STRING, description: 'Concise Arabic description.' },
    enabled: { type: Type.BOOLEAN },
    capabilities: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Subset of: create_note, set_timer, set_alarm, device_setting, send_message, custom_action.',
    },
    internalHandler: {
      type: Type.OBJECT,
      properties: {
        enabled: { type: Type.BOOLEAN },
        storageNamespace: { type: Type.STRING },
        storeRecords: { type: Type.BOOLEAN },
        responseTemplateEn: { type: Type.STRING },
        responseTemplateAr: { type: Type.STRING },
      },
      required: ['enabled', 'storageNamespace'],
    },
    actions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          capability: { type: Type.STRING },
          title: { type: Type.STRING },
          titleAr: { type: Type.STRING },
          triggers: {
            type: Type.OBJECT,
            properties: {
              en: { type: Type.ARRAY, items: { type: Type.STRING } },
              ar: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['en', 'ar'],
          },
          uriTemplate: { type: Type.STRING },
          responseTemplateEn: { type: Type.STRING },
          responseTemplateAr: { type: Type.STRING },
        },
        required: ['id', 'capability', 'title', 'triggers'],
      },
    },
  },
  required: ['schemaVersion', 'id', 'name', 'arabicName', 'description', 'capabilities', 'internalHandler', 'actions'],
};

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/assistant/status', (_req: Request, res: Response) => {
    res.json({
      aiAvailable: Boolean(process.env.GEMINI_API_KEY?.trim()),
      model: MODEL_NAME,
    });
  });

  app.post('/api/assistant/ask', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as AskRequestBody;
    const query = body.query?.trim();
    if (!query) {
      res.status(400).json({ error: 'Query is required.' });
      return;
    }

    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'Smart Cloud AI is not configured yet. Add GEMINI_API_KEY in Settings > Secrets, or continue using Fast Offline mode.',
        code: 'API_KEY_MISSING',
      });
      return;
    }

    const contactsList = Array.isArray(body.contacts)
      ? body.contacts.slice(0, 20).join(', ')
      : '';
    const routinesList = Array.isArray(body.routines)
      ? body.routines.slice(0, 12).join(', ')
      : '';
    const appsList = Array.isArray(body.apps)
      ? body.apps.slice(0, 16).join(', ')
      : '';

    const systemInstruction = [
      'You are Vicky, a fast, smart, voice-first Android Google Assistant-style personal assistant.',
      'Always reply in the exact language/dialect the user spoke (Arabic if Arabic, Hindi if Hindi, English if English).',
      'Keep replies brief, clear, and voice-friendly (1 to 2 short sentences maximum, no markdown bullets or emojis).',
      'You can dispatch alarms and timers to the Clock app or Crystal app, change device settings (wifi, bluetooth, dnd, flashlight, airplane, battery_saver, brightness, volume, dark_mode), send WhatsApp/SMS/Email messages, run routines, navigate, or invoke registered App API plugins.',
      `Current local time ISO: ${body.currentTimeIso || new Date().toISOString()}.`,
      contactsList ? `Saved contacts: ${contactsList}.` : '',
      routinesList ? `Available routines: ${routinesList}.` : '',
      appsList ? `Registered App API plugins: ${appsList}.` : '',
    ]
      .filter(Boolean)
      .join(' ');

    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: query,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          responseMimeType: 'application/json',
          responseSchema: assistantResponseSchema,
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({ error: 'Empty response received from AI model.' });
        return;
      }

      const parsed = JSON.parse(rawText) as Record<string, unknown>;
      res.json({
        ...parsed,
        model: MODEL_NAME,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI request failed.';
      const status =
        message.includes('429') || message.includes('RESOURCE_EXHAUSTED')
          ? 429
          : message.includes('403') || message.includes('PERMISSION_DENIED')
            ? 403
            : message.includes('400') || message.includes('API_KEY_INVALID')
              ? 400
              : 500;
      res.status(status).json({ error: message });
    }
  });

  /**
   * Generates a strictly valid Vicky Plugin Schema v1.0 JSON manifest from natural language.
   */
  app.post('/api/plugins/generate', async (req: Request, res: Response) => {
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    if (!prompt) {
      res.status(400).json({ error: 'Plugin description prompt is required.' });
      return;
    }

    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Cloud AI plugin generator requires GEMINI_API_KEY in Settings > Secrets.',
        code: 'API_KEY_MISSING',
      });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Design a complete Vicky AI Plugin Schema v1.0 JSON manifest for this user request:\n${prompt}`,
        config: {
          systemInstruction:
            'You are a developer architect creating Vicky AI Plugin Schema v1.0 JSON manifests. Always provide both English and Arabic voice triggers, clear response templates using {{text}} or {{minutes}}, valid capability names (create_note, set_timer, set_alarm, device_setting, send_message, custom_action), and realistic URI templates.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          responseMimeType: 'application/json',
          responseSchema: pluginManifestSchema,
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({ error: 'Empty manifest returned by AI.' });
        return;
      }

      const manifest = JSON.parse(rawText) as Record<string, unknown>;
      res.json({ manifest, model: MODEL_NAME });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Plugin generation failed.';
      res.status(500).json({ error: message });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Vicky AI server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
