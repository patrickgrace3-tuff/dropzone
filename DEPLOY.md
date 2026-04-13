# Deploying to Render.com

## Quick Deploy (render.yaml method)
1. Push code to GitHub
2. Go to render.com → New → Blueprint
3. Connect your repo — Render reads `render.yaml` and creates everything automatically
4. Update `frontend/.env.production` with your actual backend URL
5. Done!

## Manual Deploy

### Step 1 — Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOURNAME/dropzone.git
git push -u origin main
```

### Step 2 — Create PostgreSQL database on Render
1. Render dashboard → New → PostgreSQL
2. Name: `dropzone-db`, Plan: Free
3. Copy the **Internal Database URL** for use in Step 3

### Step 3 — Deploy Backend
1. Render → New → Web Service
2. Connect GitHub repo
3. Settings:
   - Root directory: `backend`
   - Runtime: Node
   - Build command: `npm install`
   - Start command: `node src/index.js`
4. Environment variables:
   ```
   NODE_ENV=production
   DATABASE_URL=<paste Internal Database URL from Step 2>
   JWT_SECRET=<any long random string>
   FRONTEND_URL=https://dropzone-frontend.onrender.com
   ANTHROPIC_API_KEY=<optional>
   ```
5. Deploy — tables are created automatically on first start

### Step 4 — Deploy Frontend
1. Render → New → Static Site
2. Connect same GitHub repo
3. Settings:
   - Root directory: `frontend`
   - Build command: `npm install && npm run build`
   - Publish directory: `dist`
4. Environment variable:
   ```
   VITE_API_URL=https://dropzone-backend.onrender.com
   ```
   (replace with your actual backend URL from Step 3)
5. Add Rewrite Rule:
   - Source: `/*`  →  Destination: `/index.html`
6. Deploy

### Step 5 — Update FRONTEND_URL on backend
Go back to your backend service on Render → Environment → update
`FRONTEND_URL` to your actual frontend URL, then redeploy.

## Local Development (still works the same)
```bash
cd backend && npm install && npm run dev
cd frontend && npm install && npm run dev
```
Just make sure `backend/.env` has `DATABASE_URL` pointing to your Render
PostgreSQL (or a local Postgres install).
