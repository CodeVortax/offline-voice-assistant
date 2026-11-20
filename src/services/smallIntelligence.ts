import { CloudAIActionResponse, DetectedLanguage } from '../types/assistant';
import { detectTextLanguage, normalizeArabic } from './arabicNlu';

export interface LocalIntelligenceResult {
  handled: boolean;
  reply: string;
  lang: DetectedLanguage;
}

interface RecentMathMemory {
  expression: string;
  value: number;
  timestamp: number;
}

let lastMathMemory: RecentMathMemory | null = null;

/**
 * Safe recursive-descent math parser supporting:
 * +, -, *, /, ^ (power), %, parentheses, unary +/-, sqrt(...) and implicit multiplication
 * e.g. "25 * 15 * sqrt(3)" or "25 * 15 / 2".
 */
function evaluateMathExpression(expr: string): number | null {
  const rawTokens = expr.match(/(sqrt|\d+(?:\.\d+)?|[+\-*/^()%])/gi);
  if (!rawTokens || rawTokens.length === 0) return null;

  // Insert implicit '*' for patterns like "15 sqrt 3", "2 (3+4)", "(2+3) (4+5)", "3 sqrt(2)"
  const tokens: string[] = [];
  for (let i = 0; i < rawTokens.length; i += 1) {
    const curr = rawTokens[i].toLowerCase();
    const prev = tokens.length > 0 ? tokens[tokens.length - 1] : null;
    if (prev !== null) {
      const prevIsValue = /^\d/.test(prev) || prev === ')' || prev === '%';
      const currStartsValue = curr === '(' || curr === 'sqrt';
      if (prevIsValue && currStartsValue) {
        tokens.push('*');
      }
    }
    tokens.push(curr);
  }

  let pos = 0;

  const parseExpression = (): number => {
    let left = parseTerm();
    while (pos < tokens.length && (tokens[pos] === '+' || tokens[pos] === '-')) {
      const op = tokens[pos++];
      const right = parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  };

  const parseTerm = (): number => {
    let left = parsePower();
    while (pos < tokens.length && (tokens[pos] === '*' || tokens[pos] === '/')) {
      const op = tokens[pos++];
      const right = parsePower();
      if (op === '/' && right === 0) {
        throw new Error('Division by zero');
      }
      left = op === '*' ? left * right : left / right;
    }
    return left;
  };

  const parsePower = (): number => {
    let base = parseUnary();
    while (pos < tokens.length && tokens[pos] === '^') {
      pos += 1;
      const exp = parseUnary();
      base = Math.pow(base, exp);
    }
    return base;
  };

  const parseUnary = (): number => {
    if (tokens[pos] === '+') {
      pos += 1;
      return parseUnary();
    }
    if (tokens[pos] === '-') {
      pos += 1;
      return -parseUnary();
    }
    if (tokens[pos] === 'sqrt') {
      pos += 1;
      const operand = parseUnary();
      if (operand < 0) throw new Error('Negative sqrt');
      return Math.sqrt(operand);
    }
    return parsePrimary();
  };

  const parsePrimary = (): number => {
    if (tokens[pos] === '(') {
      pos += 1;
      const val = parseExpression();
      if (tokens[pos] !== ')') throw new Error('Unmatched parenthesis');
      pos += 1;
      return val;
    }
    const num = Number(tokens[pos]);
    if (Number.isNaN(num)) throw new Error('Invalid number');
    pos += 1;
    if (tokens[pos] === '%') {
      pos += 1;
      return num / 100;
    }
    return num;
  };

  try {
    const result = parseExpression();
    if (pos !== tokens.length || !Number.isFinite(result)) return null;
    return Math.round(result * 10000) / 10000;
  } catch {
    return null;
  }
}

function replaceSpokenWord(text: string, words: string[], replacement: string): string {
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  // Unicode-safe boundary matching (works for Arabic AND English, unlike \b!)
  const re = new RegExp(`(^|[\\s,،?؟()\\d])(?:${escaped})(?=$|[\\s,،?؟()\\d])`, 'gi');
  return text.replace(re, `$1 ${replacement} `);
}

const ARABIC_NUMBER_WORDS: Array<[string[], string]> = [
  [['صفر'], '0'],
  [['واحد', 'واحده'], '1'],
  [['اثنين', 'اتنين', 'الاثنين', 'الاتنين', 'اثنان'], '2'],
  [['ثلاثه', 'تلاته', 'الثلاثه', 'التلاته'], '3'],
  [['اربعه', 'الاربعه'], '4'],
  [['خمسه', 'الخمسه'], '5'],
  [['سته', 'السته'], '6'],
  [['سبعه', 'السبعه'], '7'],
  [['ثمانيه', 'تمانيه', 'الثمانيه', 'التمانيه'], '8'],
  [['تسعه', 'التسعه'], '9'],
  [['عشره', 'العشره'], '10'],
  [['عشرين', 'العشرين'], '20'],
  [['ثلاثين', 'تلاتين'], '30'],
  [['اربعين'], '40'],
  [['خمسين'], '50'],
  [['ستين'], '60'],
  [['سبعين'], '70'],
  [['ثمانين', 'تمانين'], '80'],
  [['تسعين'], '90'],
  [['ميه', 'مئه', 'مائه'], '100'],
  [['الف'], '1000'],
  [['نص', 'نصف'], '0.5'],
  [['ربع'], '0.25'],
];

function trySolveMath(rawText: string, lang: DetectedLanguage): string | null {
  const norm = normalizeArabic(rawText).toLowerCase();

  // Follow-up utterance right after a bare expression ("يساوي كام" / "equals what")
  if (
    lastMathMemory &&
    Date.now() - lastMathMemory.timestamp < 15_000 &&
    /^(?:يساوي كام|يساوي كم|تساوي كام|بكام|بكم|كام|الناتج كام|الناتج|equals|equals what|what is it)\??$/i.test(
      norm.replace(/[؟?]/g, '').trim(),
    )
  ) {
    const { expression, value } = lastMathMemory;
    return lang === 'ar'
      ? `${expression} تساوي ${value}`
      : `${expression} equals ${value}`;
  }

  // Percentage query: "15% of 240" or "25% من 480" or "20 بالمئة من 500"
  const percentMatch = norm.match(
    /(\d+(?:\.\d+)?)\s*(?:%|percent|بالميه|بالمئه|في الميه)\s*(?:of|من)\s*(\d+(?:\.\d+)?)/i,
  );
  if (percentMatch) {
    const pct = Number(percentMatch[1]);
    const base = Number(percentMatch[2]);
    const ans = Math.round(((pct / 100) * base) * 10000) / 10000;
    lastMathMemory = { expression: `${pct}% of ${base}`, value: ans, timestamp: Date.now() };
    return lang === 'ar'
      ? `${pct}% من ${base} تساوي ${ans}`
      : `${pct}% of ${base} is ${ans}`;
  }

  // Normalize Unicode math operators first (×, ✕, ÷, −, **)
  let candidate = norm
    .replace(/[×✕✖·]/g, ' * ')
    .replace(/[÷]/g, ' / ')
    .replace(/[−–—]/g, ' - ')
    .replace(/\*\*/g, ' ^ ')
    .replace(/[؟?،,]/g, ' ');

  // Remove Arabic & English question wrappers cleanly
  candidate = candidate.replace(
    /(?:calculate|compute|what is|what's|how much is|equals what|equals|احسبلي|احسب|قولي|يساوي كام|يساوي كم|تساوي كام|تساوي كم|يساوي|تساوي|بكام|بكم|كام|كم|الناتج)/gi,
    ' ',
  );

  // Spoken multi-word operators first
  candidate = candidate
    .replace(/(?:multiplied by|ضرب|مضروب في|مضروبه في)/gi, ' * ')
    .replace(/(?:divided by|مقسوم علي|مقسومه علي|قسمه)/gi, ' / ')
    .replace(/(?:square root of|الجذر التربيعي ل|الجذر التربيعي|جذر تربيعي|جذر)/gi, ' sqrt ')
    .replace(/(?:squared|تربيع)/gi, ' ^ 2 ')
    .replace(/(?:to the power of|power of)/gi, ' ^ ');

  // Convert single-word spoken operators using Unicode-safe boundaries
  candidate = replaceSpokenWord(candidate, ['plus', 'زائد', 'زايد', 'بلس'], '+');
  candidate = replaceSpokenWord(candidate, ['minus', 'ناقص', 'طرح', 'ماينص'], '-');
  candidate = replaceSpokenWord(candidate, ['times', 'x', 'في'], '*');
  candidate = replaceSpokenWord(candidate, ['over', 'علي', 'على'], '/');
  candidate = replaceSpokenWord(candidate, ['اس', 'قوه'], '^');

  // Convert Arabic number words (e.g., "الاثنين" -> "2")
  for (const [words, digit] of ARABIC_NUMBER_WORDS) {
    candidate = replaceSpokenWord(candidate, words, digit);
  }

  candidate = candidate.replace(/\s+/g, ' ').trim();

  // Must contain at least one math operator/function AND at least one digit
  if (!/(?:[+\-*/^]|sqrt)/.test(candidate) || !/\d/.test(candidate)) {
    return null;
  }

  // Only allow digits, spaces, decimal points, parens, operators, and "sqrt"
  const strippedCheck = candidate.replace(/sqrt/gi, '');
  if (!/^[\d\s.+\-*/^()%]+$/.test(strippedCheck)) {
    return null;
  }

  const val = evaluateMathExpression(candidate);
  if (val === null) return null;

  const prettyExpr = candidate.replace(/\*/g, '×').replace(/sqrt\s*/gi, '√');
  lastMathMemory = { expression: prettyExpr, value: val, timestamp: Date.now() };

  return lang === 'ar'
    ? `الناتج هو ${val}`
    : `The answer is ${val}`;
}

function tryConvertUnits(rawText: string, lang: DetectedLanguage): string | null {
  const norm = normalizeArabic(rawText).toLowerCase();
  const match = norm.match(
    /(\d+(?:\.\d+)?)\s*(km|kilometers?|miles?|mi|kg|kilograms?|lb|lbs|pounds?|cm|centimeters?|in|inches?|c|celsius|f|fahrenheit|مئويه|فهرنهايت|كيلو|ميل|باوند)\s*(?:to|in|الي|الى|ل)\s*(km|kilometers?|miles?|mi|kg|kilograms?|lb|lbs|pounds?|cm|centimeters?|in|inches?|c|celsius|f|fahrenheit|مئويه|فهرنهايت|كيلو|ميل|باوند)/i,
  );
  if (!match) return null;

  const value = Number(match[1]);
  const from = match[2].toLowerCase();
  const to = match[3].toLowerCase();
  const round = (n: number) => Math.round(n * 100) / 100;

  let converted: number | null = null;
  let targetLabel = to;

  if ((from.startsWith('km') || from.includes('كيلو')) && (to.startsWith('mi') || to.includes('ميل'))) {
    converted = round(value * 0.621371);
    targetLabel = lang === 'ar' ? 'ميل' : 'miles';
  } else if ((from.startsWith('mi') || from.includes('ميل')) && (to.startsWith('km') || to.includes('كيلو'))) {
    converted = round(value * 1.60934);
    targetLabel = lang === 'ar' ? 'كيلومتر' : 'kilometers';
  } else if (from.startsWith('kg') && (to.startsWith('lb') || to.startsWith('pound') || to.includes('باوند'))) {
    converted = round(value * 2.20462);
    targetLabel = lang === 'ar' ? 'باوند' : 'pounds';
  } else if ((from.startsWith('lb') || from.startsWith('pound') || from.includes('باوند')) && from !== to && (to.startsWith('kg') || to.includes('كيلو'))) {
    converted = round(value * 0.453592);
    targetLabel = lang === 'ar' ? 'كيلوجرام' : 'kilograms';
  } else if (from.startsWith('cm') && to.startsWith('in')) {
    converted = round(value / 2.54);
    targetLabel = lang === 'ar' ? 'إنش' : 'inches';
  } else if (from.startsWith('in') && to.startsWith('cm')) {
    converted = round(value * 2.54);
    targetLabel = lang === 'ar' ? 'سنتيمتر' : 'centimeters';
  } else if ((from === 'c' || from.startsWith('cel') || from.includes('مئوي')) && (to === 'f' || to.startsWith('fah') || to.includes('فهرن'))) {
    converted = round((value * 9) / 5 + 32);
    targetLabel = lang === 'ar' ? 'درجة فهرنهايت' : '°F';
  } else if ((from === 'f' || from.startsWith('fah') || from.includes('فهرن')) && (to === 'c' || to.startsWith('cel') || to.includes('مئوي'))) {
    converted = round(((value - 32) * 5) / 9);
    targetLabel = lang === 'ar' ? 'درجة مئوية' : '°C';
  }

  if (converted === null) return null;
  return lang === 'ar'
    ? `${value} تساوي تقريباً ${converted} ${targetLabel}`
    : `${value} ${from} is approximately ${converted} ${targetLabel}`;
}

/**
 * Tier 1: Ultra-fast (<5ms) offline local intelligence for Arabic/English math,
 * unit conversion, utility tools (coin/dice), and bilingual conversational replies.
 */
export function runLocalSmallIntelligence(
  rawText: string,
  fallbackLang?: DetectedLanguage,
): LocalIntelligenceResult {
  const detected = detectTextLanguage(rawText);
  const lang: DetectedLanguage =
    detected === 'en' && fallbackLang ? fallbackLang : detected;
  const norm = normalizeArabic(rawText).toLowerCase().trim();

  // Math calculation (including bare Arabic/English expressions & sqrt)
  const mathAnswer = trySolveMath(rawText, lang);
  if (mathAnswer) {
    return { handled: true, reply: mathAnswer, lang };
  }

  // Unit conversion
  const unitAnswer = tryConvertUnits(rawText, lang);
  if (unitAnswer) {
    return { handled: true, reply: unitAnswer, lang };
  }

  // Coin flip & dice roll
  if (norm.includes('flip a coin') || norm.includes('toss a coin') || norm.includes('ارمي عمله')) {
    const isHeads = Math.random() < 0.5;
    return {
      handled: true,
      reply:
        lang === 'ar'
          ? isHeads
            ? 'النتيجة: ملك (صورة)'
            : 'النتيجة: كتابة'
          : `It landed on ${isHeads ? 'Heads' : 'Tails'}.`,
      lang,
    };
  }

  if (norm.includes('roll a dice') || norm.includes('roll dice') || norm.includes('ارمي نرد')) {
    const roll = Math.floor(Math.random() * 6) + 1;
    return {
      handled: true,
      reply: lang === 'ar' ? `ظهر الرقم ${roll}` : `You rolled a ${roll}.`,
      lang,
    };
  }

  // Bilingual conversational greetings & capability Q&A
  if (
    /^(hi|hello|hey|good afternoon|good evening|how are you|who are you|what is your name)\b/.test(
      norm,
    ) ||
    norm.includes('السلام عليكم') ||
    norm.includes('ازيك') ||
    norm.includes('عامل ايه') ||
    norm.includes('كيف حالك') ||
    norm.includes('كيفك') ||
    norm.includes('من انت') ||
    norm.includes('انت مين')
  ) {
    if (norm.includes('السلام عليكم')) {
      return {
        handled: true,
        reply: 'وعليكم السلام ورحمة الله! أنا فيكي، مساعدك الذكي. كيف أقدر أساعدك؟',
        lang: 'ar',
      };
    }
    if (lang === 'ar') {
      return {
        handled: true,
        reply:
          'أهلاً بك! أنا فيكي، مساعدك الصوتي الذكي. أقدر أتحكم في الإعدادات، أضبط المنبه في تطبيق الساعة، أبعت رسائل واتساب، أشغل أوامر التطبيقات عبر الـ API، وأحل الحسابات فوراً.',
        lang: 'ar',
      };
    }
    return {
      handled: true,
      reply:
        "Hi! I'm Vicky, your fast voice assistant. I can control device settings, dispatch alarms to Clock or Crystal, send WhatsApp or SMS messages, trigger App APIs, and solve quick math.",
      lang: 'en',
    };
  }

  if (
    norm.includes('what can you do') ||
    norm.includes('help') ||
    norm.includes('تقدر تعمل ايه') ||
    norm.includes('ماذا تستطيع') ||
    norm.includes('مساعده')
  ) {
    return {
      handled: true,
      reply:
        lang === 'ar'
          ? 'جرب تقول: "شغل الواي فاي"، "اضبط منبه 7 صباحاً"، "ابعت رسالة واتساب لأحمد أنا في الطريق"، "اكتب نوت في كريستال اشتري قهوة"، أو اسألني أي مسألة حسابية.'
          : 'Try saying: "Turn on Wi-Fi", "Set alarm for 7:30 AM", "Send WhatsApp to Ahmed saying on my way", "Add note in Crystal buy coffee", or ask any math or unit question.',
      lang,
    };
  }

  if (norm.includes('thank') || norm.includes('شكرا') || norm.includes('تسلم')) {
    return {
      handled: true,
      reply: lang === 'ar' ? 'العفو! أنا هنا في أي وقت.' : "You're welcome! Always ready when you say Hey Vicky.",
      lang,
    };
  }

  return { handled: false, reply: '', lang };
}

/**
 * Tier 2: Calls the server-side fast Gemini 3.1 Flash-Lite endpoint (/api/assistant/ask).
 */
export async function askCloudSmallIntelligence(payload: {
  query: string;
  language: string;
  contacts: string[];
  routines: string[];
  apps?: string[];
}): Promise<CloudAIActionResponse> {
  const response = await fetch('/api/assistant/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      currentTimeIso: new Date().toISOString(),
    }),
  });

  const data = (await response.json().catch(() => ({}))) as Partial<CloudAIActionResponse> & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error || `Assistant AI request failed (${response.status})`);
  }

  return {
    reply: data.reply || 'Done.',
    action: data.action || 'none',
    time24: data.time24,
    minutes: data.minutes,
    label: data.label,
    recipient: data.recipient,
    messageText: data.messageText,
    channel: data.channel,
    appName: data.appName,
    routineName: data.routineName,
    destination: data.destination,
    settingName: data.settingName,
    settingState: data.settingState,
    settingValue: data.settingValue,
    apiCapability: data.apiCapability,
    apiText: data.apiText,
    model: data.model,
  };
}

export async function fetchCloudAIStatus(): Promise<{ aiAvailable: boolean; model: string }> {
  try {
    const res = await fetch('/api/assistant/status');
    if (!res.ok) return { aiAvailable: false, model: 'gemini-3.1-flash-lite' };
    return (await res.json()) as { aiAvailable: boolean; model: string };
  } catch {
    return { aiAvailable: false, model: 'gemini-3.1-flash-lite' };
  }
}
