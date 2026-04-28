#!/bin/bash
cd /c/Users/Office-40/post-project

# Comment out all mentions usage lines
sed -i 's/mentions.length > 0 ? mentions.map/\/\/ mentions.length > 0 ? mentions.map/' src/components/ComposerPage.tsx
sed -i 's/mentions,/\/\/ mentions,/' src/components/ComposerPage.tsx
sed -i 's/{mentions.length > 0 && (/{\/\* mentions.length > 0 \&\& (/' src/components/ComposerPage.tsx
sed -i 's/{mentions.map((m) => (/{\/\* mentions.map((m) => (/' src/components/ComposerPage.tsx
sed -i 's/mentions.length} отметк/mentions.length} отметк *\/}/' src/components/ComposerPage.tsx

echo "All mentions usage commented out"
