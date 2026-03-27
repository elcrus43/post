import { useState } from 'react';
import { Search, ExternalLink, Trash2, CheckCircle2, XCircle, Loader2, MessageSquarePlus, MessageSquareOff, AtSign, Smile } from 'lucide-react';
import { useStore } from '../store/useStore';
import PlatformIcon from './PlatformIcon';
import { cn } from '../utils/cn';
import { Platform } from '../types';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  scheduled: 'Запланирован',
  publishing: 'Публикуется',
  published: 'Опубликован',
  failed: 'Ошибка',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  scheduled: 'bg-blue-100 text-blue-700',
  publishing: 'bg-yellow-100 text-yellow-700',
  published: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

export default function HistoryPage() {
  const { posts, accounts, removePost } = useStore();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const publishedPosts = posts
    .filter((p) => p.status === 'published' || p.status === 'failed' || p.status === 'publishing')
    .filter((p) => {
      const matchSearch = p.text.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === 'all' || p.status === filterStatus;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">История</h1>
        <p className="text-sm text-gray-500 mt-0.5">Все опубликованные и обработанные посты</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
            placeholder="Поиск по тексту..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">Все</option>
          <option value="published">Опубликованные</option>
          <option value="failed">С ошибкой</option>
          <option value="publishing">Публикуются</option>
        </select>
      </div>

      {publishedPosts.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-6xl mb-3">📋</div>
          <p className="font-medium text-gray-500">История пуста</p>
          <p className="text-sm mt-1">Опубликованные посты появятся здесь</p>
        </div>
      ) : (
        <div className="space-y-4">
          {publishedPosts.map((post) => {
            const targetAccs = accounts.filter((a) => post.targetAccounts.includes(a.id));
            const colors: Record<Platform, string> = { vk: 'bg-blue-500', ok: 'bg-orange-500', telegram: 'bg-sky-500' };

            return (
              <div key={post.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <p className="text-sm text-gray-800 flex-1 line-clamp-3 leading-relaxed">
                    {post.text || <span className="text-gray-400 italic">Без текста</span>}
                  </p>
                  <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0', STATUS_COLORS[post.status])}>
                    {STATUS_LABELS[post.status]}
                  </span>
                </div>

                {/* Media thumbnails */}
                {post.media.length > 0 && (
                  <div className="flex gap-1.5 mb-3">
                    {post.media.slice(0, 5).map((m) =>
                      m.type === 'image' ? (
                        <img key={m.id} src={m.url} alt="" className="w-12 h-12 object-cover rounded-lg border border-gray-100" />
                      ) : null
                    )}
                    {post.media.length > 5 && (
                      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-xs text-gray-500">
                        +{post.media.length - 5}
                      </div>
                    )}
                  </div>
                )}

                {/* Results per account */}
                <div className="space-y-1.5 mb-3">
                  {targetAccs.map((acc) => {
                    const result = post.results.find((r) => r.accountId === acc.id);
                    return (
                      <div key={acc.id} className="flex items-center gap-2 text-xs">
                        <div className={cn('w-5 h-5 rounded flex items-center justify-center text-white flex-shrink-0', colors[acc.platform])}>
                          <PlatformIcon platform={acc.platform} size={10} />
                        </div>
                        <span className="text-gray-600 flex-1">{acc.name}</span>
                        {!result && <span className="text-gray-400">—</span>}
                        {result?.status === 'success' && (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 size={12} />
                            <span>OK</span>
                            {result.postUrl && (
                              <a href={result.postUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline ml-1">
                                <ExternalLink size={10} />
                              </a>
                            )}
                          </div>
                        )}
                        {result?.status === 'error' && (
                          <div className="flex items-center gap-1 text-red-500" title={result.error}>
                            <XCircle size={12} />
                            <span className="truncate max-w-32">{result.error}</span>
                          </div>
                        )}
                        {post.status === 'publishing' && !result && (
                          <Loader2 size={12} className="animate-spin text-gray-400" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Feature badges */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {post.stickers && post.stickers.length > 0 && (
                    <span className="flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200">
                      <Smile size={10} />
                      {post.stickers.map((s) => s.emoji).join(' ')}
                    </span>
                  )}
                  {post.mentions && post.mentions.length > 0 && (
                    <span className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
                      <AtSign size={10} />
                      {post.mentions.map((m) => `@${m.handle}`).join(', ')}
                    </span>
                  )}
                  {post.firstComment?.enabled && (
                    <span className="flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
                      <MessageSquarePlus size={10} />
                      Первый коммент.
                    </span>
                  )}
                  {post.disableComments && (
                    <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">
                      <MessageSquareOff size={10} />
                      Коммент. закрыты
                    </span>
                  )}
                  {post.autoDelete?.enabled && post.deleteAt && (
                    <span className="flex items-center gap-1 text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-200">
                      <Trash2 size={10} />
                      Удалить: {new Date(post.deleteAt).toLocaleString('ru', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    {new Date(post.createdAt).toLocaleString('ru', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <button
                    onClick={() => removePost(post.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
