import { DetectedLanguage } from '../types/assistant';

const EASTERN_ARABIC_DIGITS: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
};

const ARABIC_DIACRITICS_REGEX = /[\u064B-\u065F\u0670\u0640]/g;

/**
 * Normalizes Arabic text for robust speech-to-text intent matching:
 * strips tashkeel/tatweel, unifies Alef/Ta Marbuta/Alef Maksura,
 * and converts Eastern Arabic/Persian numerals to Western ASCII digits.
 */
export function normalizeArabic(input: string): string {
  let result = input.replace(ARABIC_DIACRITICS_REGEX, '');
  result = result
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي');

  result = result.replace(/[٠-٩۰-۹]/g, (ch) => EASTERN_ARABIC_DIGITS[ch] ?? ch);
  return result.replace(/\s+/g, ' ').trim();
}

export function detectTextLanguage(text: string): DetectedLanguage {
  if (/[\u0600-\u06FF]/.test(text)) {
    return 'ar';
  }
  if (/[\u0900-\u097F]/.test(text)) {
    return 'hi';
  }
  return 'en';
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );

  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}

const ENGLISH_GREETING_PREFIXES = ['hey', 'ok', 'okay', 'hi', 'yo', 'a', 'hay', 'hei'];
const ENGLISH_NAME_TARGETS = [
  'vicky',
  'vikki',
  'viki',
  'vickey',
  'vickie',
  'wiki',
  'bicky',
  'ficky',
  'ricky',
];

const ARABIC_GREETING_PREFIXES = [
  'يا',
  'هاي',
  'اهلا',
  'هلا',
  'مرحبا',
  'اوكي',
  'اوك',
  'ايه',
  'اي',
  'هي',
];
const ARABIC_NAME_TARGETS = [
  'فيكي',
  'ويكي',
  'بيكي',
  'فكي',
  'فيك',
  'فكيه',
  'افيكي',
  'يافيكي',
  'يفيكي',
  'هافيكي',
  'هايفيكي',
];

export interface WakeWordMatch {
  matched: boolean;
  wakePhrase: string | null;
  remainder: string;
  lang: DetectedLanguage;
}

/**
 * High-accuracy bilingual fuzzy wake-word detector supporting:
 * - "Hey Vicky" / "OK Vicky" / "Vicky" + phonetic misrecognitions (edit distance <= 1)
 * - Arabic "يا فيكي" / "هاي فيكي" / "افيكي" / "فيكي" + phonetic misrecognitions
 */
