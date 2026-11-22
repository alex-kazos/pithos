<p align="center"><img src="public/images/logo/pithos-icon.svg" width="96" alt="" /></p>

# Pithos

Pithos is an open-source inventory analytics dashboard for **Shopify** and **WooCommerce** stores. It pulls your products and orders, flags stockouts and dead stock, forecasts demand, and uses an LLM to write restock recommendations and answer questions about your store data.

**[Try the live demo →](https://pithos.alexkazos.com)** (sample data, nothing to sign up for)

![The Pithos dashboard](img.png)

> **Self-hosted and fully open source.** One `docker compose up` runs the whole thing on your own machine or server: a Node API, a Postgres database and open-source login ([Better Auth](https://www.better-auth.com)). No cloud accounts are needed, and every user brings their **own OpenAI API key**, added in Settings.

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

The browser only ever talks to the app's own `/api`, using an HTTP-only session cookie. Secrets stay on the server: store credentials (Shopify tokens, WooCommerce keys) and each user's OpenAI key are **encrypted at rest** (AES-256-GCM) and never sent back to the browser.

## Quick start with Docker 🐳

You need [Docker](https://docs.docker.com/get-docker/) with Compose.

```bash
git clone https://github.com/alex-kazos/pithos.git
cd pithos
cp .env.example .env
```

Open `.env` and set `BETTER_AUTH_SECRET` to a random string of at least 32 characters (for example the output of `openssl rand -base64 32`). Then:

```bash
docker compose up -d
```

Open http://localhost:3000, create an account, connect a store, and add your OpenAI API key under **Settings → AI & API key**.

To run it on a real domain, put it behind your usual reverse proxy (Caddy, nginx, Traefik, ...) and set `APP_URL` to the public URL, e.g. `https://pithos.example.com`. Data lives in the `db-data` Docker volume.

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
| `ALLOW_PRIVATE_DATABASE_HOSTS` | no | `true` lets users connect databases on private/local addresses (see below). Off by default |

There is no server-wide OpenAI key: AI features use the signed-in user's own key, so each user pays for their own usage. Without a saved key, the dashboard works and the AI features ask the user to add one.

## Connecting stores 🛒

Users connect stores from the dashboard after signing in.

**WooCommerce: nothing to configure.**
- *One-click*: uses WooCommerce's built-in [application authentication](https://developer.woocommerce.com/docs/apis/rest-api/authentication/#application-authentication). The store's server POSTs the generated keys back to `/api/woocommerce/oauth/callback`, so your deployment must be reachable from the internet (this won't work against `localhost`).
- *Manual*: in WordPress go to **WooCommerce → Settings → Advanced → REST API**, create a key with **Read** permission, and paste the consumer key and secret.

**Shopify: pick one.**
- *Custom app (simplest, for your own store)*: in the [Shopify Dev Dashboard](https://help.shopify.com/en/manual/apps/install-setup-apps#create-and-install-a-custom-app), create an app with the `read_products` and `read_orders` Admin API scopes (`read_customers` is optional), release a version and install it on your store. Then paste its **client ID and client secret** in the connect screen. Pithos exchanges them for an access token and renews it every 24 hours ([Shopify's client credentials grant](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/client-credentials-grant)). The app must belong to the same Shopify organization as the store. No server configuration needed.
- *Access token (custom apps created before 2026)*: older custom apps made in the Shopify admin can still [reveal an Admin API access token](https://help.shopify.com/en/manual/apps/install-setup-apps#get-access-token-legacy) (starts with `shpat_`) once. Paste it in the connect screen under **Access token**.
- *One-click OAuth*: create your **own** app in the [Shopify Partner Dashboard](https://partners.shopify.com), add `{APP_URL}/api/shopify/oauth/callback` to its allowed redirection URLs, and set `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET`. An app with *custom distribution* can only be installed on the store or organization you pick when you create the install link. To let any merchant connect, the app needs *public* distribution, which means going through Shopify's app review.

Pasted tokens and keys are checked against the store before they're saved.

**Your own database (PostgreSQL, MySQL, MariaDB).**
Not on Shopify or WooCommerce? Connect the database your shop already runs on and give Pithos two SQL queries; their column names (use `AS` to rename) are all it needs:

| Query | One row per | Required columns | Optional columns |
| --- | --- | --- | --- |
| Products | product | `id`, `title`, `inventory_quantity` | `sku`, `price`, `product_type`, `created_at`, `updated_at` |
| Orders | order line item | `order_id`, `created_at`, `product_id`, `quantity` | `price` (unit price), `total_price`, `line_item_id` |

`product_id` must match the products query's `id` (integers, UUIDs or text codes all work). For example:

```sql
-- Products
SELECT id, name AS title, sku, price, stock AS inventory_quantity, category AS product_type FROM products

-- Orders (PostgreSQL; on MySQL/MariaDB write NOW() - INTERVAL 1 YEAR)
SELECT o.id AS order_id, o.created_at, i.product_id, i.quantity, i.unit_price AS price
FROM orders o JOIN order_items i ON i.order_id = o.id
WHERE o.created_at >= now() - interval '1 year'
```

Connect with a connection string (`postgres://…`, `mysql://…` or `mariadb://…`; SSL is set with `?sslmode=` or MySQL's `?ssl-mode=`) or with host and credentials.

Both queries are run once before the connection is saved. They always run in a read-only transaction with a 30-second timeout, one statement at a time, and may return at most 100,000 rows each. Even so, connect with a user that can only `SELECT` the tables you need:

```sql
-- PostgreSQL
CREATE ROLE pithos_readonly LOGIN PASSWORD '...';
GRANT SELECT ON products, orders, order_items TO pithos_readonly;

-- MySQL / MariaDB
CREATE USER 'pithos_readonly'@'%' IDENTIFIED BY '...';
GRANT SELECT ON shop.products TO 'pithos_readonly'@'%';  -- repeat for orders, order_items
```

On MySQL and MariaDB, `DATETIME` values are read as UTC. The server-side timeout needs MySQL 5.7.8+ or MariaDB 10.1+; older versions still connect, but a slow query is then only cut off by Pithos's own timeout.

Connection details are encrypted at rest like other store credentials, and the password is never sent back to the browser. To protect the network Pithos runs on, it only connects to databases with public addresses. On a self-hosted deployment where the database is on the same machine or LAN, set `ALLOW_PRIVATE_DATABASE_HOSTS=true`.

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
docker compose exec db createdb -U pithos pithos_test
TEST_DATABASE_URL=postgres://pithos:pithos@localhost:5432/pithos_test npm test
```

`server/lib/customDatabase.mysql.test.ts` checks the own-database connector against real MySQL and MariaDB servers (read-only enforcement, timeouts, ids and dates). Each engine runs only when its URL is set, e.g.:

```bash
docker run -d --rm --name pithos-mysql -e MYSQL_ROOT_PASSWORD=pithos -e MYSQL_DATABASE=pithos_test -p 3306:3306 mysql:8.4
TEST_MYSQL_URL=mysql://root:pithos@127.0.0.1:3306/pithos_test npm test
```

`TEST_MARIADB_URL` works the same way. CI runs both.

## Project structure 📁

```
pithos/
├── server/                   # The API server (Node + Hono)
│   ├── index.ts              # Entry: runs migrations, serves /api and the built frontend
│   ├── app.ts                # Routes
│   ├── routes/               # stores, settings, layouts, account, openai, database, shopify/, woocommerce/
│   └── lib/                  # auth, db, migrations, crypto, store/settings data access, OpenAI client, own-database connector
├── src/
│   ├── components/           # Dashboard, onboarding, integrations, assistant
│   ├── contexts/             # Auth, filters, AI assistant
│   ├── hooks/                # Store data, preferences, dashboard presets
│   ├── pages/                # Routes: auth, dashboard, demo
│   ├── services/             # API client, Shopify/WooCommerce/database clients, cache, store health
│   └── utils/                # Metrics, forecasting, query analyzer, AI request building
├── Dockerfile
├── docker-compose.yml
└── public/                   # Static assets
```

## Data model

Better Auth owns `user`, `session`, `account` and `verification`. Everything else belongs to a user and is deleted with them:

| Table | Holds |
| --- | --- |
| `stores` | Connected stores and own databases: platform, URL, label, **encrypted** credentials (for databases also the SQL queries), active flag, last sync health |
| `user_settings` | Preferences, and the user's **encrypted** OpenAI key (plus a short hint like `…a1b2`) |
| `dashboard_layouts` | Which Overview layout each store view uses |
| `recommendations` | Last AI recommendations per store view, reused for a week |
| `oauth_states` | One-time state for the Shopify/WooCommerce connect flows |

Contributions are welcome: open an issue or a pull request.

## License 📄

MIT. See [LICENSE](./LICENSE).
