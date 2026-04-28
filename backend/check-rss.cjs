const axios = require('axios');
async function check() {
  const loginRes = await axios.post('http://localhost:3000/api/login', { password: 'pass55184' });
  const cookie = loginRes.headers['set-cookie'];
  const rulesRes = await axios.get('http://localhost:3000/api/reposter/rules', { headers: { Cookie: cookie } });
  rulesRes.data.forEach(r => {
    if (r.source && r.source.type === 'rss') {
      console.log('ID:', r.id, '| Name:', r.name, '| URL:', r.source.url);
    }
  });
  process.exit();
}
check();
