const axios = require('axios');

(async () => {
  const url = 'https://cpxnhuqvjvzkoulnrpuj.supabase.co';
  const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNweG5odXF2anZ6a291bG5ycHVqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjY1NzYxNSwiZXhwIjoyMDkyMjMzNjE1fQ.Oz6IDo7qv4Urp5I7aOLlD2S5uIqXWhWQCfJ-kgZ9yD4';

  console.log('⚠️ Please create these tables manually in Supabase Dashboard:');
  console.log('\n1. Go to: https://supabase.com/dashboard/project/cpxnhuqvjvzkoulnrpuj/editor');
  console.log('\n2. Run this SQL in SQL Editor:\n');
  console.log(`
CREATE TABLE IF NOT EXISTS news_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'rss',
  url TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  items_found INTEGER DEFAULT 0,
  last_parsed TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS news_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  preview TEXT,
  content TEXT,
  category TEXT DEFAULT 'news',
  status TEXT DEFAULT 'queued',
  source TEXT,
  source_icon TEXT,
  source_url TEXT,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  tags JSONB DEFAULT '[]',
  scheduled_for TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_sources_enabled ON news_sources(enabled);
CREATE INDEX IF NOT EXISTS idx_news_items_status ON news_items(status);
CREATE INDEX IF NOT EXISTS idx_news_items_category ON news_items(category);
  `);

  // Try to create sample source
  try {
    const res = await axios.post(
      url + '/rest/v1/news_sources',
      {
        name: 'РИА Новости',
        type: 'rss',
        url: 'https://ria.ru/rss',
        enabled: true,
        items_found: 0
      },
      {
        headers: {
          apikey: key,
          Authorization: 'Bearer ' + key,
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
      }
    );
    console.log('✅ Sample source created:', res.data);
  } catch (e) {
    console.log('ℹ️ Table might not exist yet. Create it using the SQL above.');
  }

  process.exit();
})();
