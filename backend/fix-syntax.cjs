const fs = require('fs');
let c = fs.readFileSync('server.js', 'utf8');

// Fix - remove toObject() call
c = c.replace(
  "res.json(rules.map(r => ({ ...r.toObject(), keywords: Array.isArray(r.keywords) ? r.keywords : [], excludeKeywords: Array.isArray(r.excludeKeywords) ? r.excludeKeywords : [] }))));",
  "res.json(rules.map(r => ({ ...r, keywords: Array.isArray(r.keywords) ? r.keywords : [], excludeKeywords: Array.isArray(r.excludeKeywords) ? r.excludeKeywords : [] }))));"
);

fs.writeFileSync('server.js', c, 'utf8');
console.log('Fixed syntax error');
