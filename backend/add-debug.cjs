const fs = require('fs');
let c = fs.readFileSync('server.js', 'utf8');

// Add logging to POST /api/accounts
c = c.replace(
  "app.post('/api/accounts', async (req, res) => {\n    try {\n      const { platform, name, token, ownerId, tgBotToken, tgChatId, okAppKey, okAppSecretKey, okGroupId } = req.body;",
  "app.post('/api/accounts', async (req, res) => {\n    try {\n      console.log('[DEBUG] POST /api/accounts body:', JSON.stringify(req.body));\n      const { platform, name, token, ownerId, tgBotToken, tgChatId, okAppKey, okAppSecretKey, okGroupId } = req.body;"
);

fs.writeFileSync('server.js', c, 'utf8');
console.log('✅ Debug logging added');
