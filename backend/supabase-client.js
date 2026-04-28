// Supabase client initialization
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('✅ Supabase initialized');
} else {
  console.warn('⚠️ Supabase credentials missing');
}

// MongoDB compatibility layer
const db = {
  accounts: {
    find: async () => {
      const { data, error } = await supabase.from('accounts').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    findById: async (id) => {
      const { data, error } = await supabase.from('accounts').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    save: async (doc) => {
      if (doc._id) {
        const { data, error } = await supabase.from('accounts').update(doc).eq('id', doc._id);
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase.from('accounts').insert([doc]).select();
        if (error) throw error;
        return data[0];
      }
    }
  },
  posts: {
    find: async () => {
      const { data, error } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  }
};

export { supabase, db };
