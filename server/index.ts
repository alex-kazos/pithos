import { existsSync } from 'node:fs';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createApp } from './app';
import { runMigrations } from './lib/migrations';

// Local development reads settings from .env; in Docker they come from the
// container environment instead and there is no file to load.
try {
  process.loadEnvFile();
} catch {
  // No .env file - fine.
}

const port = Number(process.env.PORT) || 3000;
const STATIC_DIR = './dist';

async function main() {
  if ((process.env.BETTER_AUTH_SECRET ?? '').length < 32) {
    throw new Error('Set BETTER_AUTH_SECRET to a random string of at least 32 characters (see .env.example).');
  }

  await runMigrations();

  const app = createApp();

  // In production the built frontend is served from here too, so the whole
  // app is one origin. During `npm run dev`, Vite serves it instead.
  if (existsSync(`${STATIC_DIR}/index.html`)) {
    app.use('/*', serveStatic({ root: STATIC_DIR }));
    // Client-side routes (/dashboard/..., /auth, /demo) all load the SPA.
    app.get('*', serveStatic({ path: `${STATIC_DIR}/index.html` }));
  }

  serve({ fetch: app.fetch, port }, info => {
    console.log(`Pithos listening on http://localhost:${info.port}`);
  });
}

main().catch(error => {
  console.error('Failed to start Pithos:', error);
  process.exit(1);
});
