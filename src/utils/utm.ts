import { Platform, UtmParams } from '../types';

// Маппинг платформы → utm_source
export const platformToSource: Record<Platform, string> = {
  vk: 'vkontakte',
  ok: 'odnoklassniki',
  telegram: 'telegram',
  tenchat: 'tenchat',
  twitter: 'twitter',
};

// Маппинг платформы → utm_medium (по умолчанию)
export const platformToMedium: Record<Platform, string> = {
  vk: 'social',
  ok: 'social',
  telegram: 'messenger',
};

/**
 * Строит UTM-URL из базовой ссылки и параметров
 */
export function buildUtmUrl(baseUrl: string, params: UtmParams): string {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set('utm_source', params.source);
    url.searchParams.set('utm_medium', params.medium);
    url.searchParams.set('utm_campaign', params.campaign);
    if (params.content) url.searchParams.set('utm_content', params.content);
    if (params.term) url.searchParams.set('utm_term', params.term);
    return url.toString();
  } catch {
    // Если URL невалидный — возвращаем как есть
    const sep = baseUrl.includes('?') ? '&' : '?';
    let result = `${baseUrl}${sep}utm_source=${encodeURIComponent(params.source)}&utm_medium=${encodeURIComponent(params.medium)}&utm_campaign=${encodeURIComponent(params.campaign)}`;
    if (params.content) result += `&utm_content=${encodeURIComponent(params.content)}`;
    if (params.term) result += `&utm_term=${encodeURIComponent(params.term)}`;
    return result;
  }
}

/**
 * Находит все URL в тексте и добавляет UTM-метки
 */
export function injectUtmIntoText(text: string, params: UtmParams): string {
  // Regex для поиска URL (http/https)
  const urlRegex = /(https?:\/\/[^\s\])\u0022\u0027,;]+)/g;
  return text.replace(urlRegex, (url) => {
    // Не добавляем UTM к уже utm-размеченным ссылкам
    if (url.includes('utm_source=')) return url;
    // Не добавляем UTM к соцсетям (они не нужны)
    if (
      url.includes('vk.com') ||
      url.includes('ok.ru') ||
      url.includes('t.me') ||
      url.includes('telegram.me')
    ) return url;
    return buildUtmUrl(url, params);
  });
}

/**
 * Извлекает все URL из текста
 */
export function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s\])\u0022\u0027,;]+)/g;
  return Array.from(text.matchAll(urlRegex), (m) => m[1]);
}

/**
 * Генерирует UTM-параметры для платформы
 */
export function generateUtmParams(
  platform: Platform,
  campaign: string,
  content?: string,
  medium?: string,
  term?: string
): UtmParams {
  return {
    source: platformToSource[platform],
    medium: medium || platformToMedium[platform],
    campaign: campaign || 'autopost',
    content,
    term,
  };
}

/**
 * Форматирует UTM-параметры в строку для отображения
 */
export function formatUtmString(params: UtmParams): string {
  const parts = [
    `utm_source=${params.source}`,
    `utm_medium=${params.medium}`,
    `utm_campaign=${params.campaign}`,
  ];
  if (params.content) parts.push(`utm_content=${params.content}`);
  if (params.term) parts.push(`utm_term=${params.term}`);
  return parts.join('&');
}

/**
 * Генерирует пример UTM-ссылки
 */
export function generateExampleUrl(baseUrl: string, platform: Platform, campaign: string): string {
  const params = generateUtmParams(platform, campaign, undefined);
  return buildUtmUrl(baseUrl || 'https://example.com/page', params);
}

/**
 * Slug из строки (для utm_campaign)
 */
export function toSlug(str: string): string {
  return str
    .toLowerCase()
    .replace(/[а-яёА-ЯЁ]/g, (c) => {
      const map: Record<string, string> = {
        а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'j',
        к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',
        х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',
      };
      return map[c.toLowerCase()] || '';
    })
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
}
