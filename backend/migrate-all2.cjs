const fs = require('fs');
let c = fs.readFileSync('server.js', 'utf8');

// Replace mongoose import
const oldImport = `const mongoose = (await import('mongoose')).default;`;
const newImport = `const { createClient } = await import('@supabase/supabase-js');\n  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);\n  console.log('✅ Supabase initialized');`;
c = c.replace(oldImport, newImport);

// Replace ALL mongoose schemas block (from // Schemas to next comment)
const schemaRegex = /\/\/ Schemas\nconst Account = mongoose\.model\('Account', new mongoose\.Schema\(\{[\s\S]*?\}\)\);[\s\S]*?const OAuthState = mongoose\.model\('OAuthState', new mongoose\.Schema\(\{[\s\S]*?\}\)\);/;

const newModel = `// Supabase helpers
  const fromDb = row => {
    if (!row) return null;
    const out = {};
    for (const [k, v] of Object.entries(row)) {
      out[k.replace(/([A-Z])/g, '_$1').toLowerCase()] = v;
    }
    out._id = row.id;
    return out;
  };
  const toDb = obj => {
    const out = {};
    for (const [k, v] of Object.entries(obj || {})) {
      if (k.startsWith('_') || k === 'id') continue;
      out[k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = v;
    }
    return out;
  };
  const makeModel = table => class {
    static table = table;
    constructor(d = {}) { Object.assign(this, d); }
    static find(filter = {}) {
      const self = this;
      let query = supabase.from(table).select('*');
      let _sortField = null, _sortAsc = true, _limit = null;
      for (const [k, v] of Object.entries(filter || {})) {
        const field = k.replace(/([A-Z])/g, '_$1').toLowerCase();
        if (v && typeof v === 'object' && '$lte' in v) query = query.lte(field, v.$lte);
        else if (v && typeof v === 'object' && '$lt' in v) query = query.lt(field, v.$lt);
        else if (v && typeof v === 'object' && '$gte' in v) query = query.gte(field, v.$gte);
        else if (v && typeof v === 'object' && '$gt' in v) query = query.gt(field, v.$gt);
        else query = query.eq(field, v);
      }
      const builder = {
        sort: (s) => {
          const [sk, dir] = Object.entries(s)[0] || [];
          if (sk) { _sortField = sk; _sortAsc = dir !== -1; }
          return builder;
        },
        limit: (n) => { _limit = n; return builder; },
        exec: async () => {
          let q = query;
          if (_sortField) q = q.order(_sortField.replace(/([A-Z])/g, '_$1').toLowerCase(), { ascending: _sortAsc });
          if (_limit) q = q.limit(_limit);
          const { data } = await q;
          return (data || []).map(x => new self(fromDb(x)));
        }
      };
      return builder;
    }
    static async findOne(filter = {}) {
      const rows = await this.find(filter).limit(1).exec();
      return rows[0] || null;
    }
    static async findById(id) {
      const { data } = await supabase.from(table).select('*').eq('id', id).single();
      return data ? new this(fromDb(data)) : null;
    }
    static async findByIdAndDelete(id) {
      await supabase.from(table).delete().eq('id', id);
    }
    static async findByIdAndUpdate(id, patch, opts = {}) {
      const { data } = await supabase.from(table).update(toDb(patch)).eq('id', id).select().single();
      if (!data) return null;
      return opts.new ? new this(fromDb(data)) : null;
    }
    static async create(data) {
      const doc = new this(data);
      await doc.save();
      return doc;
    }
    async save() {
      const db = toDb(this);
      if (this._id || this.id) {
        const { data } = await supabase.from(this.constructor.table).update(db).eq('id', this._id || this.id).select().single();
        if (data) Object.assign(this, fromDb(data));
      } else {
        const { data } = await supabase.from(this.constructor.table).insert([db]).select().single();
        if (data) Object.assign(this, fromDb(data));
      }
      return this;
    }
  };
  const Account = makeModel('accounts');
  const Post = makeModel('posts');
  const RepostRule = makeModel('repost_rules');
  const RepostHistory = makeModel('repost_history');
  const OAuthState = makeModel('oauth_states');`;

c = c.replace(schemaRegex, newModel);

// Add Telegram proxy
const oldProxy = `app.use("/ok", authProxy, createProxyMiddleware({ target: "https://api.ok.ru", changeOrigin: true }));`;
const newProxy = `app.use("/ok", authProxy, createProxyMiddleware({ target: "https://api.ok.ru", changeOrigin: true }));\n  app.use("/tg", authProxy, createProxyMiddleware({ target: "https://api.telegram.org", changeOrigin: true }));`;
c = c.replace(oldProxy, newProxy);

// Increase rate limits
c = c.replace('max: 100,', 'max: 1000,');
c = c.replace('max: 10,', 'max: 100,');

// Fix cron to use .exec()
c = c.replace(
  'const posts = await Post.find({ status: \'scheduled\', scheduledAt: { $lte: now } }).limit(50);',
  'const posts = await Post.find({ status: \'scheduled\', scheduledAt: { $lte: now } }).limit(50).exec();'
);
c = c.replace(
  'const rules = await RepostRule.find({ status: \'active\' });',
  'const rules = await RepostRule.find({ status: \'active\' }).exec();'
);

// Remove MongoDB connection
c = c.replace(
  /if \(process\.env\.MONGO_URI\) \{[^}]*mongoose\.connect[^}]*\}\s*/g,
  '// Using Supabase instead of MongoDB\n'
);

// Fix health check
c = c.replace(
  `db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',`,
  `db: supabase ? 'connected' : 'disconnected',`
);

fs.writeFileSync('server.js', c, 'utf8');
console.log('✅ Migration complete!');
console.log('mongoose found:', c.includes('mongoose'));
