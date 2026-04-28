const mongoose = require('mongoose');
const { RepostRule } = require('./models.cjs');

async function updateRSS() {
  await mongoose.connect('mongodb://localhost:27017/autopost');
  const rule = await RepostRule.findOne({ name: 'RSS едомости' });
  if (rule) {
    rule.source.url = 'https://www.vedomosti.ru/rss/rubric/realty.xml';
    await rule.save();
    console.log('✅ RSS URL updated to:', rule.source.url);
  } else {
    console.log('❌ Rule not found');
  }
  process.exit();
}

updateRSS();
