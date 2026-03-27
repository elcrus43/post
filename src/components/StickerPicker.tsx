import { useState } from 'react';
import { Smile, X } from 'lucide-react';
import { Sticker } from '../types';
import { cn } from '../utils/cn';

const STICKER_CATEGORIES: { key: Sticker['category']; label: string; icon: string }[] = [
  { key: 'reactions',  label: 'Реакции',  icon: '👍' },
  { key: 'emotions',   label: 'Эмоции',   icon: '😀' },
  { key: 'business',   label: 'Бизнес',   icon: '💼' },
  { key: 'nature',     label: 'Природа',  icon: '🌿' },
  { key: 'food',       label: 'Еда',      icon: '🍕' },
  { key: 'symbols',    label: 'Символы',  icon: '⭐' },
];

const STICKERS: Sticker[] = [
  // Reactions
  { id: 's1',  emoji: '👍', label: 'Лайк',        category: 'reactions' },
  { id: 's2',  emoji: '❤️', label: 'Сердце',       category: 'reactions' },
  { id: 's3',  emoji: '🔥', label: 'Огонь',        category: 'reactions' },
  { id: 's4',  emoji: '👏', label: 'Аплодисменты', category: 'reactions' },
  { id: 's5',  emoji: '🎉', label: 'Праздник',     category: 'reactions' },
  { id: 's6',  emoji: '💯', label: '100%',         category: 'reactions' },
  { id: 's7',  emoji: '🙌', label: 'Ура!',         category: 'reactions' },
  { id: 's8',  emoji: '😍', label: 'Восхищение',   category: 'reactions' },
  // Emotions
  { id: 's9',  emoji: '😀', label: 'Улыбка',       category: 'emotions' },
  { id: 's10', emoji: '😂', label: 'Смех',         category: 'emotions' },
  { id: 's11', emoji: '🤔', label: 'Думаю',        category: 'emotions' },
  { id: 's12', emoji: '😎', label: 'Круто',        category: 'emotions' },
  { id: 's13', emoji: '🥳', label: 'Веселье',      category: 'emotions' },
  { id: 's14', emoji: '😢', label: 'Грусть',       category: 'emotions' },
  { id: 's15', emoji: '😡', label: 'Злость',       category: 'emotions' },
  { id: 's16', emoji: '🤩', label: 'Восторг',      category: 'emotions' },
  // Business
  { id: 's17', emoji: '💼', label: 'Портфель',     category: 'business' },
  { id: 's18', emoji: '📈', label: 'Рост',         category: 'business' },
  { id: 's19', emoji: '💡', label: 'Идея',         category: 'business' },
  { id: 's20', emoji: '🚀', label: 'Запуск',       category: 'business' },
  { id: 's21', emoji: '🎯', label: 'Цель',         category: 'business' },
  { id: 's22', emoji: '💰', label: 'Деньги',       category: 'business' },
  { id: 's23', emoji: '📊', label: 'Статистика',   category: 'business' },
  { id: 's24', emoji: '🤝', label: 'Сотрудничество', category: 'business' },
  // Nature
  { id: 's25', emoji: '🌿', label: 'Природа',      category: 'nature' },
  { id: 's26', emoji: '🌸', label: 'Цветок',       category: 'nature' },
  { id: 's27', emoji: '⛄', label: 'Снеговик',     category: 'nature' },
  { id: 's28', emoji: '☀️', label: 'Солнце',       category: 'nature' },
  { id: 's29', emoji: '🌊', label: 'Волна',        category: 'nature' },
  { id: 's30', emoji: '🐾', label: 'Следы',        category: 'nature' },
  { id: 's31', emoji: '🦋', label: 'Бабочка',      category: 'nature' },
  { id: 's32', emoji: '🌈', label: 'Радуга',       category: 'nature' },
  // Food
  { id: 's33', emoji: '🍕', label: 'Пицца',        category: 'food' },
  { id: 's34', emoji: '☕', label: 'Кофе',         category: 'food' },
  { id: 's35', emoji: '🍰', label: 'Торт',         category: 'food' },
  { id: 's36', emoji: '🥑', label: 'Авокадо',      category: 'food' },
  { id: 's37', emoji: '🍣', label: 'Суши',         category: 'food' },
  { id: 's38', emoji: '🍔', label: 'Бургер',       category: 'food' },
  { id: 's39', emoji: '🥂', label: 'Шампанское',   category: 'food' },
  { id: 's40', emoji: '🧁', label: 'Кекс',         category: 'food' },
  // Symbols
  { id: 's41', emoji: '⭐', label: 'Звезда',       category: 'symbols' },
  { id: 's42', emoji: '✅', label: 'Галочка',      category: 'symbols' },
  { id: 's43', emoji: '⚡', label: 'Молния',       category: 'symbols' },
  { id: 's44', emoji: '💎', label: 'Бриллиант',    category: 'symbols' },
  { id: 's45', emoji: '🏆', label: 'Трофей',       category: 'symbols' },
  { id: 's46', emoji: '📣', label: 'Мегафон',      category: 'symbols' },
  { id: 's47', emoji: '🔔', label: 'Колокол',      category: 'symbols' },
  { id: 's48', emoji: '📌', label: 'Закреп',       category: 'symbols' },
];

