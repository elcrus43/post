const fs = require('fs');
let lines = fs.readFileSync('server.js', 'utf8').split('\n');

// Find line numbers
const startIdx = lines.findIndex(l => l.includes('// Schemas'));
const endIdx = lines.findIndex(l => l.includes('// Auth middleware'));

if (startIdx === -1 || endIdx === -1) {
  console.log('Lines not found:', startIdx, endIdx);
  process.exit(1);
}

console.log('Replacing lines', startIdx+1, 'to', endIdx);

const newBlock = [
  '  // Supabase helpers',
  '  const fromDb = row => {',
  '    if (!row) return null;',
  '    const out = {};',
  '    for (const [k, v] of Object.entries(row)) {',
  '      out[k.replace(/([A-Z])/g, \'_$1\').toLowerCase()] = v;',
  '    }',
  '    out._id = row.id;',
  '    return out;',
  '  };',
  '  const toDb = obj => {',
  '    const out = {};',
  '    for (const [k, v] of Object.entries(obj || {})) {',
  '      if (k.startsWith(\'_\') || k === \'id\') continue;',
  '      out[k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = v;',
  '    }',
  '    return out;',
  '  };',
  '  const makeModel = table => class {',
  '    static table = table;',
  '    constructor(d = {}) { Object.assign(this, d); }',
  '    static find(filter = {}) {',
  '      const self = this;',
  '      let query = supabase.from(table).select(\'*\');',
  '      let _sortField = null, _sortAsc = true, _limit = null;',
  '      for (const [k, v] of Object.entries(filter || {})) {',
  '        const field = k.replace(/([A-Z])/g, \'_$1\').toLowerCase();',
  '        if (v && typeof v === \'object\' && \'$lte\' in v) query = query.lte(field, v.$lte);',
  '        else if (v && typeof v === \'object\' && \'$lt\' in v) query = query.lt(field, v.$lt);',
  '        else if (v && typeof v === \'object\' && \'$gte\' in v) query = query.gte(field, v.$gte);',
  '        else if (v && typeof v === \'object\' && \'$gt\' in v) query = query.gt(field, v.$gt);',
  '        else query = query.eq(field, v);',
  '      }',
  '      const builder = {',
  '        sort: (s) => {',
  '          const [sk, dir] = Object.entries(s)[0] || [];',
  '          if (sk) { _sortField = sk; _sortAsc = dir !== -1; }',
  '          return builder;',
  '        },',
  '        limit: (n) => { _limit = n; return builder; },',
  '        exec: async () => {',
  '          let q = query;',
  '          if (_sortField) q = q.order(_sortField.replace(/([A-Z])/g, \'_$1\').toLowerCase(), { ascending: _sortAsc });',
  '          if (_limit) q = q.limit(_limit);',
  '          const { data } = await q;',
  '          return (data || []).map(x => new self(fromDb(x)));',
  '        }',
  '      };',
  '      return builder;',
  '    }',
  '    static async findOne(filter = {}) {',
  '      const rows = await this.find(filter).limit(1).exec();',
  '      return rows[0] || null;',
  '    }',
  '    static async findById(id) {',
  '      const { data } = await supabase.from(table).select(\'*\').eq(\'id\', id).single();',
  '      return data ? new this(fromDb(data)) : null;',
  '    }',
  '    static async findByIdAndDelete(id) {',
  '      await supabase.from(table).delete().eq(\'id\', id);',
  '    }',
  '    static async findByIdAndUpdate(id, patch, opts = {}) {',
  '      const { data } = await supabase.from(table).update(toDb(patch)).eq(\'id\', id).select().single();',
  '      if (!data) return null;',
  '      return opts.new ? new this(fromDb(data)) : null;',
  '    }',
  '    static async create(data) {',
  '      const doc = new this(data);',
  '      await doc.save();',
  '      return doc;',
  '    }',
  '    async save() {',
  '      const db = toDb(this);',
  '      if (this._id || this.id) {',
  '        const { data } = await supabase.from(this.constructor.table).update(db).eq(\'id\', this._id || this.id).select().single();',
  '        if (data) Object.assign(this, fromDb(data));',
  '      } else {',
  '        const { data } = await supabase.from(this.constructor.table).insert([db]).select().single();',
  '        if (data) Object.assign(this, fromDb(data));',
  '      }',
  '      return this;',
  '    }',
  '  };',
  '  const Account = makeModel(\'accounts\');',
  '  const Post = makeModel(\'posts\');',
  '  const RepostRule = makeModel(\'repost_rules\');',
  '  const RepostHistory = makeModel(\'repost_history\');',
  '  const OAuthState = makeModel(\'oauth_states\');'
];

// Replace lines from startIdx to endIdx-1
lines.splice(startIdx, endIdx - startIdx, ...newBlock);

fs.writeFileSync('server.js', lines.join('\n'), 'utf8');
console.log('✅ Replaced!');
