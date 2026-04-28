const fs = require('fs');
let c = fs.readFileSync('server.js', 'utf8');

// Replace VK auth route - redirect directly to frontend for Implicit Flow
c = c.replace(
  'app.get(\'/api/auth/vk\', (req, res) => {\n    const { VK_CLIENT_ID: c, VK_REDIRECT_URI: r } = process.env;\n    if (!c || !r) return res.status(500).json({ error: \'VK not configured\' });\n    res.redirect(`https://oauth.vk.com/authorize?client_id=${c}&response_type=token&redirect_uri=${encodeURIComponent(r)}&display=page&v=5.199`);\n  });',
  'app.get(\'/api/auth/vk\', (req, res) => {\n    const { VK_CLIENT_ID: c, VK_REDIRECT_URI: r } = process.env;\n    if (!c || !r) return res.status(500).json({ error: \'VK not configured\' });\n    // Standalone app: redirect to frontend, which will handle Implicit Flow\n    res.redirect(`https://oauth.vk.com/authorize?client_id=${c}&response_type=token&redirect_uri=${encodeURIComponent(r)}&display=page&v=5.199`);\n  });\n\n  // VK token handler for Implicit Flow\n  app.post(\'/api/auth/vk/token\', async (req, res) => {\n    try {\n      const { access_token, user_id } = req.body;\n      if (!access_token || !user_id) return res.status(400).json({ error: \'Missing token\' });\n      const u = await axios.get(\'https://api.vk.com/method/users.get\', { params: { access_token, v: \'5.199\', fields: \'photo_100\' } });\n      const name = `${u.data.response[0].first_name} ${u.data.response[0].last_name}`;\n      let a = await Account.findOne({ platform: \'vk\', ownerId: String(user_id) });\n      if (a) { a.name = name; a.encryptedToken = enc(access_token); a.isActive = true; await a.save(); }\n      else { a = new Account({ platform: \'vk\', name, ownerId: String(user_id), encryptedToken: enc(access_token), isActive: true, createdAt: new Date() }); await a.save(); }\n      res.json({ success: true });\n    } catch (e) { console.error(\'VK:\', e.message); res.status(500).json({ error: \'VK error\' }); }\n  });'
);

fs.writeFileSync('server.js', c, 'utf8');
console.log('✅ Added VK token handler for Implicit Flow');
