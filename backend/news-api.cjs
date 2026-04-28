const axios = require('axios');
const Parser = require('rss-parser');

const parser = new Parser();

// In-memory stores
let newsSources = [];
let newsStore = [];
let sourceId = 1;
let newsId = 1;

function categorizeNews(title, description) {
  const text = (title + ' ' + description).toLowerCase();
  if (text.includes('закон') || text.includes('правительство')) return 'law';
  if (text.includes('анализ') || text.includes('рынок')) return 'market';
  if (text.includes('соцсет') || text.includes('telegram')) return 'social';
  return 'news';
}

function extractTags(title, description) {
  const text = (title + ' ' + description).toLowerCase();
  const tags = [];
  if (text.includes('квартир')) tags.push('квартиры');
  if (text.includes('новостройк')) tags.push('новостройки');
  if (text.includes('киров')) tags.push('киров');
  if (tags.length === 0) tags.push('недвижимость');
  return tags.slice(0, 5);
}

async function parseRSS(url) {
  try {
    const feed = await parser.parseURL(url);
    return feed.items.slice(0, 10).map(item => ({
      id: 'news_' + (newsId++),
      category: categorizeNews(item.title, item.contentSnippet || ''),
      title: item.title,
      source: '',
      sourceIcon: '??',
      date: item.isoDate || new Date().toISOString(),
      preview: item.contentSnippet || item.title,
      fullText: item.content || '',
      url: item.link || '',
      tags: extractTags(item.title, item.contentSnippet || ''),
      status: 'queued'
    }));
  } catch (e) {
    console.error('[News] RSS parse error:', e.message);
    return [];
  }
}

function setupNewsApi(app) {
  // ===== SOURCES API =====
  
  // Get all sources
  app.get('/api/news/sources', (req, res) => {
    res.json(newsSources);
  });

  // Add source
  app.post('/api/news/sources', (req, res) => {
    const { name, type, url } = req.body;
    if (!name || !url) {
      return res.status(400).json({ error: 'Name and URL required' });
    }
    const source = {
      id: 'src_' + (sourceId++),
      name,
      type: type || 'rss',
      url,
      enabled: true,
      createdAt: new Date().toISOString()
    };
    newsSources.push(source);
    res.json(source);
  });

  // Delete source
  app.delete('/api/news/sources/:id', (req, res) => {
    const { id } = req.params;
    newsSources = newsSources.filter(s => s.id !== id);
    res.json({ success: true });
  });

  // Toggle source
  app.patch('/api/news/sources/:id', (req, res) => {
    const { id } = req.params;
    const { enabled } = req.body;
    const source = newsSources.find(s => s.id === id);
    if (!source) {
      return res.status(404).json({ error: 'Source not found' });
    }
    source.enabled = enabled;
    res.json(source);
  });

  // Parse specific source
  app.post('/api/news/sources/:id/parse', async (req, res) => {
    const { id } = req.params;
    const source = newsSources.find(s => s.id === id);
    if (!source) {
      return res.status(404).json({ error: 'Source not found' });
    }
    if (!source.enabled) {
      return res.status(400).json({ error: 'Source disabled' });
    }

    try {
      let items = [];
      if (source.type === 'rss') {
        items = await parseRSS(source.url);
      } else {
        return res.status(400).json({ error: 'Only RSS supported for now' });
      }
      
      // Update source with parsed items
      source.lastParsed = new Date().toISOString();
      source.itemsCount = (source.itemsCount || 0) + items.length;
      
      // Add items source name
      items.forEach(item => {
        item.source = source.name;
        newsStore.unshift(item);
      });
      
      // Keep last 100 items
      newsStore = newsStore.slice(0, 100);
      
      res.json({ success: true, count: items.length });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ===== NEWS API =====
  
  // Get all news
  app.get('/api/news', (req, res) => {
    res.json(newsStore);
  });

  // Parse all enabled sources
  app.post('/api/news/parse', async (req, res) => {
    const enabledSources = newsSources.filter(s => s.enabled);
    let totalCount = 0;
    
    for (const source of enabledSources) {
      if (source.type === 'rss') {
        const items = await parseRSS(source.url);
        items.forEach(item => {
          item.source = source.name;
          newsStore.unshift(item);
        });
        source.lastParsed = new Date().toISOString();
        source.itemsCount = (source.itemsCount || 0) + items.length;
        totalCount += items.length;
      }
    }
    
    newsStore = newsStore.slice(0, 100);
    res.json({ success: true, count: totalCount });
  });

  // News action
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

module.exports = { setupNewsApi };
