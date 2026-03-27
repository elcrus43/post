import { useState } from 'react';
import { Play, Trash2, Calendar, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { PostResult } from '../types';
import PlatformIcon from './PlatformIcon';
import { publishToAccount } from '../services/apiService';
import { cn } from '../utils/cn';
import toast from 'react-hot-toast';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  scheduled: 'Запланирован',
  publishing: 'Публикуется...',
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

export default function SchedulerPage() {
  const { posts, accounts, updatePost, updatePostResult, removePost } = useStore();
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const scheduledOrDraft = posts.filter((p) => p.status === 'scheduled' || p.status === 'draft');

  const handlePublishNow = async (postId: string) => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    setPublishingId(postId);
    updatePost(postId, { status: 'publishing' });

    const targetAccs = accounts.filter((a) => post.targetAccounts.includes(a.id));
    const results: PostResult[] = [];

    for (const acc of targetAccs) {
      const result = await publishToAccount(acc, post);
      results.push(result);
      updatePostResult(postId, result);
    }

    const successCount = results.filter((r) => r.status === 'success').length;
    const failCount = results.filter((r) => r.status === 'error').length;

    updatePost(postId, {
      status: failCount === results.length ? 'failed' : 'published',
      publishedAt: new Date().toISOString(),
    });

    if (successCount > 0) toast.success(`Опубликовано в ${successCount} аккаунт(ов)`);
    if (failCount > 0) toast.error(`Ошибка в ${failCount} аккаунт(ах)`);

    setPublishingId(null);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Планировщик</h1>
        <p className="text-sm text-gray-500 mt-0.5">Запланированные и черновые публикации</p>
      </div>

      {scheduledOrDraft.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-6xl mb-3">📅</div>
          <p className="font-medium text-gray-500">Нет запланированных постов</p>
          <p className="text-sm mt-1">Создайте пост и выберите «Запланировать»</p>
        </div>
      ) : (
        <div className="space-y-4">
          {scheduledOrDraft.map((post) => {
            const isPublishing = publishingId === post.id;
            const targetAccs = accounts.filter((a) => post.targetAccounts.includes(a.id));

            return (
              <div key={post.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 line-clamp-2 leading-relaxed">
                      {post.text || <span className="text-gray-400 italic">Без текста</span>}
                    </p>
                  </div>
                  <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0', STATUS_COLORS[post.status])}>
                    {STATUS_LABELS[post.status]}
                  </span>
                </div>

                {/* Accounts */}
                <div className="flex items-center gap-2 mb-3">
                  {targetAccs.map((acc) => {
                    const colors = { vk: 'bg-blue-500', ok: 'bg-orange-500', telegram: 'bg-sky-500' };
                    return (
                      <div
                        key={acc.id}
                        className={cn('w-6 h-6 rounded-lg flex items-center justify-center text-white', colors[acc.platform])}
                        title={acc.name}
                      >
                        <PlatformIcon platform={acc.platform} size={12} />
                      </div>
                    );
                  })}
                  <span className="text-xs text-gray-400">{targetAccs.map((a) => a.name).join(', ')}</span>
                </div>

                {/* Schedule time */}
                {post.scheduledAt && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
                    <Calendar size={12} />
                    {new Date(post.scheduledAt).toLocaleString('ru', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handlePublishNow(post.id)}
                    disabled={isPublishing}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      isPublishing
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-violet-600 text-white hover:bg-violet-700'
                    )}
                  >
                    {isPublishing ? (
                      <><Loader2 size={12} className="animate-spin" /> Публикуем...</>
                    ) : (
                      <><Play size={12} /> Опубликовать сейчас</>
                    )}
                  </button>
                  <button
                    onClick={() => removePost(post.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={12} />
                    Удалить
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
