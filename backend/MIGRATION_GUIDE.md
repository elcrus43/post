# Supabase Migration Guide

## Changes needed in server.js:

### 1. Replace MongoDB imports (line 69):
REMOVE: const mongoose = (await import('mongoose')).default;
ADD: const { createClient } = await import('@supabase/supabase-js');

### 2. Add Supabase initialization (after line 69):
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
console.log('✅ Supabase initialized');

### 3. Replace MongoDB models with Supabase queries:

REMOVE Mongoose models (lines 115-145):
- Account model
- Post model  
- RepostRule model

ADD Supabase helper functions:
\\\javascript
// Helper to convert Supabase response
const toMongoFormat = (data) => data.map(x => ({...x, _id: x.id}));

// Accounts
const Account = {
  find: () => supabase.from('accounts').select('*'),
  findById: (id) => supabase.from('accounts').select('*').eq('id', id).single(),
  save: async (doc) => {
    if (doc._id) {
      return supabase.from('accounts').update(doc).eq('id', doc._id);
    }
    return supabase.from('accounts').insert([doc]);
  }
};

// Posts
const Post = {
  find: () => supabase.from('posts').select('*'),
  findById: (id) => supabase.from('posts').select('*').eq('id', id).single(),
  save: async (doc) => {
    if (doc._id) {
      return supabase.from('posts').update(doc).eq('id', doc._id);
    }
    return supabase.from('posts').insert([doc]);
  }
};
\\\

### 4. Remove MongoDB connection (line 507):
REMOVE: if (process.env.MONGO_URI) { mongoose.connect... }

### 5. Replace all .find(), .findById(), .save() calls:
- .find() → .select('*')
- .findById(id) → .select('*').eq('id', id).single()
- .save() → .insert() or .update()

## Total changes: ~50 locations
## Estimated time: 2-3 hours manual edit

Or use AI assistant (Claude, GPT-4) with full file access to automate this.
