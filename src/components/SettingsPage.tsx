import { ExternalLink, Info, Server, Shield, Globe } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { backendUrl, useBackend, setBackendConfig } = useStore();
  const [urlInput, setUrlInput] = useState(backendUrl || '');

  const handleSaveBackend = () => {
    try {
      if (urlInput && !urlInput.startsWith('http')) {
        toast.error('URL должен начинаться с http:// или https://');
        return;
      }
      setBackendConfig(urlInput || null, useBackend);
      toast.success('Настройки бэкенда сохранены');
    } catch (e) {
      toast.error('Ошибка сохранения');
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Настройки</h1>
          <p className="text-sm text-gray-500 mt-0.5">Конфигурация API и сервера</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Backend Proxy Settings */}
        <Section color="violet" title="Backend Proxy (Railway)" emoji="🚀">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Если вы развернули бэкенд на Railway, укажите его URL здесь для безопасной публикации и хранения аккаунтов.
            </p>
            
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">URL бэкенда</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://your-backend.railway.app"
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all font-mono"
                />
                <button
                  onClick={handleSaveBackend}
                  className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 transition-colors shadow-sm"
                >
                  Сохранить
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-violet-50 rounded-xl border border-violet-100">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-violet-600" />
                <div>
                  <p className="text-sm font-medium text-violet-900">Использовать прокси</p>
                  <p className="text-xs text-violet-600">Направлять все запросы через указанный сервер</p>
                </div>
              </div>
              <button
                onClick={() => setBackendConfig(backendUrl, !useBackend)}
                className={`relative w-12 h-6 rounded-full transition-colors ${useBackend ? 'bg-violet-600' : 'bg-gray-200'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${useBackend ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>

            {useBackend && !backendUrl && (
              <div className="flex gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
                <Info size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Внимание: прокси включен, но URL не указан. Запросы могут не работать.
                </p>
              </div>
            )}
          </div>
        </Section>
        {/* Telegram */}
        <Section color="sky" title="Telegram Bot API" emoji="✈️">
          <p className="text-sm text-gray-600 mb-3">
            Telegram работает напрямую из браузера — дополнительная настройка не нужна.
          </p>
          <ol className="space-y-2 text-sm text-gray-700">
            <li className="flex gap-2">
              <span className="w-5 h-5 bg-sky-100 text-sky-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
              Откройте Telegram и найдите <strong>@BotFather</strong>
            </li>
            <li className="flex gap-2">
              <span className="w-5 h-5 bg-sky-100 text-sky-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
              Отправьте команду <code className="bg-gray-100 px-1 rounded">/newbot</code> и следуйте инструкциям
            </li>
            <li className="flex gap-2">
              <span className="w-5 h-5 bg-sky-100 text-sky-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
              Скопируйте <strong>Bot Token</strong> вида <code className="bg-gray-100 px-1 rounded">1234567890:ABC...</code>
            </li>
            <li className="flex gap-2">
              <span className="w-5 h-5 bg-sky-100 text-sky-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
              Добавьте бота в канал/группу как администратора с правом публикации
            </li>
            <li className="flex gap-2">
              <span className="w-5 h-5 bg-sky-100 text-sky-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">5</span>
              Для канала используйте <code className="bg-gray-100 px-1 rounded">@username</code>. Для группы — получите ID через <strong>@userinfobot</strong>
            </li>
          </ol>
          <a
            href="https://core.telegram.org/bots/api"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-sky-600 hover:underline mt-3"
          >
            Документация Telegram Bot API <ExternalLink size={12} />
          </a>
        </Section>

        {/* VK */}
        <Section color="blue" title="ВКонтакте API" emoji="🔵">
          <div className="flex gap-2 mb-3 p-3 bg-yellow-50 rounded-xl border border-yellow-100">
            <Info size={14} className="text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-700">
              <strong>CORS:</strong> VK API не поддерживает запросы напрямую из браузера.
              Используйте CORS-прокси или запускайте приложение на сервере.
            </p>
          </div>
          <ol className="space-y-2 text-sm text-gray-700">
            <li className="flex gap-2">
              <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
              Перейдите на <a href="https://vk.com/dev" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">vk.com/dev</a> → «Мои приложения» → «Создать приложение»
            </li>
            <li className="flex gap-2">
              <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
              Тип: <strong>Standalone-приложение</strong>
            </li>
            <li className="flex gap-2">
              <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
              Получите токен через Implicit Flow (права: <code className="bg-gray-100 px-1 rounded">wall,groups,offline</code>)
            </li>
            <li className="flex gap-2">
              <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
              Owner ID группы: откройте группу → Управление → ID (с минусом: -123456789)
            </li>
          </ol>
          <div className="mt-3 bg-gray-900 rounded-xl p-4 text-xs text-green-400 font-mono">
            <div className="text-gray-500 mb-1"># URL для получения токена (Implicit Flow):</div>
            <div className="break-all">
              {'https://oauth.vk.com/authorize?client_id=APP_ID&display=page&redirect_uri=https://oauth.vk.com/blank.html&scope=wall,groups,offline&response_type=token&v=5.199'}
            </div>
          </div>
        </Section>

        {/* OK */}
        <Section color="orange" title="Одноклассники API" emoji="🟠">
          <div className="flex gap-2 mb-3 p-3 bg-yellow-50 rounded-xl border border-yellow-100">
            <Info size={14} className="text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-700">
              <strong>CORS:</strong> OK API также требует серверной стороны для production.
            </p>
          </div>
          <ol className="space-y-2 text-sm text-gray-700">
            <li className="flex gap-2">
              <span className="w-5 h-5 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
              Перейдите на <a href="https://apiok.ru/dev/app/create" target="_blank" rel="noreferrer" className="text-orange-600 hover:underline">apiok.ru/dev</a> → «Создать приложение»
            </li>
            <li className="flex gap-2">
              <span className="w-5 h-5 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
              Сохраните <strong>Application Key</strong> (публичный) и <strong>Secret Key</strong>
            </li>
            <li className="flex gap-2">
              <span className="w-5 h-5 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
              Получите Access Token через OAuth 2.0
            </li>
            <li className="flex gap-2">
              <span className="w-5 h-5 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
              Group ID найдёте в адресной строке страницы группы
            </li>
          </ol>
        </Section>

        {/* Proxy note */}
        <Section color="gray" title="CORS-прокси (для VK и OK)" emoji="🔧">
          <p className="text-sm text-gray-600 mb-3">
            Для работы VK и OK из браузера нужен простой Node.js прокси-сервер:
          </p>
          <div className="bg-gray-900 rounded-xl p-4 text-xs text-green-400 font-mono overflow-x-auto">
            <div className="text-gray-500 mb-2"># Установка и запуск</div>
            <div>npm install express http-proxy-middleware cors</div>
            <div className="mt-2 text-gray-500"># server.js</div>
            <div>{'const express = require("express");'}</div>
            <div>{'const { createProxyMiddleware } = require("http-proxy-middleware");'}</div>
            <div>{'const cors = require("cors");'}</div>
            <div>{'const app = express();'}</div>
            <div>{'app.use(cors());'}</div>
            <div>{'app.use("/vk", createProxyMiddleware({ target: "https://api.vk.com", changeOrigin: true }));'}</div>
            <div>{'app.use("/ok", createProxyMiddleware({ target: "https://api.ok.ru", changeOrigin: true }));'}</div>
            <div>{'app.listen(3001);'}</div>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({
  color,
  title,
  emoji,
  children,
}: {
  color: string;
  title: string;
  emoji: string;
  children: React.ReactNode;
}) {
  const borders: Record<string, string> = {
    sky: 'border-sky-200',
    blue: 'border-blue-200',
    orange: 'border-orange-200',
    violet: 'border-violet-200',
    gray: 'border-gray-200',
  };
  const headers: Record<string, string> = {
    sky: 'bg-sky-50',
    blue: 'bg-blue-50',
    orange: 'bg-orange-50',
    violet: 'bg-violet-50',
    gray: 'bg-gray-50',
  };

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${borders[color] || 'border-gray-200'}`}>
      <div className={`px-5 py-3 ${headers[color] || 'bg-gray-50'} border-b ${borders[color] || 'border-gray-200'}`}>
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <span>{emoji}</span>
          {title}
        </h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
