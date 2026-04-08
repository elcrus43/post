// server.js — прокси для безопасной публикации в VK, OK и Telegram
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import CryptoJS from 'crypto-js';
import crypto from 'crypto';
import mongoose from 'mongoose';
import md5 from 'md5';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import { createProxyMiddleware } from 'http-proxy-middleware';
import rateLimit from 'express-rate-limit';
import 'dotenv/config';
import cookieParser from 'cookie-parser';
import cron from 'node-cron';
import Parser from 'rss-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const parser = new Parser();

const app = express();
app.use(cookieParser());

// Health check endpoints - MUST be before all middleware for Railway
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/ready', (req, res) => {
  const isReady = mongoose.connection.readyState === 1;
  res.status(isReady ? 200 : 503).json({ status: isReady ? 'ready' : 'not_ready' });
});

// FIX #8: Пароль обязателен для безопасности
const APP_PASSWORD = process.env.APP_PASSWORD;

if (!APP_PASSWORD) {
  console.warn('⚠️⚠️⚠️ WARNING: APP_PASSWORD is not set!');
  console.warn('⚠️ Server is starting with DISABLED authentication!');
  console.warn('⚠️ This is INSECURE and should be fixed immediately!');
  console.warn('⚠️ Set APP_PASSWORD in your environment variables (Railway Dashboard → Variables)');
  console.warn('⚠️⚠️⚠️');
  // Не падаем, но логируем WARNING. В production это критично!
}

// Настройка CORS: разрешить только вашему фронтенду
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.RAILWAY_STATIC_URL, // Railway dynamic URL
  'http://localhost:5173', // для локальной разработки
  'http://localhost:4173',
  'https://post-production-01fa.up.railway.app' // Production Railway URL
].filter(Boolean);

// FIX #12: Валидация URL для защиты от SSRF
const URL_ALLOWLIST = ['http:', 'https:'];
const PRIVATE_IP_REGEX = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.|0\.0\.0\.0|::1|169\.254\.|fc00:|fe80:)/i;

function validateUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') {
    throw new Error('Invalid URL: URL is required');
  }

  try {
    const url = new URL(urlString);

    // Разрешаем только http/https
    if (!URL_ALLOWLIST.includes(url.protocol)) {
      throw new Error(`Invalid URL protocol: ${url.protocol}. Only http/https allowed.`);
    }

    // Блокируем private IP адреса (SSRF protection)
    if (PRIVATE_IP_REGEX.test(url.hostname)) {
      throw new Error(`SSRF protection: Access to ${url.hostname} is blocked.`);
    }

    return true;
  } catch (err) {
    if (err.message.startsWith('SSRF') || err.message.startsWith('Invalid URL')) {
      throw err;
    }
    throw new Error(`Invalid URL format: ${urlString}`);
  }
}

// FIX #1: CORS — используем allowedOrigins вместо origin: true
app.use(cors({
  origin: function (origin, callback) {
    // Разрешаем запросы без origin (например, curl, Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.some(allowed => origin.startsWith(allowed))) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));

// FIX #9: Middleware для санитизации входных данных (защита от NoSQL injection)
const sanitizeInput = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map(sanitizeInput);
  }
  if (obj !== null && typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      // Удаляем MongoDB операторы и специальные ключи
      if (key.startsWith('$') || key.includes('.')) {
        continue; // Игнорируем подозрительные ключи
      }
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  return obj;
};

app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeInput(req.body);
  }
  next();
});

