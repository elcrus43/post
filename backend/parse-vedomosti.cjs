const axios = require('axios');

(async () => {
  try {
    const loginRes = await axios.post('http://localhost:3000/api/login', {
      password: 'pass55184'
    });
    const cookies = loginRes.headers['set-cookie'];

    console.log('🔄 Парсинг Vedomosti...\n');

    const parseRes = await axios.post(
      'http://localhost:3000/api/news/sources/e0db87d5-cea3-422c-b431-04436e340f38/parse',
      {},
      { headers: { Cookie: cookies } }
    );

    console.log('✅ Найдено новостей:', parseRes.data.items.length);

    if (parseRes.data.items.length > 0) {
      console.log('\n📰 Примеры новостей:\n');
      parseRes.data.items.slice(0, 5).forEach((news, i) => {
        console.log(`${i + 1}. ${news.title.substring(0, 80)}`);
        console.log(`   Статус: ${news.status}`);
        console.log(`   Теги: ${news.tags.join(', ')}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.response?.data || error.message);
  }

  process.exit();
})();
