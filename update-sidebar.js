const fs = require('fs');
const file = 'c:/Users/Office-40/post-project/src/components/Sidebar.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add Rss import
content = content.replace('BarChart2 }', 'BarChart2, Rss }');

// Add news and news-sources after reposter
content = content.replace(
  \"{ id: 'reposter', label: 'епостер', icon: RefreshCw },\",
  \"{ id: 'reposter', label: 'епостер', icon: RefreshCw },\\n  { id: 'news', label: 'News', icon: BookOpen },\\n  { id: 'news-sources', label: 'сточники', icon: Rss },\"
);

// Remove deploy
content = content.replace(/\\s*{ id: 'deploy'.*\\n/, '');

fs.writeFileSync(file, content, 'utf8');
console.log('Sidebar updated successfully');
