#!/bin/bash
cd /c/Users/Office-40/post-project

# Create news API endpoints file
cat > backend/news-api.cjs << 'EOFAPI'
const axios = require('axios');
const Parser = require('rss-parser');

const parser = new Parser();

// News sources to parse
const NEWS_SOURCES = [
  {
    name: 'Vedomosti Realty',
    url: 'https://www.vedomosti.ru/rss/rubric/realty.xml',
    icon: '📰',
    type: 'rss'
  },
  {
    name: 'Cian',
    url: 'https://www.cian.ru/rss/news/',
    icon: '🏠',
    type: 'rss'
  },
  {
    name: 'RBC Realty',
    url: 'https://www.rbc.ru/rss/realestate.xml',
    icon: '📊',
    type: 'rss'
  }
];

// In-memory news store (can be replaced with Supabase)
let newsStore = [];
let newsId = 1;

function categorizeNews(title, description) {
  const text = (title + ' ' + description).toLowerCase();
  if (text.includes('закон') || text.includes('правительство') || text.includes('министр')) {
    return 'law';
  }
  if (text.includes('анализ') || text.includes('прогноз') || text.includes('рынок') || text.includes('статистик')) {
    return 'market';
  }
  if (text.includes('соцсет') || text.includes('telegram') || text.includes('vk')) {
    return 'social';
  }
  if (text.includes('факт') || text.includes('открыт') || text.includes('запусти')) {
    return 'fact';
  }
  return 'news';
}

function extractTags(title, description) {
  const text = (title + ' ' + description).toLowerCase();
  const tags = [];
  if (text.includes('квартир')) tags.push('квартиры');
  if (text.includes('новостройк')) tags.push('новостройки');
  if (text.includes('ипотек')) tags.push('ипотека');
  if (text.includes('строен') || text.includes('застройщик')) tags.push('застройщики');
  if (text.includes('киров')) tags.push('киров');
  if (tags.length === 0) tags.push('недвижимость');
  return tags.slice(0, 5);
}

async function parseRSS(source) {
  try {
    const feed = await parser.parseURL(source.url);
    const items = feed.items.slice(0, 10).map(item => ({
      id: 'news_' + (newsId++),
      category: categorizeNews(item.title, item.contentSnippet || ''),
      title: item.title,
      source: source.name,
      sourceIcon: source.icon,
      date: item.isoDate || new Date().toISOString(),
      preview: item.contentSnippet || item.title,
      fullText: item.content || item.contentSnippet || '',
      url: item.link || '',
      tags: extractTags(item.title, item.contentSnippet || ''),
      status: 'queued'
    }));
    return items;
  } catch (e) {
    console.error('[News] Error parsing', source.name, ':', e.message);
    return [];
  }
}

async function parseAllNews() {
  const allNews = [];
  for (const source of NEWS_SOURCES) {
    const items = await parseRSS(source);
    allNews.push(...items);
  }
  // Add to store (keep last 100)
  newsStore = [...allNews, ...newsStore].slice(0, 100);
  return allNews;
}

function setupNewsApi(app) {
  // Get all news
  app.get('/api/news', (req, res) => {
    res.json(newsStore);
  });

  // Parse news now
  app.post('/api/news/parse', async (req, res) => {
    try {
      const items = await parseAllNews();
      res.json({ success: true, count: items.length, items });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Action on news (send/skip/restore)
  app.post('/api/news/:id/action', (req, res) => {
    const { id } = req.params;
    const { action } = req.body;
    const news = newsStore.find(n => n.id === id);
    if (!news) {
      return res.status(404).json({ error: 'News not found' });
    }
    news.status = action;
    res.json({ success: true, news });
  });

  console.log('[News] API endpoints registered');
}

module.exports = { setupNewsApi, parseAllNews };
EOFAPI

echo "✅ News API created"
