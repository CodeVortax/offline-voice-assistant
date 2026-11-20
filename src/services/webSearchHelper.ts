import { detectTextLanguage, normalizeArabic } from './arabicNlu';

const MAX_SNIPPET_LENGTH = 220;

const OFFLINE_KNOWLEDGE_BASE: Record<string, string> = {
  ai: 'Artificial intelligence is the capability of computational systems to perform tasks typically associated with human intelligence, such as learning, reasoning, and problem-solving.',
  'artificial intelligence':
    'Artificial intelligence is the capability of computational systems to perform tasks typically associated with human intelligence, such as learning, reasoning, and problem-solving.',
  mars: 'Mars is the fourth planet from the Sun in the Solar System, known as the Red Planet due to iron oxide dust across its surface.',
  'albert einstein':
    'Albert Einstein was a German-born theoretical physicist best known for developing the theory of relativity and contributing to quantum mechanics.',
  'vicky ai':
    'Vicky AI is a fast voice assistant with Hey Vicky wake-word detection, Arabic and English commands, alarms, routines, messaging, and offline intelligence.',
  'الذكاء الاصطناعي':
    'الذكاء الاصطناعي هو قدرة الأنظمة الحاسوبية على التعلم والاستنتاج وحل المشكلات وفهم اللغة الطبيعية بطريقة تحاكي الذكاء البشري.',
  المريخ:
    'المريخ هو الكوكب الرابع في البعد عن الشمس في النظام الشمسي، ويُعرف بالكوكب الأحمر بسبب أكسيد الحديد المنتشر على سطحه.',
  مصر: 'مصر دولة تقع في شمال شرق أفريقيا وتمتد إلى شبه جزيرة سيناء في آسيا، وعاصمتها القاهرة وتشتهر بحضارتها العريقة ونهر النيل.',
  السعوديه:
    'المملكة العربية السعودية هي أكبر دولة في شبه الجزيرة العربية، وعاصمتها الرياض وتضم الحرمين الشريفين في مكة المكرمة والمدينة المنورة.',
};

function truncateResult(raw: string): string {
  const clean = raw.replace(/\s+/g, ' ').trim();
  if (!clean) {
    return 'No result found';
  }
  if (clean.length > MAX_SNIPPET_LENGTH) {
    return `${clean.slice(0, MAX_SNIPPET_LENGTH)}...`;
  }
  return clean;
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/**
 * Bilingual English & Arabic knowledge lookup using CORS-enabled Wikipedia APIs
 * (en.wikipedia.org and ar.wikipedia.org) with offline fallback.
 */
export class WebSearchHelper {
  public buildGoogleSearchUrl(query: string): string {
    const lang = detectTextLanguage(query);
    return `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=${lang === 'ar' ? 'ar' : 'en'}`;
  }

  public buildYouTubeSearchUrl(query: string): string {
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  }

  public buildMapsUrl(destination: string): string {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
  }

  public async searchAndGetResult(query: string): Promise<string> {
    const trimmed = query.trim();
    const lang = detectTextLanguage(trimmed);
    const wikiLang = lang === 'ar' ? 'ar' : 'en';
    const normalized = normalizeArabic(trimmed).toLowerCase();

    if (!normalized) {
      return lang === 'ar' ? 'لم يتم العثور على نتيجة' : 'No result found';
    }

    if (typeof navigator === 'undefined' || navigator.onLine !== false) {
      try {
        const directSummary = await this.fetchWikipediaSummary(trimmed, wikiLang);
        if (directSummary) {
          return truncateResult(directSummary);
        }

        const searchSnippet = await this.fetchWikipediaSearchSnippet(trimmed, wikiLang);
        if (searchSnippet) {
          return truncateResult(searchSnippet);
        }
      } catch {
        // Fall back to offline knowledge base
      }
    }

    const offlineExact = OFFLINE_KNOWLEDGE_BASE[normalized];
    if (offlineExact) {
      return truncateResult(offlineExact);
    }

    for (const [key, summary] of Object.entries(OFFLINE_KNOWLEDGE_BASE)) {
      const normKey = normalizeArabic(key).toLowerCase();
      if (normalized.includes(normKey) || normKey.includes(normalized)) {
        return truncateResult(summary);
      }
    }

    return lang === 'ar' ? 'لم أجد ملخصاً فورياً، يمكنك فتح بحث جوجل.' : 'No result found';
  }

  private async fetchWikipediaSummary(query: string, wikiLang: 'en' | 'ar'): Promise<string | null> {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 3500);
    try {
      const response = await fetch(
        `https://${wikiLang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query.trim())}`,
        { signal: controller.signal },
      );
      if (!response.ok) return null;
      const data = (await response.json()) as { extract?: string; type?: string };
      if (data.extract && data.type !== 'disambiguation') {
        return data.extract;
      }
      return null;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  private async fetchWikipediaSearchSnippet(
    query: string,
    wikiLang: 'en' | 'ar',
  ): Promise<string | null> {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 3500);
    try {
      const url = `https://${wikiLang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        query.trim(),
      )}&utf8=&format=json&origin=*`;
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) return null;
      const data = (await response.json()) as {
        query?: { search?: Array<{ title?: string; snippet?: string }> };
      };
      const firstHit = data.query?.search?.[0];
      if (!firstHit) return null;

      if (firstHit.title) {
        const hitSummary = await this.fetchWikipediaSummary(firstHit.title, wikiLang);
        if (hitSummary) return hitSummary;
      }

      if (firstHit.snippet) {
        return stripHtmlTags(firstHit.snippet);
      }
      return null;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  public cleanup(): void {
    // No persistent resources
  }
}
