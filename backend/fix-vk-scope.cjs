const fs = require('fs');
let c = fs.readFileSync('server.js', 'utf8');

// Fix VK OAuth scope - use correct permission bits for Standalone app
// 4194304 = wall, 262144 = photos, 134217728 = groups
c = c.replace(
  'scope=466972',
  'scope=4194304,262144,134217728,offline'
);

fs.writeFileSync('server.js', c, 'utf8');
console.log('✅ Fixed VK OAuth scope');