export function detectWakeWord(rawText: string): WakeWordMatch {
  const lang = detectTextLanguage(rawText);
  const normalized = normalizeArabic(rawText).toLowerCase();
  const cleanTokens = normalized
    .replace(/[،,.:;!?'"()[\]]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (cleanTokens.length === 0) {
    return { matched: false, wakePhrase: null, remainder: '', lang };
  }

  // Preserve original text remainder cleanly when stripping wake prefix
  const origTokens = rawText.trim().split(/\s+/).filter(Boolean);

  // Pass 1: Two-word greeting + wake name ("hey vicky", "ok vicky", "يا فيكي", "هاي فيكي")
  for (let i = 0; i < cleanTokens.length - 1; i += 1) {
    const first = cleanTokens[i];
    const second = cleanTokens[i + 1];

    const isEnglishPair =
      ENGLISH_GREETING_PREFIXES.includes(first) &&
      (ENGLISH_NAME_TARGETS.includes(second) ||
        (second.length >= 4 &&
          second.length <= 7 &&
          ENGLISH_NAME_TARGETS.some((target) => levenshteinDistance(second, target) <= 1)));

    const isArabicPair =
      ARABIC_GREETING_PREFIXES.includes(first) &&
      (ARABIC_NAME_TARGETS.includes(second) ||
        (second.length >= 3 &&
          second.length <= 6 &&
          ARABIC_NAME_TARGETS.some((target) => levenshteinDistance(second, target) <= 1)));

    if (isEnglishPair || isArabicPair) {
      const remainder =
        origTokens.length === cleanTokens.length
          ? origTokens.slice(i + 2).join(' ').replace(/^[,،:\s-]+/, '').trim()
          : cleanTokens.slice(i + 2).join(' ').trim();
      return {
        matched: true,
        wakePhrase: isArabicPair ? 'يا فيكي' : 'Hey Vicky',
        remainder,
        lang: isArabicPair ? 'ar' : lang,
      };
    }
  }

  // Pass 2: Merged or standalone wake word ("heyvicky", "vicky", "فيكي", "افيكي", "يافيكي")
  for (let i = 0; i < cleanTokens.length; i += 1) {
    const token = cleanTokens[i];
    const isArabicHit =
      /[\u0600-\u06FF]/.test(token) &&
      (ARABIC_NAME_TARGETS.includes(token) ||
        (token.length >= 4 &&
          token.length <= 6 &&
          ['فيكي', 'افيكي', 'يافيكي'].some((target) => levenshteinDistance(token, target) <= 1)));

    const isEnglishHit =
      token === 'heyvicky' ||
      token === 'okvicky' ||
      ENGLISH_NAME_TARGETS.includes(token);

    if (isEnglishHit || isArabicHit) {
      const remainder =
        origTokens.length === cleanTokens.length
          ? origTokens.slice(i + 1).join(' ').replace(/^[,،:\s-]+/, '').trim()
          : cleanTokens.slice(i + 1).join(' ').trim();
      return {
        matched: true,
        wakePhrase: isArabicHit ? 'يا فيكي' : 'Hey Vicky',
        remainder,
        lang: isArabicHit ? 'ar' : lang,
      };
    }
  }

  return { matched: false, wakePhrase: null, remainder: rawText.trim(), lang };
}

export interface ParsedTime {
  hour24: number;
  minute: number;
  time24: string;
  formatted12h: string;
}

export function formatTime12h(time24: string): string {
  const [hStr, mStr] = time24.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return time24;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Parses English and Arabic clock times ("7:30 am", "19:00", "half past 6",
 * "الساعة 7 ونص صباحا", "الساعة 8 مساء", "in 20 minutes", "بعد 15 دقيقة").
 */
export function parseTimeExpression(rawText: string): ParsedTime | null {
  const norm = normalizeArabic(rawText).toLowerCase();

  // Relative offset ("in 15 minutes" / "بعد 15 دقيقة")
  const relMatch = norm.match(
    /(?:in|after|بعد)\s+(\d+)\s*(?:min|mins|minute|minutes|دقيقه|دقائق|دقايق)/i,
  );
  if (relMatch) {
    const mins = Number(relMatch[1]);
    if (!Number.isNaN(mins) && mins > 0) {
      const target = new Date(Date.now() + mins * 60_000);
      const hour24 = target.getHours();
      const minute = target.getMinutes();
      const time24 = `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      return { hour24, minute, time24, formatted12h: formatTime12h(time24) };
    }
  }

  // English "half past 7" / "quarter past 7" / "quarter to 8"
  const phraseMatch = norm.match(
    /(half past|quarter past|quarter to)\s+(\d{1,2})\s*(am|pm)?/i,
  );
  if (phraseMatch) {
    const phrase = phraseMatch[1].toLowerCase();
    let hour = Number(phraseMatch[2]);
    let minute = 0;
    if (phrase === 'half past') minute = 30;
    else if (phrase === 'quarter past') minute = 15;
    else if (phrase === 'quarter to') {
      minute = 45;
      hour = hour === 1 ? 12 : hour - 1;
    }
    const meridiem = phraseMatch[3]?.toLowerCase();
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
    const time24 = `${String(hour % 24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    return { hour24: hour % 24, minute, time24, formatted12h: formatTime12h(time24) };
  }

  // Standard HH:MM or H with optional am/pm or Arabic صباحا/مساء/ونص/وربع
  const timeMatch = norm.match(
    /(?:at|for|الساعه|ساعه|علي|على)?\s*(\d{1,2})(?::(\d{2}))?\s*(ونصف|ونص|وربع|الا ربع)?\s*(am|pm|a\.m\.|p\.m\.|صباحا|صباح|مساء|مساءا|الليل|بليل|العصر|الظهر|الفجر)?/i,
  );
  if (timeMatch && timeMatch[1]) {
    let hour = Number(timeMatch[1]);
    let minute = timeMatch[2] ? Number(timeMatch[2]) : 0;
    const arabicFraction = timeMatch[3];
    const meridiem = timeMatch[4]?.toLowerCase() ?? '';

    if (hour > 23 || minute > 59) return null;

    if (arabicFraction === 'ونصف' || arabicFraction === 'ونص') {
      minute = 30;
    } else if (arabicFraction === 'وربع') {
      minute = 15;
    } else if (arabicFraction === 'الا ربع') {
      minute = 45;
      hour = hour === 1 ? 12 : hour - 1;
    }

    const isPm =
      meridiem.startsWith('p') ||
      meridiem.includes('مساء') ||
      meridiem.includes('الليل') ||
      meridiem.includes('بليل') ||
      meridiem.includes('العصر');
    const isAm =
      meridiem.startsWith('a') ||
      meridiem.includes('صباح') ||
      meridiem.includes('الفجر');

    if (isPm && hour < 12) hour += 12;
    if (isAm && hour === 12) hour = 0;

    const hasTimeSignal =
      Boolean(timeMatch[2]) ||
      Boolean(arabicFraction) ||
      Boolean(meridiem) ||
      /(?:alarm|clock|wake|منبه|الساعه|ساعه|صحيني|at|for)/i.test(norm);
    if (!hasTimeSignal) return null;

    const time24 = `${String(hour % 24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    return { hour24: hour % 24, minute, time24, formatted12h: formatTime12h(time24) };
  }

  return null;
}

/**
 * Parses English and Arabic timer durations ("5 minutes", "30 seconds", "دقيقتين", "نص ساعة").
 */
export function parseDurationSeconds(rawText: string): number | null {
  const norm = normalizeArabic(rawText).toLowerCase();

  if (norm.includes('half an hour') || norm.includes('نص ساعه') || norm.includes('نصف ساعه')) {
    return 30 * 60;
  }
  if (norm.includes('دقيقتين') || norm.includes('دقيقتان')) {
    return 2 * 60;
  }
  if (norm.includes('ساعتين') || norm.includes('ساعتان')) {
    return 2 * 3600;
  }

  let totalSeconds = 0;
  const hourMatch = norm.match(/(\d+)\s*(?:h|hr|hrs|hour|hours|ساعه|ساعات)/i);
  const minMatch = norm.match(/(\d+)\s*(?:m|min|mins|minute|minutes|دقيقه|دقائق|دقايق)/i);
  const secMatch = norm.match(/(\d+)\s*(?:s|sec|secs|second|seconds|ثانيه|ثواني)/i);

  if (hourMatch) totalSeconds += Number(hourMatch[1]) * 3600;
  if (minMatch) totalSeconds += Number(minMatch[1]) * 60;
  if (secMatch) totalSeconds += Number(secMatch[1]);

  if (totalSeconds > 0) return totalSeconds;

  if (/(?:^|\s)(?:a minute|one minute|دقيقه)(?:\s|$)/i.test(norm)) return 60;
  if (/(?:^|\s)(?:an hour|one hour|ساعه)(?:\s|$)/i.test(norm)) return 3600;

  return null;
}
