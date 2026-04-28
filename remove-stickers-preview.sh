#!/bin/bash
cd /c/Users/Office-40/post-project

# Remove stickers preview line
sed -i '/stickers.length} стикер/d' src/components/ComposerPage.tsx

echo "Stickers preview removed"
