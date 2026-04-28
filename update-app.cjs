const fs = require('fs');
const f = 'c:/Users/Office-40/post-project/src/App.tsx';
let c = fs.readFileSync(f, 'utf8');
c = c.replace(/(import AnalyticsPage from)/, 'import NewsPage from ''./components/NewsPage'';`n``$1');
c = c.replace(/(case 'deploy':)/, 'case ''news'':       return <NewsPage />;`n      ``$1');
fs.writeFileSync(f, c, 'utf8');
console.log('DONE');
