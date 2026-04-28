#!/bin/bash
cd /c/Users/Office-40/post-project

# Add news-sources case after line 49
sed -i '49a\      case '\''news-sources'\'':       return <NewsSourcesPage />;' src/App.tsx

# Add сточники to Sidebar after news
sed -i '/{ id: "news", label: "News", icon: BookOpen },/a\  { id: "news-sources", label: "сточники", icon: Rss },' src/components/Sidebar.tsx

# Add Rss import if not present
grep -q 'Rss' src/components/Sidebar.tsx && echo "Rss already imported" || sed -i 's/BarChart2 }/BarChart2, Rss }/' src/components/Sidebar.tsx

echo "News Sources integrated"
