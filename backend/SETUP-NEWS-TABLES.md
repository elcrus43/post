# Setup News Tables in Supabase

## ✅ What's New:

**News and News Sources are now combined into ONE tab!**
- Clean, modern unified interface
- Two sections: "Лента новостей" (News Feed) and "Источники" (Sources)
- Easy switching between managing sources and viewing news
- Full RSS parsing with database storage

## Steps:

1. **Open Supabase Dashboard:**
   https://supabase.com/dashboard/project/cpxnhuqvjvzkoulnrpuj/editor

2. **Go to SQL Editor** (left sidebar)

3. **Copy and paste this SQL:**

```sql
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

-- Insert sample sources
INSERT INTO news_sources (name, type, url, enabled) VALUES
('РИА Новости', 'rss', 'https://ria.ru/rss', true),
('Lenta.ru', 'rss', 'https://lenta.ru/rss', true),
('Газета.ru', 'rss', 'https://www.gazeta.ru/export/rss/recent.shtml', true);
```

4. **Click "Run" button**

5. **Done!** The unified News page will now work with both sources and feed.

## Features:

✅ **Unified Interface** - One tab for everything news-related
✅ **Source Management** - Add, enable/disable, parse, delete RSS sources
✅ **News Feed** - View, filter, send, skip, or restore news items
✅ **RSS Parsing** - Automatically fetch and parse RSS feeds
✅ **Database Storage** - All news items saved to Supabase
✅ **Modern Design** - Clean, intuitive UI with proper styling
✅ **Batch Operations** - Parse all sources at once
✅ **Filtering** - Filter news by category and status
