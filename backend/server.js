// server.js — прокси для безопасной публикации в VK, OK и Telegram
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const CryptoJS = require('crypto-js');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

// Настройка CORS: разрешить только вашему фронтенду
const allowedOrigins = [
  process.env.FRONTEND_URL, 
  'http://localhost:5173', // для локальной разработки
  'http://localhost:4173'
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

app.use(express.json({ limit: '50mb' }));

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
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});
const Account = mongoose.model('Account', AccountSchema);

// Шифрование токена (AES-256)
const encrypt = (token) =>
  CryptoJS.AES.encrypt(token, process.env.ENCRYPTION_KEY).toString();

// Дешифрование токена
const decrypt = (encrypted) => {
  const bytes = CryptoJS.AES.decrypt(encrypted, process.env.ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};

// ── API Эндпоинты ────────────────────────────────────────────────────────────

// Тестовый эндпоинт
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Сохранить аккаунт (шифрует токен перед сохранением)
app.post('/api/accounts', async (req, res) => {
  try {
    const { platform, name, token, ownerId } = req.body;
    if (!platform || !name || !token || !ownerId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const account = new Account({
      platform,
      name,
      ownerId,
      encryptedToken: encrypt(token),
    });

    await account.save();
    res.json({ id: account._id, platform, name, ownerId });
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

    const response = await axios.post('https://api.vk.com/method/wall.post', null, {
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Proxy server running on port ${PORT}`));
