# Connect shitboxshuffle.com — DNS setup

Use this after your app is deployed (API on Railway, frontend on GitHub Pages). Where you add these records depends on **where you bought the domain** (e.g. Namecheap, Cloudflare, GoDaddy, Google Domains, etc.).

---

## 1. Point the main site (shitboxshuffle.com) to GitHub Pages

### In GitHub (do this first)

1. Repo → **Settings** → **Pages**
2. Under **Custom domain**, enter: `shitboxshuffle.com`
3. Save. GitHub may show a reminder to add DNS records — that’s the next step.
4. (Optional) Check **Enforce HTTPS** after DNS has propagated.

### In your domain registrar / DNS provider

Add these records so `shitboxshuffle.com` and `www.shitboxshuffle.com` point to GitHub Pages.

| Type | Name/Host | Value / Target | TTL |
|------|-----------|----------------|-----|
| **A** | `@` | `185.199.108.153` | 3600 (or default) |
| **A** | `@` | `185.199.109.153` | 3600 |
| **A** | `@` | `185.199.110.153` | 3600 |
| **A** | `@` | `185.199.111.153` | 3600 |
| **CNAME** | `www` | `YOUR_GITHUB_USERNAME.github.io` | 3600 |

- **`@`** = apex domain (shitboxshuffle.com). Some panels use “@”, others leave “Name” blank or use the root domain.
- Replace `YOUR_GITHUB_USERNAME` with your GitHub username (e.g. `marukaneko1`).

**If you use Cloudflare:** Add the same A and CNAME records. Use **DNS only** (grey cloud) until GitHub shows the domain as verified and HTTPS works; then you can switch to **Proxied** (orange) if you want.

---

## 2. (Optional) Point api.shitboxshuffle.com to Railway

If you want the API at `https://api.shitboxshuffle.com` instead of `*.up.railway.app`:

### In Railway

1. Project → your API service → **Settings** → **Networking** → **Public Networking**
2. Click **Generate Domain** if you don’t have one yet.
3. Under **Custom Domain**, add: `api.shitboxshuffle.com`
4. Railway will show the target you must use (often a CNAME target like `xxx.up.railway.app` or an A record). Copy it.

### In your DNS provider

| Type | Name/Host | Value / Target | TTL |
|------|-----------|----------------|-----|
| **CNAME** | `api` | (exact value Railway shows, e.g. `your-service.up.railway.app`) | 3600 |

Use the **exact** CNAME target from Railway (no `https://`, no path). Wait for DNS to propagate (often 5–60 minutes).

---

## 3. Update your app config to use shitboxshuffle.com

After DNS is working:

1. **Frontend (GitHub Pages)**  
   In `shitboxshuffle.html`, `lobby.html`, `session.html`, and any other file that has `PROD_APP_URL` / `PROD_API_URL`, set:

   - `PROD_APP_URL` = `https://shitboxshuffle.com`
   - `PROD_API_URL` = your Railway URL, e.g.  
     - `https://your-app.up.railway.app`  
     - or `https://api.shitboxshuffle.com` if you added the custom domain in step 2.

2. **Railway env vars**  
   In Railway → your API service → **Variables**, set:

   - `WEB_BASE_URL` = `https://shitboxshuffle.com`
   - `ALLOWED_ORIGINS` = `https://shitboxshuffle.com,https://www.shitboxshuffle.com`

   If you use `api.shitboxshuffle.com`, no extra env is needed for that; just use that URL in the frontend as `PROD_API_URL`.

3. Commit and push so GitHub Pages and Railway use the new URLs.

---

## 4. Check that everything works

- `https://shitboxshuffle.com` → loads your site (e.g. index.html).
- `https://www.shitboxshuffle.com` → same (if you added the CNAME).
- `https://your-api.up.railway.app/api/auth/health` or `https://api.shitboxshuffle.com/api/auth/health` → `{"ok":true}` or similar.
- Log in / sign up from the live site and confirm API and WebSockets work.

---

## Quick reference by registrar

- **Cloudflare:** DNS → Add record → choose A or CNAME; Name = `@` or `www`, Value = as in tables above.
- **Namecheap:** Advanced DNS → Add New Record → A Record / CNAME Record.
- **GoDaddy:** DNS Management → Add → choose Type and enter Name and Value.
- **Google Domains (now Squarespace):** DNS → Custom records → add A and CNAME.

If you tell me where the domain is registered (e.g. “Cloudflare” or “Namecheap”), I can give click-by-click steps for that panel.
