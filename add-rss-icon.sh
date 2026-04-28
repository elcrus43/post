#!/bin/bash
cd /c/Users/Office-40/post-project

# Add Rss to imports
sed -i 's/import { PenSquare, Clock, Users, History, Settings, Zap, BookOpen, Sparkles, RefreshCw, BarChart2 }/import { PenSquare, Clock, Users, History, Settings, Zap, BookOpen, Sparkles, RefreshCw, BarChart2, Rss }/' src/components/Sidebar.tsx

echo \"Rss icon added\"
