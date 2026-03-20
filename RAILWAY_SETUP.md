# Railway + GitHub Pages Deployment Guide

## Overview
- **Backend (API + WebSockets)** → Railway
- **Frontend (HTML files)** → GitHub Pages
- **Database (Postgres)** → Railway plugin
- **Cache (Redis)** → Railway plugin

---

## Step 1 — Push to GitHub

Make sure your code is pushed to GitHub before starting.

```bash
git add .
git commit -m "add railway deployment config"
git push
```

---

## Step 2 — Create Railway Project

1. Go to [railway.app](https://railway.app) and sign up / log in
2. Click **New Project**
3. Select **Deploy from GitHub repo**
4. Connect your GitHub account and select this repo
5. Railway will detect the `railway.toml` and `api/Dockerfile` automatically

---

## Step 3 — Add Postgres

1. Inside your Railway project, click **+ New**
2. Select **Database → Add PostgreSQL**
3. Railway creates the database and automatically sets `DATABASE_URL` in your service's environment

---

## Step 4 — Add Redis

1. Click **+ New** again
2. Select **Database → Add Redis**
3. Railway creates Redis and automatically sets `REDIS_URL` in your service's environment

---

## Step 5 — Set Environment Variables

In your Railway service → **Variables** tab, add these:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `JWT_ACCESS_SECRET` | Run `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` locally and paste result |
| `JWT_REFRESH_SECRET` | Run the same command again for a **different** value |
| `JWT_ACCESS_EXPIRES_IN` | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | `7d` |
| `WEB_BASE_URL` | `https://yourdomain.com` (your GitHub Pages / custom domain) |
| `ALLOWED_ORIGINS` | `https://yourdomain.com,https://www.yourdomain.com` |

> `DATABASE_URL` and `REDIS_URL` are set automatically by Railway — do NOT add them manually.

**Optional (add when you need these features):**

| Variable | When needed |
|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth login |
| `GOOGLE_MAPS_API_KEY` | GeoGuesser — Maps JavaScript API (enable in GCP; referrer-restrict the key) |
| `STRIPE_SECRET_KEY` | Stripe payments |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhooks |
| `AGORA_APP_ID` + `AGORA_APP_CERTIFICATE` | Video chat |

---

## Step 6 — Get Your Railway API URL

1. In Railway, click your service → **Settings → Networking**
2. Click **Generate Domain** — you'll get a URL like `https://shitboxshuffle-api.up.railway.app`
3. Copy this URL — you'll need it in Step 8

---

## Step 7 — Set Up GitHub Pages (Frontend)

1. In your GitHub repo → **Settings → Pages**
2. Set **Source** to `Deploy from a branch`
3. Set **Branch** to `main` and folder to `/ (root)`
4. Click **Save**
5. GitHub gives you a URL like `https://yourusername.github.io/shitboxshuffle`
6. If you have a custom domain, add it in the **Custom domain** field

---

## Step 8 — Update Frontend URLs

In `shitbox-combined_2.html`, `session.html`, `admin.html`, and `penguin-knockout.html`,
update the config at the top of each file's `<script>` section:

```js
// Change FROM:
const API_URL = 'http://localhost:3001';
const WS_URL  = 'http://localhost:3001';
const APP_URL = 'http://localhost:8080';

// Change TO:
const API_URL = 'https://shitboxshuffle-api.up.railway.app';  // your Railway URL
const WS_URL  = 'https://shitboxshuffle-api.up.railway.app';  // same
const APP_URL = 'https://yourdomain.com';                      // your frontend URL
```

Then push to GitHub — both Railway and GitHub Pages will auto-deploy.

---

## Step 9 — Verify Deployment

1. Visit `https://your-railway-url.up.railway.app/api/auth/health` → should return `{"status":"ok"}`
2. Visit your frontend domain → should load the app
3. Register an account and test matchmaking

---

## Generating JWT Secrets

Run this in your terminal to generate secure secrets:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Run it **twice** — once for `JWT_ACCESS_SECRET`, once for `JWT_REFRESH_SECRET`. Never reuse the same value for both.

---

## Troubleshooting

**Build fails on Railway:**
- Check the build logs in Railway dashboard → your service → **Deployments**
- Common cause: missing environment variable

**WebSockets not connecting:**
- Make sure `ALLOWED_ORIGINS` includes your exact frontend URL (no trailing slash)
- Railway supports WebSockets natively — no extra config needed

**Database migration errors:**
- The `CMD` in the Dockerfile runs `prisma migrate deploy` automatically on every deploy
- Check Railway logs if it fails

**CORS errors in browser:**
- Make sure `ALLOWED_ORIGINS` env var is set and matches your frontend URL exactly
