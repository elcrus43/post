const Parser = require('rss-parser');
const parser = new Parser();

(async () => {
  const vedomostiUrl = 'https://www.vedomosti.ru/rss/rubric/realty.xml';
  
  console.log('🏠 Тестирование Vedomosti RSS\n');
  console.log('URL:', vedomostiUrl, '\n');

  try {
    const feed = await parser.parseURL(vedomostiUrl);
    
    console.log('✅ RSS работает!');
    console.log('Название:', feed.title);
    console.log('Найдено новостей:', feed.items.length, '\n');
    
    if (feed.items.length > 0) {
      console.log('📰 Первые 5 новостей:\n');
      feed.items.slice(0, 5).forEach((item, i) => {
        console.log(`${i + 1}. ${item.title}`);
        console.log(`   Дата: ${item.pubDate}`);
        console.log(`   Ссылка: ${item.link}`);
        console.log(`   Превью: ${(item.contentSnippet || '').substring(0, 100)}...`);
        console.log('');
      });
    }
    
    console.log('✅ Vedomosti RSS готов к использованию!\n');
    
  } catch (error) {
    console.log('❌ Ошибка:', error.message, '\n');
  }

  process.exit();
})();
