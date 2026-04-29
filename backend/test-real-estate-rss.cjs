// Тест RSS источников по недвижимости
const Parser = require('rss-parser');
const parser = new Parser();

const realEstateSources = [
  { name: 'РБК Недвижимость', url: 'https://www.rbc.ru/reality/rss/' },
  { name: 'IRN.ru', url: 'https://www.irn.ru/rss/' },
  { name: 'Move.ru', url: 'https://www.move.ru/rss/' },
  { name: 'Cian.ru', url: 'https://www.cian.ru/rss/' },
  { name: 'Lenta.ru (фильтр по недвижимости)', url: 'https://lenta.ru/rss' }
];

console.log('🏠 Тестирование RSS источников по недвижимости\n');

(async () => {
  let workingSources = [];

  for (const source of realEstateSources) {
    try {
      console.log(`📡 Тестируем: ${source.name}`);
      console.log(`   URL: ${source.url}`);
      
      const feed = await parser.parseURL(source.url);
      console.log(`✅ Успешно! Найдено ${feed.items.length} новостей`);
      
      // Ищем новости о недвижимости
      const realEstateItems = feed.items.filter(item => {
        const text = ((item.title || '') + ' ' + (item.contentSnippet || '')).toLowerCase();
        return text.includes('недвижим') || 
               text.includes('квартир') || 
               text.includes('ипотек') ||
               text.includes('жк ') ||
               text.includes('стройк') ||
               text.includes('риэлт');
      });

      if (realEstateItems.length > 0) {
        console.log(`   🏠 Новостей о недвижимости: ${realEstateItems.length}`);
        console.log(`   Пример: ${realEstateItems[0].title}\n`);
      } else {
        console.log(`   ⚠️ Новостей о недвижимости не найдено (будем фильтровать AI)\n`);
      }

      workingSources.push(source);
      
    } catch (error) {
      console.log(`❌ Ошибка: ${error.message}\n`);
    }
  }

  console.log('\n✅ РАБОЧИЕ ИСТОЧНИКИ:');
  workingSources.forEach((s, i) => {
    console.log(`${i + 1}. ${s.name} - ${s.url}`);
  });

  console.log('\n📋 Рекомендация:');
  console.log('Добавьте эти источники через интерфейс приложения.');
  console.log('AI будет автоматически фильтровать только новости о недвижимости.\n');

  process.exit();
})();
