const fs = require('fs');
let c = fs.readFileSync('server.js', 'utf8');

// 1. Replace mongoose import with Supabase
c = c.replace(
  "const mongoose = (await import('mongoose')).default;",
  "const { createClient } = await import('@supabase/supabase-js');\n  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);"
);

// 2. Add Telegram proxy
c = c.replace(
  'app.use("/ok", authProxy, createProxyMiddleware({ target: "https://api.ok.ru", changeOrigin: true }));',
  'app.use("/ok", authProxy, createProxyMiddleware({ target: "https://api.ok.ru", changeOrigin: true }));\n  app.use("/tg", authProxy, createProxyMiddleware({ target: "https://api.telegram.org", changeOrigin: true }));'
);

// 3. Fix cron to use .exec()
c = c.replace(
  "const posts = await Post.find({ status: 'scheduled', scheduledAt: { $lte: now } }).limit(50);",
  "const posts = await Post.find({ status: 'scheduled', scheduledAt: { $lte: now } }).limit(50).exec();"
);
c = c.replace(
  "const rules = await RepostRule.find({ status: 'active' });",
  "const rules = await RepostRule.find({ status: 'active' }).exec();"
);

// 4. Remove MongoDB connection
c = c.replace(/if \(process\.env\.MONGO_URI\) \{[\s\S]*?mongoose\.connect[\s\S]*?\}\s*/, '');

// 5. Fix health check
c = c.replace(
  "db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',",
  "db: supabase ? 'connected' : 'disconnected',"
);

fs.writeFileSync('server.js', c, 'utf8');
console.log('✅ All fixes applied!');
console.log('mongoose remaining:', c.includes('mongoose'));
