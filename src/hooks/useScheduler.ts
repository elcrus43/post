import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { publishToAccount } from '../services/apiService';
import { PostResult } from '../types';
import toast from 'react-hot-toast';

/**
 * Хук автоматического планировщика.
 * Каждые 30 секунд проверяет посты со статусом 'scheduled'
 * и если время наступило — публикует их.
 */
export function useScheduler() {
  // We use useStore.getState() inside the interval to always get fresh state
  const publishingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const tick = async () => {
      const now = new Date();
      const { posts: currentPosts, accounts: currentAccounts } = useStore.getState();

      const due = currentPosts.filter(
        (p) =>
          p.status === 'scheduled' &&
          p.scheduledAt &&
          new Date(p.scheduledAt) <= now &&
          !publishingRef.current.has(p.id)
      );

      for (const post of due) {
        publishingRef.current.add(post.id);
        useStore.getState().updatePost(post.id, { status: 'publishing' });

        const targetAccs = currentAccounts.filter((a) =>
          post.targetAccounts.includes(a.id)
        );

        const results: PostResult[] = [];

        for (const acc of targetAccs) {
          const result = await publishToAccount(acc, post);
          results.push(result);
          useStore.getState().updatePostResult(post.id, result);
        }

        const successCount = results.filter((r) => r.status === 'success').length;
        const failCount = results.filter((r) => r.status === 'error').length;

        useStore.getState().updatePost(post.id, {
          status: failCount === results.length ? 'failed' : 'published',
          publishedAt: new Date().toISOString(),
        });

        publishingRef.current.delete(post.id);

        if (successCount > 0) {
          toast.success(`⏰ Запланированный пост опубликован в ${successCount} аккаунт(ов)`);
        }
        if (failCount > 0) {
          toast.error(`⏰ Ошибка публикации в ${failCount} аккаунт(ах)`);
        }
      }
    };

    // Запускаем сразу при монтировании
    tick();

    // Затем каждые 30 секунд
    const interval = setInterval(tick, 30_000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
