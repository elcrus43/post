export type Platform = 'vk' | 'ok' | 'telegram';
export type AccountType = 'personal' | 'group' | 'channel';
export type PostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';

// ─── Reposter ────────────────────────────────────────────────────────────────
export type RepostSourceType = 'rss' | 'vk_wall' | 'tg_channel';
export type RepostOrder = 'newest' | 'oldest' | 'random';
export type RepostStatus = 'active' | 'paused' | 'error';

export interface RepostSchedule {
  /** Дни недели: 0=вс,1=пн,...,6=сб */
  days: number[];
  /** Часы публикации (0-23) */
  hours: number[];
  /** Минимальная задержка между постами (мин) */
  intervalMin: number;
  /** Максимальная задержка между постами (мин) */
  intervalMax: number;
}

export interface RepostFilters {
  /** Минимальное кол-во символов в посте */
  minLength: number;
  /** Максимальное кол-во символов (0 = без ограничений) */
  maxLength: number;
  /** Только посты с картинками */
  requireImage: boolean;
  /** Стоп-слова — пропускать посты с этими словами */
  stopWords: string[];
  /** Только посты с этими словами */
  requiredWords: string[];
}

export interface RepostSource {
  id: string;
  name: string;
  type: RepostSourceType;
  /** URL для RSS или VK wall, username для TG */
  url: string;
  /** ID группы/канала для VK */
  vkOwnerId?: string;
  /** Токен для доступа к закрытым VK-группам */
  vkToken?: string;
  /** Username Telegram канала (@channel) */
  tgUsername?: string;
}

export interface RepostRule {
  id: string;
  name: string;
  status: RepostStatus;
  source: RepostSource;
  /** ID аккаунтов-назначений из основного списка */
  targetAccountIds: string[];
  schedule: RepostSchedule;
  filters: RepostFilters;
  order: RepostOrder;
  /** Добавлять подпись к посту */
  appendText: string;
  /** Добавлять ссылку на источник */
  addSourceLink: boolean;
  /** Публиковать только уникальные (не дублировать) */
  skipDuplicates: boolean;
  /** UTM-метки для ссылок в посте */
  utmEnabled?: boolean;
  utmParams?: Omit<UtmParams, 'source'>; // source берётся из платформы
  /** Последний успешно обработанный ID поста из источника */
  lastProcessedId?: string;
  /** Дата последней проверки */
  lastCheckedAt?: string;
  /** Дата следующей публикации */
  nextPublishAt?: string;
  createdAt: string;
}

export interface RepostHistoryItem {
  id: string;
  ruleId: string;
  ruleName: string;
  sourceTitle: string;
  sourceUrl?: string;
  sourceImage?: string;
  text: string;
  publishedAt: string;
  targetAccountIds: string[];
  results: Array<{
    accountId: string;
    platform: Platform;
    status: 'success' | 'error';
    error?: string;
    postUrl?: string;
  }>;
}

export interface Account {
  id: string;
  platform: Platform;
  type: AccountType;
  name: string;
  // VK
  vkToken?: string;
  vkOwnerId?: string;
  // OK
  okToken?: string;
  okAppKey?: string;
  okAppSecretKey?: string;
  okGroupId?: string;
  // Telegram
  tgBotToken?: string;
  tgChatId?: string;
  isActive: boolean;
  createdAt: string;
}

export interface MediaFile {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'video' | 'document';
  size: number;
}

export interface PostResult {
  accountId: string;
  platform: Platform;
  status: 'success' | 'error';
  postId?: string;
  postUrl?: string;
  error?: string;
  publishedAt?: string;
}

// ─── UTM ─────────────────────────────────────────────────────────────────────
export interface UtmParams {
  source: string;      // utm_source (vk, ok, telegram)
  medium: string;      // utm_medium (social, post, reposter)
  campaign: string;    // utm_campaign (название кампании)
  content?: string;    // utm_content (описание поста / ID)
  term?: string;       // utm_term (ключевые слова)
}

export interface UtmPreset {
  id: string;
  name: string;
  campaign: string;
  medium: string;
  term?: string;
  createdAt: string;
}

export interface UtmClick {
  id: string;
  postId?: string;
  ruleId?: string;
  platform: Platform;
  accountId: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent?: string;
  url: string;
  clicks: number;
  conversions: number;
  date: string; // ISO date string YYYY-MM-DD
}

export interface AnalyticsEntry {
  id: string;
  postId?: string;
  ruleId?: string;
  platform: Platform;
  accountId: string;
  accountName: string;
  url: string;
  utmParams: UtmParams;
  clicks: number;
  conversions: number;
  ctr: number; // click-through rate %
  createdAt: string;
  lastUpdatedAt: string;
}

// ─── Стикеры ─────────────────────────────────────────────────────────────────
export interface Sticker {
  id: string;
  emoji: string;
  label: string;
  category: 'reactions' | 'emotions' | 'business' | 'nature' | 'food' | 'symbols';
}

export interface PostMention {
  id: string;
  platform: Platform;
  /** @username или ссылка */
  handle: string;
  displayName: string;
}

// ─── Первый комментарий ───────────────────────────────────────────────────────
export interface FirstComment {
  enabled: boolean;
  text: string;
}

// ─── Авто-удаление ────────────────────────────────────────────────────────────
export interface AutoDelete {
  enabled: boolean;
  /** Через сколько минут удалить после публикации */
  afterMinutes: number;
}

export interface Post {
  id: string;
  text: string;
  media: MediaFile[];
  targetAccounts: string[];
  status: PostStatus;
  scheduledAt?: string;
  publishedAt?: string;
  deleteAt?: string;
  createdAt: string;
  results: PostResult[];
  utmParams?: UtmParams;
  utmEnabled?: boolean;
  // Новые поля
  stickers?: Sticker[];
  mentions?: PostMention[];
  firstComment?: FirstComment;
  autoDelete?: AutoDelete;
  disableComments?: boolean;
  isVkStory?: boolean;
}
