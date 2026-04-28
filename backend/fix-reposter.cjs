const fs = require('fs');
let c = fs.readFileSync('server.js', 'utf8');

// Fix POST /api/reposter/rules to normalize keywords
c = c.replace(
  "app.post('/api/reposter/rules', async (req, res) => { try { const r = new RepostRule(req.body); await r.save(); res.json(r); } catch (e) { res.status(500).json({ error: e.message }); } });",
  "app.post('/api/reposter/rules', async (req, res) => { try { const body = { ...req.body, keywords: Array.isArray(req.body.keywords) ? req.body.keywords : [], excludeKeywords: Array.isArray(req.body.excludeKeywords) ? req.body.excludeKeywords : [] }; const r = new RepostRule(body); await r.save(); res.json(r); } catch (e) { res.status(500).json({ error: e.message }); } });"
);

// Fix GET to normalize too
c = c.replace(
  "app.get('/api/reposter/rules', async (req, res) => { try { res.json(await RepostRule.find().sort({ createdAt: -1 })); } catch (e) { res.status(500).json({ error: e.message }); } });",
  "app.get('/api/reposter/rules', async (req, res) => { try { const rules = await RepostRule.find().sort({ createdAt: -1 }); res.json(rules.map(r => ({ ...r.toObject(), keywords: Array.isArray(r.keywords) ? r.keywords : [], excludeKeywords: Array.isArray(r.excludeKeywords) ? r.excludeKeywords : [] })))); } catch (e) { res.status(500).json({ error: e.message }); } });"
);

fs.writeFileSync('server.js', c, 'utf8');
console.log('Fixed keywords normalization');
