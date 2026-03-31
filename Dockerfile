# AutoPost - Railway Deployment
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install dependencies
RUN npm install --legacy-peer-deps
WORKDIR /app/backend
RUN npm install --legacy-peer-deps

# Build frontend
WORKDIR /app
COPY . .
RUN npm run build

# Expose port
EXPOSE 3000

# Environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Start server
CMD ["node", "backend/server.js"]
