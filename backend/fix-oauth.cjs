const fs = require('fs');
let c = fs.readFileSync('server.js', 'utf8');

// Fix duplicate Telegram proxy (keep only one)
c = c.replace(
  'app.use("/tg", authProxy, createProxyMiddleware({ target: "https://api.telegram.org", changeOrigin: true }));\n  app.use("/tg", authProxy, createProxyMiddleware({ target: "https://api.telegram.org", changeOrigin: true }));\n  app.use("/tg", authProxy, createProxyMiddleware({ target: "https://api.telegram.org", changeOrigin: true }));',
  'app.use("/tg", authProxy, createProxyMiddleware({ target: "https://api.telegram.org", changeOrigin: true }));'
);

// Fix VK OAuth URL (use oauth.vk.com instead of id.vk.com)
c = c.replace(
  'https://id.vk.com/auth?app_id=',
  'https://oauth.vk.com/authorize?client_id='
);
c = c.replace(
  'https://id.vk.com/oauth2/auth',
  'https://oauth.vk.com/access_token'
);

fs.writeFileSync('server.js', c, 'utf8');
console.log('✅ Fixed duplicates and VK OAuth URLs');
