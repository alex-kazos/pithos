import { Hono } from 'hono';
import { getAuth } from './lib/auth';
import { isGoogleSignInConfigured, isShopifyOAuthConfigured } from './lib/config';
import { storesRoutes } from './routes/stores';
import { settingsRoutes } from './routes/settings';
import { layoutsRoutes } from './routes/layouts';
import * as account from './routes/account';
import * as openai from './routes/openai';
import * as shopifyProxy from './routes/shopify/proxy';
import * as shopifyOAuthStart from './routes/shopify/oauthStart';
import * as shopifyOAuthCallback from './routes/shopify/oauthCallback';
import * as wooProxy from './routes/woocommerce/proxy';
import * as wooOAuthStart from './routes/woocommerce/oauthStart';
import * as wooOAuthCallback from './routes/woocommerce/oauthCallback';

type FetchHandler = { onRequest: (context: { request: Request }) => Promise<Response> };

/** Mounts a handler written against the plain Fetch API (`onRequest({ request })`). */
const handle = (route: FetchHandler) => (c: { req: { raw: Request } }) => route.onRequest({ request: c.req.raw });

/** The whole /api surface. Static frontend files are added by index.ts in production. */
export function createApp(): Hono {
  const app = new Hono();

  // Sign up / sign in / sessions / Google OAuth - all handled by Better Auth.
  app.on(['GET', 'POST'], '/api/auth/*', c => getAuth().handler(c.req.raw));

  // Which optional features this deployment has switched on (public).
  app.get('/api/config', c =>
    c.json({
      googleSignIn: isGoogleSignInConfigured(),
      shopifyOAuth: isShopifyOAuthConfigured(),
    })
  );

  app.route('/api/stores', storesRoutes);
  app.route('/api/settings', settingsRoutes);
  app.route('/api/layouts', layoutsRoutes);

  app.all('/api/account/*', handle(account));
  app.all('/api/openai/*', handle(openai));

  // OAuth routes first: the proxies below match everything else under their prefix.
  app.all('/api/shopify/oauth/start', handle(shopifyOAuthStart));
  app.all('/api/shopify/oauth/callback', handle(shopifyOAuthCallback));
  app.all('/api/shopify/*', handle(shopifyProxy));

  app.all('/api/woocommerce/oauth/start', handle(wooOAuthStart));
  app.all('/api/woocommerce/oauth/callback', handle(wooOAuthCallback));
  app.all('/api/woocommerce/*', handle(wooProxy));

  app.all('/api/*', c => c.json({ error: 'Not found' }, 404));

  app.onError((error, c) => {
    console.error('Unhandled API error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  });

  return app;
}
