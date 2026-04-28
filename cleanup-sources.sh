#!/bin/bash
cd /c/Users/Office-40/post-project

# Remove news-sources from Sidebar
sed -i '/news-sources/d' src/components/Sidebar.tsx

# Remove NewsSourcesPage from App.tsx
sed -i '/NewsSourcesPage/d' src/App.tsx

echo "NewsSourcesPage references removed"
