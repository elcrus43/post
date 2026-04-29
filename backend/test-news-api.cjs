// Тест API новостей
const axios = require('axios');

(async () => {
  const BASE_URL = 'http://localhost:3000';
  
  console.log('🧪 Тестирование API новостей\n');

  try {
    // 1. Авторизация
    console.log('1️⃣ Авторизация...');
    const loginRes = await axios.post(`${BASE_URL}/api/login`, {
      password: 'pass55184'
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    const cookies = loginRes.headers['set-cookie'];
    console.log('✅ Авторизация успешна\n');

    // 2. Создание RSS источника
    console.log('2️⃣ Создание RSS источника (РИА Новости)...');
    const createSourceRes = await axios.post(`${BASE_URL}/api/news/sources`, {
      name: 'РИА Новости',
      type: 'rss',
      url: 'https://ria.ru/rss'
    }, {
      headers: { Cookie: cookies }
    });
    
    const source = createSourceRes.data;
    console.log('✅ Источник создан:', source.name, source.id, '\n');

    // 3. Парсинг источника
    console.log('3️⃣ Парсинг RSS источника...');
    const parseRes = await axios.post(`${BASE_URL}/api/news/sources/${source.id}/parse`, {}, {
      headers: { Cookie: cookies }
    });
    
    console.log(`✅ Найдено ${parseRes.data.items.length} новостей\n`);
    
    if (parseRes.data.items.length > 0) {
      console.log('📰 Пример новости:');
      const news = parseRes.data.items[0];
      console.log('  Заголовок:', news.title);
      console.log('  Категория:', news.category);
      console.log('  Статус:', news.status);
      console.log('  Источник:', news.source, '\n');
    }

    // 4. Получение списка всех новостей
    console.log('4️⃣ Получение списка новостей...');
    const newsListRes = await axios.get(`${BASE_URL}/api/news/items`, {
      headers: { Cookie: cookies }
    });
    
    console.log(`✅ Всего новостей в базе: ${newsListRes.data.length}\n`);

    // 5. Создание VK источника
    console.log('5️⃣ Создание VK источника...');
    const vkSourceRes = await axios.post(`${BASE_URL}/api/news/sources`, {
      name: 'Тестовая группа VK',
      type: 'vk',
      url: 'https://vk.com/public123456'
    }, {
      headers: { Cookie: cookies }
    });
    
    console.log('✅ VK источник создан:', vkSourceRes.data.name, '\n');

    console.log('✅ Все тесты пройдены успешно! 🎉\n');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.response?.data || error.message);
  }

  process.exit();
})();