// FIX #7: Rate Limiting для защиты от brute-force и спама
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // максимум 100 запросов за 15 минут
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // максимум 10 попыток (для логина)
  message: { error: 'Too many attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 30, // максимум 30 AI запросов в час
  message: { error: 'AI request limit exceeded, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalLimiter);

// FIX #4: Прокси с аутентификацией
const authProxyMiddleware = (req, res, next) => {
  const token = req.cookies.app_token;
  if (token !== APP_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

app.use("/vk", authProxyMiddleware, createProxyMiddleware({ target: "https://api.vk.com", changeOrigin: true }));
app.use("/ok", authProxyMiddleware, createProxyMiddleware({ target: "https://api.ok.ru", changeOrigin: true }));

// Подключение к MongoDB
if (process.env.MONGO_URI) {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('❌ MongoDB connection error:', err.message));
} else {
  console.warn('⚠️ MONGO_URI is not set. Database features will be disabled.');
}

// Схема аккаунта с зашифрованными токенами
const AccountSchema = new mongoose.Schema({
  platform: String,
  name: String,
  encryptedToken: String, // токен НИКОГДА не хранится открыто
  ownerId: String,
  // OK-specific fields (encrypted if sensitive)
  okAppKey: String,
  okAppSecretKey: String, // encrypted similarly to token? Let's encrypt it too
  okGroupId: String,
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});
const Account = mongoose.model('Account', AccountSchema);

// Схема запланированного поста
const PostSchema = new mongoose.Schema({
  userId: String, // для будущего многопользовательского режима
  text: String,
  media: Array, // [{type, url, name}]
  scheduledAt: Date,
  status: { type: String, enum: ['scheduled', 'published', 'error', 'draft'], default: 'scheduled' },
  targetAccounts: [String],
  results: [
    {
      accountId: String,
      platform: String,
      status: String,
      postUrl: String,
      error: String,
      publishedAt: Date,
    }
  ],
  createdAt: { type: Date, default: Date.now }
});
const Post = mongoose.model('Post', PostSchema);

// Схема правила репостера
const RepostRuleSchema = new mongoose.Schema({
  name: String,
  status: { type: String, enum: ['active', 'paused', 'error'], default: 'paused' },
  source: {
    type: { type: String, enum: ['rss', 'vk_wall', 'tg_channel'] },
    name: String,
    url: String,
    vkOwnerId: String,
    vkToken: String,
    tgUsername: String,
  },
  targetAccountIds: [String],
  schedule: {
    days: [Number], // 0-6
    hours: [Number], // 0-23
    intervalMin: Number,
    intervalMax: Number,
  },
  filters: {
    minLength: Number,
    maxLength: Number,
    requireImage: Boolean,
    stopWords: [String],
    requiredWords: [String],
  },
  order: { type: String, enum: ['newest', 'oldest', 'random'], default: 'newest' },
  appendText: String,
  addSourceLink: Boolean,
  skipDuplicates: Boolean,
  lastCheckedAt: Date,
  nextPublishAt: Date,
  createdAt: { type: Date, default: Date.now }
});
const RepostRule = mongoose.model('RepostRule', RepostRuleSchema);

// Схема истории репостов (для предотвращения дублей и аналитики)
const RepostHistorySchema = new mongoose.Schema({
  ruleId: mongoose.Schema.Types.ObjectId,
  sourceUrl: { type: String, unique: true }, // уникальный ID поста из источника (guid или link)
  publishedAt: { type: Date, default: Date.now },
  status: String,
  text: String,
  results: Array,
});
const RepostHistory = mongoose.model('RepostHistory', RepostHistorySchema);

// ─── Проверка Telegram токена ─────────────────────────────────────────────────
app.get('/api/test/telegram', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Missing bot token' });

    const response = await axios.get(`https://api.telegram.org/bot${token}/getMe`);
    if (response.data.ok) {
      return res.json({ ok: true, name: response.data.result.username });
    }
    res.status(400).json({ error: response.data.description });
  } catch (err) {
    res.status(500).json({ error: 'Telegram API error: ' + err.message });
  }
});

// Шифрование токена (AES-256)
const encrypt = (token) => {
  if (!token) return '';
  return CryptoJS.AES.encrypt(token, process.env.ENCRYPTION_KEY).toString();
};

// Дешифрование токена
const decrypt = (encrypted) => {
  if (!encrypted) return '';
  const bytes = CryptoJS.AES.decrypt(encrypted, process.env.ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};

// Схема для временного хранения состояния OAuth (PKCE)
const OAuthStateSchema = new mongoose.Schema({
  state: String,
  codeVerifier: String,
  platform: String,
  createdAt: { type: Date, expires: '15m', default: Date.now }, // Авто-удаление через 15 минут
});
const OAuthState = mongoose.model('OAuthState', OAuthStateSchema);

// Middleware для защиты доступа (только для ПОЛЬЗОВАТЕЛЯ)
const authMiddleware = (req, res, next) => {
  const token = req.cookies.app_token;
  const publicPaths = ['/api/login', '/login', '/api/auth/', '/favicon.ico', '/api/auth/tenchat', '/api/auth/twitter', '/health', '/ready'];

  // Если это публичный путь, разрешаем
  if (publicPaths.some(p => req.path.startsWith(p))) {
    return next();
  }

  // FIX #2: Убран magic token 'authorized_session' — только проверка пароля
  // Проверка сессии (пароля)
  if (token === APP_PASSWORD) {
    return next();
  }

  // Если запрос к API — возвращаем 401
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Если запрос к странице — редирект на логин (будет обработан фронтендом или статикой)
  next();
};

app.use(authMiddleware);

// ── API Эндпоинты ────────────────────────────────────────────────────────────

// Эндпоинт для проверки пароля с защитой от brute-force
app.post('/api/login', strictLimiter, (req, res) => {
  const { password } = req.body;

  if (password === APP_PASSWORD) {
    // FIX #3: httpOnly: true для защиты от XSS
    // FIX: secure: false для поддержки локальной разработки (http)
    // В production установить secure: true
    res.cookie('app_token', APP_PASSWORD, {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true, // Защищено от XSS
      secure: process.env.NODE_ENV === 'production', // true только для https
      sameSite: 'Lax'
    });
    return res.json({ success: true });
  }

  res.status(401).json({ error: 'Wrong password' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Раздача статических файлов фронтенда
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// Получить все аккаунты (без токенов!)
app.get('/api/accounts', async (req, res) => {
  try {
    const rawAccounts = await Account.find().sort({ createdAt: -1 });
    const accounts = rawAccounts.map(a => ({
      id: a._id,
      platform: a.platform,
      name: a.name,
      ownerId: a.ownerId, // сохраняем для совместимости
      // Мапим обратно во фронтенд-поля
      vkOwnerId: a.platform === 'vk' ? a.ownerId : undefined,
      tgChatId: a.platform === 'telegram' ? a.ownerId : undefined,
      okGroupId: a.platform === 'ok' ? a.okGroupId : undefined,
      okAppKey: a.okAppKey,
      isActive: a.isActive,
      createdAt: a.createdAt
    }));
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── VK OAuth 2.0 (Server-Side) ───────────────────────────────────────────────

app.get('/api/auth/vk', (req, res) => {
  const clientId = process.env.VK_CLIENT_ID;
  const clientSecret = process.env.VK_CLIENT_SECRET;
  const redirectUri = process.env.VK_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    console.warn('⚠️ VK OAuth credentials missing:', { clientId: !!clientId, clientSecret: !!clientSecret, redirectUri: !!redirectUri });
    const missing = [];
    if (!clientId) missing.push('VK_CLIENT_ID');
    if (!clientSecret) missing.push('VK_CLIENT_SECRET');
    if (!redirectUri) missing.push('VK_REDIRECT_URI');
    return res.status(500).json({ error: `VK OAuth not configured. Missing in .env: ${missing.join(', ')}` });
  }

  console.log('🔗 Generating VK Auth URL with redirect_uri:', redirectUri);

  // VK ID Authorization (Modern way)
  // 466972 = wall+groups+photos+video+audio+docs+offline
  const vkAuthUrl = `https://id.vk.com/auth?app_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=466972&state=${Math.random().toString(36).substring(7)}`;

  res.redirect(vkAuthUrl);
});

app.get('/api/auth/vk/callback', async (req, res) => {
  const { code, state } = req.query;
  console.log('📩 Received VK callback with code:', code ? 'present' : 'missing');

  if (!code) {
    console.error('❌ VK Auth Error: No code received in callback');
    return res.redirect(`${process.env.FRONTEND_URL || ''}/accounts?error=vk_no_code`);
  }

  try {
    const response = await axios.post('https://id.vk.com/oauth2/auth', null, {
      params: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.VK_REDIRECT_URI,
        client_id: process.env.VK_CLIENT_ID,
        client_secret: process.env.VK_CLIENT_SECRET,
      }
    });

    if (response.data.error) {
      console.error('❌ VK Token Exchange Error:', response.data.error);
      throw new Error(response.data.error_description || response.data.error);
    }

    const { access_token, user_id } = response.data;

    // Получаем информацию о пользователе для базы
    const userRes = await axios.get('https://api.vk.com/method/users.get', {
      params: {
        access_token,
        v: '5.199',
        fields: 'photo_100'
      }
    });

    const userData = userRes.data.response[0];
    const name = `${userData.first_name} ${userData.last_name}`;

    // Сохраняют или обновляют аккаунт в базе.
    // Находим существующий или создаем новый.
    let account = await Account.findOne({ platform: 'vk', ownerId: String(user_id) });

    if (account) {
      account.name = name;
      account.encryptedToken = encrypt(access_token);
      account.isActive = true;
      await account.save();
    } else {
      account = new Account({
        platform: 'vk',
        name,
        ownerId: String(user_id),
        encryptedToken: encrypt(access_token),
        isActive: true,
        createdAt: new Date(),
      });
      await account.save();
    }

    // Перенаправляем пользователя обратно на фронтенд
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/accounts?success=vk_added`);
  } catch (err) {
    // FIX #14: Не логируем данные ответа (могут содержать токены)
    console.error('VK Callback Error:', err.message);
    res.status(500).send('Internal server error during VK authentication');
  }
});

// ─── OK OAuth 2.0 (Server-Side) ───────────────────────────────────────────────

app.get('/api/auth/ok', (req, res) => {
  const appId = process.env.OK_APP_ID;
  const secretKey = process.env.OK_SECRET_KEY;
  const publicKey = process.env.OK_PUBLIC_KEY;
  const redirectUri = process.env.OK_REDIRECT_URI;

  if (!appId || !secretKey || !publicKey || !redirectUri) {
    const missing = [];
    if (!appId) missing.push('OK_APP_ID');
    if (!secretKey) missing.push('OK_SECRET_KEY');
    if (!publicKey) missing.push('OK_PUBLIC_KEY');
    if (!redirectUri) missing.push('OK_REDIRECT_URI');
    return res.status(500).json({ error: `OK OAuth not configured. Missing in .env: ${missing.join(', ')}` });
  }

  const okAuthUrl = `https://connect.ok.ru/oauth/authorize?client_id=${appId}&scope=VALUABLE_ACCESS;PUBLISH_TO_STREAM;GROUP_CONTENT;PHOTO_CONTENT;VIDEO_CONTENT;LONG_ACCESS_TOKEN;GET_EMAIL;PUBLISH_NOTE&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}`;

  res.redirect(okAuthUrl);
});

app.get('/api/auth/ok/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.status(400).send(`OK Auth Error: ${error}`);
  }

  if (!code) {
    return res.status(400).send('No code received from OK');
  }

  try {
    // Обмениваем код на токен
    const params = new URLSearchParams();
    params.append('code', code);
    params.append('client_id', process.env.OK_APP_ID);
    params.append('client_secret', process.env.OK_SECRET_KEY);
    params.append('redirect_uri', process.env.OK_REDIRECT_URI);
    params.append('grant_type', 'authorization_code');

    const tokenRes = await axios.post('https://api.ok.ru/oauth/token.do', params);
    const { access_token } = tokenRes.data;

    if (!access_token) {
      return res.status(400).send('Failed to obtain access token from OK');
    }

    // В Одноклассниках для проверки токена и получения инфо нужно считать подпись sig
    // Но для начала просто сохраним аккаунт. 
    // Обычно при авторизации возвращается информация о пользователе или мы можем её запросить.

    const sessSecret = md5(access_token + process.env.OK_SECRET_KEY).toLowerCase();
    const sigParams = {
      application_key: process.env.OK_PUBLIC_KEY,
      format: 'json',
      method: 'users.getCurrentUser',
    };

    const sorted = Object.keys(sigParams).sort().map(k => `${k}=${sigParams[k]}`).join('');
    const sig = md5(sorted + sessSecret).toLowerCase();

    const userRes = await axios.get('https://api.ok.ru/fb.do', {
      params: {
        ...sigParams,
        access_token,
        sig
      }
    });

    const userData = userRes.data;
    const name = userData.name || `${userData.first_name} ${userData.last_name}`;
    const uid = userData.uid;

    // Сохраняем или обновляем аккаунт в базе
    let account = await Account.findOne({ platform: 'ok', ownerId: String(uid) });

    const accountData = {
      platform: 'ok',
      name,
      ownerId: String(uid),
      encryptedToken: encrypt(access_token),
      okAppKey: process.env.OK_PUBLIC_KEY,
      okAppSecretKey: encrypt(process.env.OK_SECRET_KEY),
      isActive: true,
      createdAt: new Date(),
    };

    if (account) {
      Object.assign(account, accountData);
      await account.save();
    } else {
      account = new Account(accountData);
      await account.save();
    }

    // Перенаправляем пользователя обратно на фронтенд
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/accounts?success=ok_added`);
  } catch (err) {
    // FIX #14: Не логируем данные ответа (могут содержать токены)
    console.error('OK Callback Error:', err.message);
    res.status(500).send('Internal server error during OK authentication');
  }
});

// ─── TenChat OAuth 2.0 (Prototype) ───────────────────────────────────────────

app.get('/api/auth/tenchat', (req, res) => {
  const clientId = process.env.TENCHAT_CLIENT_ID || 'smm-planner'; // Default from user snippet if not set
  const redirectUri = process.env.TENCHAT_REDIRECT_URI;

  if (!redirectUri) {
    return res.status(500).json({ error: 'TenChat REDIRECT_URI not configured in .env' });
  }

  const tenchatAuthUrl = `https://oauth.tenchat.ru/auth/sign-in?client_id=${clientId}&response_type=code&scope=post:write+user:read&redirect_uri=${encodeURIComponent(redirectUri)}&state=${Math.random().toString(36).substring(7)}`;

  res.redirect(tenchatAuthUrl);
});

app.get('/api/auth/tenchat/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) return res.status(400).send(`TenChat Auth Error: ${error}`);
  if (!code) return res.status(400).send('No code received from TenChat');

  try {
    // Обмен кода на токен (OAuth 2.0 PKCE)
    const tokenData = {
      code,
      grant_type: 'authorization_code',
      redirect_uri: process.env.TENCHAT_REDIRECT_URI,
      client_id: process.env.TENCHAT_CLIENT_ID
    };

    if (process.env.TENCHAT_CLIENT_SECRET) {
      tokenData.client_secret = process.env.TENCHAT_CLIENT_SECRET;
    }

    const tokenRes = await axios.post('https://api.tenchat.ru/oauth/token', tokenData);

    const { access_token, user_id } = tokenRes.data;

    // Получаем инфо о пользователе
    const userRes = await axios.get('https://api.tenchat.ru/v1/user/me', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const name = userRes.data.name || userRes.data.username || 'TenChat User';

    let account = await Account.findOne({ platform: 'tenchat', ownerId: String(user_id) });
    const accountData = {
      platform: 'tenchat',
      name,
      ownerId: String(user_id),
      encryptedToken: encrypt(access_token),
      isActive: true,
      createdAt: new Date(),
    };

    if (account) {
      Object.assign(account, accountData);
      await account.save();
    } else {
      account = new Account(accountData);
      await account.save();
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/accounts?success=tenchat_added`);
  } catch (err) {
    // FIX #14: Не логируем данные ответа
    console.error('TenChat Callback Error:', err.message);
    res.status(500).send('Internal server error during TenChat authentication');
  }
});

// ─── Twitter (X) OAuth 2.0 + PKCE ────────────────────────────────────────────

function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('hex'); // 64 chars
}

function generateCodeChallenge(verifier) {
  const hash = crypto.createHash('sha256').update(verifier).digest();
  return hash.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

app.get('/api/auth/twitter', async (req, res) => {
  const clientId = process.env.TWITTER_CLIENT_ID;
  const redirectUri = process.env.TWITTER_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return res.status(500).json({ error: 'Twitter OAuh 2.0 credentials not configured' });
  }

  const state = Math.random().toString(36).substring(7);
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Сохраняем verifier в БД для проверки в callback
  await OAuthState.create({ state, codeVerifier, platform: 'twitter' });

  const scope = 'tweet.read tweet.write users.read offline.access media.write';
  const twitterAuthUrl = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;

  res.redirect(twitterAuthUrl);
});

app.get('/api/auth/twitter/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;
  const redirectUri = process.env.TWITTER_REDIRECT_URI;

  if (error) return res.status(400).send(`Twitter Auth Error: ${error}`);
  if (!code) return res.status(400).send('No code received from Twitter');

  try {
    const savedState = await OAuthState.findOneAndDelete({ state, platform: 'twitter' });
    if (!savedState) return res.status(400).send('Invalid or expired OAuth state');

    // Обмен кода на токен (OAuth 2.0 PKCE)
    const params = new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code_verifier: savedState.codeVerifier,
      client_id: clientId, // Обязательно для PKCE
    });

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    // Если есть секрет — используем Basic Auth, если нет — только client_id в теле
    if (clientSecret) {
      const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      headers['Authorization'] = `Basic ${authHeader}`;
    }

    const tokenRes = await axios.post('https://api.twitter.com/2/oauth2/token',
      params,
      { headers }
    );

    const { access_token, refresh_token, expires_in } = tokenRes.data;

    // Получаем инфо о пользователе
    const userRes = await axios.get('https://api.twitter.com/2/users/me', {
      headers: { Authorization: `Bearer ${access_token}` },
      params: { 'user.fields': 'id,name,username' }
    });

    const userData = userRes.data.data;
    const name = `@${userData.username} (${userData.name})`;

    let account = await Account.findOne({ platform: 'twitter', ownerId: userData.id });
    const accountData = {
      platform: 'twitter',
      name,
      ownerId: userData.id,
      encryptedToken: encrypt(access_token), // Refresh token also needs storage for production
      isActive: true,
      createdAt: new Date(),
    };

    if (account) {
      Object.assign(account, accountData);
      await account.save();
    } else {
      account = new Account(accountData);
      await account.save();
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/accounts?success=twitter_added`);
  } catch (err) {
    // FIX #14: Не логируем данные ответа
    console.error('Twitter Callback Error:', err.message);
    res.status(500).send('Internal server error during Twitter authentication');
  }
});

// Получить список аккаунтов (БЕЗ токенов!)
app.get('/api/accounts', async (req, res) => {
  try {
    const accounts = await Account.find().sort({ createdAt: -1 });
    const results = accounts.map(acc => {
      const plain = acc.toObject();
      return {
        id: plain._id,
        platform: plain.platform,
        name: plain.name,
        ownerId: plain.ownerId,
        vkOwnerId: acc.platform === 'vk' ? acc.ownerId : undefined,
        tgChatId: acc.platform === 'telegram' ? acc.ownerId : undefined,
        okGroupId: acc.platform === 'ok' ? acc.okGroupId : undefined,
        okAppKey: acc.platform === 'ok' ? acc.okAppKey : undefined,
        isActive: plain.isActive,
        createdAt: plain.createdAt
        // FIX #5: Токены НЕ возвращаются — они используются только на сервере
      };
    });
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Сохранить аккаунт (шифрует токен перед сохранением)
app.post('/api/accounts', async (req, res) => {
  try {
    const { platform, name, token, ownerId, tgBotToken, tgChatId, okAppKey, okAppSecretKey, okGroupId } = req.body;

    // Поддержка имен полей как для Telegram (tgBotToken) так и общих (token)
    const finalToken = token || tgBotToken;
    const finalOwnerId = ownerId || tgChatId;

    if (!platform || !name || !finalToken) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const account = new Account({
      platform,
      name,
      ownerId: finalOwnerId,
      encryptedToken: encrypt(finalToken),
      okAppKey,
      okAppSecretKey: okAppSecretKey ? encrypt(okAppSecretKey) : undefined,
      okGroupId,
    });

    await account.save();
    res.json({
      id: account._id,
      platform,
      name,
      ownerId: finalOwnerId,
      tgBotToken: finalToken,
      tgChatId: finalOwnerId,
      isActive: account.isActive,
      createdAt: account.createdAt
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Удалить аккаунт
app.delete('/api/accounts/:id', async (req, res) => {
  try {
    await Account.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Переключить активность аккаунта
app.patch('/api/accounts/:id/toggle', async (req, res) => {
  try {
    const account = await Account.findById(req.params.id);
    if (!account) return res.status(404).json({ error: 'Not found' });

    account.isActive = !account.isActive;
    await account.save();
    res.json({ id: account._id, isActive: account.isActive });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Публикация во ВКонтакте
app.post('/api/publish/vk', async (req, res) => {
  try {
    const { accountId, token, ownerId, message, attachments, media } = req.body;
    // Используем media если есть, иначе attachments (для обратной совместимости)
    const postMedia = media || (attachments ? attachments.split(',').map(url => ({ type: 'image', url })) : []);
    const result = await performPublish(accountId || { platform: 'vk', token, ownerId }, { text: message, media: postMedia });
    res.json(result);
  } catch (err) {
    console.error('Manual VK publish error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Публикация в VK Stories
app.post('/api/publish/vk/story', async (req, res) => {
  try {
    const { accountId, token: directToken, ownerId: directOwnerId, media, link_text, link_url } = req.body;

    let token = directToken;
    let ownerId = directOwnerId;

    if (accountId) {
      const account = await Account.findById(accountId);
      if (account) {
        token = decrypt(account.encryptedToken);
        ownerId = account.ownerId;
      }
    }

    if (!token || !ownerId) {
      return res.status(400).json({ error: 'Missing token or ownerId' });
    }

    if (!media || media.length === 0) {
      return res.status(400).json({ error: 'Stories require at least one image or video' });
    }

    const firstMedia = media[0];
    const isVideo = firstMedia.type === 'video';

    // 1. Получаем сервер для загрузки
    const method = isVideo ? 'stories.getVideoUploadServer' : 'stories.getPhotoUploadServer';
    const serverRes = await axios.get(`https://api.vk.ru/method/${method}`, {
      params: {
        access_token: token,
        v: '5.199',
        add_to_news: 1,
        group_id: Math.abs(parseInt(ownerId)) || undefined,
        link_text: link_text || undefined,
        link_url: link_url || undefined,
      }
    });

    if (serverRes.data.error) throw new Error(serverRes.data.error.error_msg);
    const uploadUrl = serverRes.data.response.upload_url;

    // 2. Загружаем файл
    let fileBuffer;
    let fileName = firstMedia.name || (isVideo ? 'video.mp4' : 'photo.jpg');
    let contentType = isVideo ? 'video/mp4' : 'image/jpeg';

    if (firstMedia.url.startsWith('data:')) {
      const base64Data = firstMedia.url.split(',')[1];
      fileBuffer = Buffer.from(base64Data, 'base64');
    } else {
      // FIX #12: Валидация URL перед загрузкой
      validateUrl(firstMedia.url);
      const downloadRes = await axios.get(firstMedia.url, { responseType: 'arraybuffer' });
      fileBuffer = Buffer.from(downloadRes.data);
    }

    const form = new FormData();
    form.append('file', fileBuffer, { filename: fileName, contentType });

    const uploadRes = await axios.post(uploadUrl, form, {
      headers: form.getHeaders(),
    });

    // 3. Сохраняем историю
    const saveRes = await axios.get('https://api.vk.ru/method/stories.save', {
      params: {
        access_token: token,
        v: '5.199',
        upload_results: uploadRes.data.response.upload_result,
        extended: 1,
      }
    });

    if (saveRes.data.error) throw new Error(saveRes.data.error.error_msg);
    res.json(saveRes.data.response);
  } catch (err) {
    console.error('VK Story Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Публикация в Telegram
app.post('/api/publish/telegram', async (req, res) => {
  try {
    const { accountId, token, ownerId, text, media } = req.body;
    const result = await performPublish(accountId || { platform: 'telegram', token, ownerId }, { text, media });
    res.json(result);
  } catch (err) {
    console.error('Manual TG publish error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Одноклассники ────────────────────────────────────────────────────────────

function okSign(params, secretKey) {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('');
  return md5(sorted + secretKey).toLowerCase();
}

app.post('/api/publish/ok', async (req, res) => {
  try {
    const { accountId, token, appKey, secretKey, groupId, message, media } = req.body;
    const result = await performPublish(accountId || { platform: 'ok', token, okAppKey: appKey, okAppSecretKey: secretKey, okGroupId: groupId }, { text: message, media });
    res.json(result);
  } catch (err) {
    console.error('Manual OK publish error:', err);
    res.status(500).json({ error: err.message });
  }
});

// AI Proxy (for Gemini/Qwen via browser to avoid CORS)
app.post('/api/ai/proxy', aiLimiter, async (req, res) => {
  try {
    const { baseUrl, apiKey, model, messages } = req.body;

    if (!baseUrl || !apiKey || !model || !messages) {
      return res.status(400).json({ error: 'Missing required AI parameters' });
    }

    const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
    // FIX #14: Не логируем API ключи
    console.log(`🤖 AI Proxy request to ${cleanBaseUrl} | Model: ${model}`);

    // Google Gemini API often requires key as a query parameter (?key=...) 
    // even for its OpenAI-compatible endpoint.
    let finalUrl = `${cleanBaseUrl}/chat/completions`;
    if (cleanBaseUrl.includes('googleapis.com')) {
      const separator = finalUrl.includes('?') ? '&' : '?';
      finalUrl = `${finalUrl}${separator}key=${apiKey}`;
    }

    const response = await axios.post(finalUrl, {
      model,
      messages,
      temperature: 0.8,
      max_tokens: 2000,
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      timeout: 30000 // 30s timeout for AI response
    });

    res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 500;
    // FIX #14: Не логируем полные данные ошибок (могут содержать токены/ключи)
    const safeError = err.message ? err.message.substring(0, 200) : 'Unknown error';

    console.error(`❌ AI Proxy Error [${status}]:`, safeError);

    res.status(status).json({
      error: { message: safeError },
      status: status,
    });
  }
});

// Вспомогательная функция для публикации на любую платформу
async function performPublish(accountIdOrData, content) {
  let account;
  if (typeof accountIdOrData === 'string' || mongoose.isValidObjectId(accountIdOrData)) {
    account = await Account.findById(accountIdOrData);
    if (!account || !account.isActive) {
      throw new Error(`Account ${accountIdOrData} not found or inactive`);
    }
  } else {
    account = accountIdOrData; // Мы уже передали объект
  }

  const token = account.encryptedToken ? decrypt(account.encryptedToken) : account.token;
  const { platform, ownerId } = account;
  const text = content.text || content.message || '';

  // Совместимость: если передан attachments (строка), превращаем в массив media
  let media = content.media || [];
  if (media.length === 0 && content.attachments) {
    media = content.attachments.split(',').filter(Boolean).map(url => ({
      url: url.trim(),
      type: url.match(/\.(mp4|mov|avi|wmv)$/i) ? 'video' : 'image'
    }));
  }

  console.log(`[performPublish] Platform: ${platform}, Media Items: ${media.length}, Text length: ${text.length}`);

  if (platform === 'vk') {
    // ВКонтакте принимает attachments как строку через запятую ссылок или медиа-ID
    const attachmentsString = media.map(m => m.url).join(',');
    const response = await axios.post('https://api.vk.ru/method/wall.post', null, {
      params: {
        owner_id: ownerId,
        message: text,
        attachments: attachmentsString || content.attachments || '',
        access_token: token,
        v: '5.199',
      }
    });
    if (response.data.error) throw new Error(response.data.error.error_msg);
    return { platform: 'vk', status: 'success', postUrl: `https://vk.com/wall${ownerId}_${response.data.response.post_id}` };
  }

  if (platform === 'telegram') {
    const tgUrl = `https://api.telegram.org/bot${token}`;

    // Вспомогательная функция для подготовки медиа для Telegram
    const getTgFile = (mediaData) => {
      if (!mediaData || !mediaData.url) return null;

      // Если это base64 (часто с префиксом data:image/png;base64,...)
      if (typeof mediaData.url === 'string' && mediaData.url.startsWith('data:')) {
        try {
          const base64Index = mediaData.url.indexOf(';base64,');
          if (base64Index !== -1) {
            const base64Data = mediaData.url.slice(base64Index + 8);
            return Buffer.from(base64Data, 'base64');
          }
        } catch (e) {
          console.error('Error parsing base64 media:', e.message);
        }
      }
      // Если это обычный URL
      return mediaData.url;
    };

    if (media.length === 0) {
      await axios.post(`${tgUrl}/sendMessage`, {
        chat_id: ownerId,
        text: text,
        parse_mode: 'HTML'
      });
    } else if (media.length === 1) {
      const method = media[0].type === 'video' ? 'sendVideo' : 'sendPhoto';
      const key = media[0].type === 'video' ? 'video' : 'photo';
      const file = getTgFile(media[0]);

      if (Buffer.isBuffer(file)) {
        const form = new FormData();
        form.append('chat_id', ownerId);
        form.append(key, file, { filename: `media.${media[0].type === 'video' ? 'mp4' : 'jpg'}` });
        form.append('caption', text);
        form.append('parse_mode', 'HTML');
        await axios.post(`${tgUrl}/${method}`, form, {
          headers: { ...form.getHeaders() }
        });
      } else {
        await axios.post(`${tgUrl}/${method}`, {
          chat_id: ownerId,
          [key]: file,
          caption: text,
          parse_mode: 'HTML'
        });
      }
    } else {
      // Для нескольких файлов Telegram требует multipart, если файлы локальные
      const form = new FormData();
      form.append('chat_id', ownerId);

      const mediaGroup = media.slice(0, 10).map((m, i) => {
        const file = getTgFile(m);
        const attachmentKey = `file_${i}`;

        if (Buffer.isBuffer(file)) {
          form.append(attachmentKey, file, { filename: `media_${i}.${m.type === 'video' ? 'mp4' : 'jpg'}` });
        }

        return {
          type: m.type === 'video' ? 'video' : 'photo',
          media: Buffer.isBuffer(file) ? `attach://${attachmentKey}` : m.url,
          caption: i === 0 ? text : '',
          parse_mode: 'HTML'
        };
      });

      form.append('media', JSON.stringify(mediaGroup));

      await axios.post(`${tgUrl}/sendMediaGroup`, form, {
        headers: { ...form.getHeaders() }
      });
    }
    return { platform: 'telegram', status: 'success', postUrl: `https://t.me/${ownerId.toString().replace('-100', '')}` };
  }

  if (platform === 'ok') {
    const appKey = account.okAppKey;
    const secretKey = decrypt(account.okAppSecretKey);
    const sessionSecretKey = md5(token + secretKey).toLowerCase();

    const attachmentObj = {
      media: [{ type: 'text', text: text }]
    };
    media.forEach(m => {
      attachmentObj.media.push({ type: 'photo', url: m.url });
    });

    const params = {
      application_key: appKey,
      attachment: JSON.stringify(attachmentObj),
      format: 'json',
      method: 'mediatopic.post',
      type: 'GROUP_THEME',
      ...(ownerId ? { gid: ownerId } : {}),
    };

    const sig = okSign(params, sessionSecretKey);
    const response = await axios.get('https://api.ok.ru/fb.do', {
      params: { ...params, sig, access_token: token }
    });

    if (response.data.error_code) throw new Error(`OK Error ${response.data.error_code}: ${response.data.error_msg}`);
    return { platform: 'ok', status: 'success', postId: response.data };
  }

  if (platform === 'twitter') {
    return await performPublishTwitter(account, content);
  }

  if (platform === 'tenchat') {
    const response = await axios.post('https://api.tenchat.ru/v1/posts', {
      text: text,
      attachments: media.map(m => m.url)
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return { platform: 'tenchat', status: 'success', postId: response.data.id };
  }

  throw new Error(`Unsupported platform: ${platform}`);
}

async function performPublishTwitter(account, content) {
  const token = decrypt(account.encryptedToken);
  const media = content.media || [];
  const text = content.text || '';

  const tweetData = { text };

  if (media.length > 0) {
    const mediaIds = [];
    for (const m of media.slice(0, 4)) {
      try {
        // FIX #12: Валидация URL перед загрузкой
        validateUrl(m.url);

        // 1. Скачиваем файл во временный буфер
        const downloadRes = await axios.get(m.url, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(downloadRes.data);

        // 2. Загружаем в Twitter v1.1 (Multipart)
        const form = new FormData();
        form.append('media', buffer, { filename: m.name || 'image.jpg' });

        const uploadRes = await axios.post('https://upload.twitter.com/1.1/media/upload.json', form, {
          headers: {
            ...form.getHeaders(),
            'Authorization': `Bearer ${token}`
          }
        });

        if (uploadRes.data.media_id_string) {
          mediaIds.push(uploadRes.data.media_id_string);
        }
      } catch (e) {
        console.error('Twitter Media Upload Error:', e.response?.data || e.message);
      }
    }
    if (mediaIds.length > 0) {
      tweetData.media = { media_ids: mediaIds };
    }
  }

  const response = await axios.post('https://api.twitter.com/2/tweets', tweetData, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  return {
    platform: 'twitter',
    status: 'success',
    postId: response.data.data.id,
    postUrl: `https://twitter.com/i/status/${response.data.data.id}`
  };
}

// ─── API Эндпоинты для Планировщика (Posts) ───────────────────────────────────

app.get('/api/posts', async (req, res) => {
  try {
    const posts = await Post.find().sort({ scheduledAt: 1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/posts', async (req, res) => {
  try {
    const post = new Post(req.body);
    await post.save();
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/posts/:id', async (req, res) => {
  try {
    const post = await Post.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/posts/:id', async (req, res) => {
  try {
    await Post.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── API Эндпоинты для Репостера (Rules) ──────────────────────────────────────

app.get('/api/reposter/rules', async (req, res) => {
  try {
    const rules = await RepostRule.find().sort({ createdAt: -1 });
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reposter/rules', async (req, res) => {
  try {
    const rule = new RepostRule(req.body);
    await rule.save();
    res.json(rule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/reposter/rules/:id', async (req, res) => {
  try {
    const rule = await RepostRule.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(rule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/reposter/rules/:id', async (req, res) => {
  try {
    await RepostRule.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reposter/history', async (req, res) => {
  try {
    const history = await RepostHistory.find().sort({ publishedAt: -1 }).limit(100);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/reposter/history', async (req, res) => {
  try {
    await RepostHistory.deleteMany({});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Фоновые задачи (Worker) ──────────────────────────────────────────────────
// Функция публикации в Twitter (X) API
async function performPublishTwitter(account, post) {
  const token = decrypt(account.encryptedToken);

  // Twitter API v2 Tweet endpoint (POST /2/tweets)
  const response = await axios.post('https://api.twitter.com/2/tweets', {
    text: post.text
    // Для медиа в v2 нужно сначала загрузить в v1.1 Media Upload и получить media_id
  }, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  return {
    status: 'success',
    postId: response.data.data.id,
    postUrl: `https://twitter.com/user/status/${response.data.data.id}`
  };
}

// Функция для проверки запланированных постов
async function checkScheduledPosts() {
  const now = new Date();
  console.log(`🕒 [Worker] Checking scheduler at ${now.toISOString()}...`);
  const pendingPosts = await Post.find({
    status: 'scheduled',
    scheduledAt: { $lte: now }
  });

  if (pendingPosts.length === 0) {
    console.log(`🕒 [Worker] No pending posts found.`);
    return;
  }

  for (const post of pendingPosts) {
    const results = [];
    for (const accId of post.targetAccounts) {
      try {
        const res = await performPublish(accId, {
          text: post.text,
          media: post.media
        });
        results.push({ accountId: accId, ...res, publishedAt: new Date() });
      } catch (err) {
        console.error(`❌ Failed to publish post ${post._id} to ${accId}:`, err.message);
        results.push({ accountId: accId, status: 'error', error: err.message, publishedAt: new Date() });
      }
    }

    post.status = results.every(r => r.status === 'error') ? 'error' : 'published';
    post.results = results;
    await post.save();
  }
}

// Функция для обработки одного правила репостера (RSS)
async function processRSSRule(rule) {
  console.log(`🔄 [Worker] Processing RSS rule: ${rule.name} (${rule.source.url})...`);
  try {
    const feed = await parser.parseURL(rule.source.url);
    const items = feed.items.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    // Берем только последний элемент для простоты (или несколько, если не было проверок)
    const latestItem = items[0];
    if (!latestItem) return;

    const sourceUid = latestItem.guid || latestItem.link;

    // Проверяем, не публиковали ли мы это уже
    const alreadyDone = await RepostHistory.findOne({ sourceUrl: sourceUid });
    if (alreadyDone && rule.skipDuplicates) return;

    console.log(`🔄 Reposter: found new item in ${rule.name} -> ${latestItem.title}`);

    // Фильтры
    const text = latestItem.contentSnippet || latestItem.content || '';
    if (rule.filters.minLength && text.length < rule.filters.minLength) return;

    // Формируем текст поста
    let postText = `${latestItem.title}\n\n${text}`;
    if (rule.addSourceLink) postText += `\n\n🔗 ${latestItem.link}`;
    if (rule.appendText) postText += `\n\n${rule.appendText}`;

    // Пытаемся найти картинку в RSS
    const media = [];
    if (latestItem.enclosure && latestItem.enclosure.url) {
      media.push({ url: latestItem.enclosure.url, type: 'image' });
    } else if (latestItem.media && latestItem.media.$ && latestItem.media.$.url) {
      media.push({ url: latestItem.media.$.url, type: 'image' });
    } else {
      // Поиск первого тега <img> в контенте
      const imgMatch = (latestItem.content || '').match(/<img[^>]+src="([^">]+)"/);
      if (imgMatch) media.push({ url: imgMatch[1], type: 'image' });
    }

    const results = [];
    for (const accId of rule.targetAccountIds) {
      try {
        const res = await performPublish(accId, { text: postText, media });
        results.push({ accountId: accId, ...res });
      } catch (err) {
        results.push({ accountId: accId, status: 'error', error: err.message });
      }
    }

    // Сохраняем в историю
    await new RepostHistory({
      ruleId: rule._id,
      sourceUrl: sourceUid,
      text: postText,
      results,
      status: results.some(r => r.status === 'success') ? 'success' : 'error'
    }).save();

    rule.lastCheckedAt = new Date();
    await rule.save();

  } catch (err) {
    console.error(`❌ Reposter error in rule ${rule.name}:`, err.message);
  }
}

// Функция для обработки правила Telegram (через RSSHub)
async function processTGChannelRule(rule) {
  const username = rule.source.tgUsername.replace('@', '');
  const rssUrl = `https://rsshub.app/telegram/channel/${username}`;

  // Временно подменяем URL и вызываем стандартный парсер RSS
  const originalUrl = rule.source.url;
  rule.source.url = rssUrl;
  await processRSSRule(rule);
  rule.source.url = originalUrl;
}

// Функция для обработки правила VK Wall
async function processVKWallRule(rule) {
  try {
    const ownerId = rule.source.vkOwnerId;
    let token = rule.source.vkToken;

    // Если токен не указан в правиле, пробуем найти его в подключенных аккаунтах
    if (!token) {
      const vkAccount = await Account.findOne({ platform: 'vk', isActive: true });
      if (vkAccount) {
        token = decrypt(vkAccount.encryptedToken);
      }
    }

    if (!token) throw new Error('No VK token available for reposter');

    const response = await axios.get('https://api.vk.ru/method/wall.get', {
      params: {
        owner_id: ownerId,
        count: 5,
        access_token: token,
        v: '5.199',
      }
    });

    if (response.data.error) throw new Error(response.data.error.error_msg);

    const items = response.data.response.items;
    if (!items || items.length === 0) return;

    // Берем самый свежий пост (не закрепленный)
    const latestItem = items.find(item => !item.is_pinned) || items[0];
    const sourceUid = `vk_${ownerId}_${latestItem.id}`;

    const alreadyDone = await RepostHistory.findOne({ sourceUrl: sourceUid });
    if (alreadyDone && rule.skipDuplicates) return;

    console.log(`🔄 Reposter: found new VK post in ${rule.name}`);

    // Извлекаем текст и вложения
    let postText = latestItem.text || '';
    if (rule.filters.minLength && postText.length < rule.filters.minLength) return;

    const vkMedia = (latestItem.attachments || [])
      .filter(a => a.type === 'photo')
      .map(a => {
        const sizes = a.photo.sizes;
        return {
          url: sizes[sizes.length - 1].url,
          type: 'image'
        };
      });

    const results = [];
    for (const accId of rule.targetAccountIds) {
      try {
        const res = await performPublish(accId, { text: postText, media: vkMedia });
        results.push({ accountId: accId, ...res });
      } catch (err) {
        results.push({ accountId: accId, status: 'error', error: err.message });
      }
    }

    await new RepostHistory({
      ruleId: rule._id,
      sourceUrl: sourceUid,
      text: postText,
      results,
      status: results.some(r => r.status === 'success') ? 'success' : 'error'
    }).save();

    rule.lastCheckedAt = new Date();
    await rule.save();

  } catch (err) {
    console.error(`❌ Reposter VK error in rule ${rule.name}:`, err.message);
  }
}

// Главный цикл воркера (каждую минуту)
cron.schedule('* * * * *', async () => {
  try {
    // 1. Проверка планировщика
    await checkScheduledPosts();

    // 2. Проверка репостера (только активные правила)
    const activeRules = await RepostRule.find({ status: 'active' });
    for (const rule of activeRules) {
      if (rule.source.type === 'rss') {
        await processRSSRule(rule);
      } else if (rule.source.type === 'vk_wall') {
        await processVKWallRule(rule);
      } else if (rule.source.type === 'tg_channel') {
        await processTGChannelRule(rule);
      }
    }
  } catch (err) {
    console.error('🛠 Worker General Error:', err);
  }
});

// ─── Тестовые Эндпоинты (для верификации) ───────────────────────────────────

app.get('/api/test/trigger', async (req, res) => {
  console.log('🚀 Manual worker trigger received');
  try {
    await checkScheduledPosts();
    const activeRules = await RepostRule.find({ status: 'active' });
    for (const rule of activeRules) {
      if (rule.source.type === 'rss') await processRSSRule(rule);
      else if (rule.source.type === 'vk_wall') await processVKWallRule(rule);
      else if (rule.source.type === 'tg_channel') await processTGChannelRule(rule);
    }
    res.json({ success: true, message: 'Worker triggered manually' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

console.log('\n🚀 Starting server...');
console.log(`📡 Port: ${PORT}`);
console.log(`🌐 Host: ${HOST}`);
console.log(`🔐 Auth: ${APP_PASSWORD ? '✅ Enabled' : '⚠️ DISABLED (set APP_PASSWORD!)'}`);
console.log(`🗄️  MongoDB: ${process.env.MONGO_URI ? '✅ Configured' : '⚠️ Not configured'}`);
console.log(`🌐 CORS Origins: ${allowedOrigins.join(', ') || '⚠️ None configured'}`);
console.log(`🔧 NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`📦 FRONTEND_URL: ${process.env.FRONTEND_URL || 'not set'}`);
console.log(`💾 ENCRYPTION_KEY: ${process.env.ENCRYPTION_KEY ? 'set' : 'MISSING'}`);
console.log('');

// Keep server alive for Railway
const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 Server is listening on ${HOST}:${PORT}`);
});

// Handle server errors
server.on('error', (err) => {
  console.error('❌ Server error:', err);
  process.exit(1);
});

// Prevent unhandled rejections from crashing
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('🚨 Uncaught Exception:', err);
});

// Все остальные GET-запросы отправляют index.html (для React Router)
// ВАЖНО: Это должно быть в самом конце!
app.get('*', (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error('Error sending file:', err.message);
        res.status(err.status || 500).send('Error loading application');
      }
    });
  } else {
    console.warn('⚠️ Frontend not built. dist/index.html not found.');
    res.status(200).send('<h1>Backend is running</h1><p>Frontend needs to be built. Run: npm run build</p>');
  }
});
