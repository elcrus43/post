# 🚀 AutoPost Deployment Guide

## Option 1: Deploy to Render (Recommended - Free Tier)

### Prerequisites:
- GitHub account
- Render account (https://render.com)
- Supabase project (already have: cpxnhuqvjvzkoulnrpuj)

### Steps:

1. **Push to GitHub:**
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

2. **Deploy on Render:**
   - Go to https://render.com
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Configure:
     - **Name:** autopost-app
     - **Root Directory:** (leave blank)
     - **Environment:** Node
     - **Build Command:** `npm install && npm run build`
     - **Start Command:** `node backend/server.js`
     - **Plan:** Free

3. **Set Environment Variables in Render Dashboard:**
```
NODE_ENV=production
PORT=10000
SUPABASE_URL=https://cpxnhuqvjvzkoulnrpuj.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNweG5odXF2anZ6a291bG5ycHVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NTc2MTUsImV4cCI6MjA5MjIzMzYxNX0._NxEAGjtCrf7wK3pBeh9cID2rB2a1mGreY_pcOZfWMU
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNweG5odXF2anZ6a291bG5ycHVqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjY1NzYxNSwiZXhwIjoyMDkyMjMzNjE1fQ.Oz6IDo7qv4Urp5I7aOLlD2S5uIqXWhWQCfJ-kgZ9yD4
APP_PASSWORD=pass55184
ENCRYPTION_KEY=5cfe4ec49e2f95437a89b634eb418d54
VK_CLIENT_ID=54556245
VK_CLIENT_SECRET=45M1wwzrqGyOlo8Cc8AX
CLOUDINARY_CLOUD_NAME=dusn3d4rz
CLOUDINARY_API_KEY=It3SgJcbcfKAfQMC
CLOUDINARY_API_SECRET=c5dnXY5Vmfw
COOKIE_SECRET=6BFd5DK1lJAx80pCVQ7tbizTg4jGrcImuyLHqwUoSXefkMvOsa2NZnY9W3PERh
TG_NOTIFICATION_BOT_TOKEN=8545913783:AAH6gpYMqP2zHIPc0P-7ZH2puXPZzLjz014
TG_NOTIFICATION_CHAT_ID=263593715
GEMINI_API_KEY=AIzaSyB3AsW7lmDSryzdzAguhQKK3YM8s3QB4ww
```

4. **Deploy!**
   - Click "Create Web Service"
   - Wait for build (~2-3 minutes)
   - Your app will be at: `https://autopost-app.onrender.com`

---

## Option 2: Deploy to Railway

### Steps:

1. **Go to Railway:** https://railway.app
2. **Click "New Project"** → "Deploy from GitHub repo"
3. **Select your repository**
4. **Add Environment Variables** (same as Render above, but PORT=3000)
5. **Deploy!**

---

## Option 3: Deploy with Docker

### Build and run locally:
```bash
docker build -t autopost .
docker run -p 3000:3000 --env-file .env autopost
```

### Push to Docker Hub:
```bash
docker tag autopost yourusername/autopost:latest
docker push yourusername/autopost:latest
```

---

## ⚠️ Important: Create Database Tables

Before deploying, create the news tables in Supabase:

1. Go to: https://supabase.com/dashboard/project/cpxnhuqvjvzkoulnrpuj/sql
2. Run this SQL:

```sql
CREATE TABLE IF NOT EXISTS news_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'rss',
  url TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  items_found INTEGER DEFAULT 0,
  last_parsed TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS news_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  preview TEXT,
  content TEXT,
  category TEXT DEFAULT 'news',
  status TEXT DEFAULT 'queued',
  source TEXT,
  source_icon TEXT,
  source_url TEXT,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  tags JSONB DEFAULT '[]',
  scheduled_for TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_sources_enabled ON news_sources(enabled);
CREATE INDEX IF NOT EXISTS idx_news_items_status ON news_items(status);
CREATE INDEX IF NOT EXISTS idx_news_items_category ON news_items(category);
```

---

## Post-Deployment Checklist:

✅ Test login with password: `pass55184`
✅ Verify accounts are visible
✅ Test RSS parsing in News tab
✅ Check AI Assistant works
✅ Verify all API endpoints respond
✅ Set up custom domain (optional)

---

## Security Recommendations:

1. **Change the app password** in production:
   - Generate new: `node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"`
   
2. **Rotate API keys** if this repo is public
   
3. **Enable HTTPS** (Render/Railway do this automatically)

4. **Set up CORS** to only allow your domain

---

## Troubleshooting:

**App won't start:**
- Check logs in Render/Railway dashboard
- Verify all env vars are set
- Ensure Supabase is accessible

**CORS errors:**
- Add your production URL to `FRONTEND_URL` env var

**Database errors:**
- Verify Supabase URL and keys are correct
- Run the SQL table creation script

---

## Need Help?

Check the logs:
- **Render:** Dashboard → Logs tab
- **Railway:** Project → Deployments → View Logs
