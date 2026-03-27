import { useState } from 'react';
import {
  Cloud, Database, Image, Shield, CheckCircle,
  ChevronDown, ChevronUp, ExternalLink, Copy, Terminal,
  Server, Globe, Lock, AlertTriangle, Zap, ArrowRight,
  Package, Key, HardDrive, RefreshCw
} from 'lucide-react';
import { cn } from '../utils/cn';

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
};

function CodeBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    copyToClipboard(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group my-3">
      <div className="flex items-center justify-between bg-gray-800 rounded-t-lg px-4 py-2">
        <span className="text-xs text-gray-400 font-mono">{lang}</span>
        <button
          onClick={handle}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
        >
          {copied ? <CheckCircle size={13} className="text-emerald-400" /> : <Copy size={13} />}
          {copied ? 'Скопировано!' : 'Копировать'}
        </button>
      </div>
      <pre className="bg-gray-900 rounded-b-lg p-4 text-sm text-gray-100 overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap">
        {code}
      </pre>
    </div>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(number === 1);
  return (
    <div className={cn('border rounded-2xl transition-all', open ? 'border-violet-300 shadow-md shadow-violet-100' : 'border-gray-200 hover:border-gray-300')}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 p-5 text-left"
      >
        <div className={cn(
          'w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-all',
          open ? 'bg-violet-600 text-white shadow-lg shadow-violet-200' : 'bg-gray-100 text-gray-500'
        )}>
          {number}
        </div>
        <span className={cn('font-semibold text-base flex-1', open ? 'text-violet-700' : 'text-gray-700')}>
          {title}
        </span>
        {open
          ? <ChevronUp size={18} className="text-violet-400 flex-shrink-0" />
          : <ChevronDown size={18} className="text-gray-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 text-sm text-gray-700 space-y-3 border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  );
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  const colors: Record<string, string> = {
    green: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    violet: 'bg-violet-100 text-violet-700 border-violet-200',
    orange: 'bg-orange-100 text-orange-700 border-orange-200',
    red: 'bg-red-100 text-red-700 border-red-200',
  };
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border', colors[color])}>
      {children}
    </span>
  );
}

function ServiceCard({ icon: Icon, name, price, desc, url, color }: {
  icon: React.ElementType; name: string; price: string; desc: string; url: string; color: string;
}) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="flex items-start gap-3 p-4 border border-gray-200 rounded-xl hover:border-violet-300 hover:shadow-md transition-all group">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', color)}>
        <Icon size={20} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-800 text-sm">{name}</span>
          <ExternalLink size={12} className="text-gray-400 group-hover:text-violet-500 transition-colors" />
        </div>
        <div className="text-xs text-emerald-600 font-semibold">{price}</div>
        <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</div>
      </div>
    </a>
  );
}

function Alert({ type, children }: { type: 'info' | 'warning' | 'success'; children: React.ReactNode }) {
  const styles = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  };
  const icons = {
    info: <Zap size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />,
    warning: <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />,
    success: <CheckCircle size={15} className="text-emerald-500 flex-shrink-0 mt-0.5" />,
  };
  return (
    <div className={cn('flex gap-2.5 p-3 rounded-xl border text-sm leading-relaxed', styles[type])}>
      {icons[type]}
      <div>{children}</div>
    </div>
  );
}

const envExample = `# MongoDB
MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/autopost

# Шифрование токенов (любые случайные строки)
JWT_SECRET=your_super_secret_jwt_key_64_chars_long_random_string_here
ENCRYPTION_KEY=your_32_char_encryption_key_here

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=123456789
CLOUDINARY_API_SECRET=your_api_secret

# Порт (Railway выставит сам)
PORT=3000`;

