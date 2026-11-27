import { Hono } from 'hono';
import { requireUser, type AuthedEnv } from '../lib/requireUser';
import { getStore } from '../lib/stores';
import {
  DatabaseConnectorError,
  MAX_ROWS,
  fetchOrders,
  fetchProducts,
  httpStatusFor,
  isDatabaseCredentials,
  toDatabaseConfig,
  type DatabaseCredentials,
} from '../lib/customDatabase';

/**
 * Reads a "bring your own database" store, the counterpart of the
 * Shopify/WooCommerce proxies: the browser names the store with x-store-id,
 * and its connection details (decrypted here) never reach the browser. The
 * answers are already in the ShopifyProduct/ShopifyOrder shape.
 */
export const databaseRoutes = new Hono<AuthedEnv & { Variables: { credentials: DatabaseCredentials } }>();

databaseRoutes.use('*', requireUser);

databaseRoutes.use('*', async (c, next) => {
  const storeId = c.req.header('x-store-id');
  if (!storeId) return c.json({ error: 'x-store-id header is required' }, 400);

  const store = await getStore(c.var.user.uid, storeId);
  if (!store || store.platform !== 'database' || !isDatabaseCredentials(store.credentials)) {
    return c.json({ error: 'Store not found' }, 404);
  }
  c.set('credentials', store.credentials);
  await next();
});

/** `?limit=` lets health checks read one row instead of the whole table. */
function parseLimit(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? Math.min(n, MAX_ROWS) : MAX_ROWS;
}

function failure(error: unknown) {
  if (!(error instanceof DatabaseConnectorError)) throw error;
  const status = httpStatusFor(error.reason);
  // `upstreamStatus` is what src/utils/storeHealth.ts reads to tell
  // "reconnect" (auth) apart from "retry later" (unreachable).
  return { body: { error: error.message, reason: error.reason, upstreamStatus: status }, status };
}

databaseRoutes.get('/products', async c => {
  try {
    return c.json(await fetchProducts(c.var.credentials, parseLimit(c.req.query('limit'))));
  } catch (error) {
    const { body, status } = failure(error);
    return c.json(body, status);
  }
});

databaseRoutes.get('/orders', async c => {
  try {
    return c.json(await fetchOrders(c.var.credentials, parseLimit(c.req.query('limit'))));
  } catch (error) {
    const { body, status } = failure(error);
    return c.json(body, status);
  }
});

/** The saved connection minus its password, so the edit form can be pre-filled. */
databaseRoutes.get('/config', c => c.json({ config: toDatabaseConfig(c.var.credentials) }));
