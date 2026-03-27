import { useState } from 'react';
import {
  RefreshCw, Plus, Trash2, Play, Pause, Clock, Rss, MessageSquare,
  ChevronDown, ChevronUp, CheckCircle2, XCircle, AlertCircle,
  History, Settings2, Globe, Edit3, X, Save
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { RepostRule, RepostSource, RepostSchedule, RepostFilters, RepostHistoryItem } from '../types';
import { cn } from '../utils/cn';

// ────────────────────────────────────────────────────────────────────────────
const DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const DEFAULT_SCHEDULE: RepostSchedule = {
  days: [1, 2, 3, 4, 5],
  hours: [9, 12, 15, 18],
  intervalMin: 30,
  intervalMax: 120,
};

const DEFAULT_FILTERS: RepostFilters = {
  minLength: 0,
  maxLength: 0,
  requireImage: false,
  stopWords: [],
  requiredWords: [],
};

function defaultRule(): Omit<RepostRule, 'id' | 'createdAt'> {
  return {
    name: '',
    status: 'paused',
    source: { id: crypto.randomUUID(), name: '', type: 'rss', url: '' },
    targetAccountIds: [],
    schedule: { ...DEFAULT_SCHEDULE },
    filters: { ...DEFAULT_FILTERS },
    order: 'newest',
    appendText: '',
    addSourceLink: true,
    skipDuplicates: true,
  };
}

// ── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: RepostRule['status'] }) {
  const map = {
    active: { label: 'Активен', cls: 'bg-emerald-100 text-emerald-700', icon: <Play size={11} /> },
    paused: { label: 'Пауза', cls: 'bg-gray-100 text-gray-600', icon: <Pause size={11} /> },
    error: { label: 'Ошибка', cls: 'bg-red-100 text-red-600', icon: <AlertCircle size={11} /> },
  };
  const s = map[status];
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', s.cls)}>
      {s.icon}{s.label}
    </span>
  );
}

// ── Source icon ──────────────────────────────────────────────────────────────
function SourceIcon({ type }: { type: RepostSource['type'] }) {
  if (type === 'rss') return <Rss size={16} className="text-orange-500" />;
  if (type === 'vk_wall') return <Globe size={16} className="text-blue-500" />;
  return <MessageSquare size={16} className="text-sky-500" />;
}

