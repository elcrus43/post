import { useState, useEffect } from 'react';
import { Plus, Trash2, RefreshCw, Rss, Globe, MessageCircle, Wifi, WifiOff, Loader2, ExternalLink, Clock, Hash } from 'lucide-react';
import { useStore } from '../store/useStore';
import { NewsSource } from '../types';
import toast from 'react-hot-toast';

const TYPE_META: Record<string, { icon: any; label: string; color: string; bg: string }> = {
  rss: { icon: Rss, label: 'RSS', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
  vk: { icon: Globe, label: 'ВКонтакте', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  telegram: { icon: MessageCircle, label: 'Telegram', color: 'text-sky-600', bg: 'bg-sky-50 border-sky-200' },
  web: { icon: Globe, label: 'Web', color: 'text-violet-600', bg: 'bg-violet-50 border-violet-200' },
};

export default function NewsSourcesPage() {
  const { backendUrl, useBackend } = useStore();
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [parsing, setParsing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newType, setNewType] = useState<NewsSource['type']>('rss');
  const [newName, setNewName] = useState('');

  useEffect(() => {
    loadSources();
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

  const handleToggle = async (id: string) => {
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

  const handleParse = async (id: string) => {
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
        toast.success(`✅ Загружено ${data.count} новостей из ${sources.filter(s => s.enabled).length} источников`);
      }
    } catch (e) {
      toast.error('Ошибка парсинга');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newUrl || !newName) {
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
        body: JSON.stringify({ name: newName, type: newType, url: newUrl }),
      });

      if (res.ok) {
        await loadSources();
        setNewUrl('');
        setNewName('');
        setShowAdd(false);
        toast.success('Источник добавлен');
      } else {
        const error = await res.json();
        toast.error(`❌ ${error.error}`);
      }
    } catch (e) {
      toast.error('Ошибка сохранения');
    }
  };

  const handleDelete = async (id: string) => {
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

  const formatTime = (iso?: string) => {
    if (!iso) return 'Никогда';
    const date = new Date(iso);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  const activeCount = sources.filter(s => s.enabled).length;
  const totalItems = sources.reduce((sum, s) => sum + (s.itemsFound || 0), 0);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Источники новостей</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Активных: <span className="text-emerald-600 font-semibold">{activeCount}</span> из {sources.length} · Загружено: <span className="text-blue-600 font-semibold">{totalItems}</span> материалов
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleParseAll}
            disabled={loading || activeCount === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Загрузить все
          </button>
          <button
            onClick={() => { setShowAdd(!showAdd); setNewName(''); setNewUrl(''); }}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 transition-colors shadow"
          >
            <Plus size={16} />
            Добавить
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-gradient-to-br from-violet-50 to-blue-50 border-2 border-violet-200 rounded-2xl shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Plus size={18} className="text-violet-600" />
            Новый источник
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Название</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Например: РИА Новости"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">URL</label>
              <input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://... или @channel"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Тип</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as NewsSource['type'])}
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
              onClick={handleAdd} 
              className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Добавить источник
            </button>
            <button 
              onClick={() => setShowAdd(false)} 
              className="px-5 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 text-sm font-medium rounded-xl transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Sources list */}
      {sources.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-6xl mb-3">📡</div>
          <p className="font-medium text-gray-500">Нет источников</p>
          <p className="text-sm mt-1">Нажмите «Добавить» чтобы подключить RSS или другой источник</p>
        </div>
      ) : (
        <div className="space-y-3">
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
                    {/* Icon */}
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.bg} border`}>
                      <Icon size={24} className={meta.color} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">{source.name}</h3>
                        <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${meta.color} ${meta.bg}`}>
                          {meta.label}
                        </span>
                      </div>
                      <p className="text-gray-500 text-sm truncate mb-2">{source.url}</p>
                      
                      {/* Stats */}
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Hash size={12} />
                          {source.itemsFound || 0} материалов
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          Последнее обновление: {formatDate(source.lastParsed)} в {formatTime(source.lastParsed)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Parse button */}
                      <button
                        onClick={() => handleParse(source.id)}
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

                      {/* Toggle */}
                      <button
                        onClick={() => handleToggle(source.id)}
                        className={`relative w-11 h-6 rounded-full transition-all duration-300 ${
                          source.enabled ? 'bg-emerald-500' : 'bg-gray-300'
                        }`}
                        title={source.enabled ? 'Отключить' : 'Включить'}
                      >
                        <span
                          className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-300 ${
                            source.enabled ? 'left-6' : 'left-1'
                          }`}
                        />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(source.id)}
                        className="p-2 rounded-xl text-red-400 hover:bg-red-50 transition-colors"
                        title="Удалить"
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
  );
}
