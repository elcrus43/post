import { useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { useStore } from '../store/useStore';
import { RepostRule, RepostHistoryItem } from '../types';
import toast from 'react-hot-toast';

// ── RSS Parser ────────────────────────────────────────────────────────────────
async function fetchRSS(url: string): Promise<Array<{ id: string; title: string; text: string; image?: string; link: string; pubDate: string }>> {
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
  const res = await fetch(proxyUrl);
  const data = await res.json();
  const parser = new DOMParser();
  const doc = parser.parseFromString(data.contents, 'text/xml');
  const items = Array.from(doc.querySelectorAll('item'));
  return items.map((item) => {
    const title = item.querySelector('title')?.textContent || '';
    const description = item.querySelector('description')?.textContent || '';
    const link = item.querySelector('link')?.textContent || '';
    const pubDate = item.querySelector('pubDate')?.textContent || new Date().toISOString();
    const guid = item.querySelector('guid')?.textContent || link;
    // Extract image from enclosure or media:content
    const enclosure = item.querySelector('enclosure');
    const mediaContent = item.querySelector('content');
    const image = enclosure?.getAttribute('url') || mediaContent?.getAttribute('url') || extractImageFromHtml(description);
    // Clean HTML from description safely (FIX #10: XSS protection)
    const cleanText = description.trim();
    return { id: guid, title, text: title + (cleanText ? '\n\n' + cleanText : ''), image: image || undefined, link, pubDate };
  });
}

function extractImageFromHtml(html: string): string | null {
  // FIX #10: Санитизация HTML перед извлечением изображений
  const cleanHtml = DOMPurify.sanitize(html);
  const match = cleanHtml.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

// ── VK Wall Parser ────────────────────────────────────────────────────────────
async function fetchVKWall(ownerId: string, token: string): Promise<Array<{ id: string; text: string; image?: string; link: string; pubDate: string }>> {
  const params = new URLSearchParams({
    owner_id: ownerId,
    count: '10',
    access_token: token,
    v: '5.131',
    filter: 'owner',
  });
  const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(`https://api.vk.com/method/wall.get?${params}`)}`);
  const data = await res.json();
  if (data.response?.items) {
    return data.response.items.map((item: any) => {
      const image = item.attachments?.find((a: any) => a.type === 'photo')?.photo?.sizes?.slice(-1)[0]?.url;
      return {
        id: String(item.id),
        text: item.text || '',
        image,
        link: `https://vk.com/wall${ownerId}_${item.id}`,
        pubDate: new Date(item.date * 1000).toISOString(),
      };
    });
  }
  return [];
}

// ── Telegram Channel Parser ───────────────────────────────────────────────────
async function fetchTGChannel(username: string): Promise<Array<{ id: string; text: string; image?: string; link: string; pubDate: string }>> {
  // Use public RSS proxy for Telegram channels
  const rssUrl = `https://rsshub.app/telegram/channel/${username.replace('@', '')}`;
  try {
    return await fetchRSS(rssUrl);
  } catch {
    return [];
  }
}

// ── Publish to account ────────────────────────────────────────────────────────
async function publishToAccount(
  account: any,
  text: string,
): Promise<{ status: 'success' | 'error'; postUrl?: string; error?: string }> {
  try {
    if (account.platform === 'telegram') {
      const res = await fetch(`https://api.telegram.org/bot${account.tgBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: account.tgChatId, text, parse_mode: 'HTML' }),
      });
      const data = await res.json();
      if (data.ok) {
        return { status: 'success', postUrl: `https://t.me/c/${account.tgChatId}` };
      }
      return { status: 'error', error: data.description };
    }

    if (account.platform === 'vk') {
      const params = new URLSearchParams({
        owner_id: account.vkOwnerId,
        message: text,
        access_token: account.vkToken,
        v: '5.131',
      });
      const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(`https://api.vk.com/method/wall.post?${params}`)}`);
      const data = await res.json();
      if (data.response?.post_id) {
        return { status: 'success', postUrl: `https://vk.com/wall${account.vkOwnerId}_${data.response.post_id}` };
      }
      return { status: 'error', error: data.error?.error_msg || 'VK error' };
    }

    return { status: 'error', error: 'Платформа не поддерживается' };
  } catch (e: any) {
    return { status: 'error', error: e.message };
  }
}

// ── Check if should publish now ───────────────────────────────────────────────
function shouldPublishNow(rule: RepostRule): boolean {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();

  if (!rule.schedule.days.includes(day)) return false;
  if (!rule.schedule.hours.includes(hour)) return false;

  if (rule.nextPublishAt) {
    const next = new Date(rule.nextPublishAt);
    if (now < next) return false;
  }

  return true;
}

function getNextPublishTime(rule: RepostRule): string {
  const now = new Date();
  const delayMs =
    (rule.schedule.intervalMin +
      Math.random() * (rule.schedule.intervalMax - rule.schedule.intervalMin)) *
    60 *
    1000;
  return new Date(now.getTime() + delayMs).toISOString();
}

