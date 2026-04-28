#!/bin/bash
cd /c/Users/Office-40/post-project

# Remove the require line
sed -i '/const { setupNewsApi } = require/d' backend/server.js

# Add dynamic import before app.listen
sed -i '/app.listen/i \/\/ News API\ntry { const { setupNewsApi } = await import('./news-api.cjs'); setupNewsApi(app); } catch(e) { console.log('[News] API not loaded:', e.message); }' backend/server.js

echo "? News API added with dynamic import"
