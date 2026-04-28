const fs = require('fs');
const p = 'c:/Users/Office-40/post-project/src/components/Sidebar.tsx';
let c = fs.readFileSync(p, 'utf8');
c = c.replace('BarChart2 }', 'BarChart2, Rss }');
c = c.replace(/({ id: 'reposter'.*\n)/, "  
