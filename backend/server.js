// server.js
// ============================================
// STEP 1: Start health server BEFORE any await
// ============================================
import http from 'http';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

const HEALTH_BODY = Buffer.from(JSON.stringify({ status: 'ok' }));

const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/ready') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': HEALTH_BODY.length });
    res.end(HEALTH_BODY);
  } else {
    res.writeHead(503);
    res.end();
  }
});

server.listen(PORT, HOST, () => console.log(`✅ Health ${HOST}:${PORT}`));
server.on('error', (err) => { console.error('❌', err); process.exit(1); });

// ============================================
// STEP 2: Load everything in async IIFE (non-blocking)
// ============================================
(async () => {
  const express = (await import('express')).default;
  const path = (await import('path')).default;
  const fs = (await import('fs')).default;
  const { fileURLToPath } = await import('url');

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const app = express();
  app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
  app.get('/ready', (req, res) => res.status(200).json({ status: 'ready' }));

  const cookieParser = (await import('cookie-parser')).default;
  await import('dotenv/config');
  app.use(cookieParser());

  const cors = (await import('cors')).default;
  const axios = (await import('axios')).default;
  const CryptoJS = (await import('crypto-js')).default;
  const crypto = (await import('crypto')).default;
  const mongoose = (await import('mongoose')).default;
  const md5 = (await import('md5')).default;
  const FormData = (await import('form-data')).default;
  const { createProxyMiddleware } = await import('http-proxy-middleware');
  const rateLimit = (await import('express-rate-limit')).default;
  const cron = (await import('node-cron')).default;
  const Parser = (await import('rss-parser')).default;
  const parser = new Parser();

  const APP_PASSWORD = process.env.APP_PASSWORD;
  if (!APP_PASSWORD) console.warn('⚠️ No APP_PASSWORD');

  const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.RAILWAY_STATIC_URL,
    process.env.PUBLIC_URL,
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:4173',
    'https://post-production-01fa.up.railway.app'
  ].filter(Boolean);

  app.use(cors({
    origin: (origin, cb) => {
      console.log(`[CORS] Origin check: ${origin}`);
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.some(a => origin?.startsWith(a)) || origin.includes('localhost')) {
        cb(null, true);
      } else {
        console.warn(`[CORS] Rejected: ${origin}`);
        cb(new Error('CORS'));
      }
    },
    credentials: true
  }));

  app.use(express.json({ limit: '50mb' }));

  // Sanitization
  const sanitize = o => Array.isArray(o) ? o.map(sanitize) : (o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('$') && !k.includes('.')).map(([k, v]) => [k, sanitize(v)])) : o);
  app.use((req, res, next) => { if (req.body && typeof req.body === 'object') req.body = sanitize(req.body); next(); });

  // Rate limiters
  const genLim = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });
  const strictLim = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
  const aiLim = rateLimit({ windowMs: 60 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
  app.use(genLim);

  // Proxy auth
  const authProxy = (req, res, next) => req.cookies.app_token === APP_PASSWORD ? next() : res.status(401).json({ error: 'Unauthorized' });
  app.use("/vk", authProxy, createProxyMiddleware({ target: "https://api.vk.com", changeOrigin: true }));
  app.use("/ok", authProxy, createProxyMiddleware({ target: "https://api.ok.ru", changeOrigin: true }));

  // SSRF
  const PRIV = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.|0\.0\.0\.0|::1|169\.254\.|fc00:|fe80:)/i;
  function vUrl(u) { if (!u || typeof u !== 'string') throw new Error('Invalid'); const p = new URL(u); if (p.protocol !== 'http:' && p.protocol !== 'https:') throw new Error('Proto'); if (PRIV.test(p.hostname)) throw new Error('SSRF'); }

  // Schemas
  const Account = mongoose.model('Account', new mongoose.Schema({
    platform: String, name: String, encryptedToken: String, ownerId: String,
    okAppKey: String, okAppSecretKey: String, okGroupId: String,
    isActive: { type: Boolean, default: true }, createdAt: { type: Date, default: Date.now }
  }));
  const Post = mongoose.model('Post', new mongoose.Schema({
    userId: String, text: String, media: Array, scheduledAt: Date,
    status: { type: String, enum: ['scheduled', 'published', 'error', 'draft'], default: 'scheduled' },
    targetAccounts: [String], results: [{ accountId: String, platform: String, status: String, postUrl: String, error: String, publishedAt: Date }],
    createdAt: { type: Date, default: Date.now }
  }));
  const RepostRule = mongoose.model('RepostRule', new mongoose.Schema({
    name: String, status: { type: String, enum: ['active', 'paused', 'error'], default: 'paused' },
    source: { type: { type: String, enum: ['rss', 'vk_wall', 'tg_channel'] }, name: String, url: String, vkOwnerId: String, vkToken: String, tgUsername: String },
    targetAccountIds: [String], schedule: { days: [Number], hours: [Number], intervalMin: Number, intervalMax: Number },
    filters: { minLength: Number, maxLength: Number, requireImage: Boolean, stopWords: [String], requiredWords: [String] },
    order: { type: String, enum: ['newest', 'oldest', 'random'], default: 'newest' }, appendText: String, addSourceLink: Boolean, skipDuplicates: Boolean,
    lastCheckedAt: Date, nextPublishAt: Date, createdAt: { type: Date, default: Date.now }
  }));
  const RepostHistory = mongoose.model('RepostHistory', new mongoose.Schema({
    ruleId: mongoose.Schema.Types.ObjectId, sourceUrl: { type: String, unique: true },
    publishedAt: { type: Date, default: Date.now }, status: String, text: String, results: Array
  }));
  const OAuthState = mongoose.model('OAuthState', new mongoose.Schema({
    state: String, codeVerifier: String, platform: String, createdAt: { type: Date, expires: '15m', default: Date.now }
  }));

  // Auth middleware
  app.use((req, res, next) => {
    const t = req.cookies.app_token;
    
    // Public paths
    const pub = ['/api/login', '/login', '/api/auth/', '/favicon.ico', '/api/auth/tenchat', '/api/auth/twitter', '/health', '/ready', '/assets/'];
    if (pub.some(p => req.path.startsWith(p))) return next();
    
    // Auth check
    if (t === APP_PASSWORD && APP_PASSWORD !== undefined) return next();
    
    // API protection
    if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Unauthorized' });
    
    // If not authorized, redirect to / (where the Login component lives)
    // but only if it's not the root path already
    next();
  });

  // Login
  app.post('/api/login', strictLim, (req, res) => {
    if (req.body.password === APP_PASSWORD) {
      res.cookie('app_token', APP_PASSWORD, { 
        maxAge: 30 * 24 * 60 * 60 * 1000, 
        httpOnly: false, 
        secure: true, 
        sameSite: 'Lax',
        path: '/'
      });
      return res.json({ success: true });
    }
    res.status(401).json({ error: 'Wrong' });
  });

  // Static
  const distPath = path.join(__dirname, '../dist');
  console.log(`[APP] Serving static from: ${distPath}`);
  
  app.use((req, res, next) => {
    if (req.url.startsWith('/assets/')) {
      const fullPath = path.join(distPath, req.url);
      console.log(`[STATIC] Requesting asset: ${req.url} -> ${fullPath}`);
      if (!fs.existsSync(fullPath)) {
        console.warn(`[STATIC] Asset NOT FOUND: ${fullPath}`);
      }
    }
    next();
  });

  app.use(express.static(distPath, {
    setHeaders: (res, path) => {
      if (path.includes('/assets/')) {
        console.log(`[STATIC] Sending asset: ${path}`);
      }
    }
  }));

  // Crypto
  const enc = t => t ? CryptoJS.AES.encrypt(t, process.env.ENCRYPTION_KEY).toString() : '';
  const dec = e => e ? CryptoJS.AES.decrypt(e, process.env.ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8) : '';

  // OAuth routes (VK, OK, TenChat, Twitter) - condensed
  app.get('/api/auth/vk', (req, res) => {
    const { VK_CLIENT_ID: c, VK_CLIENT_SECRET: s, VK_REDIRECT_URI: r } = process.env;
    if (!c || !s || !r) return res.status(500).json({ error: 'VK not configured' });
    res.redirect(`https://id.vk.com/auth?app_id=${c}&response_type=code&redirect_uri=${encodeURIComponent(r)}&scope=466972&state=${Math.random().toString(36).substring(7)}`);
  });
  app.get('/api/auth/vk/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect(`${process.env.FRONTEND_URL || ''}/accounts?error=vk`);
    try {
      const r = await axios.post('https://id.vk.com/oauth2/auth', null, { params: { grant_type: 'authorization_code', code, redirect_uri: process.env.VK_REDIRECT_URI, client_id: process.env.VK_CLIENT_ID, client_secret: process.env.VK_CLIENT_SECRET } });
      if (r.data.error) throw new Error(r.data.error_description || r.data.error);
      const { access_token, user_id } = r.data;
      const u = await axios.get('https://api.vk.com/method/users.get', { params: { access_token, v: '5.199', fields: 'photo_100' } });
      const name = `${u.data.response[0].first_name} ${u.data.response[0].last_name}`;
      let a = await Account.findOne({ platform: 'vk', ownerId: String(user_id) });
      if (a) { a.name = name; a.encryptedToken = enc(access_token); a.isActive = true; await a.save(); }
      else { a = new Account({ platform: 'vk', name, ownerId: String(user_id), encryptedToken: enc(access_token), isActive: true, createdAt: new Date() }); await a.save(); }
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/accounts?success=vk`);
    } catch (e) { console.error('VK:', e.message); res.status(500).send('VK error'); }
  });

  app.get('/api/auth/ok', (req, res) => {
    const { OK_APP_ID: a, OK_SECRET_KEY: s, OK_PUBLIC_KEY: p, OK_REDIRECT_URI: r } = process.env;
    if (!a || !s || !p || !r) return res.status(500).json({ error: 'OK not configured' });
    res.redirect(`https://connect.ok.ru/oauth/authorize?client_id=${a}&scope=VALUABLE_ACCESS;PUBLISH_TO_STREAM;GROUP_CONTENT;PHOTO_CONTENT;VIDEO_CONTENT;LONG_ACCESS_TOKEN;GET_EMAIL;PUBLISH_NOTE&response_type=code&redirect_uri=${encodeURIComponent(r)}`);
  });
  app.get('/api/auth/ok/callback', async (req, res) => {
    const { code, error } = req.query;
    if (error) return res.status(400).send(`OK: ${error}`);
    if (!code) return res.status(400).send('No code');
    try {
      const p = new URLSearchParams();
      p.append('code', code); p.append('client_id', process.env.OK_APP_ID); p.append('client_secret', process.env.OK_SECRET_KEY);
      p.append('redirect_uri', process.env.OK_REDIRECT_URI); p.append('grant_type', 'authorization_code');
      const t = await axios.post('https://api.ok.ru/oauth/token.do', p);
      const { access_token } = t.data;
      if (!access_token) return res.status(400).send('No token');
      const ss = md5(access_token + process.env.OK_SECRET_KEY).toLowerCase();
      const sp = { application_key: process.env.OK_PUBLIC_KEY, format: 'json', method: 'users.getCurrentUser' };
      const sorted = Object.keys(sp).sort().map(k => `${k}=${sp[k]}`).join('');
      const sig = md5(sorted + ss).toLowerCase();
      const u = await axios.get('https://api.ok.ru/fb.do', { params: { ...sp, access_token, sig } });
      const d = u.data;
      const name = d.name || `${d.first_name} ${d.last_name}`;
      let a = await Account.findOne({ platform: 'ok', ownerId: String(d.uid) });
      const ad = { platform: 'ok', name, ownerId: String(d.uid), encryptedToken: enc(access_token), okAppKey: process.env.OK_PUBLIC_KEY, okAppSecretKey: enc(process.env.OK_SECRET_KEY), isActive: true, createdAt: new Date() };
      if (a) { Object.assign(a, ad); await a.save(); } else { a = new Account(ad); await a.save(); }
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/accounts?success=ok`);
    } catch (e) { console.error('OK:', e.message); res.status(500).send('OK error'); }
  });

  app.get('/api/auth/tenchat', (req, res) => {
    const c = process.env.TENCHAT_CLIENT_ID || 'smm-planner';
    const r = process.env.TENCHAT_REDIRECT_URI;
    if (!r) return res.status(500).json({ error: 'TenChat not configured' });
    res.redirect(`https://oauth.tenchat.ru/auth/sign-in?client_id=${c}&response_type=code&scope=post:write+user:read&redirect_uri=${encodeURIComponent(r)}&state=${Math.random().toString(36).substring(7)}`);
  });
  app.get('/api/auth/tenchat/callback', async (req, res) => {
    const { code, error } = req.query;
    if (error) return res.status(400).send(`TenChat: ${error}`);
    if (!code) return res.status(400).send('No code');
    try {
      const d = { code, grant_type: 'authorization_code', redirect_uri: process.env.TENCHAT_REDIRECT_URI, client_id: process.env.TENCHAT_CLIENT_ID };
      if (process.env.TENCHAT_CLIENT_SECRET) d.client_secret = process.env.TENCHAT_CLIENT_SECRET;
      const t = await axios.post('https://api.tenchat.ru/oauth/token', d);
      const { access_token, user_id } = t.data;
      const u = await axios.get('https://api.tenchat.ru/v1/user/me', { headers: { Authorization: `Bearer ${access_token}` } });
      const name = u.data.name || u.data.username || 'TenChat';
      let a = await Account.findOne({ platform: 'tenchat', ownerId: String(user_id) });
      const ad = { platform: 'tenchat', name, ownerId: String(user_id), encryptedToken: enc(access_token), isActive: true, createdAt: new Date() };
      if (a) { Object.assign(a, ad); await a.save(); } else { a = new Account(ad); await a.save(); }
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/accounts?success=tenchat`);
    } catch (e) { console.error('TenChat:', e.message); res.status(500).send('TenChat error'); }
  });

  function genV() { return crypto.randomBytes(32).toString('hex'); }
  function genC(v) { return crypto.createHash('sha256').update(v).digest().toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''); }
  app.get('/api/auth/twitter', async (req, res) => {
    const { TWITTER_CLIENT_ID: c, TWITTER_REDIRECT_URI: r } = process.env;
    if (!c || !r) return res.status(500).json({ error: 'Twitter not configured' });
    const st = Math.random().toString(36).substring(7);
    const cv = genV(), cc = genC(cv);
    await OAuthState.create({ state: st, codeVerifier: cv, platform: 'twitter' });
    res.redirect(`https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${c}&redirect_uri=${encodeURIComponent(r)}&scope=tweet.read%20tweet.write%20users.read%20offline.access%20media.write&state=${st}&code_challenge=${cc}&code_challenge_method=S256`);
  });
  app.get('/api/auth/twitter/callback', async (req, res) => {
    const { code, state, error } = req.query;
    const { TWITTER_CLIENT_ID: c, TWITTER_CLIENT_SECRET: s, TWITTER_REDIRECT_URI: r } = process.env;
    if (error) return res.status(400).send(`Twitter: ${error}`);
    if (!code) return res.status(400).send('No code');
    try {
      const ss = await OAuthState.findOneAndDelete({ state, platform: 'twitter' });
      if (!ss) return res.status(400).send('Invalid state');
      const p = new URLSearchParams({ code, grant_type: 'authorization_code', redirect_uri: r, code_verifier: ss.codeVerifier, client_id: c });
      const h = { 'Content-Type': 'application/x-www-form-urlencoded' };
      if (s) h['Authorization'] = `Basic ${Buffer.from(`${c}:${s}`).toString('base64')}`;
      const t = await axios.post('https://api.twitter.com/2/oauth2/token', p, { headers: h });
      const { access_token } = t.data;
      const u = await axios.get('https://api.twitter.com/2/users/me', { headers: { Authorization: `Bearer ${access_token}` }, params: { 'user.fields': 'id,name,username' } });
      const d = u.data.data;
      const name = `@${d.username} (${d.name})`;
      let a = await Account.findOne({ platform: 'twitter', ownerId: d.id });
      const ad = { platform: 'twitter', name, ownerId: d.id, encryptedToken: enc(access_token), isActive: true, createdAt: new Date() };
      if (a) { Object.assign(a, ad); await a.save(); } else { a = new Account(ad); await a.save(); }
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/accounts?success=twitter`);
    } catch (e) { console.error('Twitter:', e.message); res.status(500).send('Twitter error'); }
  });

  // Accounts
  app.get('/api/accounts', async (req, res) => {
    try {
      const a = await Account.find().sort({ createdAt: -1 });
      res.json(a.map(x => ({ id: x._id, platform: x.platform, name: x.name, ownerId: x.ownerId, vkOwnerId: x.platform === 'vk' ? x.ownerId : undefined, tgChatId: x.platform === 'telegram' ? x.ownerId : undefined, okGroupId: x.platform === 'ok' ? x.okGroupId : undefined, okAppKey: x.platform === 'ok' ? x.okAppKey : undefined, isActive: x.isActive, createdAt: x.createdAt })));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/accounts', async (req, res) => {
    try {
      const { platform, name, token, ownerId, tgBotToken, tgChatId, okAppKey, okAppSecretKey, okGroupId } = req.body;
      const ft = token || tgBotToken, fo = ownerId || tgChatId;
      if (!platform || !name || !ft) return res.status(400).json({ error: 'Missing' });
      const a = new Account({ platform, name, ownerId: fo, encryptedToken: enc(ft), okAppKey, okAppSecretKey: okAppSecretKey ? enc(okAppSecretKey) : undefined, okGroupId });
      await a.save();
      res.json({ id: a._id, platform, name, ownerId: fo, tgBotToken: ft, tgChatId: fo, isActive: a.isActive, createdAt: a.createdAt });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.delete('/api/accounts/:id', async (req, res) => { try { await Account.findByIdAndDelete(req.params.id); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
  app.patch('/api/accounts/:id/toggle', async (req, res) => {
    try { const a = await Account.findById(req.params.id); if (!a) return res.status(404).json({ error: 'Not found' }); a.isActive = !a.isActive; await a.save(); res.json({ id: a._id, isActive: a.isActive }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Publish
  app.post('/api/publish/vk', async (req, res) => {
    try { const { accountId, token, ownerId, message, attachments, media } = req.body; const pm = media || (attachments ? attachments.split(',').filter(Boolean).map(u => ({ type: 'image', url: u.trim() })) : []); res.json(await pub(accountId || { platform: 'vk', token, ownerId }, { text: message, media: pm })); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/publish/vk/story', async (req, res) => {
    try {
      const { accountId, token: dt, ownerId: do_, media } = req.body;
      let token = dt, ownerId = do_;
      if (accountId) { const a = await Account.findById(accountId); if (a) { token = dec(a.encryptedToken); ownerId = a.ownerId; } }
      if (!token || !ownerId) return res.status(400).json({ error: 'Missing' });
      if (!media?.length) return res.status(400).json({ error: 'No media' });
      const fm = media[0], isV = fm.type === 'video';
      const sr = await axios.get(`https://api.vk.ru/method/${isV ? 'stories.getVideoUploadServer' : 'stories.getPhotoUploadServer'}`, { params: { access_token: token, v: '5.199', add_to_news: 1 } });
      if (sr.data.error) throw new Error(sr.data.error.error_msg);
      let fb; if (fm.url.startsWith('data:')) fb = Buffer.from(fm.url.split(',')[1], 'base64'); else { vUrl(fm.url); const dr = await axios.get(fm.url, { responseType: 'arraybuffer' }); fb = Buffer.from(dr.data); }
      const form = new FormData(); form.append('file', fb, { filename: fm.name || (isV ? 'video.mp4' : 'photo.jpg'), contentType: isV ? 'video/mp4' : 'image/jpeg' });
      const ur = await axios.post(sr.data.response.upload_url, form, { headers: form.getHeaders() });
      const sv = await axios.get('https://api.vk.ru/method/stories.save', { params: { access_token: token, v: '5.199', upload_results: ur.data.response.upload_result } });
      if (sv.data.error) throw new Error(sv.data.error.error_msg);
      res.json(sv.data.response);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/publish/telegram', async (req, res) => {
    try { const { accountId, token, ownerId, text, media } = req.body; res.json(await pub(accountId || { platform: 'telegram', token, ownerId }, { text, media })); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
  function okSign(p, sk) { return md5(Object.keys(p).sort().map(k => `${k}=${p[k]}`).join('') + sk).toLowerCase(); }
  app.post('/api/publish/ok', async (req, res) => {
    try { const { accountId, token, appKey, secretKey, groupId, message, media } = req.body; res.json(await pub(accountId || { platform: 'ok', token, okAppKey: appKey, okAppSecretKey: secretKey, okGroupId: groupId }, { text: message, media })); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/ai/proxy', aiLim, async (req, res) => {
    try {
      const { baseUrl, apiKey, model, messages } = req.body;
      if (!baseUrl || !apiKey || !model || !messages) return res.status(400).json({ error: 'Missing' });
      let url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
      if (url.includes('googleapis.com')) url += `${url.includes('?') ? '&' : '?'}key=${apiKey}`;
      const r = await axios.post(url, { model, messages, temperature: 0.8, max_tokens: 2000 }, { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }, timeout: 30000 });
      res.json(r.data);
    } catch (e) { res.status(e.response?.status || 500).json({ error: { message: e.message } }); }
  });

  // Retry helper
  async function withRetry(fn, max = 3, delay = 1000) {
    for (let i = 0; i < max; i++) {
      try { return await fn(); }
      catch (e) {
        if (i === max - 1) throw e;
        // Only retry on network errors or 5xx/429
        const s = e.response?.status;
        if (s && s < 500 && s !== 429) throw e; 
        console.warn(`[Retry ${i+1}/${max}] failing:`, e.message);
        await new Promise(r => setTimeout(r, delay * Math.pow(2, i)));
      }
    }
  }

  // Publish helper
  async function pub(aid, content) {
    let acc;
    if (typeof aid === 'string' || mongoose.isValidObjectId(aid)) { acc = await Account.findById(aid); if (!acc || !acc.isActive) throw new Error('Not found'); } else acc = aid;
    const token = acc.encryptedToken ? dec(acc.encryptedToken) : acc.token;
    const { platform, ownerId } = acc;
    const text = content.text || content.message || '';
    let media = content.media || [];
    if (!media.length && content.attachments) media = content.attachments.split(',').filter(Boolean).map(u => ({ url: u.trim(), type: u.match(/\.(mp4|mov|avi|wmv)$/i) ? 'video' : 'image' }));

    if (platform === 'vk') { const r = await axios.post('https://api.vk.ru/method/wall.post', null, { params: { owner_id: ownerId, message: text, attachments: media.map(m => m.url).join(','), access_token: token, v: '5.199' } }); if (r.data.error) throw new Error(r.data.error.error_msg); return { platform: 'vk', status: 'success', postUrl: `https://vk.com/wall${ownerId}_${r.data.response.post_id}` }; }

    if (platform === 'telegram') {
      const tg = `https://api.telegram.org/bot${token}`;
      const gf = m => { if (!m?.url) return null; if (m.url.startsWith('data:')) { const i = m.url.indexOf(';base64,'); return i !== -1 ? Buffer.from(m.url.slice(i + 8), 'base64') : null; } return m.url; };
      if (!media.length) await axios.post(`${tg}/sendMessage`, { chat_id: ownerId, text, parse_mode: 'HTML' });
      else if (media.length === 1) { const mt = media[0].type === 'video' ? 'sendVideo' : 'sendPhoto', mk = media[0].type === 'video' ? 'video' : 'photo', f = gf(media[0]); if (Buffer.isBuffer(f)) { const form = new FormData(); form.append('chat_id', ownerId); form.append(mk, f, { filename: `media.${media[0].type === 'video' ? 'mp4' : 'jpg'}` }); form.append('caption', text); form.append('parse_mode', 'HTML'); await axios.post(`${tg}/${mt}`, form, { headers: form.getHeaders() }); } else await axios.post(`${tg}/${mt}`, { chat_id: ownerId, [mk]: f, caption: text, parse_mode: 'HTML' }); }
      else { const form = new FormData(); form.append('chat_id', ownerId); const mg = media.slice(0, 10).map((m, i) => { const f = gf(m), ak = `file_${i}`; if (Buffer.isBuffer(f)) form.append(ak, f, { filename: `media_${i}.${m.type === 'video' ? 'mp4' : 'jpg'}` }); return { type: m.type === 'video' ? 'video' : 'photo', media: Buffer.isBuffer(f) ? `attach://${ak}` : m.url, caption: i === 0 ? text : '', parse_mode: 'HTML' }; }); form.append('media', JSON.stringify(mg)); await axios.post(`${tg}/sendMediaGroup`, form, { headers: form.getHeaders() }); }
      return { platform: 'telegram', status: 'success', postUrl: `https://t.me/${ownerId.toString().replace('-100', '')}` };
    }

    if (platform === 'ok') { const ak = acc.okAppKey, sk = dec(acc.okAppSecretKey), ssk = md5(token + sk).toLowerCase(), ao = { media: [{ type: 'text', text }] }; media.forEach(m => ao.media.push({ type: 'photo', url: m.url })); const params = { application_key: ak, attachment: JSON.stringify(ao), format: 'json', method: 'mediatopic.post', type: 'GROUP_THEME', ...(ownerId ? { gid: ownerId } : {}) }; const sig = okSign(params, ssk); const r = await axios.get('https://api.ok.ru/fb.do', { params: { ...params, sig, access_token: token } }); if (r.data.error_code) throw new Error(r.data.error_msg); return { platform: 'ok', status: 'success', postId: r.data }; }

    if (platform === 'twitter') { const td = { text }; if (media.length > 0) { const ids = []; for (const m of media.slice(0, 4)) { try { vUrl(m.url); const dr = await axios.get(m.url, { responseType: 'arraybuffer' }); const form = new FormData(); form.append('media', Buffer.from(dr.data), { filename: m.name || 'image.jpg' }); const ur = await axios.post('https://upload.twitter.com/1.1/media/upload.json', form, { headers: { ...form.getHeaders(), 'Authorization': `Bearer ${token}` } }); if (ur.data.media_id_string) ids.push(ur.data.media_id_string); } catch (e) { } } if (ids.length) td.media = { media_ids: ids }; } const r = await axios.post('https://api.twitter.com/2/tweets', td, { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }); return { platform: 'twitter', status: 'success', postId: r.data.data.id, postUrl: `https://twitter.com/i/status/${r.data.data.id}` }; }

    if (platform === 'tenchat') { const r = await axios.post('https://api.tenchat.ru/v1/posts', { text, attachments: media.map(m => m.url) }, { headers: { Authorization: `Bearer ${token}` } }); return { platform: 'tenchat', status: 'success', postId: r.data.id }; }

    throw new Error(`Unsupported: ${platform}`);
  }

  // Posts
  app.get('/api/posts', async (req, res) => { try { res.json(await Post.find().sort({ scheduledAt: 1 })); } catch (e) { res.status(500).json({ error: e.message }); } });
  app.post('/api/posts', async (req, res) => { try { const p = new Post(req.body); await p.save(); res.json(p); } catch (e) { res.status(500).json({ error: e.message }); } });
  app.patch('/api/posts/:id', async (req, res) => { try { res.json(await Post.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (e) { res.status(500).json({ error: e.message }); } });
  app.delete('/api/posts/:id', async (req, res) => { try { await Post.findByIdAndDelete(req.params.id); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

  // Reposter
  app.get('/api/reposter/rules', async (req, res) => { try { res.json(await RepostRule.find().sort({ createdAt: -1 })); } catch (e) { res.status(500).json({ error: e.message }); } });
  app.post('/api/reposter/rules', async (req, res) => { try { const r = new RepostRule(req.body); await r.save(); res.json(r); } catch (e) { res.status(500).json({ error: e.message }); } });
  app.patch('/api/reposter/rules/:id', async (req, res) => { try { res.json(await RepostRule.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (e) { res.status(500).json({ error: e.message }); } });
  app.delete('/api/reposter/rules/:id', async (req, res) => { try { await RepostRule.findByIdAndDelete(req.params.id); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
  app.get('/api/reposter/history', async (req, res) => { try { res.json(await RepostHistory.find().sort({ publishedAt: -1 }).limit(100)); } catch (e) { res.status(500).json({ error: e.message }); } });
  app.delete('/api/reposter/history', async (req, res) => { try { await RepostHistory.deleteMany({}); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

  // Worker
  async function check() { 
    const now = new Date(); 
    const posts = await Post.find({ status: 'scheduled', scheduledAt: { $lte: now } }).limit(50); 
    for (const p of posts) { 
      const results = []; 
      for (const aid of p.targetAccounts) { 
        try { 
          const r = await withRetry(() => pub(aid, { text: p.text, media: p.media })); 
          results.push({ accountId: aid, ...r, publishedAt: new Date() }); 
        } catch (e) { 
          results.push({ accountId: aid, status: 'error', error: e.message, publishedAt: new Date() }); 
        } 
      } 
      p.status = results.every(r => r.status === 'error') ? 'error' : 'published'; 
      p.results = results; 
      await p.save(); 
    } 
  }
  async function rssRule(rule) { try { const feed = await parser.parseURL(rule.source.url); const items = feed.items.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate)); const item = items[0]; if (!item) return; const uid = item.guid || item.link; if (await RepostHistory.findOne({ sourceUrl: uid }) && rule.skipDuplicates) return; const text = item.contentSnippet || item.content || ''; if (rule.filters.minLength && text.length < rule.filters.minLength) return; let pt = `${item.title}\n\n${text}`; if (rule.addSourceLink) pt += `\n\n🔗 ${item.link}`; if (rule.appendText) pt += `\n\n${rule.appendText}`; const media = []; if (item.enclosure?.url) media.push({ url: item.enclosure.url, type: 'image' }); else { const m = (item.content || '').match(/<img[^>]+src="([^">]+)"/); if (m) media.push({ url: m[1], type: 'image' }); } const results = []; for (const aid of rule.targetAccountIds) { try { const r = await pub(aid, { text: pt, media }); results.push({ accountId: aid, ...r }); } catch (e) { results.push({ accountId: aid, status: 'error', error: e.message }); } } await new RepostHistory({ ruleId: rule._id, sourceUrl: uid, text: pt, results, status: results.some(r => r.status === 'success') ? 'success' : 'error' }).save(); rule.lastCheckedAt = new Date(); await rule.save(); } catch (e) { } }
  async function tgRule(rule) { const u = rule.source.tgUsername.replace('@', ''); const o = rule.source.url; rule.source.url = `https://rsshub.app/telegram/channel/${u}`; await rssRule(rule); rule.source.url = o; }
  async function vkRule(rule) { try { const oid = rule.source.vkOwnerId; let token = rule.source.vkToken; if (!token) { const a = await Account.findOne({ platform: 'vk', isActive: true }); if (a) token = dec(a.encryptedToken); } if (!token) throw new Error('No token'); const r = await axios.get('https://api.vk.ru/method/wall.get', { params: { owner_id: oid, count: 5, access_token: token, v: '5.199' } }); if (r.data.error) throw new Error(r.data.error.error_msg); const items = r.data.response.items; if (!items?.length) return; const item = items.find(i => !i.is_pinned) || items[0]; const uid = `vk_${oid}_${item.id}`; if (await RepostHistory.findOne({ sourceUrl: uid }) && rule.skipDuplicates) return; let text = item.text || ''; if (rule.filters.minLength && text.length < rule.filters.minLength) return; const media = (item.attachments || []).filter(a => a.type === 'photo').map(a => ({ url: a.photo.sizes.slice(-1)[0].url, type: 'image' })); const results = []; for (const aid of rule.targetAccountIds) { try { const r = await pub(aid, { text, media }); results.push({ accountId: aid, ...r }); } catch (e) { results.push({ accountId: aid, status: 'error', error: e.message }); } } await new RepostHistory({ ruleId: rule._id, sourceUrl: uid, text, results, status: results.some(r => r.status === 'success') ? 'success' : 'error' }).save(); rule.lastCheckedAt = new Date(); await rule.save(); } catch (e) { console.error('[vkRule] Error processing rule', rule.name, ':', e.message); } }
  cron.schedule('* * * * *', async () => { try { await check(); const rules = await RepostRule.find({ status: 'active' }); for (const r of rules) { if (r.source.type === 'rss') await rssRule(r); else if (r.source.type === 'vk_wall') await vkRule(r); else if (r.source.type === 'tg_channel') await tgRule(r); } } catch (e) { console.error('[cron] Unexpected error:', e.message); } });

  // Test
  app.get('/api/test/trigger', async (req, res) => { try { await check(); const rules = await RepostRule.find({ status: 'active' }); for (const r of rules) { if (r.source.type === 'rss') await rssRule(r); else if (r.source.type === 'vk_wall') await vkRule(r); else if (r.source.type === 'tg_channel') await tgRule(r); } res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
  app.get('/api/test/telegram', async (req, res) => { try { const { token } = req.query; if (!token) return res.status(400).json({ error: 'Missing' }); const r = await axios.get(`https://api.telegram.org/bot${token}/getMe`); if (r.data.ok) return res.json({ ok: true, name: r.data.result.username }); res.status(400).json({ error: r.data.description }); } catch (e) { res.status(500).json({ error: 'TG error' }); } });

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      time: new Date().toISOString()
    });
  });

  // MongoDB
  if (process.env.MONGO_URI) { mongoose.connect(process.env.MONGO_URI).then(() => console.log('✅ Mongo')).catch(e => console.error('❌ Mongo:', e.message)); }

  // Replace health handler with Express
  server.removeAllListeners('request');
  server.on('request', app);

  console.log('\n🚀 App ready!');
  console.log(`📡 ${HOST}:${PORT}`);
  console.log(`🔐 ${APP_PASSWORD ? '✅' : '⚠️'}`);
  if (APP_PASSWORD === 'changeme_or_configure_env') {
    console.log('   !!! WARNING: Using default insecure password !!!');
  }
  console.log(`🗄️ ${process.env.MONGO_URI ? '✅' : '⚠️'}`);

  // Catch-all
  app.get('*', (req, res) => { const fp = path.join(distPath, 'index.html'); if (fs.existsSync(fp)) res.sendFile(fp); else res.status(200).send('<h1>Backend ok</h1>'); });

  process.on('unhandledRejection', r => console.error('🚨', r));
  process.on('uncaughtException', e => { console.error('🚨', e); process.exit(1); });
})();