const backendCode = `// server.js — минимальный Express прокси для VK и OK
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const CryptoJS = require('crypto-js');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json({ limit: '50mb' }));

// Подключение к MongoDB
mongoose.connect(process.env.MONGO_URI);

// Схема аккаунта с зашифрованными токенами
const AccountSchema = new mongoose.Schema({
  platform: String,
  name: String,
  encryptedToken: String, // токен НИКОГДА не хранится открыто
  ownerId: String,
  isActive: Boolean,
});
const Account = mongoose.model('Account', AccountSchema);

// Шифрование токена
const encrypt = (token) =>
  CryptoJS.AES.encrypt(token, process.env.ENCRYPTION_KEY).toString();

// Дешифрование токена
const decrypt = (encrypted) =>
  CryptoJS.AES.decrypt(encrypted, process.env.ENCRYPTION_KEY)
    .toString(CryptoJS.enc.Utf8);

// POST /api/accounts — сохранить аккаунт
app.post('/api/accounts', async (req, res) => {
  const { platform, name, token, ownerId } = req.body;
  const account = new Account({
    platform, name, ownerId, isActive: true,
    encryptedToken: encrypt(token), // шифруем перед сохранением
  });
  await account.save();
  res.json({ id: account._id, platform, name, ownerId });
});

// POST /api/publish/vk — публикация во ВКонтакте
app.post('/api/publish/vk', async (req, res) => {
  const { accountId, message, attachments } = req.body;
  const account = await Account.findById(accountId);
  const token = decrypt(account.encryptedToken);

  const response = await axios.post('https://api.vk.com/method/wall.post', {
    owner_id: account.ownerId,
    message,
    attachments,
    access_token: token,
    v: '5.199',
  });
  res.json(response.data);
});

app.listen(process.env.PORT || 3000, () => console.log('✅ Server running'));`;

const railwaySteps = `1. Зайти на railway.app → New Project
2. Deploy from GitHub repo → выбрать ваш репозиторий
3. Add service → Database? → НЕТ (используем Atlas)
4. Variables → добавить все переменные из .env
5. Settings → Root Directory → указать /backend
6. Deploy → скопировать URL сервера`;

const vercelSteps = `1. Зайти на vercel.com → New Project
2. Import Git Repository → выбрать ваш репозиторий
3. Framework Preset → Vite (определится автоматически)
4. Root Directory → / (корень, фронтенд)
5. Environment Variables:
   VITE_API_URL = https://ваш-railway-url.railway.app
6. Deploy → готово!`;

const mongoSteps = `1. Зайти на mongodb.com/atlas → Create Free Account
2. Create Cluster → FREE (M0 Sandbox)
3. Security → Database Access → Add User
   Username: autopost_user
   Password: [сгенерировать]
4. Security → Network Access → Add IP → Allow from Anywhere
5. Database → Connect → Drivers → скопировать строку подключения
   Вставить в MONGO_URI (заменить <password>)`;

const backupScript = `// Экспорт всех аккаунтов в зашифрованный файл
// Запускать: node backup.js

const mongoose = require('mongoose');
const CryptoJS = require('crypto-js');
const fs = require('fs');
require('dotenv').config();

async function backup() {
  await mongoose.connect(process.env.MONGO_URI);
  const accounts = await Account.find({});

  // Перешифровываем новым ключом для бэкапа
  const backupData = {
    date: new Date().toISOString(),
    accounts: accounts.map(a => ({
      platform: a.platform,
      name: a.name,
      ownerId: a.ownerId,
      token: decrypt(a.encryptedToken), // расшифровываем
    }))
  };

  // Шифруем весь файл паролем
  const encrypted = CryptoJS.AES.encrypt(
    JSON.stringify(backupData),
    process.env.BACKUP_PASSWORD
  ).toString();

  fs.writeFileSync(\`backup_\${Date.now()}.enc\`, encrypted);
  console.log('✅ Бэкап создан!');
  process.exit();
}

backup();`;

