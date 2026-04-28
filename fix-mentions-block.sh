#!/bin/bash
cd /c/Users/Office-40/post-project

# Delete the broken mentions block (lines 282-291)
sed -i '282,291d' src/components/ComposerPage.tsx

echo "Broken mentions block removed"
