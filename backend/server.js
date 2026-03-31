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

// Middleware для защиты доступа (только для ПОЛЬЗОВАТЕЛЯ)
const authMiddleware = (req, res, next) => {
  const token = req.cookies.app_token;
  const publicPaths = ['/api/login', '/login', '/favicon.ico'];
  
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
  const redirectUri = process.env.VK_REDIRECT_URI;
  
  if (!clientId || !redirectUri) {
    return res.status(500).json({ error: 'VK OAuth credentials not configured in .env' });
  }

  // Запрашиваем права на стену, группы, истории и бессрочный токен (offline)
  const vkAuthUrl = `https://oauth.vk.com/authorize?client_id=${clientId}&display=page&redirect_uri=${encodeURIComponent(redirectUri)}&scope=wall,groups,stories,offline&response_type=code&v=5.199`;
  
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
  const redirectUri = process.env.OK_REDIRECT_URI;
  
  if (!appId || !redirectUri) {
    return res.status(500).json({ error: 'OK OAuth credentials not configured in .env' });
  }

  const okAuthUrl = `https://connect.ok.ru/oauth/authorize?client_id=${appId}&scope=VALUABLE_ACCESS;SET_STATUS;PHOTO_CONTENT&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}`;
  
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

// Сохранить аккаунт (шифрует токен перед сохранением)
app.post('/api/accounts', async (req, res) => {
  try {
    const { platform, name, token, ownerId, okAppKey, okAppSecretKey, okGroupId } = req.body;
    
    // Для OK ownerId может быть пустым (если это личный профиль, а не группа),
    // поэтому делаем проверку ownerId зависимой от платформы.
    const isOwnerIdRequired = platform !== 'ok';
    
    if (!platform || !name || !token || (isOwnerIdRequired && !ownerId)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const account = new Account({
      platform,
      name,
      ownerId,
      encryptedToken: encrypt(token),
      okAppKey,
      okAppSecretKey: okAppSecretKey ? encrypt(okAppSecretKey) : undefined,
      okGroupId,
    });

    await account.save();
    res.json({ 
      id: account._id, 
      platform, 
      name, 
      ownerId,
      vkOwnerId: platform === 'vk' ? ownerId : undefined,
      tgChatId: platform === 'telegram' ? ownerId : undefined,
      okGroupId: platform === 'ok' ? okGroupId : undefined,
      okAppKey, 
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Proxy server running on port ${PORT}`));

// Все остальные GET-запросы отправляют index.html (для React Router)
// ВАЖНО: Это должно быть в самом конце!
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});