// ── Rule Form ─────────────────────────────────────────────────────────────────
function RuleForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Omit<RepostRule, 'id' | 'createdAt'>;
  onSave: (rule: Omit<RepostRule, 'id' | 'createdAt'>) => void;
  onCancel: () => void;
}) {
  const { accounts } = useStore();
  const [form, setForm] = useState(initial);
  const [tab, setTab] = useState<'source' | 'targets' | 'schedule' | 'filters' | 'options'>('source');
  const [stopWordsInput, setStopWordsInput] = useState(initial.filters.stopWords.join(', '));
  const [requiredWordsInput, setRequiredWordsInput] = useState(initial.filters.requiredWords.join(', '));

  const upd = (path: string, value: any) => {
    setForm((prev) => {
      const parts = path.split('.');
      if (parts.length === 1) return { ...prev, [path]: value };
      if (parts.length === 2) return { ...prev, [parts[0]]: { ...(prev as any)[parts[0]], [parts[1]]: value } };
      return prev;
    });
  };

  const toggleDay = (d: number) => {
    const days = form.schedule.days.includes(d)
      ? form.schedule.days.filter((x) => x !== d)
      : [...form.schedule.days, d];
    upd('schedule.days', days);
  };

  const toggleHour = (h: number) => {
    const hours = form.schedule.hours.includes(h)
      ? form.schedule.hours.filter((x) => x !== h)
      : [...form.schedule.hours, h];
    upd('schedule.hours', hours);
  };

  const toggleTarget = (id: string) => {
    const ids = form.targetAccountIds.includes(id)
      ? form.targetAccountIds.filter((x) => x !== id)
      : [...form.targetAccountIds, id];
    setForm((p) => ({ ...p, targetAccountIds: ids }));
  };

  const handleSave = () => {
    const updated = {
      ...form,
      filters: {
        ...form.filters,
        stopWords: stopWordsInput.split(',').map((s) => s.trim()).filter(Boolean),
        requiredWords: requiredWordsInput.split(',').map((s) => s.trim()).filter(Boolean),
      },
    };
    onSave(updated);
  };

  const tabs = [
    { id: 'source', label: 'Источник' },
    { id: 'targets', label: 'Куда постить' },
    { id: 'schedule', label: 'Расписание' },
    { id: 'filters', label: 'Фильтры' },
    { id: 'options', label: 'Настройки' },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
              <RefreshCw size={18} className="text-violet-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">
                {initial.name ? `Редактировать: ${initial.name}` : 'Новое правило репостера'}
              </h2>
              <p className="text-xs text-gray-500">Настройте источник, цели и расписание</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Name */}
        <div className="px-6 pt-4">
          <input
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-300"
            placeholder="Название правила (например: Новости Tech)"
            value={form.name}
            onChange={(e) => upd('name', e.target.value)}
          />
        </div>

        {/* Tab nav */}
        <div className="flex gap-1 px-6 pt-3 border-b">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'px-3 py-2 text-xs font-medium rounded-t-lg transition-colors -mb-px',
                tab === t.id
                  ? 'bg-white border border-b-white border-gray-200 text-violet-600'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* SOURCE */}
          {tab === 'source' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-2 block">Тип источника</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { type: 'rss', label: 'RSS лента', icon: <Rss size={20} />, color: 'orange' },
                    { type: 'vk_wall', label: 'Стена ВКонтакте', icon: <Globe size={20} />, color: 'blue' },
                    { type: 'tg_channel', label: 'Telegram канал', icon: <MessageSquare size={20} />, color: 'sky' },
                  ] as const).map((s) => (
                    <button
                      key={s.type}
                      onClick={() => upd('source.type', s.type)}
                      className={cn(
                        'flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-xs font-medium',
                        form.source.type === s.type
                          ? 'border-violet-500 bg-violet-50 text-violet-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      )}
                    >
                      {s.icon}
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Название источника</label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                  placeholder="Например: Хабр"
                  value={form.source.name}
                  onChange={(e) => upd('source.name', e.target.value)}
                />
              </div>

              {form.source.type === 'rss' && (
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">URL RSS-ленты</label>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                    placeholder="https://habr.com/ru/rss/hubs/all/"
                    value={form.source.url}
                    onChange={(e) => upd('source.url', e.target.value)}
                  />
                  <p className="text-xs text-gray-400 mt-1">Поддерживается любая RSS/Atom-лента</p>
                </div>
              )}

              {form.source.type === 'vk_wall' && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Owner ID (с минусом для групп)</label>
                    <input
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                      placeholder="-123456789"
                      value={form.source.vkOwnerId || ''}
                      onChange={(e) => upd('source.vkOwnerId', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">VK Access Token</label>
                    <input
                      type="password"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                      placeholder="vk1.a...."
                      value={form.source.vkToken || ''}
                      onChange={(e) => upd('source.vkToken', e.target.value)}
                    />
                  </div>
                </>
              )}

              {form.source.type === 'tg_channel' && (
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Username канала</label>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                    placeholder="@durov или durov"
                    value={form.source.tgUsername || ''}
                    onChange={(e) => upd('source.tgUsername', e.target.value)}
                  />
                  <p className="text-xs text-gray-400 mt-1">Только публичные каналы. Используется RSSHub для парсинга.</p>
                </div>
              )}
            </div>
          )}

          {/* TARGETS */}
          {tab === 'targets' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">Выберите аккаунты, куда будет публиковаться контент:</p>
              {accounts.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  Нет аккаунтов. Сначала добавьте аккаунты в разделе «Аккаунты».
                </div>
              )}
              {accounts.map((acc) => (
                <label key={acc.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={form.targetAccountIds.includes(acc.id)}
                    onChange={() => toggleTarget(acc.id)}
                    className="w-4 h-4 accent-violet-600"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-800">{acc.name}</div>
                    <div className="text-xs text-gray-400 capitalize">{acc.platform} · {acc.type}</div>
                  </div>
                  {!acc.isActive && (
                    <span className="text-xs text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">Выключен</span>
                  )}
                </label>
              ))}
            </div>
          )}

          {/* SCHEDULE */}
          {tab === 'schedule' && (
            <div className="space-y-5">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-2 block">Дни публикации</label>
                <div className="flex gap-2 flex-wrap">
                  {DAYS.map((d, i) => (
                    <button
                      key={i}
                      onClick={() => toggleDay(i)}
                      className={cn(
                        'w-10 h-10 rounded-xl text-xs font-semibold transition-all',
                        form.schedule.days.includes(i)
                          ? 'bg-violet-600 text-white shadow-md shadow-violet-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-2 block">Часы публикации</label>
                <div className="flex flex-wrap gap-1.5">
                  {HOURS.map((h) => (
                    <button
                      key={h}
                      onClick={() => toggleHour(h)}
                      className={cn(
                        'w-9 h-9 rounded-lg text-xs font-medium transition-all',
                        form.schedule.hours.includes(h)
                          ? 'bg-violet-600 text-white'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      )}
                    >
                      {h}:00
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                    Мин. интервал (мин)
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                    value={form.schedule.intervalMin}
                    onChange={(e) => upd('schedule.intervalMin', Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                    Макс. интервал (мин)
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                    value={form.schedule.intervalMax}
                    onChange={(e) => upd('schedule.intervalMax', Number(e.target.value))}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400">
                Между публикациями будет случайная пауза от {form.schedule.intervalMin} до {form.schedule.intervalMax} минут — для естественного вида.
              </p>
            </div>
          )}

          {/* FILTERS */}
          {tab === 'filters' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Мин. длина текста (симв.)</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                    value={form.filters.minLength}
                    onChange={(e) => upd('filters.minLength', Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Макс. длина (0 = без огр.)</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                    value={form.filters.maxLength}
                    onChange={(e) => upd('filters.maxLength', Number(e.target.value))}
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={form.filters.requireImage}
                  onChange={(e) => upd('filters.requireImage', e.target.checked)}
                  className="w-4 h-4 accent-violet-600"
                />
                <div>
                  <div className="text-sm font-medium text-gray-800">Только посты с картинкой</div>
                  <div className="text-xs text-gray-400">Пропускать посты без изображений</div>
                </div>
              </label>

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                  Стоп-слова (через запятую)
                </label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                  placeholder="реклама, спонсор, промо"
                  value={stopWordsInput}
                  onChange={(e) => setStopWordsInput(e.target.value)}
                />
                <p className="text-xs text-gray-400 mt-1">Посты с этими словами будут пропущены</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                  Обязательные слова (через запятую)
                </label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                  placeholder="технологии, AI, стартап"
                  value={requiredWordsInput}
                  onChange={(e) => setRequiredWordsInput(e.target.value)}
                />
                <p className="text-xs text-gray-400 mt-1">Репостить только посты с этими словами</p>
              </div>
            </div>
          )}

          {/* OPTIONS */}
          {tab === 'options' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-2 block">Порядок публикации</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: 'newest', label: 'Сначала новые' },
                    { value: 'oldest', label: 'Сначала старые' },
                    { value: 'random', label: 'Случайный' },
                  ] as const).map((o) => (
                    <button
                      key={o.value}
                      onClick={() => setForm((p) => ({ ...p, order: o.value }))}
                      className={cn(
                        'p-2.5 rounded-xl border-2 text-xs font-medium transition-all',
                        form.order === o.value
                          ? 'border-violet-500 bg-violet-50 text-violet-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={form.skipDuplicates}
                  onChange={(e) => setForm((p) => ({ ...p, skipDuplicates: e.target.checked }))}
                  className="w-4 h-4 accent-violet-600"
                />
                <div>
                  <div className="text-sm font-medium text-gray-800">Не дублировать посты</div>
                  <div className="text-xs text-gray-400">Пропускать уже репостнутые материалы</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={form.addSourceLink}
                  onChange={(e) => setForm((p) => ({ ...p, addSourceLink: e.target.checked }))}
                  className="w-4 h-4 accent-violet-600"
                />
                <div>
                  <div className="text-sm font-medium text-gray-800">Добавлять ссылку на источник</div>
                  <div className="text-xs text-gray-400">Прикреплять 🔗 ссылку в конец поста</div>
                </div>
              </label>

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                  Приписка к каждому посту
                </label>
                <textarea
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
                  placeholder="#новости #технологии&#10;Подписывайтесь на наш канал!"
                  value={form.appendText}
                  onChange={(e) => setForm((p) => ({ ...p, appendText: e.target.value }))}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={!form.name || !form.source.name}
            className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Save size={15} />
            Сохранить правило
          </button>
        </div>
      </div>
    </div>
  );
}

// ── History Panel ─────────────────────────────────────────────────────────────
function HistoryPanel({ history, onClose }: { history: RepostHistoryItem[]; onClose: () => void }) {
  const { accounts, clearRepostHistory } = useStore();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <History size={20} className="text-violet-600" />
            <h2 className="font-semibold text-gray-900">История репостов</h2>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{history.length}</span>
          </div>
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={clearRepostHistory}
                className="text-xs text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
              >
                Очистить
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {history.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <History size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">История пуста</p>
            </div>
          )}
          {history.map((item) => {
            const ok = item.results.filter((r) => r.status === 'success').length;
            const fail = item.results.filter((r) => r.status === 'error').length;
            return (
              <div key={item.id} className="border border-gray-100 rounded-xl p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-3">
                  {item.sourceImage && (
                    <img src={item.sourceImage} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" alt="" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-violet-600">{item.ruleName}</span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-400">
                        {new Date(item.publishedAt).toLocaleString('ru')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-2">{item.text}</p>
                    {item.sourceUrl && (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline mt-1 block truncate"
                      >
                        {item.sourceUrl}
                      </a>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      {ok > 0 && (
                        <span className="flex items-center gap-1 text-xs text-emerald-600">
                          <CheckCircle2 size={12} /> {ok} успешно
                        </span>
                      )}
                      {fail > 0 && (
                        <span className="flex items-center gap-1 text-xs text-red-500">
                          <XCircle size={12} /> {fail} ошибка
                        </span>
                      )}
                      {item.results.map((r) => {
                        const acc = accounts.find((a) => a.id === r.accountId);
                        return r.postUrl ? (
                          <a
                            key={r.accountId}
                            href={r.postUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-500 hover:underline"
                          >
                            {acc?.name || r.platform}
                          </a>
                        ) : null;
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Rule Card ─────────────────────────────────────────────────────────────────
function RuleCard({
  rule,
  onEdit,
  onDelete,
  onToggle,
}: {
  rule: RepostRule;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const { accounts } = useStore();
  const [expanded, setExpanded] = useState(false);
  const targets = accounts.filter((a) => rule.targetAccountIds.includes(a.id));

  return (
    <div className={cn(
      'bg-white rounded-2xl border transition-all',
      rule.status === 'active' ? 'border-emerald-200 shadow-sm shadow-emerald-50' :
      rule.status === 'error' ? 'border-red-200' : 'border-gray-200'
    )}>
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
            rule.status === 'active' ? 'bg-emerald-100' : 'bg-gray-100'
          )}>
            <SourceIcon type={rule.source.type} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 text-sm">{rule.name}</h3>
              <StatusBadge status={rule.status} />
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
              <span>{rule.source.name || rule.source.url}</span>
              {rule.lastCheckedAt && (
                <>
                  <span>·</span>
                  <span>Проверен: {new Date(rule.lastCheckedAt).toLocaleTimeString('ru')}</span>
                </>
              )}
              {rule.nextPublishAt && rule.status === 'active' && (
                <>
                  <span>·</span>
                  <span className="text-violet-500">
                    След.: {new Date(rule.nextPublishAt).toLocaleTimeString('ru')}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onToggle}
              title={rule.status === 'active' ? 'Поставить на паузу' : 'Запустить'}
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                rule.status === 'active'
                  ? 'text-emerald-600 hover:bg-emerald-50'
                  : 'text-gray-400 hover:bg-gray-100'
              )}
            >
              {rule.status === 'active' ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button
              onClick={onEdit}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
            >
              <Edit3 size={15} />
            </button>
            <button
              onClick={onDelete}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={15} />
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Clock size={12} />
            <span>{rule.schedule.days.length} дн./нед. · {rule.schedule.hours.length} часов</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Settings2 size={12} />
            <span>
              {rule.order === 'newest' ? 'Новые сначала' : rule.order === 'oldest' ? 'Старые сначала' : 'Случайный порядок'}
            </span>
          </div>
          {targets.length > 0 && (
            <div className="flex items-center gap-1 ml-auto">
              {targets.slice(0, 3).map((acc) => (
                <span
                  key={acc.id}
                  className="text-xs bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full"
                >
                  {acc.name}
                </span>
              ))}
              {targets.length > 3 && (
                <span className="text-xs text-gray-400">+{targets.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-50 pt-3 grid grid-cols-2 gap-3 text-xs">
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="font-semibold text-gray-600 mb-2">📅 Расписание</div>
            <div className="text-gray-500">Дни: {rule.schedule.days.map((d) => DAYS[d]).join(', ')}</div>
            <div className="text-gray-500">Часы: {rule.schedule.hours.map((h) => `${h}:00`).join(', ')}</div>
            <div className="text-gray-500">Интервал: {rule.schedule.intervalMin}-{rule.schedule.intervalMax} мин.</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="font-semibold text-gray-600 mb-2">🔍 Фильтры</div>
            {rule.filters.minLength > 0 && <div className="text-gray-500">Мин. длина: {rule.filters.minLength} симв.</div>}
            {rule.filters.maxLength > 0 && <div className="text-gray-500">Макс. длина: {rule.filters.maxLength} симв.</div>}
            {rule.filters.requireImage && <div className="text-gray-500">✓ Только с картинкой</div>}
            {rule.filters.stopWords.length > 0 && <div className="text-gray-500">Стоп-слова: {rule.filters.stopWords.join(', ')}</div>}
            {rule.skipDuplicates && <div className="text-gray-500">✓ Без дублей</div>}
            {rule.addSourceLink && <div className="text-gray-500">✓ Ссылка на источник</div>}
          </div>
          {rule.appendText && (
            <div className="col-span-2 bg-violet-50 rounded-xl p-3">
              <div className="font-semibold text-violet-600 mb-1">📝 Приписка</div>
              <div className="text-gray-600 whitespace-pre-line">{rule.appendText}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ReposterPage() {
  const { repostRules, repostHistory, addRepostRule, updateRepostRule, removeRepostRule, toggleRepostRule } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<RepostRule | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const handleSave = (rule: Omit<RepostRule, 'id' | 'createdAt'>) => {
    if (editingRule) {
      updateRepostRule(editingRule.id, rule);
    } else {
      addRepostRule(rule);
    }
    setShowForm(false);
    setEditingRule(null);
  };

  const handleEdit = (rule: RepostRule) => {
    setEditingRule(rule);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Удалить правило репостера?')) {
      removeRepostRule(id);
    }
  };

  const activeCount = repostRules.filter((r) => r.status === 'active').length;
  const errorCount = repostRules.filter((r) => r.status === 'error').length;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-200">
              <RefreshCw size={20} className="text-white" />
            </div>
            Репостер
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Автоматически берёт посты из RSS, ВКонтакте или Telegram и публикует в ваши аккаунты
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors relative"
          >
            <History size={16} />
            История
            {repostHistory.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-violet-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {Math.min(repostHistory.length, 99)}
              </span>
            )}
          </button>
          <button
            onClick={() => { setEditingRule(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-xl transition-colors shadow-md shadow-violet-200"
          >
            <Plus size={16} />
            Новое правило
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{repostRules.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Всего правил</div>
        </div>
        <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600">{activeCount}</div>
          <div className="text-xs text-emerald-600 mt-0.5">Активных</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-violet-600">{repostHistory.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Репостов всего</div>
        </div>
      </div>

      {/* Error alert */}
      {errorCount > 0 && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
          <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
          <div>
            <div className="text-sm font-medium text-red-700">{errorCount} правил с ошибками</div>
            <div className="text-xs text-red-500">Проверьте токены и настройки источников</div>
          </div>
        </div>
      )}

      {/* How it works */}
      {repostRules.length === 0 && (
        <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-2xl border border-violet-100 p-8 mb-6">
          <h3 className="font-semibold text-gray-900 text-center mb-6">Как работает репостер?</h3>
          <div className="grid grid-cols-3 gap-6">
            {[
              {
                step: '1',
                icon: <Rss size={24} className="text-orange-500" />,
                title: 'Укажите источник',
                desc: 'RSS-лента, стена ВКонтакте или публичный Telegram-канал',
              },
              {
                step: '2',
                icon: <Clock size={24} className="text-violet-500" />,
                title: 'Настройте расписание',
                desc: 'Выберите дни, часы и интервал между публикациями',
              },
              {
                step: '3',
                icon: <RefreshCw size={24} className="text-emerald-500" />,
                title: 'Включите и забудьте',
                desc: 'Репостер сам найдёт новые посты и опубликует их в ваши группы',
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center mx-auto mb-3">
                  {item.icon}
                </div>
                <div className="font-semibold text-gray-800 text-sm mb-1">{item.title}</div>
                <div className="text-xs text-gray-500">{item.desc}</div>
              </div>
            ))}
          </div>
          <div className="text-center mt-6">
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-xl transition-colors shadow-lg shadow-violet-200"
            >
              <Plus size={18} />
              Создать первое правило
            </button>
          </div>
        </div>
      )}

      {/* Rules list */}
      <div className="space-y-3">
        {repostRules.map((rule) => (
          <RuleCard
            key={rule.id}
            rule={rule}
            onEdit={() => handleEdit(rule)}
            onDelete={() => handleDelete(rule.id)}
            onToggle={() => toggleRepostRule(rule.id)}
          />
        ))}
      </div>

      {/* RSS examples */}
      {repostRules.length > 0 && (
        <div className="mt-6 p-4 bg-gray-50 rounded-2xl border border-gray-200">
          <div className="text-xs font-semibold text-gray-600 mb-3">💡 Популярные RSS-ленты</div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { name: 'Хабр (все хабы)', url: 'https://habr.com/ru/rss/hubs/all/' },
              { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
              { name: 'VC.ru', url: 'https://vc.ru/rss' },
              { name: 'RBC Технологии', url: 'https://rssexport.rbc.ru/rbcnews/news/30/full.rss' },
            ].map((feed) => (
              <div key={feed.url} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-100">
                <Rss size={12} className="text-orange-500 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-gray-700">{feed.name}</div>
                  <div className="text-[10px] text-gray-400 truncate">{feed.url}</div>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(feed.url)}
                  className="ml-auto text-[10px] text-violet-500 hover:text-violet-700 px-2 py-1 rounded hover:bg-violet-50 flex-shrink-0"
                >
                  Копировать
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <RuleForm
          initial={editingRule ? {
            name: editingRule.name,
            status: editingRule.status,
            source: editingRule.source,
            targetAccountIds: editingRule.targetAccountIds,
            schedule: editingRule.schedule,
            filters: editingRule.filters,
            order: editingRule.order,
            appendText: editingRule.appendText,
            addSourceLink: editingRule.addSourceLink,
            skipDuplicates: editingRule.skipDuplicates,
            lastProcessedId: editingRule.lastProcessedId,
            lastCheckedAt: editingRule.lastCheckedAt,
            nextPublishAt: editingRule.nextPublishAt,
          } : defaultRule()}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingRule(null); }}
        />
      )}

      {/* History modal */}
      {showHistory && (
        <HistoryPanel history={repostHistory} onClose={() => setShowHistory(false)} />
      )}
    </div>
  );
}
