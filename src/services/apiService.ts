import { Account, Post, PostResult } from '../types';
import md5 from 'md5';
import { useStore } from '../store/useStore';

// ─── CORS Proxy ───────────────────────────────────────────────────────────────
// Используется для обхода CORS при прямых запросах к VK и OK API из браузера.
// В продакшене замените на свой бэкенд-прокси (Railway/Render).
// Для разработки и демо используем публичный CORS-прокси.
const CORS_PROXY = 'https://corsproxy.io/?';

function proxied(url: string): string {
  const { backendUrl, useBackend } = useStore.getState();
  
  if (useBackend && backendUrl) {
    // Используем наш бэкенд прокси для VK и OK
    if (url.includes('api.vk.ru') || url.includes('api.vk.com')) {
      return url.replace(/https:\/\/api\.vk\.(ru|com)/, `${backendUrl}/vk`);
    }
    if (url.includes('api.ok.ru')) {
      return url.replace('https://api.ok.ru', `${backendUrl}/ok`);
    }
  }

  // Fallback на публичный CORS-прокси
  return `${CORS_PROXY}${encodeURIComponent(url)}`;
}

// ─── Telegram ────────────────────────────────────────────────────────────────
async function postToTelegram(account: Account, post: Post): Promise<PostResult> {
  const base: PostResult = {
    accountId: account.id,
    platform: 'telegram',
    status: 'error',
  };

  if (!account.tgBotToken || !account.tgChatId) {
    return { ...base, error: 'Не указан Bot Token или Chat ID' };
  }

  const apiBase = `https://api.telegram.org/bot${account.tgBotToken}`;

  try {
    const images = post.media.filter((m) => m.type === 'image');

    if (images.length === 1) {
      // Одно фото + подпись
      const res = await fetch(`${apiBase}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: account.tgChatId,
          photo: images[0].url,
          caption: post.text.slice(0, 1024),
          parse_mode: 'HTML',
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.description);
      return {
        ...base,
        status: 'success',
        postId: String(data.result.message_id),
        postUrl: `https://t.me/c/${String(account.tgChatId).replace('-100', '')}/${data.result.message_id}`,
        publishedAt: new Date().toISOString(),
      };
    }

    if (images.length > 1) {
      // Альбом фотографий
      const media = images.slice(0, 10).map((img, i) => ({
        type: 'photo',
        media: img.url,
        ...(i === 0 ? { caption: post.text.slice(0, 1024), parse_mode: 'HTML' } : {}),
      }));
      const res = await fetch(`${apiBase}/sendMediaGroup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: account.tgChatId, media }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.description);
      return {
        ...base,
        status: 'success',
        postId: String(data.result[0]?.message_id),
        publishedAt: new Date().toISOString(),
      };
    }

    // Только текст
    const res = await fetch(`${apiBase}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: account.tgChatId,
        text: post.text,
        parse_mode: 'HTML',
      }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.description);
    return {
      ...base,
      status: 'success',
      postId: String(data.result.message_id),
      publishedAt: new Date().toISOString(),
    };
  } catch (e: unknown) {
    return { ...base, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Проверка Telegram токена ─────────────────────────────────────────────────
export async function testTelegramConnection(botToken: string): Promise<{ ok: boolean; name?: string; error?: string }> {
  const { useBackend, backendUrl } = useStore.getState();

  if (useBackend && backendUrl) {
    try {
      const res = await fetch(`${backendUrl}/api/test/telegram?token=${encodeURIComponent(botToken)}`);
      return await res.json();
    } catch (e) {
      return { ok: false, error: 'Ошибка бэкенд-прокси для Telegram' };
    }
  }

  // Fallback (может не работать в браузере из-за CORS)
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const data = await res.json();
    if (data.ok) {
      return { ok: true, name: data.result.username };
    }
    return { ok: false, error: data.description };
  } catch (e) {
    return { ok: false, error: 'Нет подключения к Telegram API (CORS?)' };
  }
}

export async function testTelegramAccountConnection(accountId: string): Promise<{ ok: boolean; name?: string; error?: string }> {
  const { useBackend, backendUrl } = useStore.getState();
  if (!useBackend || !backendUrl) {
    return { ok: false, error: 'Требуется бэкенд для теста сохраненного аккаунта' };
  }
  try {
    const res = await fetch(`${backendUrl}/api/test/telegram?accountId=${encodeURIComponent(accountId)}`, {
      credentials: 'include',
    });
    const data = await res.json();
    return data;
  } catch {
    return { ok: false, error: 'Ошибка бэкенд-прокси для Telegram' };
  }
}

// ─── VK ───────────────────────────────────────────────────────────────────────
async function postToVK(account: Account, post: Post): Promise<PostResult> {
  const base: PostResult = {
    accountId: account.id,
    platform: 'vk',
    status: 'error',
  };

  if (!account.vkToken || !account.vkOwnerId) {
    return { ...base, error: 'Не указан токен VK или Owner ID' };
  }

  try {
    const params = new URLSearchParams({
      owner_id: account.vkOwnerId,
      message: post.text,
      access_token: account.vkToken,
      v: '5.199',
    });

    const url = `https://api.vk.ru/method/wall.post?${params}`;

    const res = await fetch(proxied(url));
    const data = await res.json();

    if (data.error) {
      const err = data.error as { error_code: number; error_msg: string };
      throw new Error(`[${err.error_code}] ${err.error_msg}`);
    }

    const response = data.response as { post_id: number } | undefined;
    const postId = response?.post_id;
    return {
      ...base,
      status: 'success',
      postId: String(postId),
      postUrl: `https://vk.com/wall${account.vkOwnerId}_${postId}`,
      publishedAt: new Date().toISOString(),
    };
  } catch (e: unknown) {
    return { ...base, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Проверка VK токена ───────────────────────────────────────────────────────
export async function testVKConnection(token: string): Promise<{ ok: boolean; name?: string; error?: string }> {
  try {
    const params = new URLSearchParams({ access_token: token, v: '5.199' });
    const url = `https://api.vk.ru/method/users.get?${params}`;
    
    const res = await fetch(proxied(url));
    const data = await res.json();
    if (data.error) {
      const err = data.error as { error_msg: string };
      return { ok: false, error: err.error_msg };
    }
    const users = data.response as Array<{ first_name: string; last_name: string }>;
    return { ok: true, name: `${users[0].first_name} ${users[0].last_name}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Ошибка подключения к VK' };
  }
}

// ─── Одноклассники ────────────────────────────────────────────────────────────
function okSign(params: Record<string, string>, secretKey: string): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('');
  return md5(sorted + secretKey).toLowerCase();
}

async function postToOK(account: Account, post: Post): Promise<PostResult> {
  const base: PostResult = {
    accountId: account.id,
    platform: 'ok',
    status: 'error',
  };

  if (!account.okToken || !account.okAppKey || !account.okAppSecretKey) {
    return { ...base, error: 'Не указаны токен или ключи OK приложения' };
  }

  try {
    const sessionSecretKey = md5(account.okToken + account.okAppSecretKey).toLowerCase();

    const attachment = JSON.stringify({
      media: [{ type: 'text', text: post.text }],
    });

    const params: Record<string, string> = {
      application_key: account.okAppKey,
      attachment,
      format: 'json',
      method: 'mediatopic.post',
      type: 'GROUP_THEME',
      ...(account.okGroupId ? { gid: account.okGroupId } : {}),
    };

    const sig = okSign(params, sessionSecretKey);

    const urlParams = new URLSearchParams({
      ...params,
      sig,
      access_token: account.okToken,
    });

    const url = `https://api.ok.ru/fb.do?${urlParams}`;

    const res = await fetch(proxied(url));
    const data = await res.json();

    const d = data as Record<string, unknown>;
    if (d.error_code) throw new Error(`[${d.error_code}] ${d.error_msg}`);

    return {
      ...base,
      status: 'success',
      postId: String(data),
      publishedAt: new Date().toISOString(),
    };
  } catch (e: unknown) {
    return { ...base, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Проверка OK токена ───────────────────────────────────────────────────────
export async function testOKConnection(token: string, appKey: string, appSecret: string): Promise<{ ok: boolean; name?: string; error?: string }> {
  try {
    const sessionSecretKey = md5(token + appSecret).toLowerCase();
    const params: Record<string, string> = {
      application_key: appKey,
      format: 'json',
      method: 'users.getCurrentUser',
    };
    const sig = okSign(params, sessionSecretKey);
    const urlParams = new URLSearchParams({ ...params, sig, access_token: token });
    const url = `https://api.ok.ru/fb.do?${urlParams}`;

    const res = await fetch(proxied(url));
    const data = await res.json();

    if (data.error_code) {
      return { ok: false, error: `[${data.error_code}] ${data.error_msg}` };
    }
    return { ok: true, name: `${data.first_name || ''} ${data.last_name || ''}`.trim() };
  } catch (e) {
    return { ok: false, error: 'Ошибка подключения к OK: ' + (e instanceof Error ? e.message : String(e)) };
  }
}

// ─── Главная функция публикации ───────────────────────────────────────────────
export async function publishToAccount(account: Account, post: Post): Promise<PostResult> {
  const { useBackend, backendUrl } = useStore.getState();
  const media = Array.isArray(post?.media) ? post.media : [];
  const text = post?.text || '';

  if (useBackend && backendUrl) {
    try {
      let endpoint: string;
      if (account.platform === 'vk' && post.isVkStory) {
        endpoint = '/api/publish/vk/story';
      } else if (account.platform === 'telegram') {
        endpoint = '/api/publish/telegram';
      } else {
        endpoint = `/api/publish/${account.platform}`;
      }

      const res = await fetch(`${backendUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Для прокси нам нужно передать либо accountId (если он в базе), 
          // либо все данные аккаунта. В нашей текущей реализации server.js ожидает accountId 
          // из MongoDB. Но так как фронтенд пока хранит всё в localStorage, 
          // мы либо должны сначала сохранить аккаунт в БД, либо изменить server.js.
          
          // ВАЖНО: В текущем server.js эндпоинты ожидают accountId базы данных.
          // Если мы хотим бесшовную интеграцию, прокси должен принимать токены.
          
          // Упростим: если используем прокси, передаём данные напрямую (нужно доработать server.js)
          // Или просто будем считать, что прокси пока только для VK/TG с переданными токенами
          
          // Передадим аккаунт целиком или необходимые поля
          accountId: account.id,
          message: text,
          text, // для TG
          media, // ВАЖНО: передаем массив для обработки на бэкенде
          attachments: media.map(m => m.url).join(','), // для обратной совместимости
          
          token: account.platform === 'vk' ? account.vkToken : 
                 account.platform === 'ok' ? account.okToken : 
                 account.tgBotToken,
          ownerId: account.platform === 'vk' ? account.vkOwnerId : 
                   account.platform === 'ok' ? account.okGroupId : 
                   account.tgChatId,
          
          appKey: account.okAppKey,
          secretKey: account.okAppSecretKey,
          groupId: account.okGroupId,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      return {
        accountId: account.id,
        platform: account.platform,
        status: 'success',
        postId: data.post_id || data.result?.message_id || String(data),
        publishedAt: new Date().toISOString(),
      };
    } catch (e: unknown) {
      console.error('Backend proxy error:', e);
      // Fallback to direct posting if backend fails? 
      // Нет, лучше вернуть ошибку чтобы пользователь знал
      return {
        accountId: account.id,
        platform: account.platform,
        status: 'error',
        error: `Ошибка бэкенд-прокси: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  // Прямая публикация (Direct/CORS Proxy fallback)
  switch (account.platform) {
    case 'telegram': return postToTelegram(account, post);
    case 'vk':       return postToVK(account, post);
    case 'ok':       return postToOK(account, post);
    default:
      return {
        accountId: account.id,
        platform: account.platform,
        status: 'error',
        error: 'Неизвестная платформа',
      };
  }
}
