#!/bin/bash
cd /c/Users/Office-40/post-project

# Replace require with createRequire
sed -i \"70a import { createRequire } from 'module';\nconst require = createRequire(import.meta.url);\" backend/server.js

echo \"Added createRequire\"
