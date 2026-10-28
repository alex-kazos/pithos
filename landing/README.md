# StockPilot marketing site

The public website for StockPilot: landing page, blog, Privacy Policy and Terms. It's a static Vite + React + Tailwind site, separate from the dashboard app at the repository root. It has no backend and doesn't use Firebase.

**You don't need this folder to self-host StockPilot.** It only links to the app (sign-up, log-in, live demo) through `VITE_APP_URL`.

```bash
cp .env.example .env   # VITE_APP_URL=http://localhost:5173
npm install
npm run dev            # http://localhost:5174
npm test
npm run build          # typecheck + production build into dist/
```

Deploy `dist/` to any static host. On Cloudflare Pages, use root directory `landing`, build command `npm run build`, output directory `dist`, and set `VITE_APP_URL` to the app's URL.

The copy, meta tags, sitemap, legal text and author links describe the original stockpilotai.com. Replace them before publishing your own.
