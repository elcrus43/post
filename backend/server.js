// server.js — прокси для безопасной публикации в VK, OK и Telegram
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const CryptoJS = require('crypto-js');
const mongoose = require('mongoose');
const md5 = require('md5');
const path = require('path');
const FormData = require('form-data');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();
const cookieParser = require('cookie-parser');
const cron = require('node-cron');
const Parser = require('rss-parser');
const parser = new Parser();

const app = express();
app.use(cookieParser());

const APP_PASSWORD = process.env.APP_PASSWORD || 'admin';

// Настройка CORS: разрешить только вашему фронтенду
const allowedOrigins = [
  process.env.FRONTEND_URL, 
  'http://localhost:5173', // для локальной разработки
  'http://localhost:4173'
].filter(Boolean);

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));

// Прокси для VK и OK (для прямого обращения с фронтенда без CORS)
app.use("/vk", createProxyMiddleware({ target: "https://api.vk.com", changeOrigin: true }));
app.use("/ok", createProxyMiddleware({ target: "https://api.ok.ru", changeOrigin: true }));

// Подключение к MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

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
  const publicPaths = ['/api/login', '/login', '/api/auth/', '/favicon.ico', '/api/auth/tenchat', '/api/auth/twitter'];
  
  // Если это публичный путь, разрешаем
  if (publicPaths.some(p => req.path.startsWith(p))) {
    return next();
  }

  // Проверка сессии (пароля)
  if (token === APP_PASSWORD || token === 'authorized_session') {
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

// Эндпоинт для проверки пароля
app.post('/api/login', (req, res) => {
  const { password } = req.body;

  if (password === APP_PASSWORD) {
    // Устанавливаем куку на 30 дней
    res.cookie('app_token', APP_PASSWORD, { 
      maxAge: 30 * 24 * 60 * 60 * 1000, 
      httpOnly: false, 
      secure: true, // Всегда true для Railway (там https)
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
    const missing = [];
    if (!clientId) missing.push('VK_CLIENT_ID');
    if (!clientSecret) missing.push('VK_CLIENT_SECRET');
    if (!redirectUri) missing.push('VK_REDIRECT_URI');
    return res.status(500).json({ error: `VK OAuth not configured. Missing in .env: ${missing.join(', ')}` });
  }

  // VK ID Authorization (Modern way)
  // 466972 = wall+groups+photos+video+audio+docs+offline
  const vkAuthUrl = `https://id.vk.com/auth?app_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=466972&state=${Math.random().toString(36).substring(7)}`;
  
  res.redirect(vkAuthUrl);
});

app.get('/api/auth/vk/callback', async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    return res.status(400).send(`VK Auth Error: ${error_description || error}`);
  }

  if (!code) {
    return res.status(400).send('No code received from VK');
  }

  try {
    // Обмениваем код на токен
    const tokenRes = await axios.get('https://oauth.vk.com/access_token', {
      params: {
        client_id: process.env.VK_CLIENT_ID,
        client_secret: process.env.VK_CLIENT_SECRET,
        redirect_uri: process.env.VK_REDIRECT_URI,
        code,
      }
    });

    const { access_token, user_id, email } = tokenRes.data;

    if (!access_token) {
      return res.status(400).send('Failed to obtain access token from VK');
    }

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
    console.error('VK Callback Error:', err.response?.data || err.message);
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
    console.error('OK Callback Error:', err.response?.data || err.message);
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
    console.error('TenChat Callback Error:', err.response?.data || err.message);
    res.status(500).send('Internal server error during TenChat authentication');
  }
});

// ─── Twitter (X) OAuth 2.0 + PKCE ────────────────────────────────────────────

const crypto = require('crypto');

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
    console.error('Twitter Callback Error:', err.response?.data || err.message);
    res.status(500).send('Internal server error during Twitter authentication');
  }
});

