const fs = require('fs');
let c = fs.readFileSync('server.js', 'utf8');

// Fix mongoose.isValidObjectId
c = c.replace(
  "if (typeof aid === 'string' || mongoose.isValidObjectId(aid)) { acc = await Account.findById(aid); if (!acc || !acc.isActive) throw new Error('Not found'); } else acc = aid;",
  "if (typeof aid === 'string') { acc = await Account.findById(aid); if (!acc || !acc.isActive) throw new Error('Not found'); } else acc = aid;"
);

fs.writeFileSync('server.js', c, 'utf8');
console.log('✅ Fixed last mongoose!');
console.log('mongoose remaining:', c.includes('mongoose'));
