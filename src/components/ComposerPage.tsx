import { useState, useRef, useEffect } from 'react';
import {
  Image, X, Send, Clock, Loader2, Link2, ChevronDown, ChevronUp,
  MessageSquarePlus, Trash2, MessageSquareOff, Bell,
  AtSign, Smile, Info,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { MediaFile, PostResult, Platform, UtmParams, Sticker, PostMention, FirstComment, AutoDelete } from '../types';
import PlatformIcon from './PlatformIcon';
import { publishToAccount } from '../services/apiService';
import { cn } from '../utils/cn';
import { generateUtmParams, injectUtmIntoText, toSlug, extractUrls } from '../utils/utm';
import StickerPicker from './StickerPicker';
import MentionInput from './MentionInput';
import toast from 'react-hot-toast';

const MAX_CHARS = 4096;

const AUTO_DELETE_OPTIONS = [
  { label: '1 час',    value: 60 },
  { label: '3 часа',   value: 180 },
  { label: '6 часов',  value: 360 },
  { label: '12 часов', value: 720 },
  { label: '1 день',   value: 1440 },
  { label: '3 дня',    value: 4320 },
  { label: '7 дней',   value: 10080 },
];

export default function ComposerPage() {
  const { accounts, addPost, updatePost, updatePostResult, utmPresets } = useStore();
  const [text, setText] = useState('');
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setSeconds(0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [isPublishing, setIsPublishing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // UTM
  const [utmEnabled, setUtmEnabled] = useState(false);
  const [utmExpanded, setUtmExpanded] = useState(false);
  const [utmCampaign, setUtmCampaign] = useState('');
  const [utmMedium, setUtmMedium] = useState('social');
  const [utmContent, setUtmContent] = useState('');
  const [utmTerm, setUtmTerm] = useState('');

  // ── Новые функции ────────────────────────────────────────────────────────────
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [mentions, setMentions] = useState<PostMention[]>([]);

  const [firstComment, setFirstComment] = useState<FirstComment>({ enabled: false, text: '' });
  const [autoDelete, setAutoDelete] = useState<AutoDelete>({ enabled: false, afterMinutes: 1440 });
  const [disableComments, setDisableComments] = useState(false);

  // Расширяемые секции
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [isVkStory, setIsVkStory] = useState(false);

  // Prefill from AI
  useEffect(() => {
    const prefill = sessionStorage.getItem('composer_prefill');
    if (prefill) {
      setText(prefill);
      sessionStorage.removeItem('composer_prefill');
    }
  }, []);

  const activeAccounts = accounts.filter((a) => a.id !== 'system' && a.isActive);
  const urlsInText = extractUrls(text);
  const hasVkSelected = activeAccounts.some(a => a.platform === 'vk' && selectedAccounts.includes(a.id));

  // ── Медиа ────────────────────────────────────────────────────────────────────
  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      if (media.length >= 10) { toast.error('Максимум 10 файлов'); return; }
      const reader = new FileReader();
      reader.onload = () => {
        setMedia((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            name: file.name,
            url: reader.result as string,
            type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'document',
            size: file.size,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const toggleAccount = (id: string) =>
    setSelectedAccounts((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const selectAll = () =>
    setSelectedAccounts(selectedAccounts.length === activeAccounts.length ? [] : activeAccounts.map((a) => a.id));

  // ── Публикация ───────────────────────────────────────────────────────────────
  const handlePublish = async () => {
    if (!text.trim() && media.length === 0) { toast.error('Введите текст или добавьте медиа'); return; }
    if (selectedAccounts.length === 0) { toast.error('Выберите хотя бы один аккаунт'); return; }

    // Собираем финальный текст с упоминаниями и стикерами
    const enrichedText = [
      text,
      mentions.length > 0 ? mentions.map((m) => `@${m.handle}`).join(' ') : '',
      stickers.length > 0 ? stickers.map((s) => s.emoji).join(' ') : '',
    ].filter(Boolean).join('\n\n');

    const utmParams = utmEnabled && utmCampaign
      ? { source: 'social', medium: utmMedium, campaign: toSlug(utmCampaign), content: utmContent || undefined, term: utmTerm || undefined }
      : undefined;

    // Push-уведомление: запросить разрешение если ещё нет
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }

    if (isScheduled) {
      addPost({
        text: enrichedText,
        media,
        targetAccounts: selectedAccounts,
        status: 'scheduled',
        scheduledAt: new Date(scheduledDate).toISOString(),
        utmEnabled,
        utmParams,
        stickers,
        mentions,
        firstComment: firstComment.enabled ? firstComment : undefined,
        autoDelete: autoDelete.enabled ? autoDelete : undefined,
        disableComments,
        isVkStory,
      });
      toast.success('Пост добавлен в расписание!');
      resetForm();
      return;
    }

    setIsPublishing(true);

    try {
      addPost({
        text: enrichedText,
        media,
        targetAccounts: selectedAccounts,
        status: 'publishing',
        utmEnabled,
        utmParams,
        stickers,
        mentions,
        firstComment: firstComment.enabled ? firstComment : undefined,
        autoDelete: autoDelete.enabled ? autoDelete : undefined,
        disableComments,
        isVkStory,
      });

      const { posts } = useStore.getState();
      const post = posts[posts.length - 1];

      const targetAccs = accounts.filter((a) => selectedAccounts.includes(a.id));
      const results: PostResult[] = [];

      for (const acc of targetAccs) {
        try {
          // Применяем UTM к ОБОГАЩЁННОМУ тексту
          const getTextWithUtmCustom = (platform: Platform, baseText: string): string => {
            const params = generateUtmParams(platform, toSlug(utmCampaign), utmContent || undefined, utmMedium || undefined, utmTerm || undefined);
            if (!params) return baseText;
            return injectUtmIntoText(baseText, params);
          };

          const finalPostText = utmEnabled && utmCampaign
            ? getTextWithUtmCustom(acc.platform, enrichedText)
            : enrichedText;

          const postToPublish = { ...post, text: finalPostText };
          const result = await publishToAccount(acc, postToPublish);
          results.push(result);
          updatePostResult(post.id, result);
        } catch (err) {
          const errorRes: PostResult = { accountId: acc.id, platform: acc.platform, status: 'error', error: String(err) };
          results.push(errorRes);
          updatePostResult(post.id, errorRes);
        }
      }

      const successCount = results.filter((r) => r.status === 'success').length;
      const failCount = results.filter((r) => r.status === 'error').length;

      // Если авто-удаление — вычислим время удаления
      const deleteAt = autoDelete.enabled
        ? new Date(Date.now() + autoDelete.afterMinutes * 60 * 1000).toISOString()
        : undefined;

      updatePost(post.id, {
        status: failCount === results.length ? 'failed' : 'published',
        publishedAt: new Date().toISOString(),
        deleteAt,
      });

      if (successCount > 0) toast.success(`Опубликовано в ${successCount} аккаунт(а/ов)`);
      if (failCount > 0) toast.error(`Ошибка в ${failCount} аккаунт(а/ов)`);
      
      resetForm();
    } catch (error) {
      console.error('Publish error:', error);
      toast.error('Произошла критическая ошибка при публикации');
    } finally {
      setIsPublishing(false);
    }
  };

  const resetForm = () => {
    setText('');
    setMedia([]);
    setSelectedAccounts([]);
    setStickers([]);
    setMentions([]);
    setFirstComment({ enabled: false, text: '' });
    setAutoDelete({ enabled: false, afterMinutes: 1440 });
    setDisableComments(false);
    setUtmEnabled(false);
    setUtmCampaign('');
    setIsVkStory(false);
  };

  const charsLeft = MAX_CHARS - text.length;

  // Собираем превью подписи с упоминаниями + стикерами
  const postPreview = [
    text,
    mentions.length > 0 ? mentions.map((m) => `@${m.handle}`).join(' ') : '',
    stickers.length > 0 ? stickers.map((s) => s.emoji).join(' ') : '',
  ].filter(Boolean).join('\n\n');

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Создать пост</h1>
        <p className="text-gray-500 text-sm mt-1">Опубликуйте сразу во все подключённые соцсети</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Editor */}
        <div className="lg:col-span-2 space-y-4">

          {/* Text editor */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Что хотите рассказать? Используйте AI-ассистента для идей ✨"
                className="w-full h-40 resize-none outline-none text-gray-800 text-sm leading-relaxed placeholder:text-gray-400"
                maxLength={MAX_CHARS}
              />
            </div>

            {/* Stickers row in textarea */}
            {stickers.length > 0 && (
              <div className="px-4 pb-2 flex flex-wrap gap-1">
                {stickers.map((s) => (
                  <span key={s.id} className="text-xl" title={s.label}>{s.emoji}</span>
                ))}
              </div>
            )}

            {/* Mentions row */}
            {mentions.length > 0 && (
              <div className="px-4 pb-3 flex flex-wrap gap-1">
                {mentions.map((m) => (
                  <span key={m.id} className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full">
                    @{m.handle}
                  </span>
                ))}
              </div>
            )}

            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Media */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-purple-300 hover:text-purple-600 text-sm transition-all"
                >
                  <Image size={15} />
                  Медиа
                </button>
                <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleMediaUpload} />

                {/* Sticker picker */}
                <StickerPicker selected={stickers} onChange={setStickers} />

                {/* Mention input */}
                <MentionInput mentions={mentions} onChange={setMentions} />
              </div>

              {/* Chars counter */}
              <span className={cn('text-xs font-mono', charsLeft < 100 ? 'text-red-500' : 'text-gray-400')}>
                {charsLeft}
              </span>
            </div>
          </div>

          {/* Media preview */}
          {media.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {media.map((m) => (
                <div key={m.id} className="relative group rounded-xl overflow-hidden aspect-square bg-gray-100">
                  {m.type === 'image' ? (
                    <img src={m.url} alt={m.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <span className="text-3xl">🎬</span>
                    </div>
                  )}
                  <button
                    onClick={() => setMedia((prev) => prev.filter((x) => x.id !== m.id))}
                    className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ── Advanced Options ───────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setAdvancedOpen(!advancedOpen)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <span>⚙️</span> Дополнительные настройки
                {(firstComment.enabled || autoDelete.enabled || disableComments) && (
                  <span className="bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full">
                    {[firstComment.enabled, autoDelete.enabled, disableComments].filter(Boolean).length} активно
                  </span>
                )}
              </span>
              {advancedOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
            </button>

            {advancedOpen && (
              <div className="border-t border-gray-100 divide-y divide-gray-100">

                {/* 1. Первый комментарий */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-green-100 rounded-lg">
                        <MessageSquarePlus size={16} className="text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Первый комментарий</p>
                        <p className="text-xs text-gray-500">Автоматически добавить комментарий под постом</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFirstComment((fc) => ({ ...fc, enabled: !fc.enabled }))}
                      className={cn(
                        'relative w-11 h-6 rounded-full transition-colors',
                        firstComment.enabled ? 'bg-green-500' : 'bg-gray-200'
                      )}
                    >
                      <div className={cn(
                        'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform',
                        firstComment.enabled ? 'translate-x-6' : 'translate-x-1'
                      )} />
                    </button>
                  </div>

                  {firstComment.enabled && (
                    <div className="ml-8">
                      <textarea
                        value={firstComment.text}
                        onChange={(e) => setFirstComment((fc) => ({ ...fc, text: e.target.value }))}
                        placeholder="Текст первого комментария... Например: задайте вопрос, добавьте хэштеги или CTA 👇"
                        className="w-full h-24 border border-gray-200 rounded-xl p-3 text-sm outline-none resize-none focus:border-green-400 transition-colors placeholder:text-gray-400"
                        maxLength={1000}
                      />
                      <div className="flex items-start gap-2 mt-2 text-xs text-amber-600 bg-amber-50 rounded-lg p-2">
                        <Info size={12} className="mt-0.5 shrink-0" />
                        <span>Поддерживается: VK и Telegram. В Одноклассниках комментарий будет добавлен через API.</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Push-уведомление */}
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-blue-100 rounded-lg">
                        <Bell size={16} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Push-уведомление</p>
                        <p className="text-xs text-gray-500">Получить уведомление в браузере когда пост выйдет</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {'Notification' in window && Notification.permission === 'granted' ? (
                        <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                          <Bell size={12} />
                          Включены
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            if ('Notification' in window) {
                              const perm = await Notification.requestPermission();
                              if (perm === 'granted') toast.success('Push-уведомления включены! 🔔');
                              else toast.error('Разрешение отклонено');
                            }
                          }}
                          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                        >
                          Разрешить
                        </button>
                      )}
                    </div>
                  </div>
                  {'Notification' in window && Notification.permission === 'granted' && (
                    <p className="ml-8 mt-2 text-xs text-gray-500">
                      ✅ Вы получите push-уведомление как только пост будет опубликован
                    </p>
                  )}
                </div>

                {/* 3. Авто-удаление */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-red-100 rounded-lg">
                        <Trash2 size={16} className="text-red-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Удалить пост через время</p>
                        <p className="text-xs text-gray-500">Автоматически удалить пост по истечении срока</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAutoDelete((ad) => ({ ...ad, enabled: !ad.enabled }))}
                      className={cn(
                        'relative w-11 h-6 rounded-full transition-colors',
                        autoDelete.enabled ? 'bg-red-500' : 'bg-gray-200'
                      )}
                    >
                      <div className={cn(
                        'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform',
                        autoDelete.enabled ? 'translate-x-6' : 'translate-x-1'
                      )} />
                    </button>
                  </div>

                  {autoDelete.enabled && (
                    <div className="ml-8 space-y-2">
                      <p className="text-xs text-gray-500 font-medium">Удалить через:</p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {AUTO_DELETE_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setAutoDelete((ad) => ({ ...ad, afterMinutes: opt.value }))}
                            className={cn(
                              'py-1.5 px-2 rounded-lg text-xs font-medium border transition-all',
                              autoDelete.afterMinutes === opt.value
                                ? 'bg-red-500 text-white border-red-500'
                                : 'border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600'
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 rounded-lg p-2">
                        <Info size={12} className="mt-0.5 shrink-0" />
                        <span>Идеально для временных акций. Пост будет автоматически удалён после публикации через {AUTO_DELETE_OPTIONS.find(o => o.value === autoDelete.afterMinutes)?.label}.</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Отключить комментарии */}
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-gray-100 rounded-lg">
                        <MessageSquareOff size={16} className="text-gray-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Отключить комментарии</p>
                        <p className="text-xs text-gray-500">Запретить комментарии под этим постом</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDisableComments(!disableComments)}
                      className={cn(
                        'relative w-11 h-6 rounded-full transition-colors',
                        disableComments ? 'bg-gray-700' : 'bg-gray-200'
                      )}
                    >
                      <div className={cn(
                        'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform',
                        disableComments ? 'translate-x-6' : 'translate-x-1'
                      )} />
                    </button>
                  </div>
                  {disableComments && (
                    <p className="ml-8 mt-2 text-xs text-gray-500">
                      🔇 Комментарии будут закрыты. Поддерживается в VK (groups.wall.post) и Telegram (reply_markup).
                    </p>
                  )}
                </div>
                
                {/* 5. VK Stories */}
                {hasVkSelected && (
                  <div className="p-4 bg-blue-50/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-100 rounded-lg">
                          <Image size={16} className="text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">Опубликовать в Истории ВК</p>
                          <p className="text-xs text-gray-500">Запостить медиафайл как историю вместо стены</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsVkStory(!isVkStory)}
                        className={cn(
                          'relative w-11 h-6 rounded-full transition-colors',
                          isVkStory ? 'bg-blue-600' : 'bg-gray-200'
                        )}
                      >
                        <div className={cn(
                          'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform',
                          isVkStory ? 'translate-x-6' : 'translate-x-1'
                        )} />
                      </button>
                    </div>
                    {isVkStory && media.length === 0 && (
                      <div className="ml-8 mt-2 text-xs text-amber-600 flex items-center gap-1">
                        <Info size={12} />
                        Для историй необходимо добавить хотя бы одно фото или видео
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}
          </div>

          {/* UTM */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => { setUtmEnabled(!utmEnabled); setUtmExpanded(!utmEnabled); }}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Link2 size={15} />
                UTM-метки
                {urlsInText.length > 0 && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    {urlsInText.length} ссылок
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2">
                {utmEnabled && <span className="text-xs text-green-600 font-medium">Активно</span>}
                {utmExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </div>
            </button>

            {utmExpanded && (
              <div className="border-t border-gray-100 p-4 space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    id="utm-enabled"
                    checked={utmEnabled}
                    onChange={(e) => setUtmEnabled(e.target.checked)}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <label htmlFor="utm-enabled" className="text-sm text-gray-700 font-medium">
                    Добавлять UTM ко всем ссылкам в тексте
                  </label>
                </div>

                {utmEnabled && (
                  <>
                    {utmPresets.length > 0 && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Пресет</label>
                        <div className="flex flex-wrap gap-1.5">
                          {utmPresets.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => { setUtmCampaign(p.campaign); setUtmMedium(p.medium); setUtmTerm(p.term || ''); }}
                              className="px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded-lg hover:bg-blue-100 transition-colors"
                            >
                              {p.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">utm_campaign *</label>
                        <input value={utmCampaign} onChange={(e) => setUtmCampaign(e.target.value)} placeholder="spring_sale" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">utm_medium</label>
                        <input value={utmMedium} onChange={(e) => setUtmMedium(e.target.value)} placeholder="social" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">utm_content</label>
                        <input value={utmContent} onChange={(e) => setUtmContent(e.target.value)} placeholder="post_text" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">utm_term</label>
                        <input value={utmTerm} onChange={(e) => setUtmTerm(e.target.value)} placeholder="ключевые слова" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
                      </div>
                    </div>

                    {utmCampaign && urlsInText.length > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                        <p className="text-xs font-medium text-green-700 mb-1">Превью для VK:</p>
                        <p className="text-xs text-green-600 break-all font-mono">
                          {urlsInText[0]}?utm_source=vk&utm_medium={utmMedium}&utm_campaign={toSlug(utmCampaign)}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Scheduling */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center gap-3 mb-3">
              <button
                type="button"
                onClick={() => setIsScheduled(false)}
                className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all', !isScheduled ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100')}
              >
                <Send size={15} /> Сейчас
              </button>
              <button
                type="button"
                onClick={() => setIsScheduled(true)}
                className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all', isScheduled ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100')}
              >
                <Clock size={15} /> По расписанию
              </button>
            </div>

            {isScheduled && (
              <input
                type="datetime-local"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400 mt-2"
              />
            )}

            <button
              onClick={handlePublish}
              disabled={isPublishing || (!text.trim() && media.length === 0) || selectedAccounts.length === 0}
              className={cn(
                'w-full mt-4 py-3 rounded-xl font-semibold text-white text-sm flex items-center justify-center gap-2 transition-all',
                isPublishing || (!text.trim() && media.length === 0) || selectedAccounts.length === 0
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg hover:shadow-xl'
              )}
            >
              {isPublishing ? (
                <><Loader2 size={16} className="animate-spin" /> Публикуем...</>
              ) : isScheduled ? (
                <><Clock size={16} /> Запланировать</>
              ) : (
                <><Send size={16} /> Опубликовать</>
              )}
            </button>
          </div>
        </div>

        {/* Right: Accounts + Preview */}
        <div className="space-y-4">
          {/* Accounts */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-800">Аккаунты</span>
              {activeAccounts.length > 1 && (
                <button onClick={selectAll} className="text-xs text-blue-600 hover:underline">
                  {selectedAccounts.length === activeAccounts.length ? 'Снять всё' : 'Выбрать все'}
                </button>
              )}
            </div>

            {activeAccounts.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-gray-400 text-xs">Нет активных аккаунтов</p>
                <button
                  onClick={() => useStore.getState().setActiveTab('accounts')}
                  className="mt-2 text-xs text-blue-600 hover:underline"
                >
                  + Добавить аккаунт
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {activeAccounts.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => toggleAccount(acc.id)}
                    className={cn(
                      'w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left',
                      selectedAccounts.includes(acc.id)
                        ? 'border-purple-300 bg-purple-50'
                        : 'border-gray-100 hover:border-gray-200 bg-gray-50'
                    )}
                  >
                    <div className={cn(
                      'w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                      selectedAccounts.includes(acc.id) ? 'bg-purple-600 border-purple-600' : 'border-gray-300'
                    )}>
                      {selectedAccounts.includes(acc.id) && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <PlatformIcon platform={acc.platform} size={16} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{acc.name}</p>
                      <p className="text-xs text-gray-400 capitalize">{acc.type}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Post preview card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">Превью поста</p>
            <div className="bg-gray-50 rounded-xl p-3 min-h-[80px]">
              {postPreview ? (
                <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">{postPreview}</p>
              ) : (
                <p className="text-xs text-gray-400 italic">Начните писать...</p>
              )}
              {media.length > 0 && (
                <div className="mt-2 flex gap-1 flex-wrap">
                  {media.slice(0, 3).map((m) => (
                    <img key={m.id} src={m.url} alt="" className="w-12 h-12 object-cover rounded-lg" />
                  ))}
                  {media.length > 3 && (
                    <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center text-xs text-gray-500 font-medium">
                      +{media.length - 3}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Badges */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {disableComments && (
                <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">
                  <MessageSquareOff size={11} /> Коммент. закрыты
                </span>
              )}
              {firstComment.enabled && (
                <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg">
                  <MessageSquarePlus size={11} /> Первый коммент.
                </span>
              )}
              {autoDelete.enabled && (
                <span className="flex items-center gap-1 text-xs bg-red-100 text-red-600 px-2 py-1 rounded-lg">
                  <Trash2 size={11} /> Авто-удаление
                </span>
              )}
              {utmEnabled && utmCampaign && (
                <span className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg">
                  <Link2 size={11} /> UTM
                </span>
              )}
              {stickers.length > 0 && (
                <span className="flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-lg">
                  <Smile size={11} /> {stickers.length} стикер(а)
                </span>
              )}
              {mentions.length > 0 && (
                <span className="flex items-center gap-1 text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg">
                  <AtSign size={11} /> {mentions.length} отметк(а/и)
                </span>
              )}
              {isVkStory && (
                <span className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg">
                  <Image size={11} /> История ВК
                </span>
              )}
            </div>
          </div>

          {/* Char stats */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">Статистика текста</p>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-gray-50 rounded-xl p-2">
                <p className="text-lg font-bold text-gray-800">{text.length}</p>
                <p className="text-xs text-gray-400">символов</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-2">
                <p className="text-lg font-bold text-gray-800">
                  {text.trim() ? text.trim().split(/\s+/).length : 0}
                </p>
                <p className="text-xs text-gray-400">слов</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-2">
                <p className="text-lg font-bold text-gray-800">{urlsInText.length}</p>
                <p className="text-xs text-gray-400">ссылок</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-2">
                <p className="text-lg font-bold text-gray-800">{media.length}</p>
                <p className="text-xs text-gray-400">медиафайлов</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