function passesFilters(text: string, rule: RepostRule): boolean {
  const { minLength, maxLength, stopWords, requiredWords } = rule.filters;
  if (minLength > 0 && text.length < minLength) return false;
  if (maxLength > 0 && text.length > maxLength) return false;
  const lower = text.toLowerCase();
  if (stopWords.some((w) => w && lower.includes(w.toLowerCase()))) return false;
  if (requiredWords.length > 0 && requiredWords.some((w) => w)) {
    if (!requiredWords.some((w) => w && lower.includes(w.toLowerCase()))) return false;
  }
  return true;
}

// ── Main hook ─────────────────────────────────────────────────────────────────
export function useReposter() {
  const { repostRules, accounts, updateRepostRule, addRepostHistory } = useStore();
  const processingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const check = async () => {
      const { useBackend, syncData } = useStore.getState();
      if (useBackend) {
        await syncData();
        return;
      }

      const activeRules = repostRules.filter((r) => r.status === 'active');
      for (const rule of activeRules) {
        if (processingRef.current.has(rule.id)) continue;
        if (!shouldPublishNow(rule)) continue;

        processingRef.current.add(rule.id);

        try {
          // Fetch posts from source
          let sourcePosts: Array<{ id: string; text: string; title?: string; image?: string; link: string; pubDate: string }> = [];

          if (rule.source.type === 'rss') {
            sourcePosts = await fetchRSS(rule.source.url);
          } else if (rule.source.type === 'vk_wall') {
            sourcePosts = await fetchVKWall(rule.source.vkOwnerId!, rule.source.vkToken!);
          } else if (rule.source.type === 'tg_channel') {
            sourcePosts = await fetchTGChannel(rule.source.tgUsername!);
          }

          if (sourcePosts.length === 0) {
            updateRepostRule(rule.id, { lastCheckedAt: new Date().toISOString() });
            continue;
          }

          // Sort by order
          if (rule.order === 'newest') sourcePosts.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
          else if (rule.order === 'oldest') sourcePosts.sort((a, b) => new Date(a.pubDate).getTime() - new Date(b.pubDate).getTime());
          else sourcePosts = sourcePosts.sort(() => Math.random() - 0.5);

          // Skip already processed
          let candidate = sourcePosts.find((p) => {
            if (rule.skipDuplicates && rule.lastProcessedId === p.id) return false;
            return passesFilters(p.text, rule);
          });

          // If skipDuplicates is on, skip all already seen
          if (rule.skipDuplicates && rule.lastProcessedId) {
            const lastIdx = sourcePosts.findIndex((p) => p.id === rule.lastProcessedId);
            const fresh = lastIdx >= 0 ? sourcePosts.slice(0, lastIdx) : sourcePosts;
            candidate = fresh.find((p) => passesFilters(p.text, rule));
          }

          if (!candidate) {
            updateRepostRule(rule.id, {
              lastCheckedAt: new Date().toISOString(),
              nextPublishAt: getNextPublishTime(rule),
            });
            continue;
          }

          // Build text
          let finalText = candidate.text;
          if (rule.appendText) finalText += `\n\n${rule.appendText}`;
          if (rule.addSourceLink && candidate.link) finalText += `\n\n🔗 ${candidate.link}`;

          // Publish to all target accounts
          const targetAccounts = accounts.filter((a) => rule.targetAccountIds.includes(a.id) && a.isActive);
          const results: RepostHistoryItem['results'] = [];

          for (const acc of targetAccounts) {
            const result = await publishToAccount(acc, finalText);
            results.push({ accountId: acc.id, platform: acc.platform, ...result });
          }

          // Save to history
          addRepostHistory({
            ruleId: rule.id,
            ruleName: rule.name,
            sourceTitle: candidate.title || candidate.text.slice(0, 60),
            sourceUrl: candidate.link,
            sourceImage: candidate.image,
            text: finalText,
            publishedAt: new Date().toISOString(),
            targetAccountIds: targetAccounts.map((a) => a.id),
            results,
          });

          const success = results.filter((r) => r.status === 'success').length;
          if (success > 0) {
            toast.success(`Репост «${rule.name}»: опубликовано в ${success} акк.`);
          }

          updateRepostRule(rule.id, {
            lastProcessedId: candidate.id,
            lastCheckedAt: new Date().toISOString(),
            nextPublishAt: getNextPublishTime(rule),
            status: results.some((r) => r.status === 'error') && results.every((r) => r.status === 'error') ? 'error' : 'active',
          });
        } catch (e: any) {
          updateRepostRule(rule.id, { status: 'error', lastCheckedAt: new Date().toISOString() });
          toast.error(`Ошибка репостера «${rule.name}»: ${e.message}`);
        } finally {
          processingRef.current.delete(rule.id);
        }
      }
    };

    check();
    const interval = setInterval(check, 60_000); // Каждую минуту
    return () => clearInterval(interval);
  }, [repostRules, accounts]);
}
