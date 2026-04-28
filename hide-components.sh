#!/bin/bash
cd /c/Users/Office-40/post-project

# Hide StickerPicker and MentionInput components
sed -i 's/<StickerPicker selected={<div className="hidden"><StickerPicker selected={/' src/components/ComposerPage.tsx
sed -i 's|onChange={setStickers} />|onChange={setStickers} /></div>|' src/components/ComposerPage.tsx

sed -i 's/<MentionInput mentions={<div className="hidden"><MentionInput mentions={/' src/components/ComposerPage.tsx
sed -i 's|onChange={setMentions} />|onChange={setMentions} /></div>|' src/components/ComposerPage.tsx

echo "Stickers and Mentions hidden"