export default function DeployGuidePage() {
  const [activeSection, setActiveSection] = useState<'overview' | 'steps' | 'security' | 'backup'>('overview');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-br from-gray-900 via-violet-950 to-indigo-900 px-8 py-10">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
              <Globe size={22} className="text-violet-300" />
            </div>
            <div>
              <div className="text-violet-300 text-sm font-medium">Инструкция по деплою</div>
              <div className="text-white font-bold text-xl">AutoPost — Antigravity</div>
            </div>
          </div>
          <p className="text-gray-300 text-sm leading-relaxed max-w-2xl">
            Полное руководство по развёртыванию приложения автопостинга в продакшн.
            Бесплатный стек: <strong className="text-white">GitHub → Vercel + Railway + MongoDB Atlas + Cloudinary</strong>
          </p>

          {/* Quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            {[
              { label: 'Стоимость', value: '~$0/мес', icon: '💰' },
              { label: 'Время деплоя', value: '~20 мин', icon: '⚡' },
              { label: 'Сервисов', value: '4 шт', icon: '🔧' },
              { label: 'Безопасность', value: 'AES-256', icon: '🔐' },
            ].map(s => (
              <div key={s.label} className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className="text-white font-bold text-sm">{s.value}</div>
                <div className="text-gray-400 text-xs">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-8">
          <div className="flex gap-1 py-2">
            {[
              { id: 'overview', label: '🗺️ Обзор', },
              { id: 'steps', label: '📋 Шаги', },
              { id: 'security', label: '🔐 Безопасность', },
              { id: 'backup', label: '💾 Бэкапы', },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id as any)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  activeSection === tab.id
                    ? 'bg-violet-600 text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-8 space-y-8">

        {/* OVERVIEW */}
        {activeSection === 'overview' && (
          <div className="space-y-8">
            {/* Architecture */}
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Server size={18} className="text-violet-500" /> Архитектура
              </h2>
              <div className="bg-white border border-gray-200 rounded-2xl p-6">
                <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
                  {[
                    { label: 'Браузер', sub: 'пользователь', color: 'bg-gray-100 text-gray-700 border-gray-300' },
                    null,
                    { label: 'Vercel', sub: 'React фронтенд', color: 'bg-blue-100 text-blue-700 border-blue-300' },
                    null,
                    { label: 'Railway', sub: 'Node.js бэкенд', color: 'bg-violet-100 text-violet-700 border-violet-300' },
                    null,
                    { label: 'MongoDB Atlas', sub: 'база данных', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
                  ].map((item, i) =>
                    item === null ? (
                      <ArrowRight key={i} size={18} className="text-gray-400" />
                    ) : (
                      <div key={i} className={cn('px-4 py-2 rounded-xl border text-center', item.color)}>
                        <div className="font-bold">{item.label}</div>
                        <div className="text-xs opacity-70">{item.sub}</div>
                      </div>
                    )
                  )}
                </div>
                <div className="mt-4 text-center">
                  <div className="inline-flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                    <Cloud size={13} className="text-orange-400" />
                    Cloudinary — хранение медиафайлов (фото, видео)
                  </div>
                </div>
              </div>
            </div>

            {/* Services */}
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Package size={18} className="text-violet-500" /> Сервисы и цены
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ServiceCard
                  icon={Server} name="GitHub" price="Бесплатно навсегда"
                  desc="Хранение кода. Нужен для автодеплоя на Vercel и Railway"
                  url="https://github.com" color="bg-gray-800"
                />
                <ServiceCard
                  icon={Globe} name="Vercel" price="Бесплатно навсегда"
                  desc="Хостинг React-приложения. HTTPS, CDN, автодеплой из GitHub"
                  url="https://vercel.com" color="bg-black"
                />
                <ServiceCard
                  icon={Server} name="Railway" price="~$0–2/мес ($5 кредитов)"
                  desc="Node.js бэкенд и прокси для API. Без sleep-режима"
                  url="https://railway.app" color="bg-violet-600"
                />
                <ServiceCard
                  icon={Database} name="MongoDB Atlas" price="Бесплатно (512 MB)"
                  desc="Хранение постов, аккаунтов (зашифрованных), расписаний"
                  url="https://mongodb.com/atlas" color="bg-emerald-600"
                />
                <ServiceCard
                  icon={Image} name="Cloudinary" price="Бесплатно (25 GB)"
                  desc="Хранение фото и видео для постов. Прямая загрузка из браузера"
                  url="https://cloudinary.com" color="bg-blue-500"
                />
                <ServiceCard
                  icon={Lock} name="Bitwarden" price="Бесплатно"
                  desc="Менеджер паролей. Хранить мастер-токены VK/OK/TG отдельно"
                  url="https://bitwarden.com" color="bg-indigo-600"
                />
              </div>
            </div>

            {/* Why this stack */}
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Zap size={18} className="text-violet-500" /> Почему именно этот стек?
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { title: 'Токены в безопасности', desc: 'Токены VK/OK/TG никогда не хранятся в браузере. Только на сервере, зашифрованные AES-256', icon: '🔐' },
                  { title: 'Не потеряете данные', desc: 'MongoDB Atlas делает автобэкапы. Atlas даёт 512 MB — хватит на миллионы постов', icon: '💾' },
                  { title: 'Работает без сна', desc: 'Railway не засыпает (в отличие от Render). Запланированные посты отправятся вовремя', icon: '⚡' },
                  { title: 'Масштабируется', desc: 'При росте нагрузки — просто обновить тарифы тех же сервисов. Не надо ничего переписывать', icon: '📈' },
                ].map(item => (
                  <div key={item.title} className="bg-white border border-gray-200 rounded-xl p-4 flex gap-3">
                    <div className="text-2xl flex-shrink-0">{item.icon}</div>
                    <div>
                      <div className="font-semibold text-gray-800 text-sm">{item.title}</div>
                      <div className="text-xs text-gray-500 mt-1 leading-relaxed">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEPS */}
        {activeSection === 'steps' && (
          <div className="space-y-4">
            <Alert type="info">
              Выполняйте шаги по порядку. Сначала база данных, потом бэкенд, потом фронтенд.
            </Alert>

            <Step number={1} title="GitHub — залить код в репозиторий">
              <div className="space-y-3">
                <p>Создайте два репозитория (или один с двумя папками):</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-50 rounded-lg p-3 text-xs font-mono border">
                    <div className="text-gray-500 mb-1">Репозиторий 1:</div>
                    <div className="text-gray-800 font-semibold">autopost-frontend</div>
                    <div className="text-gray-500">→ текущий React проект</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-xs font-mono border">
                    <div className="text-gray-500 mb-1">Репозиторий 2:</div>
                    <div className="text-gray-800 font-semibold">autopost-backend</div>
                    <div className="text-gray-500">→ Node.js сервер</div>
                  </div>
                </div>
                <CodeBlock lang="bash" code={`# Инициализация и загрузка фронтенда
cd /path/to/autopost-frontend
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_NAME/autopost-frontend.git
git push -u origin main`} />
                <Alert type="success">
                  После этого каждый <code className="bg-emerald-100 px-1 rounded">git push</code> будет автоматически деплоиться на Vercel.
                </Alert>
              </div>
            </Step>

            <Step number={2} title="MongoDB Atlas — создать базу данных">
              <div className="space-y-3">
                <p>MongoDB Atlas — бесплатная облачная MongoDB с 512 MB места.</p>
                <CodeBlock lang="step-by-step" code={mongoSteps} />
                <Alert type="warning">
                  Запишите строку подключения! Она выглядит так:<br />
                  <code className="text-xs">mongodb+srv://autopost_user:PASSWORD@cluster0.xxxxx.mongodb.net/autopost</code>
                </Alert>
              </div>
            </Step>

            <Step number={3} title="Cloudinary — хранение медиафайлов">
              <div className="space-y-3">
                <p>Для хранения фото и видео перед отправкой в VK/OK/TG.</p>
                <CodeBlock lang="step-by-step" code={`1. Зайти на cloudinary.com → Sign Up Free
2. Dashboard → скопировать:
   - Cloud Name
   - API Key  
   - API Secret
3. Settings → Upload → Add upload preset
   Preset name: autopost_preset
   Signing Mode: Unsigned (для загрузки из браузера)
4. Сохранить preset name`} />
              </div>
            </Step>

            <Step number={4} title="Railway — деплой Node.js бэкенда">
              <div className="space-y-3">
                <p>Railway — лучший бесплатный хостинг для Node.js без sleep-режима.</p>
                <CodeBlock lang="step-by-step" code={railwaySteps} />
                <p className="font-medium text-gray-700">Переменные окружения для Railway:</p>
                <CodeBlock lang=".env" code={envExample} />
                <Alert type="info">
                  После деплоя Railway даст URL вида: <code className="text-xs">https://autopost-backend.railway.app</code> — сохраните его для Vercel.
                </Alert>
              </div>
            </Step>

            <Step number={5} title="Vercel — деплой React фронтенда">
              <div className="space-y-3">
                <p>Vercel автоматически собирает Vite-проект и раздаёт через CDN.</p>
                <CodeBlock lang="step-by-step" code={vercelSteps} />
                <Alert type="success">
                  После деплоя приложение доступно по адресу: <strong>https://autopost.vercel.app</strong> (или ваш домен).
                </Alert>
              </div>
            </Step>

            <Step number={6} title="Проверка — всё работает?">
              <div className="space-y-3">
                <div className="space-y-2">
                  {[
                    { check: 'Открыть https://autopost.vercel.app', ok: true },
                    { check: 'Перейти в Аккаунты → добавить Telegram бота', ok: true },
                    { check: 'Создать пост → Опубликовать сейчас', ok: true },
                    { check: 'В MongoDB Atlas → Collections → проверить posts', ok: true },
                    { check: 'В Railway → Logs → нет ошибок', ok: true },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-sm">
                      <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
                      <span className="text-gray-700">{item.check}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Step>
          </div>
        )}

        {/* SECURITY */}
        {activeSection === 'security' && (
          <div className="space-y-6">
            <Alert type="warning">
              <strong>Главное правило:</strong> токены VK, ОК и Telegram никогда не должны быть в коде, в localStorage или в git-репозитории!
            </Alert>

            {/* What not to do */}
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-500" /> Как НЕ надо (уязвимости)
              </h2>
              <div className="space-y-3">
                {[
                  { bad: 'Хранить токены в localStorage', why: 'Любой JS-скрипт на странице может их украсть' },
                  { bad: 'Писать токены в .env фронтенда (VITE_VK_TOKEN=...)', why: 'Vite вставит их прямо в JS-бандл — они будут видны всем' },
                  { bad: 'Коммитить .env в git', why: 'GitHub проиндексирует их, злоумышленники найдут через поиск' },
                  { bad: 'Хранить токены в MongoDB без шифрования', why: 'При утечке БД — все токены скомпрометированы' },
                ].map((item, i) => (
                  <div key={i} className="flex gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <div className="text-red-500 font-bold text-sm flex-shrink-0">✗</div>
                    <div>
                      <div className="font-semibold text-red-700 text-sm">{item.bad}</div>
                      <div className="text-red-600 text-xs mt-0.5">{item.why}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* How to do it right */}
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Shield size={18} className="text-emerald-500" /> Правильная схема защиты
              </h2>
              <div className="space-y-3">
                {[
                  { good: 'Токены только на бэкенде (Railway)', how: 'Фронтенд никогда не видит реальный токен. Только отправляет команду "опубликовать"' },
                  { good: 'Шифрование AES-256 в MongoDB', how: 'Даже если утечёт база — без ENCRYPTION_KEY токены не расшифровать' },
                  { good: '".env" в .gitignore', how: 'Добавьте .env в .gitignore ДО первого коммита' },
                  { good: 'JWT-авторизация на бэкенде', how: 'Только авторизованный пользователь может публиковать посты' },
                  { good: 'Мастер-токены в Bitwarden', how: 'Храните оригинальные токены в менеджере паролей как резервную копию' },
                ].map((item, i) => (
                  <div key={i} className="flex gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="text-emerald-500 font-bold text-sm flex-shrink-0">✓</div>
                    <div>
                      <div className="font-semibold text-emerald-700 text-sm">{item.good}</div>
                      <div className="text-emerald-600 text-xs mt-0.5">{item.how}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Backend example */}
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                <Terminal size={18} className="text-violet-500" /> Пример бэкенда с шифрованием
              </h2>
              <CodeBlock lang="javascript — server.js" code={backendCode} />
            </div>

            {/* .gitignore */}
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                <Key size={18} className="text-violet-500" /> Обязательный .gitignore
              </h2>
              <CodeBlock lang=".gitignore" code={`# Переменные окружения — НИКОГДА в git!
.env
.env.local
.env.production

# Зависимости
node_modules/

# Бэкапы с токенами
*.enc
backup_*.json

# Логи
*.log`} />
            </div>
          </div>
        )}

        {/* BACKUP */}
        {activeSection === 'backup' && (
          <div className="space-y-6">
            <Alert type="success">
              MongoDB Atlas M0 (бесплатный) делает автоматические snapshot-бэкапы раз в сутки. Но рекомендуем дополнительный ручной бэкап токенов.
            </Alert>

            {/* Backup strategy */}
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <HardDrive size={18} className="text-violet-500" /> Стратегия хранения
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { layer: '1-й уровень', name: 'MongoDB Atlas', desc: 'Основное хранилище. Зашифрованные токены + все посты. Автобэкапы включены', badge: 'Автоматически', color: 'border-emerald-300 bg-emerald-50' },
                  { layer: '2-й уровень', name: 'Зашифрованный файл', desc: 'Экспорт токенов в .enc файл раз в месяц. Хранить на компьютере или Google Drive', badge: 'Раз в месяц', color: 'border-blue-300 bg-blue-50' },
                  { layer: '3-й уровень', name: 'Bitwarden', desc: 'Оригинальные токены VK/OK/TG вручную. Это последняя линия обороны', badge: 'При получении', color: 'border-violet-300 bg-violet-50' },
                ].map(item => (
                  <div key={item.name} className={cn('border-2 rounded-xl p-4', item.color)}>
                    <div className="text-xs text-gray-500 mb-1">{item.layer}</div>
                    <div className="font-bold text-gray-800 text-sm mb-2">{item.name}</div>
                    <div className="text-xs text-gray-600 leading-relaxed mb-3">{item.desc}</div>
                    <Badge color="green">{item.badge}</Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Backup script */}
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                <RefreshCw size={18} className="text-violet-500" /> Скрипт бэкапа токенов
              </h2>
              <CodeBlock lang="javascript — backup.js" code={backupScript} />
              <Alert type="info">
                Запускайте скрипт раз в месяц: <code className="text-xs bg-blue-100 px-1 rounded">node backup.js</code>. Файл <code className="text-xs bg-blue-100 px-1 rounded">backup_*.enc</code> можно безопасно хранить в облаке — без BACKUP_PASSWORD он бесполезен.
              </Alert>
            </div>

            {/* Recovery */}
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <RefreshCw size={18} className="text-violet-500" /> Восстановление после сбоя
              </h2>
              <div className="space-y-3">
                {[
                  { scenario: '🔴 Удалили аккаунт в MongoDB', solution: 'Восстановить из Atlas Backup (автобэкап) → Collections → Restore' },
                  { scenario: '🔴 Потеряли ENCRYPTION_KEY', solution: 'Токены не расшифровать. Восстановить из Bitwarden → добавить аккаунты заново' },
                  { scenario: '🔴 Сгорел Railway сервер', solution: 'Новый Railway проект → залить тот же код → те же .env переменные → готово' },
                  { scenario: '🔴 Заблокировали Vercel аккаунт', solution: 'Задеплоить на Netlify или Cloudflare Pages — это 5 минут' },
                  { scenario: '🟡 Устарел токен VK/OK', solution: 'Получить новый токен → обновить в разделе "Аккаунты" приложения' },
                ].map((item, i) => (
                  <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="font-semibold text-gray-800 text-sm mb-1">{item.scenario}</div>
                    <div className="text-xs text-gray-600 flex items-start gap-1.5">
                      <ArrowRight size={12} className="text-violet-400 mt-0.5 flex-shrink-0" />
                      {item.solution}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Final checklist */}
            <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200 rounded-2xl p-6">
              <h2 className="text-base font-bold text-violet-800 mb-4 flex items-center gap-2">
                <CheckCircle size={18} className="text-violet-500" /> Финальный чеклист
              </h2>
              <div className="space-y-2">
                {[
                  'Код залит на GitHub',
                  'MongoDB Atlas кластер создан, строка подключения сохранена',
                  'Cloudinary аккаунт создан, ключи добавлены в .env',
                  'Railway деплой запущен, все переменные добавлены',
                  'Vercel деплой запущен, VITE_API_URL указывает на Railway',
                  'Все оригинальные токены сохранены в Bitwarden',
                  '.env добавлен в .gitignore',
                  'Первый тестовый пост успешно отправлен',
                  'Бэкап-скрипт настроен и проверен',
                ].map((item, i) => (
                  <label key={i} className="flex items-center gap-2.5 cursor-pointer group">
                    <input type="checkbox" className="w-4 h-4 rounded accent-violet-600" />
                    <span className="text-sm text-violet-700 group-hover:text-violet-900 transition-colors">{item}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
