#!/bin/bash
cd /c/Users/Office-40/post-project

# Remove remaining stickers/mentions spans around line 788-793
sed -i '785,800d' src/components/ComposerPage.tsx

echo "Remaining orphaned code removed"
