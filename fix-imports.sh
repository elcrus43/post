#!/bin/bash
cd /c/Users/Office-40/post-project

# Fix broken import line 2
sed -i '2d' src/components/NewsSourcesPage.tsx

# Remove mockData import on line 3
sed -i '/mockSources/d' src/components/NewsSourcesPage.tsx

echo "Imports fixed"
