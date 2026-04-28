const fs = require('fs');
let c = fs.readFileSync('server.js', 'utf8');

// For Standalone VK app: use response_type=token (Implicit Flow) without scope
c = c.replace(
  'res.redirect(`https://oauth.vk.com/authorize?client_id=${c}&response_type=code&redirect_uri=${encodeURIComponent(r)}&scope=4194304,262144,134217728,offline&state=${genS()}`);',
  'res.redirect(`https://oauth.vk.com/authorize?client_id=${c}&response_type=token&redirect_uri=${encodeURIComponent(r)}&display=page&v=5.199`);'
);

fs.writeFileSync('server.js', c, 'utf8');
console.log('✅ Fixed VK OAuth for Standalone app (Implicit Flow)');
