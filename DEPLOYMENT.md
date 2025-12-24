# 🚀 Deployment Guide

## Quick Start

1. **Fork this repository** on GitHub
2. **Choose your hosting platform** from the options below
3. **Deploy with one click** using the provided configurations

## Hosting Options

### 🔥 Vercel (Recommended for React)
- **Best for**: Frontend hosting with serverless functions
- **Setup**: Connect GitHub → Import repo → Set root to `frontend`
- **Auto-deploys**: On every push to main branch
- **Custom domains**: Supported
- **Cost**: Free tier available

### 🌐 Netlify
- **Best for**: Static site hosting with build automation  
- **Setup**: Connect GitHub → Set build dir to `frontend`
- **Build command**: `npm run build`
- **Publish directory**: `frontend/dist`
- **Cost**: Free tier available

### 🚂 Railway (Full-Stack)
- **Best for**: Complete application with backend
- **Setup**: Connect GitHub → Auto-detects both frontend/backend
- **Database**: Includes PostgreSQL/MySQL options
- **Environment variables**: Easy configuration
- **Cost**: Pay-as-you-go

### 📄 GitHub Pages (Free)
- **Best for**: Frontend-only deployment
- **Setup**: Automatic via GitHub Actions workflow
- **URL**: `https://YOUR_USERNAME.github.io/codecache-pro/`
- **Cost**: Completely free

## Environment Variables

### Frontend (.env)
```bash
VITE_API_URL=https://your-backend-url.com
```

### Backend (.env)
```bash
PORT=5050
CACHE_SIZE_LIMIT=5368709120
LOG_LEVEL=info
```

## Manual Deployment Steps

### 1. Prepare Repository
```bash
git clone https://github.com/YOUR_USERNAME/codecache-pro.git
cd codecache-pro
```

### 2. Build Frontend
```bash
cd frontend
npm install
npm run build
```

### 3. Deploy Backend
```bash
cd ../backend
npm install
npm start
```

## Troubleshooting

- **Build fails**: Check Node.js version (requires 18+)
- **API not connecting**: Verify VITE_API_URL in frontend
- **CORS errors**: Configure backend CORS for your domain
- **GitHub Pages 404**: Ensure base path is set correctly in vite.config.js