const fs = require('fs');
let c = fs.readFileSync('server.js', 'utf8');

// Change back to Authorization Code Flow for Website app type
c = c.replace(
  'res.redirect(`https://oauth.vk.com/authorize?client_id=${c}&response_type=token&redirect_uri=${encodeURIComponent(r)}&display=page&v=5.199`);',
  'res.redirect(`https://oauth.vk.com/authorize?client_id=${c}&response_type=code&redirect_uri=${encodeURIComponent(r)}&display=page&v=5.199`);'
);

fs.writeFileSync('server.js', c, 'utf8');
console.log('✅ Switched to Authorization Code Flow');
