#!/bin/bash
cd /c/Users/Office-40/post-project

# Remove StickerPicker import and component
sed -i "/import StickerPicker/d" src/components/ComposerPage.tsx
sed -i "/<StickerPicker/d" src/components/ComposerPage.tsx

# Remove MentionInput import and component  
sed -i "/import MentionInput/d" src/components/ComposerPage.tsx
sed -i "/<MentionInput/d" src/components/ComposerPage.tsx

# Remove stickers state and related code
sed -i "/const \[stickers/d" src/components/ComposerPage.tsx
sed -i "/stickers.length > 0/d" src/components/ComposerPage.tsx
sed -i "/stickers.map/d" src/components/ComposerPage.tsx
sed -i "/stickers,/d" src/components/ComposerPage.tsx

# Remove mentions state
sed -i "/const \[mentions/d" src/components/ComposerPage.tsx

echo "Stickers and mentions removed"
