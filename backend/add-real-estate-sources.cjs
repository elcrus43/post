const axios = require('axios');

(async () => {
  const BASE_URL = 'http://localhost:3000';
  
  console.log('🏠 Добавление источников недвижимости\n');

  try {
    // Авторизация
    const loginRes = await axios.post(`${BASE_URL}/api/login`, {
      password: 'pass55184'
    });
    const cookies = loginRes.headers['set-cookie'];

    // Источники которые работают
    const sources = [
      {
        name: 'Lenta.ru - Недвижимость',
        type: 'rss',
        url: 'https://lenta.ru/rss'
      },
      {
        name: 'Google News - Недвижимость Россия',
        type: 'rss',
        url: 'https://news.google.com/rss/search?q=недвижимость+Россия&hl=ru&gl=RU&ceid=RU:ru'
      },
      {
        name: 'Google News - Ипотека',
        type: 'rss',
        url: 'https://news.google.com/rss/search?q=ипотека+Россия&hl=ru&gl=RU&ceid=RU:ru'
      },
      {
        name: 'Google News - Застройщики',
        type: 'rss',
        url: 'https://news.google.com/rss/search?q=застройщики+жк+Россия&hl=ru&gl=RU&ceid=RU:ru'
      }
    ];

    console.log('Добавляем источники:\n');

    for (const source of sources) {
      try {
        const res = await axios.post(`${BASE_URL}/api/news/sources`, source, {
          headers: { Cookie: cookies }
        });
        console.log(`✅ ${source.name}`);
        console.log(`   ID: ${res.data.id}\n`);
      } catch (error) {
        console.log(`❌ ${source.name} - ${error.response?.data?.error || error.message}\n`);
      }
    }

    console.log('\n✅ Готово! Теперь можно парсить новости.');
    console.log('💡 AI автоматически отфильтрует только новости о недвижимости.\n');

  } catch (error) {
    console.error('Ошибка:', error.message);
  }

  process.exit();
})();
