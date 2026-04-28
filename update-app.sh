#!/bin/bash
cd /c/Users/Office-40/post-project

# Add NewsPage import
sed -i "s|import AnalyticsPage from './components/AnalyticsPage';|import AnalyticsPage from './components/AnalyticsPage';\nimport NewsPage from './components/NewsPage';|" src/App.tsx

# Add news route before deploy
sed -i "s|      case 'deploy':|      case 'news':       return <NewsPage />;\n      case 'deploy':|" src/App.tsx

echo "✅ App.tsx updated"
