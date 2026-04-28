const fs = require('fs');
const p = 'c:/Users/Office-40/post-project/src/components/Sidebar.tsx';
let c = fs.readFileSync(p, 'utf8');
const regex = /(\{ id: 'reposter'.*?\},)/;
c = c.replace(regex, '' + '\n  { id: "news", label: "News", icon: BookOpen },');
fs.writeFileSync(p, c, 'utf8');
console.log('DONE');
