# Google Search Console & GA4 — checklist for shitboxshuffle.com

Complete these steps in your Google account (cannot be automated in git).

## 1. Google Search Console

1. Go to [Google Search Console](https://search.google.com/search-console).
2. Add property: **URL prefix** `https://shitboxshuffle.com/` (or Domain property if DNS verified).
3. Verify ownership using one of:
   - **HTML file** upload (add the file Google gives you to the repo root and deploy), or
   - **DNS TXT** record at your registrar (best long-term).
4. After verification, open **Sitemaps** → submit: `https://shitboxshuffle.com/sitemap.xml`
5. Weekly: check **Coverage**, **Experience** (Core Web Vitals), and **Enhancements** for issues.

## 2. Google Analytics 4

1. In [Google Analytics](https://analytics.google.com/), create a **GA4** property for Shitbox Shuffle.
2. Copy your **Measurement ID** (`G-XXXXXXXXXX`).
3. In [index.html](index.html), find the commented `<!-- GA4: ...` block in `<head>`, replace `G-XXXXXXXXXX` with your ID, and **uncomment** the two `<script>` lines.
4. Use **DebugView** (GA4) or the Realtime report to confirm hits after deploy.

## 3. Rich results / sharing

- Test the homepage with [Rich Results Test](https://search.google.com/test/rich-results) (JSON-LD).
- Test share previews with [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) (add `assets/og-default.png` later for best Facebook support; see [assets/README.txt](assets/README.txt)).

## 4. Already in the repo

- [robots.txt](robots.txt) — sitemap line, `Disallow` for `/admin.html` and `/session.html`
- [sitemap.xml](sitemap.xml) — public URLs including `/blog/`
- Meta + Open Graph on main HTML pages
- `noindex` on [session.html](session.html) and [admin.html](admin.html)
