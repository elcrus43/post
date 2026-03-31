import { useState, useEffect } from 'react';
import { Plus, Trash2, Power, ChevronDown, ChevronUp, Wifi, WifiOff, Loader2, ExternalLink } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Account, Platform, AccountType } from '../types';
import PlatformIcon from './PlatformIcon';
import { cn } from '../utils/cn';
import { testTelegramConnection, testVKConnection, testOKConnection } from '../services/apiService';
import toast from 'react-hot-toast';

const PLATFORM_LABELS: Record<Platform, string> = {
  vk: 'ВКонтакте',
  ok: 'Одноклассники',
  telegram: 'Telegram',
  tenchat: 'TenChat',
  twitter: 'Twitter (X)',
};

const PLATFORM_COLORS: Record<Platform, string> = {
  vk: 'bg-blue-500',
  ok: 'bg-orange-500',
  telegram: 'bg-sky-500',
  tenchat: 'bg-orange-600',
  twitter: 'bg-black',
};

const TYPE_LABELS: Record<AccountType, string> = {
  personal: 'Личная страница',
  group: 'Группа',
  channel: 'Канал',
};

interface FormState {
  platform: Platform;
  type: AccountType;
  name: string;
  vkToken: string;
  vkOwnerId: string;
  okToken: string;
  okAppKey: string;
  okAppSecretKey: string;
  okGroupId: string;
  tgBotToken: string;
  tgChatId: string;
}

const defaultForm: FormState = {
  platform: 'telegram',
  type: 'personal',
  name: '',
  vkToken: '',
  vkOwnerId: '',
  okToken: '',
  okAppKey: '',
  okAppSecretKey: '',
  okGroupId: '',
  tgBotToken: '',
  tgChatId: '',
};

