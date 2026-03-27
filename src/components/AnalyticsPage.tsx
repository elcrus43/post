import { useState, useMemo } from 'react';
import {
  BarChart2, Link2, Plus, Trash2, Copy, Check, TrendingUp,
  TrendingDown, Minus, MousePointer, ShoppingCart,
  ChevronDown, ChevronUp, Download,
  Zap, Globe, X, Save, AlertCircle
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { Platform } from '../types';
import {
  buildUtmUrl, generateUtmParams, formatUtmString,
  platformToSource, toSlug, injectUtmIntoText, extractUrls
} from '../utils/utm';
import PlatformIcon from './PlatformIcon';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PLATFORM_COLORS: Record<Platform, string> = {
  vk: '#2688EB',
  ok: '#EE8208',
  telegram: '#29B6F6',
};

const PLATFORM_LABELS: Record<Platform, string> = {
  vk: 'ВКонтакте',
  ok: 'Одноклассники',
  telegram: 'Telegram',
};

function StatCard({
  icon: Icon, label, value, sub, color, trend
}: {
  icon: React.ElementType; label: string; value: string | number;
  sub?: string; color: string; trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      <div className="flex items-start justify-between">
        <div className={`p-2.5 rounded-xl`} style={{ background: color + '18' }}>
          <Icon size={20} style={{ color }} />
        </div>
        {trend && (
          <span className={`text-xs font-medium flex items-center gap-0.5 ${
            trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-500' : 'text-gray-400'
          }`}>
            {trend === 'up' ? <TrendingUp size={13} /> : trend === 'down' ? <TrendingDown size={13} /> : <Minus size={13} />}
          </span>
        )}
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-sm text-gray-500 mt-0.5">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
      </div>
    </div>
  );
}

// ─── UTM Builder Tab ──────────────────────────────────────────────────────────
function UtmBuilderTab() {
  const { utmPresets, addUtmPreset, removeUtmPreset } = useStore();
  const [baseUrl, setBaseUrl] = useState('https://');
  const [campaign, setCampaign] = useState('');
  const [medium, setMedium] = useState('social');
  const [content, setContent] = useState('');
  const [term, setTerm] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(['vk', 'ok', 'telegram']);
  const [copied, setCopied] = useState<string | null>(null);
  const [presetName, setPresetName] = useState('');
  const [showPresetForm, setShowPresetForm] = useState(false);
  const [testText, setTestText] = useState('');
  const [processedText, setProcessedText] = useState('');

  const platforms: Platform[] = ['vk', 'ok', 'telegram'];

  const togglePlatform = (p: Platform) => {
    setSelectedPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  const generatedLinks = useMemo(() => {
    if (!baseUrl || !campaign) return [];
    return selectedPlatforms.map(platform => {
      const params = generateUtmParams(platform, toSlug(campaign), content || undefined, medium || undefined, term || undefined);
      return {
        platform,
        url: buildUtmUrl(baseUrl, params),
        params,
      };
    });
  }, [baseUrl, campaign, medium, content, term, selectedPlatforms]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSavePreset = () => {
    if (!presetName.trim() || !campaign.trim()) return;
    addUtmPreset({ name: presetName.trim(), campaign: toSlug(campaign), medium, term });
    setPresetName('');
    setShowPresetForm(false);
  };

  const handleProcessText = () => {
    if (!testText || !campaign) return;
    // Используем первую выбранную платформу для теста
    const platform = selectedPlatforms[0] || 'vk';
    const params = generateUtmParams(platform, toSlug(campaign), content || undefined, medium || undefined, term || undefined);
    setProcessedText(injectUtmIntoText(testText, params));
  };

  const urlsInText = extractUrls(testText);

  return (
    <div className="space-y-6">
      {/* Builder Form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="p-2 bg-violet-50 rounded-xl">
            <Link2 size={18} className="text-violet-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">UTM Конструктор</h2>
            <p className="text-xs text-gray-500">Генерируй UTM-ссылки для каждой платформы</p>
          </div>
        </div>
        <div className="p-6 space-y-5">
          {/* Base URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Базовая ссылка <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="url"
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                placeholder="https://yoursite.com/page"
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Campaign */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Кампания (utm_campaign) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={campaign}
                onChange={e => setCampaign(e.target.value)}
                placeholder="Летняя распродажа"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              />
              {campaign && (
                <p className="text-xs text-gray-400 mt-1">→ <code className="bg-gray-100 px-1 rounded">{toSlug(campaign)}</code></p>
              )}
            </div>
            {/* Medium */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Medium (utm_medium)</label>
              <select
                value={medium}
                onChange={e => setMedium(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-violet-400 bg-white"
              >
                <option value="social">social</option>
                <option value="cpc">cpc</option>
                <option value="email">email</option>
                <option value="post">post</option>
                <option value="story">story</option>
                <option value="messenger">messenger</option>
                <option value="reposter">reposter</option>
              </select>
            </div>
            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Контент (utm_content)</label>
              <input
                type="text"
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="post_123 или описание"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              />
            </div>
            {/* Term */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Слово (utm_term)</label>
              <input
                type="text"
                value={term}
                onChange={e => setTerm(e.target.value)}
                placeholder="ключевое слово"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              />
            </div>
          </div>

          {/* Platform selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Платформы</label>
            <div className="flex gap-2">
              {platforms.map(p => (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                    selectedPlatforms.includes(p)
                      ? 'border-violet-400 bg-violet-50 text-violet-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <PlatformIcon platform={p} size={14} />
                  {PLATFORM_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Generated Links */}
      {generatedLinks.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Сгенерированные ссылки</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setShowPresetForm(!showPresetForm)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-violet-50 text-violet-700 rounded-lg hover:bg-violet-100 transition-colors"
              >
                <Save size={14} />
                Сохранить пресет
              </button>
            </div>
          </div>

          {showPresetForm && (
            <div className="px-6 py-4 bg-violet-50 border-b border-violet-100 flex gap-3 items-center">
              <input
                type="text"
                value={presetName}
                onChange={e => setPresetName(e.target.value)}
                placeholder="Название пресета..."
                className="flex-1 px-3 py-2 border border-violet-200 rounded-lg text-sm focus:outline-none focus:border-violet-400"
              />
              <button onClick={handleSavePreset} className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700">
                Сохранить
              </button>
              <button onClick={() => setShowPresetForm(false)} className="p-2 text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
          )}

          <div className="divide-y divide-gray-50">
            {generatedLinks.map(({ platform, url, params }) => (
              <div key={platform} className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <PlatformIcon platform={platform} size={16} />
                  <span className="font-medium text-sm text-gray-800">{PLATFORM_LABELS[platform]}</span>
                  <span className="text-xs text-gray-400 ml-auto">{formatUtmString(params)}</span>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2.5 text-xs text-gray-600 font-mono break-all border border-gray-100">
                    {url}
                  </div>
                  <button
                    onClick={() => handleCopy(url, platform)}
                    className="flex-shrink-0 p-2.5 rounded-xl border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-colors"
                  >
                    {copied === platform ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} className="text-gray-400" />}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Copy all */}
          <div className="px-6 py-4 border-t border-gray-100">
            <button
              onClick={() => handleCopy(generatedLinks.map(l => `${PLATFORM_LABELS[l.platform]}: ${l.url}`).join('\n'), 'all')}
              className="flex items-center gap-2 text-sm text-violet-600 hover:text-violet-700 font-medium"
            >
              {copied === 'all' ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
              Скопировать все ссылки
            </button>
          </div>
        </div>
      )}

      {/* Text Injector */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-xl">
            <Zap size={18} className="text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Авто-разметка текста поста</h3>
            <p className="text-xs text-gray-500">Вставь текст поста — UTM добавятся ко всем ссылкам автоматически</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Текст поста</label>
            <textarea
              value={testText}
              onChange={e => setTestText(e.target.value)}
              rows={4}
              placeholder="Вставьте текст поста с ссылками, например: Читайте статью https://site.com/article и оформите заказ на https://site.com/shop"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none"
            />
            {urlsInText.length > 0 && (
              <p className="text-xs text-blue-600 mt-1">
                🔗 Найдено ссылок: <strong>{urlsInText.length}</strong> — {urlsInText.join(', ')}
              </p>
            )}
          </div>
          <button
            onClick={handleProcessText}
            disabled={!testText || !campaign}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Zap size={15} />
            Добавить UTM в текст
          </button>
          {processedText && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Результат</label>
              <div className="relative">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 break-all whitespace-pre-wrap">
                  {processedText}
                </div>
                <button
                  onClick={() => handleCopy(processedText, 'text')}
                  className="absolute top-2 right-2 p-1.5 bg-white rounded-lg border border-gray-200 hover:border-emerald-300 transition-colors"
                >
                  {copied === 'text' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="text-gray-400" />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Presets */}
      {utmPresets.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Сохранённые пресеты</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {utmPresets.map(preset => (
              <div key={preset.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <div className="font-medium text-sm text-gray-800">{preset.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    campaign={preset.campaign} · medium={preset.medium}
                    {preset.term && ` · term=${preset.term}`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setCampaign(preset.campaign);
                      setMedium(preset.medium);
                      if (preset.term) setTerm(preset.term);
                    }}
                    className="px-3 py-1.5 text-xs bg-violet-50 text-violet-700 rounded-lg hover:bg-violet-100"
                  >
                    Применить
                  </button>
                  <button
                    onClick={() => removeUtmPreset(preset.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────
function AnalyticsTab() {
  const { analyticsEntries, addAnalyticsEntry, incrementClicks, incrementConversions, clearAnalytics } = useStore();
  const [filterPlatform, setFilterPlatform] = useState<Platform | 'all'>('all');
  const [filterCampaign, setFilterCampaign] = useState('');
  const [sortBy, setSortBy] = useState<'clicks' | 'conversions' | 'ctr' | 'date'>('clicks');
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Add entry form state
  const [newEntry, setNewEntry] = useState({
    platform: 'vk' as Platform,
    url: 'https://',
    campaign: '',
    medium: 'social',
    content: '',
    clicks: 0,
    conversions: 0,
  });

  const platforms: Platform[] = ['vk', 'ok', 'telegram'];

  // Сводная статистика
  const totalClicks = analyticsEntries.reduce((s, e) => s + e.clicks, 0);
  const totalConversions = analyticsEntries.reduce((s, e) => s + e.conversions, 0);
  const avgCtr = analyticsEntries.length > 0
    ? (analyticsEntries.reduce((s, e) => s + e.ctr, 0) / analyticsEntries.length).toFixed(1)
    : '0.0';

  // По платформам
  const byPlatform = useMemo(() => {
    const map: Record<string, { clicks: number; conversions: number; count: number }> = {};
    analyticsEntries.forEach(e => {
      if (!map[e.platform]) map[e.platform] = { clicks: 0, conversions: 0, count: 0 };
      map[e.platform].clicks += e.clicks;
      map[e.platform].conversions += e.conversions;
      map[e.platform].count++;
    });
    return map;
  }, [analyticsEntries]);

  // По кампаниям
  const byCampaign = useMemo(() => {
    const map: Record<string, { clicks: number; conversions: number; platforms: Set<Platform> }> = {};
    analyticsEntries.forEach(e => {
      const c = e.utmParams.campaign;
      if (!map[c]) map[c] = { clicks: 0, conversions: 0, platforms: new Set() };
      map[c].clicks += e.clicks;
      map[c].conversions += e.conversions;
      map[c].platforms.add(e.platform);
    });
    return Object.entries(map).sort((a, b) => b[1].clicks - a[1].clicks);
  }, [analyticsEntries]);

  // Фильтрация + сортировка
  const filtered = useMemo(() => {
    let res = [...analyticsEntries];
    if (filterPlatform !== 'all') res = res.filter(e => e.platform === filterPlatform);
    if (filterCampaign) res = res.filter(e =>
      e.utmParams.campaign.toLowerCase().includes(filterCampaign.toLowerCase())
    );
    res.sort((a, b) => {
      if (sortBy === 'clicks') return b.clicks - a.clicks;
      if (sortBy === 'conversions') return b.conversions - a.conversions;
      if (sortBy === 'ctr') return b.ctr - a.ctr;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return res;
  }, [analyticsEntries, filterPlatform, filterCampaign, sortBy]);

  const handleAddEntry = () => {
    if (!newEntry.campaign || !newEntry.url) return;
    addAnalyticsEntry({
      platform: newEntry.platform,
      accountId: crypto.randomUUID(),
      accountName: PLATFORM_LABELS[newEntry.platform],
      url: newEntry.url,
      utmParams: {
        source: platformToSource[newEntry.platform],
        medium: newEntry.medium,
        campaign: toSlug(newEntry.campaign),
        content: newEntry.content || undefined,
      },
      clicks: newEntry.clicks,
      conversions: newEntry.conversions,
      ctr: newEntry.clicks > 0 ? (newEntry.conversions / newEntry.clicks * 100) : 0,
    });
    setShowAddForm(false);
    setNewEntry({ platform: 'vk', url: 'https://', campaign: '', medium: 'social', content: '', clicks: 0, conversions: 0 });
  };

  const maxClicks = Math.max(...analyticsEntries.map(e => e.clicks), 1);

  // Экспорт CSV
  const handleExportCsv = () => {
    const headers = ['Платформа', 'Аккаунт', 'Кампания', 'Medium', 'URL', 'Клики', 'Конверсии', 'CTR%', 'Дата'];
    const rows = filtered.map(e => [
      PLATFORM_LABELS[e.platform],
      e.accountName,
      e.utmParams.campaign,
      e.utmParams.medium,
      e.url,
      e.clicks,
      e.conversions,
      e.ctr.toFixed(1),
      new Date(e.createdAt).toLocaleDateString('ru-RU'),
    ]);
    const csv = [headers, ...rows].map(r => r.join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `utm-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Stats overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={MousePointer} label="Всего кликов" value={totalClicks.toLocaleString()} color="#7C3AED" trend="up" />
        <StatCard icon={ShoppingCart} label="Конверсии" value={totalConversions.toLocaleString()} color="#059669" trend="up" />
        <StatCard icon={BarChart2} label="Ср. CTR" value={`${avgCtr}%`} color="#2563EB" />
        <StatCard icon={Link2} label="Ссылок" value={analyticsEntries.length} color="#D97706" />
      </div>

      {/* By Platform */}
      {Object.keys(byPlatform).length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">📊 По платформам</h3>
          </div>
          <div className="p-6 grid grid-cols-3 gap-4">
            {(Object.keys(byPlatform) as Platform[]).map(platform => {
              const data = byPlatform[platform];
              const pct = totalClicks > 0 ? (data.clicks / totalClicks * 100) : 0;
              return (
                <div key={platform} className="rounded-2xl border p-4" style={{ borderColor: PLATFORM_COLORS[platform] + '40' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <PlatformIcon platform={platform} size={18} />
                    <span className="font-medium text-sm">{PLATFORM_LABELS[platform]}</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{data.clicks.toLocaleString()}</div>
                  <div className="text-xs text-gray-500 mb-3">кликов · {data.conversions} конверсий</div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{ width: `${pct}%`, background: PLATFORM_COLORS[platform] }}
                    />
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{pct.toFixed(1)}% от всех кликов</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* By Campaign */}
      {byCampaign.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">🎯 По кампаниям</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {byCampaign.map(([campaign, data]) => {
              const pct = totalClicks > 0 ? (data.clicks / totalClicks * 100) : 0;
              return (
                <div key={campaign} className="px-6 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <code className="text-sm font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-700">{campaign}</code>
                      <div className="flex gap-1">
                        {Array.from(data.platforms).map(p => (
                          <PlatformIcon key={p} platform={p} size={14} />
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <span className="text-blue-700 font-semibold">{data.clicks.toLocaleString()} кликов</span>
                      <span className="text-emerald-700 font-semibold">{data.conversions} конверсий</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-violet-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <h3 className="font-semibold text-gray-900">Все UTM-ссылки</h3>
          <div className="flex gap-2 flex-wrap">
            {/* Filter platform */}
            <select
              value={filterPlatform}
              onChange={e => setFilterPlatform(e.target.value as Platform | 'all')}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none bg-white"
            >
              <option value="all">Все платформы</option>
              {(['vk', 'ok', 'telegram'] as Platform[]).map(p => (
                <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
              ))}
            </select>
            {/* Filter campaign */}
            <input
              type="text"
              value={filterCampaign}
              onChange={e => setFilterCampaign(e.target.value)}
              placeholder="Поиск по кампании..."
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-300 w-44"
            />
            {/* Sort */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none bg-white"
            >
              <option value="clicks">По кликам</option>
              <option value="conversions">По конверсиям</option>
              <option value="ctr">По CTR</option>
              <option value="date">По дате</option>
            </select>
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:border-violet-300 hover:text-violet-700"
            >
              <Download size={14} />
              CSV
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700"
            >
              <Plus size={14} />
              Добавить
            </button>
          </div>
        </div>

        {/* Add form */}
        {showAddForm && (
          <div className="p-6 bg-violet-50 border-b border-violet-100">
            <h4 className="font-medium text-sm text-gray-800 mb-4">Добавить запись аналитики</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Платформа</label>
                <select
                  value={newEntry.platform}
                  onChange={e => setNewEntry(p => ({ ...p, platform: e.target.value as Platform }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                >
                  {platforms.map(p => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Кампания</label>
                <input type="text" value={newEntry.campaign} onChange={e => setNewEntry(p => ({ ...p, campaign: e.target.value }))}
                  placeholder="summer_sale" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">URL</label>
                <input type="url" value={newEntry.url} onChange={e => setNewEntry(p => ({ ...p, url: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Medium</label>
                <input type="text" value={newEntry.medium} onChange={e => setNewEntry(p => ({ ...p, medium: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Клики</label>
                <input type="number" value={newEntry.clicks} onChange={e => setNewEntry(p => ({ ...p, clicks: +e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Конверсии</label>
                <input type="number" value={newEntry.conversions} onChange={e => setNewEntry(p => ({ ...p, conversions: +e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleAddEntry} className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700">
                Добавить
              </button>
              <button onClick={() => setShowAddForm(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Отмена
              </button>
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <BarChart2 size={40} className="mx-auto text-gray-200 mb-3" />
            <p className="text-gray-400 font-medium">Нет данных аналитики</p>
            <p className="text-sm text-gray-300 mt-1">
              Добавляйте UTM-ссылки к постам — данные появятся здесь
            </p>
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl mx-auto max-w-md text-left">
              <div className="flex gap-2">
                <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  <strong>Как получить реальные данные:</strong> Подключите Яндекс.Метрику или Google Analytics на сайт. 
                  UTM-параметры автоматически передаются в системы аналитики. 
                  Данные из GA4 / Метрики можно импортировать вручную через кнопку «Добавить».
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(entry => {
              const barWidth = (entry.clicks / maxClicks * 100);
              const isExpanded = expandedId === entry.id;
              return (
                <div key={entry.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <PlatformIcon platform={entry.platform} size={16} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
                            {entry.utmParams.campaign}
                          </code>
                          <span className="text-xs text-gray-400">{entry.accountName}</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{entry.url}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 flex-shrink-0">
                      <div className="text-right">
                        <div className="text-sm font-bold text-gray-900">{entry.clicks.toLocaleString()}</div>
                        <div className="text-xs text-gray-400">кликов</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-emerald-700">{entry.conversions}</div>
                        <div className="text-xs text-gray-400">конверсий</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-blue-700">{entry.ctr.toFixed(1)}%</div>
                        <div className="text-xs text-gray-400">CTR</div>
                      </div>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                        className="p-1.5 text-gray-400 hover:text-gray-600"
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Bar */}
                  <div className="mt-2 w-full bg-gray-100 rounded-full h-1">
                    <div
                      className="h-1 rounded-full transition-all"
                      style={{ width: `${barWidth}%`, background: PLATFORM_COLORS[entry.platform] }}
                    />
                  </div>

                  {/* Expanded */}
                  {isExpanded && (
                    <div className="mt-4 bg-gray-50 rounded-xl p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><span className="text-gray-500">utm_source:</span> <code className="text-gray-700">{entry.utmParams.source}</code></div>
                        <div><span className="text-gray-500">utm_medium:</span> <code className="text-gray-700">{entry.utmParams.medium}</code></div>
                        <div><span className="text-gray-500">utm_campaign:</span> <code className="text-gray-700">{entry.utmParams.campaign}</code></div>
                        {entry.utmParams.content && <div><span className="text-gray-500">utm_content:</span> <code className="text-gray-700">{entry.utmParams.content}</code></div>}
                        {entry.utmParams.term && <div><span className="text-gray-500">utm_term:</span> <code className="text-gray-700">{entry.utmParams.term}</code></div>}
                      </div>
                      <div className="text-xs text-gray-400">
                        Создано: {new Date(entry.createdAt).toLocaleString('ru-RU')} · 
                        Обновлено: {new Date(entry.lastUpdatedAt).toLocaleString('ru-RU')}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => incrementClicks(entry.id)}
                          className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100">
                          +1 клик
                        </button>
                        <button onClick={() => incrementConversions(entry.id)}
                          className="px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100">
                          +1 конверсия
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {filtered.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center">
            <span className="text-sm text-gray-400">{filtered.length} записей</span>
            <button onClick={clearAnalytics} className="text-sm text-red-400 hover:text-red-600 flex items-center gap-1">
              <Trash2 size={13} /> Очистить аналитику
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [tab, setTab] = useState<'builder' | 'analytics'>('builder');
  const { analyticsEntries } = useStore();

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">UTM & Аналитика</h1>
          <p className="text-gray-500 text-sm mt-1">
            Генерируй UTM-ссылки, отслеживай какие каналы приносят больше трафика и конверсий
          </p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setTab('builder')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === 'builder' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Link2 size={15} />
            Конструктор
          </button>
          <button
            onClick={() => setTab('analytics')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === 'analytics' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <BarChart2 size={15} />
            Аналитика
            {analyticsEntries.length > 0 && (
              <span className="bg-violet-100 text-violet-700 text-xs px-1.5 py-0.5 rounded-full">
                {analyticsEntries.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="mb-6 bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-200 rounded-2xl p-4 flex gap-3">
        <div className="text-2xl">📊</div>
        <div>
          <p className="text-sm font-medium text-gray-800">Как работает UTM-отслеживание</p>
          <p className="text-xs text-gray-600 mt-0.5">
            UTM-параметры добавляются к ссылкам в постах → пользователь переходит по ссылке → 
            Яндекс.Метрика / Google Analytics фиксируют переход с указанием источника, кампании и платформы.
            <strong className="text-violet-700"> Реальные данные кликов берутся из вашей системы аналитики.</strong>
          </p>
        </div>
      </div>

      {tab === 'builder' ? <UtmBuilderTab /> : <AnalyticsTab />}
    </div>
  );
}
