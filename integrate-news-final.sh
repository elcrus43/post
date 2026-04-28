#!/bin/bash
cd /c/Users/Office-40/post-project

# Find app.listen line and add dynamic import before it
sed -i '/app.listen/i \\n\/\/ News API\ntry {\n  const { setupNewsApi } = await import(\x27./news-api.cjs\x27);\n  setupNewsApi(app);\n  console.log(\x27[News] API loaded successfully\x27);\n} catch (e) {\n  console.log(\x27[News] API not loaded:\x27, e.message);\n}' backend/server.js

echo \"News API integration added\"
