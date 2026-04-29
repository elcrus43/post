// Простой тест RSS парсинга
const Parser = require('rss-parser');
const parser = new Parser();

(async () => {
  const urls = [
    'https://ria.ru/rss',
    'https://lenta.ru/rss',
    'https://www.gazeta.ru/export/rss/recent.shtml',
    'https://news.google.com/rss?hl=ru&gl=RU&ceid=RU:ru'
  ];

  console.log('🧪 Тестирование RSS источников\n');

  for (const url of urls) {
    try {
      console.log(`📡 Тестируем: ${url}`);
      const feed = await parser.parseURL(url);
      console.log(`✅ Успешно! Найдено ${feed.items.length} новостей`);
      
      if (feed.items.length > 0) {
        const item = feed.items[0];
        console.log(`   Первая новость: ${item.title}`);
        console.log(`   Дата: ${item.pubDate}\n`);
      }
      
    } catch (error) {
      console.log(`❌ Ошибка: ${error.message}\n`);
    }
  }

  process.exit();
})();
