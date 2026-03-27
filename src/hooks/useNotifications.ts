import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';

/**
 * Хук push-уведомлений:
 * - запрашивает разрешение на уведомления при монтировании
 * - следит за постами со статусом 'published' и отправляет push
 * - следит за autoDelete и удаляет пост через заданное время
 */
export function useNotifications() {
  const { posts, updatePost, removePost } = useStore();
  const notifiedIds = useRef<Set<string>>(new Set());

  // Запросить разрешение
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Слежение за публикациями
  useEffect(() => {
    posts.forEach((post) => {
      // ── Push-уведомление о выходе поста ──────────────────────────────────
      if (
        post.status === 'published' &&
        !notifiedIds.current.has(post.id) &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        notifiedIds.current.add(post.id);

        const successAccounts = post.results.filter((r) => r.status === 'success').length;
        const preview = post.text.slice(0, 80) + (post.text.length > 80 ? '…' : '');

        new Notification('✅ Пост опубликован!', {
          body: `${preview}\n\nОпубликовано в ${successAccounts} аккаунт(а/ов)`,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: `post-${post.id}`,
          requireInteraction: false,
        });
      }

      // ── Авто-удаление поста ───────────────────────────────────────────────
      if (
        post.status === 'published' &&
        post.autoDelete?.enabled &&
        post.deleteAt &&
        new Date(post.deleteAt) <= new Date()
      ) {
        // Помечаем как удалённый и убираем из списка
        updatePost(post.id, { status: 'failed' }); // переиспользуем статус
        setTimeout(() => removePost(post.id), 300);

        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('🗑️ Пост удалён', {
            body: `Пост автоматически удалён: "${post.text.slice(0, 60)}…"`,
            tag: `delete-${post.id}`,
          });
        }
      }
    });
  }, [posts, updatePost, removePost]);
}
