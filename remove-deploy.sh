#!/bin/bash
cd /c/Users/Office-40/post-project

# Remove deploy line from Sidebar
sed -i "/{ id: 'deploy'/d" src/components/Sidebar.tsx

echo "Deploy tab removed"
