# StockPilot AI 🚀

StockPilot AI is an open-source inventory analytics dashboard for **Shopify** and **WooCommerce** stores. It pulls your products and orders, flags stockouts and dead stock, forecasts demand, and uses an LLM to write restock recommendations and answer questions about your store data.

![img.png](img.png)
<p align="center"><i>Dashboard Preview</i></p>

> **Self-hosted and fully open source.** One `docker compose up` runs the whole thing on your own machine or server: a Node API, a Postgres database and open-source login ([Better Auth](https://www.better-auth.com)). No cloud accounts are needed, and every user brings their **own OpenAI API key**, added in Settings.

The repository holds two separate projects:

- **The app** (repository root): sign-in, the dashboard, the public demo and the `/api` server. This is all you need to run StockPilot for your own stores.
- **The marketing site** ([`landing/`](landing/)): the landing page, blog and legal pages of the original stockpilotai.com. It's optional and has its own `package.json`. If you're self-hosting, you can ignore it or delete the folder.

## Features 🌟

- **Multi-store dashboard**: connect several Shopify and WooCommerce stores to one account and switch between them, or view them all merged by SKU.
- **Inventory alerts**: low stock, stockouts, dead stock and overstock, with thresholds you set.
- **Forecasts**: per-SKU demand and stock-cover projections.
- **AI restock recommendations**: generated from your filtered inventory data, cached per store for a week.
- **AI chat assistant**: ask questions about your products and orders in plain language.
- **Public demo**: `/demo` shows the whole dashboard on synthetic data, with no sign-in.

## How it fits together 🛠️

| Layer | What | Where |
| --- | --- | --- |
| Frontend | React 18 + TypeScript, Vite, Tailwind, MUI, Recharts / Chart.js | `src/` |
| API server | Node + [Hono](https://hono.dev): store proxies, OAuth flows, AI proxy, settings | `server/` |
| Login | [Better Auth](https://www.better-auth.com): email/password, optional Google | `server/lib/auth.ts` |
| Database | PostgreSQL (schema migrates itself on startup) | `server/lib/migrations.ts` |
| AI | OpenAI Chat Completions with each user's own key, or any OpenAI-compatible endpoint | `server/lib/openai.ts` |
| Marketing site (optional) | Landing page, blog, legal pages - static React + Tailwind | `landing/` |

The browser only ever talks to the app's own `/api`, using an HTTP-only session cookie. Secrets stay on the server: store credentials (Shopify tokens, WooCommerce keys) and each user's OpenAI key are **encrypted at rest** (AES-256-GCM) and never sent back to the browser.

## Quick start with Docker 🐳

You need [Docker](https://docs.docker.com/get-docker/) with Compose.

```bash
git clone https://github.com/alex-kazos/stockpilot-open.git
cd stockpilot-open
cp .env.example .env
```

Open `.env` and set `BETTER_AUTH_SECRET` to a random string of at least 32 characters (for example the output of `openssl rand -base64 32`). Then:

```bash
docker compose up -d
```

Open http://localhost:3000, create an account, connect a store, and add your OpenAI API key under **Settings → AI & API key**.

To run it on a real domain, put it behind your usual reverse proxy (Caddy, nginx, Traefik, ...) and set `APP_URL` to the public URL, e.g. `https://stockpilot.example.com`. Data lives in the `db-data` Docker volume.

## Configuration 🔐

All settings go in `.env` (template: [`.env.example`](.env.example)).

| Variable | Required | Purpose |
| --- | --- | --- |
| `APP_URL` | yes | Public URL of the app, no trailing slash. Used for login cookies and OAuth redirects |
| `BETTER_AUTH_SECRET` | yes | Signs sessions and encrypts stored secrets. 32+ characters. Changing it signs everyone out and makes saved OpenAI keys and store connections unreadable |
| `DATABASE_URL` | yes | Postgres connection string (Docker Compose sets this for the app container) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | no | Enables "Continue with Google". Redirect URI: `{APP_URL}/api/auth/callback/google` |
| `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` | no | Enables one-click "Connect with Shopify" (see below) |
| `SHOPIFY_SCOPES` | no | Default `read_products,read_orders,read_customers` |
| `OPENAI_CHAT_MODEL` | no | Model for the chat assistant (default `gpt-5.6-luna`) |
| `OPENAI_RECOMMENDATIONS_MODEL` | no | Model for recommendations, must support JSON mode (default `gpt-5.6-terra`) |
| `OPENAI_BASE_URL` | no | Any OpenAI-compatible endpoint: Azure OpenAI, OpenRouter, a local server, ... |
| `PORT` | no | Port the server listens on (default `3000`) |

There is no server-wide OpenAI key: AI features use the signed-in user's own key, so each user pays for their own usage. Without a saved key, the dashboard works and the AI features ask the user to add one.

## Connecting stores 🛒

Users connect stores from the dashboard after signing in.

**WooCommerce: nothing to configure.**
- *One-click*: uses WooCommerce's built-in [application authentication](https://developer.woocommerce.com/docs/apis/rest-api/authentication/#application-authentication). The store's server POSTs the generated keys back to `/api/woocommerce/oauth/callback`, so your deployment must be reachable from the internet (this won't work against `localhost`).
- *Manual*: in WordPress go to **WooCommerce → Settings → Advanced → REST API**, create a key with **Read** permission, and paste the consumer key and secret.

**Shopify: pick one.**
- *Access token (simplest, for your own store)*: create a custom app for your store with the `read_products` and `read_orders` Admin API scopes (`read_customers` is optional), install it, and paste its Admin API access token in the connect screen. No server configuration needed. See Shopify's docs on [custom apps](https://help.shopify.com/en/manual/apps/app-types/custom-apps).
- *One-click OAuth*: create your **own** app in the [Shopify Partner Dashboard](https://partners.shopify.com), add `{APP_URL}/api/shopify/oauth/callback` to its allowed redirection URLs, and set `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET`. An app with *custom distribution* can only be installed on the store or organization you pick when you create the install link. To let any merchant connect, the app needs *public* distribution, which means going through Shopify's app review.

Pasted tokens and keys are checked against the store before they're saved.

## Development 💻

Requires Node.js 22+ and Docker (for Postgres).

```bash
npm install
cp .env.example .env    # set BETTER_AUTH_SECRET, and APP_URL=http://localhost:5173
npm run db:up           # Postgres only, on localhost:5432
npm run dev             # API on :3000 + Vite on :5173
```

Open http://localhost:5173. Vite proxies `/api` to the API server, so the browser sees one origin, as in production.

```bash
npm test                  # Vitest: frontend + server
npm run typecheck:server  # Typecheck the API server
npm run lint
npm run build             # Frontend into dist/, server into dist-server/
npm start                 # Run the production build (serves dist/ too)
```

`server/integration.test.ts` runs the real app against a real Postgres. It's skipped unless `TEST_DATABASE_URL` points at a **disposable** database (it drops every table first), e.g.:

```bash
docker compose exec db createdb -U stockpilot stockpilot_test
TEST_DATABASE_URL=postgres://stockpilot:stockpilot@localhost:5432/stockpilot_test npm test
```

## Marketing site (optional) 🌐

[`landing/`](landing/) is the public website that sits in front of the app: landing page, blog, Privacy Policy and Terms. It's a static Vite + React + Tailwind site with no backend, and it links to the app through `VITE_APP_URL`.

```bash
cd landing
cp .env.example .env   # VITE_APP_URL=http://localhost:5173
npm install
npm run dev            # http://localhost:5174
```

Deploy its `dist/` to any static host (root directory `landing`, build command `npm run build`, output `dist`), with `VITE_APP_URL` set to the app's URL.

Everything in it describes the original stockpilotai.com and its operator: the copy, `index.html` meta tags, `public/sitemap.xml`, the legal text and contact email in `src/data/legalContent.ts`, and the author links in `src/components/Footer.tsx`. Replace them before publishing your own.

## Project structure 📁

```
stockpilot-open/
├── landing/                  # Optional marketing site (separate project - see above)
├── server/                   # The API server (Node + Hono)
│   ├── index.ts              # Entry: runs migrations, serves /api and the built frontend
│   ├── app.ts                # Routes
│   ├── routes/               # stores, settings, layouts, account, openai, shopify/, woocommerce/
│   └── lib/                  # auth, db, migrations, crypto, store/settings data access, OpenAI client
├── src/
│   ├── components/           # Dashboard, onboarding, integrations, assistant
│   ├── contexts/             # Auth, filters, AI assistant
│   ├── hooks/                # Store data, preferences, dashboard presets
│   ├── pages/                # Routes: auth, dashboard, demo
│   ├── services/             # API client, Shopify/WooCommerce clients, cache, store health
│   └── utils/                # Metrics, forecasting, query analyzer, AI request building
├── Dockerfile
├── docker-compose.yml
└── public/                   # Static assets
```

## Data model

Better Auth owns `user`, `session`, `account` and `verification`. Everything else belongs to a user and is deleted with them:

| Table | Holds |
| --- | --- |
| `stores` | Connected stores: platform, URL, **encrypted** credentials, active flag, last sync health |
| `user_settings` | Preferences, and the user's **encrypted** OpenAI key (plus a short hint like `…a1b2`) |
| `dashboard_layouts` | Which Overview layout each store view uses |
| `recommendations` | Last AI recommendations per store view, reused for a week |
| `oauth_states` | One-time state for the Shopify/WooCommerce connect flows |

Contributions are welcome: open an issue or a pull request.

## License 📄

MIT. See [LICENSE](./LICENSE).
