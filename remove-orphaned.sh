#!/bin/bash
cd /c/Users/Office-40/post-project

# Remove orphaned stickers and mentions blocks (lines 261-277)
sed -i '261,277d' src/components/ComposerPage.tsx

echo "Orphaned blocks removed"
