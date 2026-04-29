const axios = require('axios');

(async () => {
  const BASE_URL = 'http://localhost:3000';
  
  console.log('🧪 Тест AI обработки новостей о недвижимости\n');

  try {
    // Авторизация
    const loginRes = await axios.post(`${BASE_URL}/api/login`, {
      password: 'pass55184'
    });
    const cookies = loginRes.headers['set-cookie'];
    console.log('✅ Авторизация успешна\n');

    // Получаем источники
    const sourcesRes = await axios.get(`${BASE_URL}/api/news/sources`, {
      headers: { Cookie: cookies }
    });

    console.log(`📡 Найдено источников: ${sourcesRes.data.length}\n`);

    if (sourcesRes.data.length === 0) {
      console.log('❌ Нет источников. Добавьте их через интерфейс.');
      process.exit();
    }

    // Берем первый источник (Lenta.ru)
    const source = sourcesRes.data[0];
    console.log(`🔄 Парсинг: ${source.name}`);
    console.log(`   URL: ${source.url}\n`);

    const parseRes = await axios.post(
      `${BASE_URL}/api/news/sources/${source.id}/parse`,
      {},
      { headers: { Cookie: cookies } }
    );

    console.log(`✅ Найдено новостей: ${parseRes.data.items.length}`);
    console.log('⏳ AI обработка займет 1-2 минуты...\n');
    console.log('Следите за логами бэкенда для просмотра прогресса AI обработки.\n');

    // Ждем 30 секунд чтобы AI успел обработать
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Проверяем результаты
    const newsRes = await axios.get(`${BASE_URL}/api/news/items`, {
      headers: { Cookie: cookies }
    });

    const aiProcessed = newsRes.data.filter(n => n.tags && n.tags.includes('ai-processed'));
    
    console.log('\n📊 РЕЗУЛЬТАТЫ:');
    console.log(`   Всего новостей в базе: ${newsRes.data.length}`);
    console.log(`   AI обработано: ${aiProcessed.length}`);

    if (aiProcessed.length > 0) {
      console.log('\n✅ Примеры AI обработанных новостей:\n');
      aiProcessed.slice(0, 3).forEach((news, i) => {
        console.log(`${i + 1}. ${news.title}`);
        console.log(`   Теги: ${news.tags.join(', ')}`);
        console.log(`   Превью: ${news.preview.substring(0, 100)}...\n`);
      });
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.response?.data || error.message);
  }

  process.exit();
})();