export default function AccountsPage() {
  const { accounts, addAccount, removeAccount, toggleAccount } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testingForm, setTestingForm] = useState(false);
  const { backendUrl, useBackend } = useStore();

  // Обработка возврата после OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'vk_added') {
      toast.success('Аккаунт ВКонтакте успешно добавлен!');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('success') === 'ok_added') {
      toast.success('Аккаунт Одноклассники успешно добавлен!');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('success') === 'tenchat_added') {
      toast.success('Аккаунт TenChat успешно добавлен!');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('success') === 'twitter_added') {
      toast.success('Аккаунт Twitter (X) успешно добавлен!');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleOAuth = (platform: Platform) => {
    if (!useBackend || !backendUrl) {
      toast.error('Бэкенд не настроен. OAuth недоступен.');
      return;
    }
    window.location.href = `${backendUrl}/api/auth/${platform}`;
  };

  const setField = (key: keyof FormState, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleAdd = () => {
    if (!form.name.trim()) { toast.error('Введите название аккаунта'); return; }

    const base = { platform: form.platform, type: form.type, name: form.name.trim(), isActive: true };

    if (form.platform === 'vk') {
      if (!form.vkToken || !form.vkOwnerId) { toast.error('Заполните токен VK и Owner ID'); return; }
      addAccount({ ...base, vkToken: form.vkToken, vkOwnerId: form.vkOwnerId });
    } else if (form.platform === 'ok') {
      if (!form.okToken || !form.okAppKey || !form.okAppSecretKey) { toast.error('Заполните все поля Одноклассников'); return; }
      addAccount({ ...base, okToken: form.okToken, okAppKey: form.okAppKey, okAppSecretKey: form.okAppSecretKey, okGroupId: form.okGroupId });
    } else if (form.platform === 'telegram') {
      if (!form.tgBotToken || !form.tgChatId) { toast.error('Заполните Bot Token и Chat ID'); return; }
      addAccount({ ...base, tgBotToken: form.tgBotToken, tgChatId: form.tgChatId });
    } else {
      // Для TenChat и Twitter используем OAuth (добавление через редирект)
      handleOAuth(form.platform);
      return;
    }

    toast.success('Аккаунт добавлен!');
    setForm(defaultForm);
    setShowForm(false);
  };

  // Тест соединения из формы
  const handleTestForm = async () => {
    setTestingForm(true);
    try {
      if (form.platform === 'telegram') {
        if (!form.tgBotToken) { toast.error('Введите Bot Token'); return; }
        const r = await testTelegramConnection(form.tgBotToken);
        if (r.ok) toast.success(`✅ Telegram бот подключён: @${r.name}`);
        else toast.error(`❌ Ошибка: ${r.error}`);
      } else if (form.platform === 'vk') {
        if (!form.vkToken) { toast.error('Введите токен VK'); return; }
        const r = await testVKConnection(form.vkToken);
        if (r.ok) toast.success(`✅ VK подключён: ${r.name}`);
        else toast.error(`❌ Ошибка: ${r.error}`);
      } else {
        if (!form.okToken || !form.okAppKey || !form.okAppSecretKey) { toast.error('Заполните все поля OK'); return; }
        const r = await testOKConnection(form.okToken, form.okAppKey, form.okAppSecretKey);
        if (r.ok) toast.success(`✅ Одноклассники: ${r.name}`);
        else toast.error(`❌ Ошибка: ${r.error}`);
      }
    } finally {
      setTestingForm(false);
    }
  };

  // Тест соединения для сохранённого аккаунта
  const handleTestAccount = async (acc: Account) => {
    setTesting(acc.id);
    try {
      if (acc.platform === 'telegram' && acc.tgBotToken) {
        const r = await testTelegramConnection(acc.tgBotToken);
        if (r.ok) toast.success(`✅ ${acc.name}: бот @${r.name} активен`);
        else toast.error(`❌ ${acc.name}: ${r.error}`);
      } else if (acc.platform === 'vk' && acc.vkToken) {
        const r = await testVKConnection(acc.vkToken);
        if (r.ok) toast.success(`✅ ${acc.name}: VK подключён (${r.name})`);
        else toast.error(`❌ ${acc.name}: ${r.error}`);
      } else if (acc.platform === 'ok' && acc.okToken && acc.okAppKey && acc.okAppSecretKey) {
        const r = await testOKConnection(acc.okToken, acc.okAppKey, acc.okAppSecretKey);
        if (r.ok) toast.success(`✅ ${acc.name}: OK подключён (${r.name})`);
        else toast.error(`❌ ${acc.name}: ${r.error}`);
      } else {
        toast('⚠️ Тест для этой платформы недоступен', { icon: 'ℹ️' });
      }
    } finally {
      setTesting(null);
    }
  };

  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white';
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1';

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Аккаунты</h1>
          <p className="text-sm text-gray-500 mt-0.5">Управление подключёнными платформами</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setForm(defaultForm); }}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 transition-colors shadow"
        >
          <Plus size={16} />
          Добавить
        </button>
      </div>

      {/* Status bar */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-6">
        {(['telegram', 'vk', 'ok', 'tenchat', 'twitter'] as Platform[]).map((p) => {
          const count = accounts.filter((a) => a.platform === p && a.isActive).length;
          return (
            <div key={p} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0', PLATFORM_COLORS[p])}>
                <PlatformIcon platform={p} size={16} />
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-800">{count} акк.</div>
                <div className="text-xs text-gray-400">{PLATFORM_LABELS[p]}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Новый аккаунт</h2>

          {/* Platform */}
          <div className="mb-4">
            <label className={labelCls}>Платформа</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {(['telegram', 'vk', 'ok', 'tenchat', 'twitter'] as Platform[]).map((p) => (
                <button key={p} onClick={() => setField('platform', p)}
                  className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all',
                    form.platform === p ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  )}>
                  <span className={cn('p-1 rounded text-white', PLATFORM_COLORS[p])}>
                    <PlatformIcon platform={p} size={14} />
                  </span>
                  {PLATFORM_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Type */}
          <div className="mb-4">
            <label className={labelCls}>Тип</label>
            <div className="flex gap-2 flex-wrap">
              {(['personal', 'group', 'channel'] as AccountType[]).map((t) => (
                <button key={t} onClick={() => setField('type', t)}
                  className={cn('px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
                    form.type === t ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  )}>
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div className="mb-4">
            <label className={labelCls}>Название аккаунта</label>
            <input className={inputCls} placeholder="Например: Мой канал"
              value={form.name} onChange={(e) => setField('name', e.target.value)} />
          </div>

          {/* Telegram */}
          {form.platform === 'telegram' && (
            <div className="space-y-3 mb-4 bg-sky-50 p-4 rounded-xl border border-sky-100">
              <h3 className="text-xs font-semibold text-sky-700 uppercase tracking-wide">Telegram API</h3>
              <div>
                <label className={labelCls}>Bot Token</label>
                <input className={inputCls} placeholder="1234567890:ABCdefGHIjklMNO..."
                  value={form.tgBotToken} onChange={(e) => setField('tgBotToken', e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">Получить у @BotFather → /newbot</p>
              </div>
              <div>
                <label className={labelCls}>Chat ID / Channel Username</label>
                <input className={inputCls} placeholder="-1001234567890 или @mychannel"
                  value={form.tgChatId} onChange={(e) => setField('tgChatId', e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">Для канала: @username. Для группы: отрицательное число</p>
              </div>
              <div className="bg-sky-100 rounded-lg p-3 text-xs text-sky-800 space-y-1">
                <p className="font-medium">Как получить Chat ID группы/канала:</p>
                <p>1. Добавьте бота в канал/группу как администратора</p>
                <p>2. Отправьте любое сообщение</p>
                <p>3. Откройте: <code className="bg-sky-200 px-1 rounded">api.telegram.org/bot{'<TOKEN>'}/getUpdates</code></p>
                <p>4. Найдите <code className="bg-sky-200 px-1 rounded">chat.id</code> в ответе</p>
              </div>
            </div>
          )}

          {/* VK */}
          {form.platform === 'vk' && (
            <div className="space-y-4 mb-4">
              <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex flex-col items-center text-center shadow-sm">
                <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white mb-4 shadow-lg">
                  <PlatformIcon platform="vk" size={32} />
                </div>
                <h3 className="text-base font-bold text-blue-900 mb-2">Авторизация VK ID</h3>
                <p className="text-sm text-blue-700 mb-6 max-w-sm">
                  Нажмите кнопку ниже, чтобы безопасно подключить ваш аккаунт или группу через официальный сервис ВКонтакте.
                </p>
                <button
                  onClick={() => handleOAuth('vk')}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-3 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                >
                  <ExternalLink size={18} />
                  Войти через ВКонтакте
                </button>
              </div>
            </div>
          )}

          {/* OK */}
          {form.platform === 'ok' && (
            <div className="space-y-4 mb-4">
              <div className="bg-orange-50 p-6 rounded-2xl border border-orange-100 flex flex-col items-center text-center shadow-sm">
                <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center text-white mb-4 shadow-lg">
                  <PlatformIcon platform="ok" size={32} />
                </div>
                <h3 className="text-base font-bold text-orange-900 mb-2">Авторизация OK.ru</h3>
                <p className="text-sm text-orange-700 mb-6 max-w-sm">
                  Подключите вашу страницу или группу в Одноклассниках.
                </p>
                <button
                  onClick={() => handleOAuth('ok')}
                  className="w-full py-3 bg-orange-600 text-white rounded-xl text-sm font-bold hover:bg-orange-700 transition-all flex items-center justify-center gap-3 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                >
                  <ExternalLink size={18} />
                  Войти через Одноклассники
                </button>
              </div>
            </div>
          )}

          {/* TenChat */}
          {form.platform === 'tenchat' && (
            <div className="space-y-4 mb-4">
              <div className="bg-orange-50 p-6 rounded-2xl border border-orange-100 flex flex-col items-center text-center shadow-sm">
                <div className="w-16 h-16 bg-orange-600 rounded-full flex items-center justify-center text-white mb-4 shadow-lg">
                  <PlatformIcon platform="tenchat" size={32} />
                </div>
                <h3 className="text-base font-bold text-orange-900 mb-2">Авторизация TenChat</h3>
                <p className="text-sm text-orange-700 mb-6 max-w-sm">
                  Подключите ваш профиль TenChat через официальное окно авторизации.
                </p>
                <button
                  onClick={() => handleOAuth('tenchat')}
                  className="w-full py-3 bg-orange-600 text-white rounded-xl text-sm font-bold hover:bg-orange-700 transition-all flex items-center justify-center gap-3 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                >
                  <ExternalLink size={18} />
                  Войти через TenChat
                </button>
              </div>
            </div>
          )}
          {/* Twitter */}
          {form.platform === 'twitter' && (
            <div className="space-y-4 mb-4">
              <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 flex flex-col items-center text-center shadow-sm">
                <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center text-white mb-4 shadow-lg">
                  <PlatformIcon platform="twitter" size={32} />
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2">Авторизация Twitter (X)</h3>
                <p className="text-sm text-gray-700 mb-6 max-w-sm">
                  Используйте OAuth 2.0 PKCE для безопасного подключения вашего X-аккаунта.
                </p>
                <button
                  onClick={() => handleOAuth('twitter')}
                  className="w-full py-3 bg-black text-white rounded-xl text-sm font-bold hover:bg-gray-800 transition-all flex items-center justify-center gap-3 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                >
                  <ExternalLink size={18} />
                  Войти через X (Twitter)
                </button>
              </div>
            </div>
          )}


          <div className="flex gap-3">
            <button onClick={handleTestForm} disabled={testingForm}
              className="flex items-center gap-2 px-4 py-2 border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-xl text-sm font-medium hover:bg-emerald-100 transition-colors disabled:opacity-50">
              {testingForm ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
              Тест
            </button>
            <button onClick={handleAdd}
              className="flex-1 py-2 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 transition-colors">
              Добавить аккаунт
            </button>
            <button onClick={() => { setShowForm(false); setForm(defaultForm); }}
              className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50">
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Accounts list */}
      {accounts.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-6xl mb-3">👥</div>
          <p className="font-medium text-gray-500">Нет добавленных аккаунтов</p>
          <p className="text-sm mt-1">Нажмите «Добавить» чтобы подключить платформу</p>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((acc) => (
            <AccountCard
              key={acc.id}
              account={acc}
              expanded={expandedId === acc.id}
              testingId={testing}
              onToggleExpand={() => setExpandedId(expandedId === acc.id ? null : acc.id)}
              onToggleActive={() => toggleAccount(acc.id)}
              onRemove={() => { removeAccount(acc.id); toast.success('Аккаунт удалён'); }}
              onTest={() => handleTestAccount(acc)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface CardProps {
  account: Account;
  expanded: boolean;
  testingId: string | null;
  onToggleExpand: () => void;
  onToggleActive: () => void;
  onRemove: () => void;
  onTest: () => void;
}

function AccountCard({ account, expanded, testingId, onToggleExpand, onToggleActive, onRemove, onTest }: CardProps) {
  const isTesting = testingId === account.id;

  return (
    <div className={cn('bg-white rounded-2xl border shadow-sm transition-all',
      account.isActive ? 'border-gray-200' : 'border-gray-100 opacity-60'
    )}>
      <div className="flex items-center gap-4 p-4">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0', PLATFORM_COLORS[account.platform])}>
          <PlatformIcon platform={account.platform} size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 truncate">{account.name}</div>
          <div className="text-xs text-gray-400 mt-0.5">
            {PLATFORM_LABELS[account.platform]} · {TYPE_LABELS[account.type]}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Test connection */}
          <button onClick={onTest} disabled={isTesting}
            className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 transition-colors disabled:opacity-50"
            title="Проверить соединение">
            {isTesting ? <Loader2 size={15} className="animate-spin" /> : <Wifi size={15} />}
          </button>
          {/* Toggle active */}
          <button onClick={onToggleActive}
            className={cn('p-1.5 rounded-lg transition-colors',
              account.isActive ? 'text-emerald-500 hover:bg-emerald-50' : 'text-gray-400 hover:bg-gray-100'
            )}
            title={account.isActive ? 'Отключить' : 'Включить'}>
            <Power size={16} />
          </button>
          {/* Expand */}
          <button onClick={onToggleExpand} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {/* Remove */}
          <button onClick={onRemove} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500 space-y-1.5 bg-gray-50 rounded-b-2xl">
          {account.platform === 'vk' && (
            <>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-600 w-20">Owner ID:</span>
                <code className="bg-white border border-gray-200 px-2 py-0.5 rounded">{account.vkOwnerId}</code>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-600 w-20">Token:</span>
                <code className="bg-white border border-gray-200 px-2 py-0.5 rounded">{account.vkToken?.slice(0, 20)}...</code>
              </div>
            </>
          )}
          {account.platform === 'ok' && (
            <>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-600 w-20">App Key:</span>
                <code className="bg-white border border-gray-200 px-2 py-0.5 rounded">{account.okAppKey}</code>
              </div>
              {account.okGroupId && (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-600 w-20">Group ID:</span>
                  <code className="bg-white border border-gray-200 px-2 py-0.5 rounded">{account.okGroupId}</code>
                </div>
              )}
            </>
          )}
          {account.platform === 'telegram' && (
            <>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-600 w-20">Chat ID:</span>
                <code className="bg-white border border-gray-200 px-2 py-0.5 rounded">{account.tgChatId}</code>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-600 w-20">Bot Token:</span>
                <code className="bg-white border border-gray-200 px-2 py-0.5 rounded">{account.tgBotToken?.slice(0, 25)}...</code>
              </div>
            </>
          )}
          <div className="flex items-center gap-2 pt-1 border-t border-gray-200">
            <span className="font-medium text-gray-600 w-20">Добавлен:</span>
            <span>{new Date(account.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-600 w-20">Статус:</span>
            <span className={cn('flex items-center gap-1', account.isActive ? 'text-emerald-600' : 'text-gray-400')}>
              {account.isActive ? <><Wifi size={11} /> Активен</> : <><WifiOff size={11} /> Отключён</>}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
