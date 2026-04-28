const fs = require('fs');
let lines = fs.readFileSync('server.js', 'utf8').split('\n');

// Remove wrong lines 117-118 (await inside find)
lines.splice(116, 2); // Remove lines 117 and 118

// Now line 117 is findOne, fix it
lines[117] = '    static async findOne(filter = {}) {';
lines[118] = '      const rows = await this.find(filter).limit(1).exec();';
lines[119] = '      return rows[0] || null;';
lines[120] = '    }';

fs.writeFileSync('server.js', lines.join('\n'), 'utf8');
console.log('Fixed!');
