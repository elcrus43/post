#!/bin/bash
cd /c/Users/Office-40/post-project

# Add news API to server.js
sed -i '/const supabase = /a\const { setupNewsApi } = require('./news-api.cjs');' backend/server.js

# Register news API routes (before app.listen)
sed -i '/app.listen/i\// News API\nsetupNewsApi(app);' backend/server.js

echo "✅ News API integrated into server.js"