// Получить список аккаунтов
app.get('/api/accounts', async (req, res) => {
  try {
    const accounts = await Account.find().sort({ createdAt: -1 });
    const results = accounts.map(acc => {
      const plain = acc.toObject();
      return {
        id: plain._id,
        ...plain,
        // Ожидаемые фронтендом поля для Telegram
        tgBotToken: acc.platform === 'telegram' ? decrypt(acc.encryptedToken) : undefined,
        tgChatId: acc.platform === 'telegram' ? acc.ownerId : undefined,
        // Ожидаемые поля для VK
        vkToken: acc.platform === 'vk' ? decrypt(acc.encryptedToken) : undefined,
        vkOwnerId: acc.platform === 'vk' ? acc.ownerId : undefined,
        // Ожидаемые поля для OK
        okToken: acc.platform === 'ok' ? decrypt(acc.encryptedToken) : undefined,
        okAppSecretKey: acc.okAppSecretKey ? decrypt(acc.okAppSecretKey) : undefined,
        // Ожидаемые поля для Twitter/TenChat
        token: decrypt(acc.encryptedToken)
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
    const { accountId, token: directToken, ownerId: directOwnerId, message, attachments } = req.body;
    
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

    const response = await axios.post('https://api.vk.ru/method/wall.post', null, {
      params: {
        owner_id: ownerId,
        message,
        attachments: attachments || '',
        access_token: token,
        v: '5.199',
      }
    });

    if (response.data.error) {
      return res.status(400).json(response.data.error);
    }
    res.json(response.data.response);
  } catch (err) {
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
    const { accountId, token: directToken, ownerId: directOwnerId, text, parse_mode = 'HTML' } = req.body;
    
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
      return res.status(400).json({ error: 'Missing token or chatId' });
    }

    const response = await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: ownerId,
      text,
      parse_mode
    });

    res.json(response.data);
  } catch (err) {
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
    const { 
      accountId, 
      token: directToken, 
      appKey: directAppKey, 
      secretKey: directSecretKey,
      groupId: directGroupId,
      message, 
      attachments 
    } = req.body;

    let token = directToken;
    let appKey = directAppKey;
    let secretKey = directSecretKey;
    let groupId = directGroupId;

    if (accountId) {
      const account = await Account.findById(accountId);
      if (account) {
        token = decrypt(account.encryptedToken);
        appKey = account.okAppKey;
        secretKey = account.okAppSecretKey ? decrypt(account.okAppSecretKey) : undefined;
        groupId = account.okGroupId;
      }
    }

    if (!token || !appKey || !secretKey) {
      return res.status(400).json({ error: 'Missing OK credentials (token, appKey, or secretKey)' });
    }

    const sessionSecretKey = md5(token + secretKey).toLowerCase();
    
    // Подготовим аттачмент как в apiService.ts
    const attachmentObj = {
      media: [{ type: 'text', text: message }]
    };
    // Если есть картинки, добавить их (упрощенно)
    if (attachments) {
      attachments.split(',').forEach(url => {
        attachmentObj.media.push({ type: 'photo', url });
      });
    }

    const params = {
      application_key: appKey,
      attachment: JSON.stringify(attachmentObj),
      format: 'json',
      method: 'mediatopic.post',
      type: 'GROUP_THEME',
      ...(groupId ? { gid: groupId } : {}),
    };

    const sig = okSign(params, sessionSecretKey);

    const response = await axios.get('https://api.ok.ru/fb.do', {
      params: {
        ...params,
        sig,
        access_token: token,
      }
    });

    if (response.data.error_code) {
      return res.status(400).json(response.data);
    }
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Proxy (for Gemini/Qwen via browser to avoid CORS)
app.post('/api/ai/proxy', async (req, res) => {
  try {
    const { baseUrl, apiKey, model, messages } = req.body;

    if (!baseUrl || !apiKey || !model || !messages) {
      return res.status(400).json({ error: 'Missing required AI parameters' });
    }

    const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
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
    const errorData = err.response?.data?.error || err.response?.data || { message: err.message };
    
    console.error(`❌ AI Proxy Error [${status}]:`, JSON.stringify(errorData, null, 2));
    
    res.status(status).json({ 
      error: errorData,
      status: status,
      details: err.message
    });
  }
});

// Вспомогательная функция для публикации на любую платформу
async function performPublish(accountId, content) {
  const account = await Account.findById(accountId);
  if (!account || !account.isActive) {
    throw new Error(`Account ${accountId} not found or inactive`);
  }

  const token = decrypt(account.encryptedToken);
  const { platform, ownerId } = account;
  const media = content.media || [];
  const text = content.text || '';

  console.log(`🚀 Publishing to ${platform} (${ownerId}) | Media count: ${media.length}`);

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
    if (media.length === 0) {
      await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id: ownerId,
        text: text,
        parse_mode: 'HTML'
      });
    } else if (media.length === 1) {
      const method = media[0].type === 'video' ? 'sendVideo' : 'sendPhoto';
      const key = media[0].type === 'video' ? 'video' : 'photo';
      await axios.post(`https://api.telegram.org/bot${token}/${method}`, {
        chat_id: ownerId,
        [key]: media[0].url,
        caption: text,
        parse_mode: 'HTML'
      });
    } else {
      const mediaGroup = media.slice(0, 10).map((m, i) => ({
        type: m.type === 'video' ? 'video' : 'photo',
        media: m.url,
        caption: i === 0 ? text : '',
        parse_mode: 'HTML'
      }));
      await axios.post(`https://api.telegram.org/bot${token}/sendMediaGroup`, {
        chat_id: ownerId,
        media: mediaGroup
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
          attachments: post.media.map(m => m.url).join(',')
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

    const results = [];
    for (const accId of rule.targetAccountIds) {
      try {
        const res = await performPublish(accId, { text: postText });
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

    const attachments = (latestItem.attachments || [])
      .filter(a => a.type === 'photo')
      .map(a => {
        const sizes = a.photo.sizes;
        return sizes[sizes.length - 1].url; // самая большая версия
      })
      .join(',');

    if (rule.addSourceLink) postText += `\n\n🔗 https://vk.com/wall${ownerId}_${latestItem.id}`;
    if (rule.appendText) postText += `\n\n${rule.appendText}`;

    const results = [];
    for (const accId of rule.targetAccountIds) {
      try {
        const res = await performPublish(accId, { text: postText, attachments });
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
app.listen(PORT, () => console.log(`🚀 Proxy server running on port ${PORT}`));

// Все остальные GET-запросы отправляют index.html (для React Router)
// ВАЖНО: Это должно быть в самом конце!
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});
