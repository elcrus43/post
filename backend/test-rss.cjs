const Parser = require('rss-parser');
const parser = new Parser();
async function testRSS() {
  try {
    console.log('Parsing RSS feed...');
    const feed = await parser.parseURL('https://www.vedomosti.ru/rss/news');
    console.log('Feed title:', feed.title);
    console.log('Items count:', feed.items.length);
    const item = feed.items[0];
    console.log('Latest item title:', item.title);
    console.log('Latest item link:', item.link);
    console.log('Content snippet:', (item.contentSnippet || '').substring(0, 100));
  } catch (e) {
    console.error('RSS Error:', e.message);
  }
}
testRSS();
