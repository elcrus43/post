#!/bin/bash
cd /c/Users/Office-40/post-project

# Change component name
sed -i 's/export default function SourcesPanel/export default function NewsSourcesPage/' src/components/NewsSourcesPage.tsx

# Remove type imports we don't need
sed -i 's/import { SourceConfig } from/import { \/* SourceConfig *\/ } from \/\/ /' src/components/NewsSourcesPage.tsx

echo "NewsSourcesPage adapted"
