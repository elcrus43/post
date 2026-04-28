#!/bin/bash
cd /c/Users/Office-40/post-project

# Add Rss to imports
sed -i 's/BarChart2 }/BarChart2, Rss }/' src/components/Sidebar.tsx

# Add News and News-Sources after reposter
sed -i "/{ id: 'reposter'/a\  { id: 'news', label: 'News', icon: BookOpen },\n  { id: 'news-sources', label: 'сточники', icon: Rss }," src/components/Sidebar.tsx

# Remove deploy tab
sed -i "/{ id: 'deploy'/d" src/components/Sidebar.tsx

echo "Sidebar fixed"
