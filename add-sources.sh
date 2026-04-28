#!/bin/bash
cd /c/Users/Office-40/post-project

# Add News Sources to Sidebar after News
sed -i '/{ id: '\''news'\'', label: '\''News'\'', icon: BookOpen },/a\  { id: '\''news-sources'\'', label: '\''сточники'\'', icon: Rss },' src/components/Sidebar.tsx

# Add import to App.tsx
sed -i '/import NewsPage from/a\import NewsSourcesPage from '\''./components/NewsSourcesPage'\'';' src/App.tsx

# Add route to App.tsx
sed -i '/case '\''news'\'':/a\      case '\''news-sources'\'': return <NewsSourcesPage />;' src/App.tsx

echo \"? News Sources page added\"
