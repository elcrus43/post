const fs = require('fs');
let c = fs.readFileSync('server.js', 'utf8');

// Fix POST /api/accounts response to include encryptedToken
c = c.replace(
  "res.json({ id: a._id, platform, name, ownerId: fo, tgBotToken: ft, tgChatId: fo, isActive: a.isActive, createdAt: a.createdAt });",
  "res.json({ id: a._id || a.id, platform, name, ownerId: fo, encryptedToken: a.encryptedToken, tgBotToken: ft, tgChatId: fo, okAppKey: a.okAppKey, okAppSecretKey: a.okAppSecretKey, okGroupId: a.okGroupId, isActive: a.isActive, createdAt: a.createdAt });"
);

fs.writeFileSync('server.js', c, 'utf8');
console.log('✅ Fixed!');
