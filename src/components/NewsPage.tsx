import { useState, useEffect } from 'react';
import { Plus, Trash2, RefreshCw, Rss, Globe, MessageCircle, Loader2, ExternalLink, Clock, Hash, Send, SkipForward, RotateCcw, Filter, Newspaper, XCircle } from 'lucide-react';
import { useStore } from '../store/useStore';
import { NewsSource, NewsItem, NewsCategory } from '../types';
import toast from 'react-hot-toast';

const TYPE_META: Record<string, { icon: any; label: string; color: string; bg: string }> = {
  rss: { icon: Rss, label: 'RSS', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
  vk: { icon: Globe, label: 'ВКонтакте', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  telegram: { icon: MessageCircle, label: 'Telegram', color: 'text-sky-600', bg: 'bg-sky-50 border-sky-200' },
  web: { icon: Globe, label: 'Web', color: 'text-violet-600', bg: 'bg-violet-50 border-violet-200' },
};

const CATEGORY_META: Record<NewsCategory, { label: string; icon: string; color: string; bg: string }> = {
  news: { label: 'Новость', icon: '📰', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  fact: { label: 'Факт', icon: '💡', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  law: { label: 'Законодательство', icon: '⚖️', color: 'text-violet-600', bg: 'bg-violet-50 border-violet-200' },
  social: { label: 'Соцсети', icon: '💬', color: 'text-pink-600', bg: 'bg-pink-50 border-pink-200' },
  market: { label: 'Аналитика', icon: '📊', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
};

const STATUS_META = {
  queued: { label: 'В очереди', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
  sent: { label: 'Отправлено', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
  skipped: { label: 'Пропущено', color: 'text-gray-500', bg: 'bg-gray-50 border-gray-200', dot: 'bg-gray-500' },
};

export default function NewsPage() {
  const { backendUrl, useBackend } = useStore();
  const [activeSection, setActiveSection] = useState<'sources' | 'feed'>('feed');
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [showAddSource, setShowAddSource] = useState(false);
  const [parsing, setParsing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [newSourceType, setNewSourceType] = useState<NewsSource['type']>('rss');
  const [newSourceName, setNewSourceName] = useState('');
  const [filterCat, setFilterCat] = useState<NewsCategory | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'queued' | 'sent' | 'skipped'>('all');

  useEffect(() => {
    loadSources();
    loadNews();
  }, []);

  const loadSources = async () => {
    if (!useBackend || !backendUrl) return;
    const baseUrl = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;
    try {
      const res = await fetch(`${baseUrl}/api/news/sources`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSources(data);
      }
    } catch (e) {
      console.error('Failed to load sources:', e);
    }
  };

  const loadNews = async () => {
    if (!useBackend || !backendUrl) return;
    const baseUrl = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;
    try {
      const res = await fetch(`${baseUrl}/api/news/items`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setNewsItems(data);
      }
    } catch (e) {
      console.error('Failed to load news:', e);
    }
  };

  const handleToggleSource = async (id: string) => {
    if (!useBackend || !backendUrl) return;
    const baseUrl = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;
    const source = sources.find(s => s.id === id);
    if (!source) return;

    try {
      const res = await fetch(`${baseUrl}/api/news/sources/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled: !source.enabled }),
      });
      if (res.ok) {
        await loadSources();
        toast.success(source.enabled ? 'Источник отключен' : 'Источник включен');
      }
    } catch (e) {
      toast.error('Ошибка обновления');
    }
  };

  const handleParseSource = async (id: string) => {
    if (!useBackend || !backendUrl) return;
    const baseUrl = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;
    setParsing(id);

    try {
      const res = await fetch(`${baseUrl}/api/news/sources/${id}/parse`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (res.ok) {
        const data = await res.json();
        await loadSources();
        await loadNews();
        toast.success(`✅ Найдено ${data.items.length} новостей`);
      } else {
        const error = await res.json();
        toast.error(`❌ ${error.error}`);
      }
    } catch (e) {
      toast.error('Ошибка парсинга');
    } finally {
      setParsing(null);
    }
  };

  const handleParseAll = async () => {
    if (!useBackend || !backendUrl) return;
    const baseUrl = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;
    setLoading(true);

    try {
      const res = await fetch(`${baseUrl}/api/news/parse-all`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (res.ok) {
        const data = await res.json();
        await loadSources();
        await loadNews();
        toast.success(`✅ Загружено ${data.count} новостей`);
      }
    } catch (e) {
      toast.error('Ошибка парсинга');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSource = async () => {
    if (!newSourceUrl || !newSourceName) {
      toast.error('Заполните все поля');
      return;
    }

    if (!useBackend || !backendUrl) return;
    const baseUrl = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;

    try {
      const res = await fetch(`${baseUrl}/api/news/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newSourceName, type: newSourceType, url: newSourceUrl }),
      });

      if (res.ok) {
        await loadSources();
        setNewSourceUrl('');
        setNewSourceName('');
        setShowAddSource(false);
        toast.success('Источник добавлен');
      } else {
        const error = await res.json();
        toast.error(`❌ ${error.error}`);
      }
    } catch (e) {
      toast.error('Ошибка сохранения');
    }
  };

  const handleDeleteSource = async (id: string) => {
    if (!useBackend || !backendUrl) return;
    const baseUrl = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;

    try {
      const res = await fetch(`${baseUrl}/api/news/sources/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        await loadSources();
        toast.success('Источник удален');
      }
    } catch (e) {
      toast.error('Ошибка удаления');
    }
  };

  const handleDeleteNews = async (id: string) => {
    if (!useBackend || !backendUrl) return;
    const baseUrl = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;

    try {
      const res = await fetch(`${baseUrl}/api/news/items/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        await loadNews();
        toast.success('Новость удалена');
      } else {
        const error = await res.json();
        toast.error(`❌ ${error.error || 'Ошибка удаления'}`);
      }
    } catch (e: any) {
      console.error('Delete error:', e);
      toast.error(`❌ ${e.message || 'Ошибка удаления'}`);
    }
  };

  const handleNewsAction = async (id: string, action: 'send' | 'skip' | 'restore') => {
    if (!useBackend || !backendUrl) return;
    const baseUrl = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;
    const newStatus = action === 'send' ? 'sent' : action === 'skip' ? 'skipped' : 'queued';

    try {
      const res = await fetch(`${baseUrl}/api/news/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        await loadNews();
        toast.success(action === 'send' ? '✅ Отправлено' : action === 'skip' ? 'Пропущено' : 'Восстановлено');
      }
    } catch (e) {
      toast.error('Ошибка');
    }
  };

  const formatTime = (iso?: string) => {
    if (!iso) return 'Никогда';
    const date = new Date(iso);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const activeSourcesCount = sources.filter(s => s.enabled).length;
  const totalItems = sources.reduce((sum, s) => sum + (s.itemsFound || 0), 0);
  
  const filteredNews = newsItems.filter((n) => {
    const catOk = filterCat === 'all' || n.category === filterCat;
    const stOk = filterStatus === 'all' || n.status === filterStatus;
    return catOk && stOk;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Новости</h1>
        <p className="text-gray-500">Управление источниками и публикациями</p>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveSection('feed')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeSection === 'feed'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Newspaper size={16} />
          Лента новостей
        </button>
        <button
          onClick={() => setActiveSection('sources')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeSection === 'sources'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Rss size={16} />
          Источники
        </button>
      </div>

      {/* Sources Section */}
      {activeSection === 'sources' && (
        <div className="space-y-4">
          {/* Sources Header */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Активных: <span className="text-emerald-600 font-semibold">{activeSourcesCount}</span> из {sources.length} · Загружено: <span className="text-blue-600 font-semibold">{totalItems}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleParseAll}
                disabled={loading || activeSourcesCount === 0}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                Загрузить все
              </button>
              <button
                onClick={() => { setShowAddSource(!showAddSource); setNewSourceName(''); setNewSourceUrl(''); }}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 transition-colors shadow"
              >
                <Plus size={16} />
                Добавить источник
              </button>
            </div>
          </div>

          {/* Add Source Form */}
          {showAddSource && (
            <div className="bg-gradient-to-br from-violet-50 to-blue-50 border-2 border-violet-200 rounded-2xl shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Plus size={18} className="text-violet-600" />
                Новый источник
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Название</label>
                  <input
                    value={newSourceName}
                    onChange={(e) => setNewSourceName(e.target.value)}
                    placeholder="Например: РИА Новости"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">URL</label>
                  <input
                    value={newSourceUrl}
                    onChange={(e) => setNewSourceUrl(e.target.value)}
                    placeholder="https://... или @channel"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Тип</label>
                  <select
                    value={newSourceType}
                    onChange={(e) => setNewSourceType(e.target.value as NewsSource['type'])}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                  >
                    <option value="rss">📡 RSS</option>
                    <option value="vk">🔵 ВКонтакте</option>
                    <option value="telegram">✈️ Telegram</option>
                    <option value="web">🌐 Web</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={handleAddSource} 
                  className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  Добавить
                </button>
                <button 
                  onClick={() => setShowAddSource(false)} 
                  className="px-5 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 text-sm font-medium rounded-xl transition-colors"
                >
                  Отмена
                </button>
              </div>
            </div>
          )}

          {/* Sources List */}
          {sources.length === 0 ? (
            <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border">
              <div className="text-6xl mb-3">📡</div>
              <p className="font-medium text-gray-500">Нет источников</p>
              <p className="text-sm mt-1">Нажмите «Добавить источник» чтобы подключить RSS</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {sources.map((source) => {
                const meta = TYPE_META[source.type];
                const Icon = meta.icon;
                const isParsing = parsing === source.id;

                return (
                  <div 
                    key={source.id} 
                    className={`bg-white rounded-2xl border shadow-sm transition-all ${
                      source.enabled ? 'border-gray-200 hover:shadow-md' : 'border-gray-100 opacity-60'
                    }`}
                  >
                    <div className="p-5">
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.bg} border`}>
                          <Icon size={24} className={meta.color} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900 truncate">{source.name}</h3>
                            <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${meta.color} ${meta.bg}`}>
                              {meta.label}
                            </span>
                          </div>
                          <p className="text-gray-500 text-sm truncate mb-2">{source.url}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                              <Hash size={12} />
                              {source.itemsFound || 0} материалов
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              {formatDate(source.lastParsed)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleParseSource(source.id)}
                            disabled={!source.enabled || isParsing}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                              isParsing
                                ? 'bg-blue-100 text-blue-700 cursor-wait'
                                : source.enabled
                                ? 'bg-blue-50 hover:bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            {isParsing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                            {isParsing ? 'Парсинг...' : 'Запустить'}
                          </button>

                          <button
                            onClick={() => handleToggleSource(source.id)}
                            className={`relative w-11 h-6 rounded-full transition-all duration-300 ${
                              source.enabled ? 'bg-emerald-500' : 'bg-gray-300'
                            }`}
                          >
                            <span
                              className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-300 ${
                                source.enabled ? 'left-6' : 'left-1'
                              }`}
                            />
                          </button>

                          <button
                            onClick={() => handleDeleteSource(source.id)}
                            className="p-2 rounded-xl text-red-400 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* News Feed Section */}
      {activeSection === 'feed' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all' as const, label: 'Все', icon: '📋' },
                { key: 'news' as const, label: 'Новости', icon: '📰' },
                { key: 'law' as const, label: 'Законы', icon: '⚖️' },
                { key: 'market' as const, label: 'Аналитика', icon: '📊' },
                { key: 'fact' as const, label: 'Факты', icon: '💡' },
                { key: 'social' as const, label: 'Соцсети', icon: '💬' },
              ].map((c) => (
                <button
                  key={c.key}
                  onClick={() => setFilterCat(c.key)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                    filterCat === c.key
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'
                  }`}
                >
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 ml-auto">
              {(['all', 'queued', 'sent', 'skipped'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    filterStatus === s
                      ? 'bg-gray-900 text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {s === 'all' ? 'Все' : s === 'queued' ? '⏳ В очереди' : s === 'sent' ? '✅ Отправлено' : '⛔ Пропущено'}
                </button>
              ))}
            </div>
          </div>

          {/* Count */}
          <p className="text-sm text-gray-600">
            Найдено: <span className="font-semibold text-gray-900">{filteredNews.length}</span> материалов
          </p>

          {/* News Cards */}
          {filteredNews.length === 0 ? (
            <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border">
              <div className="text-6xl mb-3">📭</div>
              <p className="font-medium text-gray-500">Нет новостей</p>
              <p className="text-sm mt-1">Загрузите новости из источников во вкладке «Источники»</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {filteredNews.map((item) => {
                const cat = CATEGORY_META[item.category];
                const st = STATUS_META[item.status];

                return (
                  <div 
                    key={item.id} 
                    className={`bg-white rounded-2xl border shadow-sm transition-all ${
                      item.status === 'skipped' ? 'border-gray-200 opacity-60' : 'border-gray-200 hover:shadow-md'
                    }`}
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${cat.bg} ${cat.color}`}>
                            {cat.icon} {cat.label}
                          </span>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${st.bg} ${st.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                            {st.label}
                          </span>
                        </div>
                        <span className="text-gray-500 text-xs whitespace-nowrap mt-1">{formatDate(item.date)}</span>
                      </div>

                      <h3 className="text-gray-900 font-semibold text-base leading-snug mb-2">{item.title}</h3>

                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-lg">{item.sourceIcon}</span>
                        <span className="text-gray-500 text-xs font-medium">{item.source}</span>
                      </div>

                      <p className="text-gray-600 text-sm leading-relaxed line-clamp-3 mb-3">
                        {item.preview}
                      </p>

                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {item.tags.map((tag) => (
                          <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md text-xs font-medium">
                            #{tag}
                          </span>
                        ))}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                        {item.status === 'queued' && (
                          <>
                            <button
                              onClick={() => handleNewsAction(item.id, 'send')}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors"
                            >
                              <Send size={12} />
                              Опубликовать
                            </button>
                            <button
                              onClick={() => handleNewsAction(item.id, 'skip')}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors"
                            >
                              <SkipForward size={12} />
                              Пропустить
                            </button>
                          </>
                        )}
                        {item.status === 'sent' && (
                          <span className="text-emerald-600 text-xs font-medium flex items-center gap-1.5">
                            ✅ Опубликовано
                          </span>
                        )}
                        {item.status === 'skipped' && (
                          <button
                            onClick={() => handleNewsAction(item.id, 'restore')}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors"
                          >
                            <RotateCcw size={12} />
                            Вернуть в очередь
                          </button>
                        )}
                        {item.sourceUrl && (
                          <a 
                            href={item.sourceUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-blue-600 text-xs transition-colors flex items-center gap-1"
                          >
                            <ExternalLink size={12} />
                            Источник
                          </a>
                        )}
                        <button
                          onClick={() => handleDeleteNews(item.id)}
                          className="ml-auto text-gray-400 hover:text-red-600 text-xs transition-colors flex items-center gap-1"
                          title="Удалить новость"
                        >
                          <XCircle size={14} />
                          Удалить
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
