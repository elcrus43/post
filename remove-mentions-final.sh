#!/bin/bash
cd /c/Users/Office-40/post-project

# Remove all mentions references
sed -i '/mentions/d' src/components/ComposerPage.tsx

echo "All mentions removed"