interface StickerPickerProps {
  selected: Sticker[];
  onChange: (stickers: Sticker[]) => void;
}

export default function StickerPicker({ selected, onChange }: StickerPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Sticker['category']>('reactions');

  const toggle = (sticker: Sticker) => {
    const exists = selected.find((s) => s.id === sticker.id);
    if (exists) {
      onChange(selected.filter((s) => s.id !== sticker.id));
    } else if (selected.length < 5) {
      onChange([...selected, sticker]);
    }
  };

  const filtered = STICKERS.filter((s) => s.category === activeCategory);

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all',
          open
            ? 'border-purple-400 bg-purple-50 text-purple-700'
            : 'border-gray-200 bg-white text-gray-600 hover:border-purple-300 hover:text-purple-600'
        )}
      >
        <Smile size={16} />
        Стикеры
        {selected.length > 0 && (
          <span className="bg-purple-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
            {selected.length}
          </span>
        )}
      </button>

      {/* Selected stickers preview */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selected.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange(selected.filter((x) => x.id !== s.id))}
              className="group relative flex items-center gap-1 bg-purple-50 border border-purple-200 rounded-lg px-2 py-1 text-sm hover:bg-red-50 hover:border-red-200 transition-colors"
              title={`Убрать ${s.label}`}
            >
              <span className="text-base">{s.emoji}</span>
              <span className="text-xs text-purple-700 group-hover:text-red-600">{s.label}</span>
              <X size={12} className="text-purple-400 group-hover:text-red-500" />
            </button>
          ))}
        </div>
      )}

      {/* Picker panel */}
      {open && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-2xl border border-gray-200 shadow-2xl z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-800 text-sm">Выбрать стикер</span>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Categories */}
          <div className="flex gap-1 px-3 py-2 border-b border-gray-100 overflow-x-auto">
            {STICKER_CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setActiveCategory(cat.key)}
                className={cn(
                  'flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                  activeCategory === cat.key
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-purple-50 hover:text-purple-600'
                )}
              >
                <span>{cat.icon}</span>
                {cat.label}
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-4 gap-1 p-3">
            {filtered.map((sticker) => {
              const isSelected = !!selected.find((s) => s.id === sticker.id);
              return (
                <button
                  key={sticker.id}
                  type="button"
                  onClick={() => toggle(sticker)}
                  title={sticker.label}
                  className={cn(
                    'flex flex-col items-center gap-1 p-2 rounded-xl transition-all text-center',
                    isSelected
                      ? 'bg-purple-100 border-2 border-purple-400'
                      : 'hover:bg-gray-100 border-2 border-transparent'
                  )}
                >
                  <span className="text-2xl">{sticker.emoji}</span>
                  <span className="text-[10px] text-gray-500 leading-tight">{sticker.label}</span>
                </button>
              );
            })}
          </div>

          <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400 text-center">
            Выбрано {selected.length}/5 стикеров
          </div>
        </div>
      )}
    </div>
  );
}
