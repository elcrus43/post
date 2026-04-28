const axios = require('axios');
async function update() {
  const loginRes = await axios.post('http://localhost:3000/api/login', { password: 'pass55184' });
  const cookie = loginRes.headers['set-cookie'];
  const rulesRes = await axios.get('http://localhost:3000/api/reposter/rules', { headers: { Cookie: cookie } });
  const rule = rulesRes.data.find(r => r.name === 'RSS едомости');
  if (rule) {
    rule.source.url = 'https://www.vedomosti.ru/rss/rubric/realty.xml';
    await axios.put('http://localhost:3000/api/reposter/rules/' + rule.id, rule, { headers: { Cookie: cookie } });
    console.log('✅ Updated! New URL:', rule.source.url);
  }
  process.exit();
}
update();

