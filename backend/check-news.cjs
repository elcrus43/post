const axios = require('axios');

(async () => {
  const BASE_URL = 'http://localhost:3000';
  
  try {
    const loginRes = await axios.post(`${BASE_URL}/api/login`, {
      password: 'pass55184'
    });
    
    const cookies = loginRes.headers['set-cookie'];
    
    const newsListRes = await axios.get(`${BASE_URL}/api/news/items`, {
      headers: { Cookie: cookies }
    });
    
    console.log('📰 Новостей в базе:', newsListRes.data.length);
    
    if (newsListRes.data.length > 0) {
      console.log('\nПоследние новости:\n');
      newsListRes.data.slice(0, 5).forEach((news, i) => {
        console.log(`${i + 1}. ${news.title.substring(0, 70)}`);
        console.log(`   Источник: ${news.source} | Статус: ${news.status} | Категория: ${news.category}`);
        console.log('');
      });
    } else {
      console.log('\n⚠️ Новостей пока нет');
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.response?.data || error.message);
  }
  
  process.exit();
})();
