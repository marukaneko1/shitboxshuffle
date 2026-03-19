# Railway setup for shitboxshuffle.com

Your frontend is live at **https://shitboxshuffle.com** (GitHub Pages + Squarespace DNS). Follow these steps to get the API running on Railway so the site can log in and use matchmaking.

---

## 1. Create the project and deploy the API

1. Go to [railway.app](https://railway.app) and sign in (GitHub is easiest).
2. Click **New Project** → **Deploy from GitHub repo**.
3. Select the **shitboxshuffle** repo. Railway will use the `railway.toml` and build from `api/`.
4. Wait for the first deploy to finish (it may fail until you add Postgres + Redis — that’s OK).

---

## 2. Add PostgreSQL

1. In the project, click **+ New** → **Database** → **Add PostgreSQL**.
2. Railway creates the DB and sets `DATABASE_URL` on your API service automatically. No copy-paste needed.

---

## 3. Add Redis

1. Click **+ New** again → **Database** → **Add Redis**.
2. Railway sets `REDIS_URL` on your API service automatically.

---

## 4. Generate a public URL for the API

1. Click your **API service** (the one that’s not Postgres or Redis).
2. Open **Settings** → **Networking** → **Public Networking**.
3. Click **Generate Domain**. You’ll get a URL like `https://shitboxshuffle-production-xxxx.up.railway.app`.
4. **Copy that URL** (no trailing slash). You’ll use it in step 5 and step 6.

---

## 5. Set environment variables (Railway)

In your API service go to **Variables** and add/confirm:

| Variable | Value |
|----------|--------|
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `WEB_BASE_URL` | `https://shitboxshuffle.com` |
| `ALLOWED_ORIGINS` | `https://shitboxshuffle.com,https://www.shitboxshuffle.com` |
| `JWT_ACCESS_SECRET` | *(generate — see below)* |
| `JWT_REFRESH_SECRET` | *(generate — see below)* |
| `JWT_ACCESS_EXPIRES_IN` | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | `7d` |

**Generate JWT secrets** (run locally, use two different values):

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

- Paste the first output into `JWT_ACCESS_SECRET`.
- Run the command again and paste the second output into `JWT_REFRESH_SECRET`.

`DATABASE_URL` and `REDIS_URL` are set by Railway when you added the plugins — don’t add them manually.

---

## 6. Paste your Railway URL into the repo

Replace `YOUR_RAILWAY_APP` with your **actual** Railway domain (e.g. `shitboxshuffle-production-xxxx`). The URL should look like `https://something.up.railway.app` with **no** trailing slash.

**Files to update (search for `YOUR_RAILWAY_APP`):**

- `shitboxshuffle.html` — line ~1290: `PROD_API_URL`
- `lobby.html` — line ~686: `PROD_API_URL`
- `session.html` — line ~3250: `PROD_API_URL`
- `admin.html` — line ~362: `API` (use `https://YOUR_APP.up.railway.app/api`)

Example: if Railway gave you `https://shitboxshuffle-api.up.railway.app`, then:

- `PROD_API_URL = 'https://shitboxshuffle-api.up.railway.app'`
- In admin: `API = 'https://shitboxshuffle-api.up.railway.app/api'`

Then commit and push. GitHub Pages will redeploy the site with the correct API URL.

---

## 7. Redeploy the API (if needed)

After changing variables, Railway usually redeploys automatically. If not, go to your API service → **Deployments** → **Redeploy**.

---

## 8. Verify

1. **Health check:** open `https://YOUR_RAILWAY_APP.up.railway.app/health` in a browser. You should see `{"ok":true}`. (Railway uses this path for deploy healthchecks too.)
2. **Site:** open **https://shitboxshuffle.com**, try Sign up / Log in. If login works and you can hit “Start Match”, the API is connected.

---

## Optional: custom API domain (e.g. api.shitboxshuffle.com)

In Railway → API service → **Settings** → **Networking** → **Custom Domain**, add `api.shitboxshuffle.com`. Railway will show a CNAME target.

In **Squarespace** (or wherever your DNS is): add a **CNAME** record:

- **Host:** `api`
- **Value:** the target Railway shows (e.g. `xxx.up.railway.app`)

After DNS propagates, use `https://api.shitboxshuffle.com` as `PROD_API_URL` in the same four files instead of `https://....up.railway.app`.
