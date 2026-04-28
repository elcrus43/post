#!/bin/bash
cd /c/Users/Office-40/post-project

cat > src/components/NewsSourcesPage.tsx << 'EOFPAGE'
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, ExternalLink, Rss, Users, Send, Globe } from 'lucide-react';

interface NewsSource {
  id: string;
  name: string;
  type: 'rss' | 'vk' | 'telegram' | 'web';
  url: string;
  enabled: boolean;
  lastParsed?: string;
  itemsCount?: number;
}

const SOURCE_TYPES = [
  { key: 'rss', label: 'RSS Feed', icon: Rss, color: 'text-orange-500' },
  { key: 'vk', label: 'VK Group', icon: Users, color: 'text-blue-500' },
  { key: 'telegram', label: 'Telegram Channel', icon: Send, color: 'text-sky-500' },
  { key: 'web', label: 'Website', icon: Globe, color: 'text-purple-500' },
];

export default function NewsSourcesPage() {
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newSource, setNewSource] = useState<Partial<NewsSource>>({ type: 'rss' });

  useEffect(() => {
    loadSources();
  }, []);

  const loadSources = async () => {
    try {
      const res = await axios.get('/api/news/sources');
      setSources(res.data);
    } catch (e) {
      console.error('Failed to load sources:', e);
    }
  };

  const handleAdd = async () => {
    if (!newSource.name || !newSource.url) {
      alert('аполните название и URL');
      return;
    }
    try {
      await axios.post('/api/news/sources', newSource);
      setShowAdd(false);
      setNewSource({ type: 'rss' });
      loadSources();
    } catch (e) {
      alert('шибка добавления');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('далить источник?')) return;
    try {
      await axios.delete(\/api/news/sources/\\);
      loadSources();
    } catch (e) {
      alert('шибка удаления');
    }
  };

  const handleToggle = async (source: NewsSource) => {
    try {
      await axios.patch(\/api/news/sources/\\, {
        enabled: !source.enabled
      });
      loadSources();
    } catch (e) {
      alert('шибка обновления');
    }
  };

  const handleParse = async (source: NewsSource) => {
    try {
      await axios.post(\/api/news/sources/\/parse\);
      loadSources();
    } catch (e) {
      alert('шибка парсинга');
    }
  };

  return (
    <div className=\"p-6 space-y-6\">
      <div className=\"flex items-center justify-between\">
        <div>
          <h2 className=\"text-2xl font-bold text-gray-900\">сточники новостей</h2>
          <p className=\"text-sm text-gray-600\">правление RSS, VK, Telegram и веб-сайтами</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className=\"flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-colors\"
        >
          <Plus size={18} />
          обавить источник
        </button>
      </div>

      {/* Sources list */}
      {sources.length === 0 ? (
        <div className=\"text-center py-16 bg-white rounded-lg border\">
          <p className=\"text-4xl mb-3\">??</p>
          <p className=\"text-gray-500 mb-4\">ет источников</p>
          <button
            onClick={() => setShowAdd(true)}
            className=\"px-4 py-2 bg-violet-600 text-white rounded-lg\"
          >
            обавить первый источник
          </button>
        </div>
      ) : (
        <div className=\"grid gap-4\">
          {sources.map((source) => {
            const typeInfo = SOURCE_TYPES.find(t => t.key === source.type);
            const Icon = typeInfo?.icon || Globe;
            return (
              <div key={source.id} className=\"bg-white rounded-lg border p-5\">
                <div className=\"flex items-start justify-between\">
                  <div className=\"flex items-start gap-4 flex-1\">
                    <div className={\p-3 rounded-lg bg-gray-50 \\}>
                      <Icon size={24} />
                    </div>
                    <div className=\"flex-1\">
                      <div className=\"flex items-center gap-2 mb-1\">
                        <h3 className=\"font-semibold text-gray-900\">{source.name}</h3>
                        <span className={\px-2 py-0.5 rounded text-xs font-medium \\}>
                          {source.enabled ? 'ктивен' : 'тключен'}
                        </span>
                      </div>
                      <a href={source.url} target=\"_blank\" rel=\"noopener noreferrer\" className=\"text-sm text-blue-600 hover:underline flex items-center gap-1 mb-2\">
                        {source.url}
                        <ExternalLink size={12} />
                      </a>
                      <div className=\"flex gap-4 text-xs text-gray-500\">
                        {source.lastParsed && <span>оследний парсинг: {new Date(source.lastParsed).toLocaleString('ru-RU')}</span>}
                        {source.itemsCount !== undefined && <span>айдено: {source.itemsCount}</span>}
                      </div>
                    </div>
                  </div>
                  <div className=\"flex gap-2\">
                    <button
                      onClick={() => handleParse(source)}
                      className=\"px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded text-sm transition-colors\"
                    >
                      ?? арсить
                    </button>
                    <button
                      onClick={() => handleToggle(source)}
                      className={\px-3 py-1.5 rounded text-sm transition-colors \\}
                    >
                      {source.enabled ? '? тключить' : '? ключить'}
                    </button>
                    <button
                      onClick={() => handleDelete(source.id)}
                      className=\"p-1.5 text-gray-400 hover:text-red-600 transition-colors\"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add source modal */}
      {showAdd && (
        <div className=\"fixed inset-0 bg-black/50 flex items-center justify-center z-50\" onClick={() => setShowAdd(false)}>
          <div className=\"bg-white rounded-lg p-6 w-full max-w-md\" onClick={(e) => e.stopPropagation()}>
            <h3 className=\"text-lg font-bold mb-4\">обавить источник</h3>
            <div className=\"space-y-4\">
              <div>
                <label className=\"block text-sm font-medium text-gray-700 mb-1\">Тип источника</label>
                <div className=\"grid grid-cols-2 gap-2\">
                  {SOURCE_TYPES.map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => setNewSource({ ...newSource, type: key as any })}
                      className={\lex items-center gap-2 px-3 py-2 rounded-lg border transition-colors \\}
                    >
                      <Icon size={16} />
                      <span className=\"text-sm\">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className=\"block text-sm font-medium text-gray-700 mb-1\">азвание</label>
                <input
                  type=\"text\"
                  value={newSource.name || ''}
                  onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                  placeholder=\"едомости едвижимость\"
                  className=\"w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500\"
                />
              </div>

              <div>
                <label className=\"block text-sm font-medium text-gray-700 mb-1\">URL</label>
                <input
                  type=\"text\"
                  value={newSource.url || ''}
                  onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
                  placeholder={newSource.type === 'rss' ? 'https://site.com/feed.xml' : newSource.type === 'vk' ? 'https://vk.com/group_name' : newSource.type === 'telegram' ? '@channel_name' : 'https://site.com/news'}
                  className=\"w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500\"
                />
                <p className=\"text-xs text-gray-500 mt-1\">
                  {newSource.type === 'rss' && 'рямая ссылка на RSS feed'}
                  {newSource.type === 'vk' && 'Ссылка на группу VK'}
                  {newSource.type === 'telegram' && 'Username канала (с @ или без)'}
                  {newSource.type === 'web' && 'URL страницы с новостями'}
                </p>
              </div>

              <div className=\"flex gap-2 pt-2\">
                <button
                  onClick={handleAdd}
                  className=\"flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-colors\"
                >
                  обавить
                </button>
                <button
                  onClick={() => setShowAdd(false)}
                  className=\"px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors\"
                >
                  тмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
EOFPAGE

echo \"? NewsSourcesPage created\"
