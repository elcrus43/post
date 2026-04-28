#!/bin/bash
cd /c/Users/Office-40/post-project

# Delete lines with StickerPicker and MentionInput components
sed -i '/<StickerPicker/d' src/components/ComposerPage.tsx
sed -i '/<MentionInput/d' src/components/ComposerPage.tsx

# Delete imports
sed -i '/import StickerPicker/d' src/components/ComposerPage.tsx
sed -i '/import MentionInput/d' src/components/ComposerPage.tsx

echo "Stickers and Mentions removed"
