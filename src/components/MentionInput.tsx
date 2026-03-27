import { useState } from 'react';
import { AtSign, X, Plus } from 'lucide-react';
import { PostMention, Platform } from '../types';
import PlatformIcon from './PlatformIcon';
import { cn } from '../utils/cn';

interface MentionInputProps {
  mentions: PostMention[];
  onChange: (mentions: PostMention[]) => void;
}

const PLATFORM_LABELS: Record<Platform, string> = {
  vk: 'ВКонтакте',
  ok: 'Одноклассники',
  telegram: 'Telegram',
};

export default function MentionInput({ mentions, onChange }: MentionInputProps) {
  const [open, setOpen] = useState(false);
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [platform, setPlatform] = useState<Platform>('vk');

  const add = () => {
    const h = handle.trim().replace(/^@/, '');
    if (!h || !displayName.trim()) return;
    const mention: PostMention = {
      id: crypto.randomUUID(),
      platform,
      handle: h,
      displayName: displayName.trim(),
    };
    onChange([...mentions, mention]);
    setHandle('');
    setDisplayName('');
    setOpen(false);
  };

  const remove = (id: string) => onChange(mentions.filter((m) => m.id !== id));

  const platformColors: Record<Platform, string> = {
    vk: 'bg-blue-50 border-blue-200 text-blue-700',
    ok: 'bg-orange-50 border-orange-200 text-orange-700',
    telegram: 'bg-sky-50 border-sky-200 text-sky-700',
  };

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all',
          open
            ? 'border-blue-400 bg-blue-50 text-blue-700'
            : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-600'
        )}
      >
        <AtSign size={16} />
        Отметки
        {mentions.length > 0 && (
          <span className="bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
            {mentions.length}
          </span>
        )}
      </button>

      {/* Tags preview */}
      {mentions.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {mentions.map((m) => (
            <span
              key={m.id}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs border font-medium',
                platformColors[m.platform]
              )}
            >
              <PlatformIcon platform={m.platform} size={12} />
              @{m.handle}
              <button
                type="button"
                onClick={() => remove(m.id)}
                className="ml-0.5 opacity-60 hover:opacity-100"
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Panel */}
      {open && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-2xl border border-gray-200 shadow-2xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-800 text-sm">Добавить отметку</span>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-4 space-y-3">
            {/* Platform */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Платформа</label>
              <div className="grid grid-cols-3 gap-1">
                {(['vk', 'ok', 'telegram'] as Platform[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlatform(p)}
                    className={cn(
                      'flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-xs font-medium transition-all',
                      platform === p
                        ? 'border-blue-400 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    )}
                  >
                    <PlatformIcon platform={p} size={16} />
                    <span>{PLATFORM_LABELS[p]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Handle */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Ник / username
              </label>
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:border-blue-400">
                <span className="px-3 text-gray-400 text-sm">@</span>
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="username"
                  className="flex-1 py-2 pr-3 text-sm outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && add()}
                />
              </div>
            </div>

            {/* Display name */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Отображаемое имя
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Имя пользователя / группы"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                onKeyDown={(e) => e.key === 'Enter' && add()}
              />
            </div>

            <button
              type="button"
              onClick={add}
              disabled={!handle.trim() || !displayName.trim()}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Plus size={16} />
              Добавить отметку
            </button>
          </div>

          {mentions.length > 0 && (
            <div className="px-4 pb-3">
              <p className="text-xs text-gray-400 font-medium mb-2">Добавлено:</p>
              <div className="space-y-1">
                {mentions.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-gray-50"
                  >
                    <div className="flex items-center gap-2">
                      <PlatformIcon platform={m.platform} size={14} />
                      <span className="text-sm text-gray-700">
                        {m.displayName}{' '}
                        <span className="text-gray-400 text-xs">@{m.handle}</span>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(m.id)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
