# shitboxshuffle.com + Railway — full checklist

Use this so the live site at **https://shitboxshuffle.com** can talk to the API on Railway.

---

## If deploy logs say `Environment variable not found: DATABASE_URL`

Postgres must exist **and** the API service must **receive** `DATABASE_URL`.

1. **Railway project** → **+ New** → **Database** → **PostgreSQL** (create one if you only have the API service).
2. Open your **API service** (shitboxshuffle), not the database.
3. **Variables** tab → **+ New Variable**.
4. Click **Add reference** (or **Variable reference** — depends on Railway UI).
5. **Service** = your PostgreSQL service → **Variable** = `DATABASE_URL` → Add.
6. Save → Railway redeploys. Deploy logs should show migrations, then `API listening`.

Adding the same URL manually as a raw **Variable** (paste the connection string) also works if references confuse you — copy `DATABASE_URL` from the Postgres service’s Variables tab.

---

## 1. Railway project layout

In **one Railway project** you should have:

| Service        | Purpose |
|----------------|---------|
| **Your API**   | Deploys from this repo (Dockerfile in `api/`). |
| **PostgreSQL** | Add via **+ New → Database → PostgreSQL**. |
| **Redis**      | Add via **+ New → Database → Redis**. |

**Link variables to the API service**

1. Open your **API** service → **Variables**.
2. Click **Add variable** (or **Reference**) and attach:
   - `DATABASE_URL` → reference the **Postgres** service’s `DATABASE_URL`.
   - `REDIS_URL` → reference the **Redis** service’s `REDIS_URL`.

If these are missing or wrong, the app will not start or matchmaking will break.

---

## 2. API service — make it public

1. API service → **Settings** → **Networking**.
2. Under **Public networking**, click **Generate Domain** (you had “Unexposed service” before — you **must** expose it).
3. Copy the URL, e.g. `https://shitboxshuffle-production-xxxx.up.railway.app` (no trailing slash).

---

## 3. API service — required environment variables

Set these on the **API** service → **Variables**:

| Variable | Example / notes |
|----------|------------------|
| `NODE_ENV` | `production` |
| `PORT` | `3001` (Railway may override; both are OK.) |
| `WEB_BASE_URL` | `https://shitboxshuffle.com` |
| `ALLOWED_ORIGINS` | `https://shitboxshuffle.com,https://www.shitboxshuffle.com` |
| `JWT_ACCESS_SECRET` | 64+ random hex (generate twice, use first for this). |
| `JWT_REFRESH_SECRET` | Second random value — **must differ** from access secret. |
| `JWT_ACCESS_EXPIRES_IN` | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | `7d` |
| `DATABASE_URL` | From Postgres (reference). |
| `REDIS_URL` | From Redis (reference). |

Generate secrets locally:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Run it **twice** for two different values.

**Optional** (only if you use the feature):

- `GOOGLE_CLIENT_ID` — Google sign-in on the site.
- `GOOGLE_MAPS_API_KEY` — GeoGuesser (Maps JavaScript API + Street View; restrict key by HTTP referrer in Google Cloud).
- `STRIPE_*` — subscriptions / token packs.
- `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE` — video matching.
- `PERSONA_*` — age verification.

`API_BASE_URL` can be your Railway URL; defaults are OK if unset.

---

## 4. Deploy & health

- After each variable change, Railway redeploys.
- Check: `https://YOUR-RAILWAY-URL.up.railway.app/health` → `{"ok":true}`.
- If deploy fails, read **Deploy logs** (migrations, missing env, DB connection).

---

## 5. Frontend (GitHub Pages) — point HTML at Railway

Your DNS already sends **shitboxshuffle.com** to GitHub Pages. The static files must use your **real** API URL (not the placeholder).

Replace **`YOUR_RAILWAY_APP`** with your actual hostname (the part before `.up.railway.app`), **or** replace the full URL string.

**Files to edit:**

| File | What to set |
|------|-------------|
| `shitboxshuffle.html` | `PROD_API_URL` = `https://<your-railway-host>.up.railway.app` |
| `lobby.html` | same `PROD_API_URL` |
| `session.html` | same `PROD_API_URL` |
| `admin.html` | `API` = `https://<your-railway-host>.up.railway.app/api` |

Keep `PROD_APP_URL` / site URLs as **`https://shitboxshuffle.com`** where already set.

Then:

```bash
git add shitboxshuffle.html lobby.html session.html admin.html
git commit -m "chore: set production Railway API URL"
git push
```

Wait for GitHub Pages to rebuild (1–2 minutes).

---

## 6. GitHub Pages

- **Settings → Pages**: source = branch (e.g. `main`), folder `/ (root)`.
- **Custom domain**: `shitboxshuffle.com` (you already did this via Squarespace DNS).
- Enable **Enforce HTTPS** when GitHub allows it.

If you use **www**, add `www.shitboxshuffle.com` in Pages too **or** redirect www → apex in Squarespace — and keep `www` in `ALLOWED_ORIGINS` (see above).

---

## 7. Smoke tests on the live site

1. Open **https://shitboxshuffle.com** → loads `index.html` / dashboard as expected.
2. Open **https://shitboxshuffle.com/shitboxshuffle.html** (or your main app entry).
3. **Sign up** / **Log in** — if this works, API + CORS + cookies are basically OK.
4. **Start match** / lobby — needs **WebSockets**; if it hangs, confirm `ALLOWED_ORIGINS` matches the **exact** origin (including `https`, no trailing slash).
5. **Admin** (`/admin.html`) — only if you use it; uses the same `API` base as above.

---

## 8. Common problems

| Symptom | What to check |
|---------|----------------|
| Login fails / “cannot reach server” | `PROD_API_URL` in HTML matches Railway URL; API is **exposed**; `/health` works. |
| CORS errors in browser console | `ALLOWED_ORIGINS` includes `https://shitboxshuffle.com` (and www if you use it). |
| WebSocket failed | Same origins; Railway supports WS on the same HTTPS URL. |
| 401 / refresh issues | Same site + `credentials: 'include'`; production cookies use `Secure` on HTTPS. |
| Build/deploy fails | Deploy logs; Postgres + Redis referenced; `JWT_*` set. |

---

## 9. Order of operations (short)

1. Railway: Postgres + Redis + API from GitHub.  
2. Variables + references + JWT secrets + `WEB_BASE_URL` + `ALLOWED_ORIGINS`.  
3. **Generate public domain** for the API.  
4. Confirm `/health` in the browser.  
5. Update the four HTML files with the Railway URL → commit → push.  
6. Test sign-in on **shitboxshuffle.com**.

That’s everything **required** for core auth + API + static site. Add Stripe / Google / Agora only when you’re ready for those features.
