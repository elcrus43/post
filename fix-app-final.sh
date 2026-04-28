#!/bin/bash
cd /c/Users/Office-40/post-project

# Remove duplicate news-sources line (keep first one)
sed -i '50d' src/App.tsx

# Remove deploy case
sed -i "/case 'deploy':/d" src/App.tsx

echo "App.tsx fixed"
