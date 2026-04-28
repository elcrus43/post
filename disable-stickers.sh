#!/bin/bash
cd /c/Users/Office-40/post-project

# Comment out imports (don't break the file)
sed -i 's/^import StickerPicker/\/\/ import StickerPicker/' src/components/ComposerPage.tsx
sed -i 's/^import MentionInput/\/\/ import MentionInput/' src/components/ComposerPage.tsx

# Comment out state declarations
sed -i 's/const \[stickers,/\/\/ const [stickers,/' src/components/ComposerPage.tsx
sed -i 's/const \[mentions,/\/\/ const [mentions,/' src/components/ComposerPage.tsx

# Comment out sticker/mention components in JSX
sed -i 's/<StickerPicker/{\/\* <StickerPicker/' src/components/ComposerPage.tsx
sed -i 's|onChange={setStickers} />|onChange={setStickers} /> *\/}|' src/components/ComposerPage.tsx

sed -i 's/<MentionInput/{\/\* <MentionInput/' src/components/ComposerPage.tsx  
sed -i 's|onChange={setMentions} />|onChange={setMentions} /> *\/}|' src/components/ComposerPage.tsx

echo "Stickers and mentions commented out safely"
