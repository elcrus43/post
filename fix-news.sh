#!/bin/bash
cd /c/Users/Office-40/post-project

# Remove mockData import
sed -i "/import { mockNews }/d" src/components/NewsPage.tsx

# Replace mockNews usage with empty array
sed -i 's/const \[news, setNews\] = useState<NewsItem\[\]>(mockNews);/const [news, setNews] = useState<NewsItem[]>([]);/' src/components/NewsPage.tsx

echo "NewsPage fixed"
