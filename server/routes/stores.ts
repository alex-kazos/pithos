import { Hono } from 'hono';
import { requireUser, type AuthedEnv } from '../lib/requireUser';
import {
  deleteStore,
  listStores,
  saveStore,
  setActiveStore,
  setStoreConnection,
  type StoreConnectionRecord,
} from '../lib/stores';
import {
  ClientCredentialsError,
  isValidAccessToken,
  normalizeShopDomain,
  requestClientCredentialsToken,
  storeIdFromShop,
  verifyAccessToken,
} from '../lib/shopifyOAuth';
import {
  isValidConsumerKey,
  isValidConsumerSecret,
  normalizeStoreUrl,
  storeIdFromUrl,
} from '../lib/wooCommerceAuth';
import { verifyWooCommerceKeysWork } from '../lib/wooCommerceOAuth';

/**
 * The user's connected stores. Listing never includes credentials; manual
 * connects (pasted Shopify token / WooCommerce REST keys) are verified
 * against the store before anything is saved.
 */
export const storesRoutes = new Hono<AuthedEnv>();

storesRoutes.use('*', requireUser);

storesRoutes.get('/', async c => {
  return c.json({ stores: await listStores(c.var.user.uid) });
});

storesRoutes.post('/', async c => {
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>));
  const uid = c.var.user.uid;

  if (body.platform === 'shopify') {
    const rawShop = typeof body.shop === 'string' ? body.shop.trim() : '';
    const shop = normalizeShopDomain(rawShop.includes('.') ? rawShop : `${rawShop}.myshopify.com`);
    if (!shop) return c.json({ error: 'Enter a valid store URL, e.g. "your-store.myshopify.com"' }, 400);

    // Dev Dashboard apps (created since 2026): exchange the client ID and
    // secret for a 24-hour token now, which also proves they work.
    if (body.clientId !== undefined || body.clientSecret !== undefined) {
      const clientId = typeof body.clientId === 'string' ? body.clientId.trim() : '';
      const clientSecret = typeof body.clientSecret === 'string' ? body.clientSecret.trim() : '';
      const looksValid = (v: string) => v.length >= 10 && v.length <= 200 && !/\s/.test(v);
      if (!looksValid(clientId) || !looksValid(clientSecret)) {
        return c.json({ error: "Enter the app's client ID and client secret from the Shopify Dev Dashboard." }, 400);
      }

      try {
        const token = await requestClientCredentialsToken(shop, clientId, clientSecret);
        const store = await saveStore(uid, {
          id: storeIdFromShop(shop),
          platform: 'shopify',
          url: shop,
          credentials: { clientId, clientSecret, accessToken: token.accessToken, tokenExpiresAt: token.expiresAt },
          authMethod: 'client_credentials',
          scope: token.scope,
        });
        return c.json({ store }, 201);
      } catch (error) {
        if (error instanceof ClientCredentialsError) {
          return c.json({ error: error.message }, error.reason === 'unreachable' ? 502 : 400);
        }
        throw error;
      }
    }

    const apiToken = typeof body.apiToken === 'string' ? body.apiToken.trim() : '';
    if (!isValidAccessToken(apiToken)) {
      return c.json({ error: 'Enter a valid Admin API access token (starts with shpat_, shpca_, or shppa_)' }, 400);
    }

    const verdict = await verifyAccessToken(shop, apiToken);
    if (verdict === 'rejected') return c.json({ error: 'Shopify rejected that access token for this store.' }, 400);
    if (verdict === 'unreachable') return c.json({ error: `Could not reach ${shop}. Check the store URL and try again.` }, 502);

    const store = await saveStore(uid, {
      id: storeIdFromShop(shop),
      platform: 'shopify',
      url: shop,
      credentials: { apiToken },
      authMethod: 'token',
    });
    return c.json({ store }, 201);
  }

  if (body.platform === 'woocommerce') {
    const storeUrl = typeof body.storeUrl === 'string' ? normalizeStoreUrl(body.storeUrl) : null;
    const consumerKey = typeof body.consumerKey === 'string' ? body.consumerKey.trim() : '';
    const consumerSecret = typeof body.consumerSecret === 'string' ? body.consumerSecret.trim() : '';
    if (!storeUrl) return c.json({ error: 'Enter your store\'s full URL, e.g. "https://your-store.com"' }, 400);
    if (!isValidConsumerKey(consumerKey) || !isValidConsumerSecret(consumerSecret)) {
      return c.json({ error: 'Enter a valid consumer key (ck_…) and consumer secret (cs_…)' }, 400);
    }

    const keysWork = await verifyWooCommerceKeysWork(storeUrl, consumerKey, consumerSecret);
    if (!keysWork) {
      return c.json({ error: 'Could not read products with those keys. Check the URL and that the key has Read access.' }, 400);
    }

    const store = await saveStore(uid, {
      id: storeIdFromUrl(storeUrl),
      platform: 'woocommerce',
      url: storeUrl,
      credentials: { consumerKey, consumerSecret },
      authMethod: 'manual',
    });
    return c.json({ store }, 201);
  }

  return c.json({ error: 'platform must be "shopify" or "woocommerce"' }, 400);
});

storesRoutes.delete('/:id', async c => {
  const deleted = await deleteStore(c.var.user.uid, c.req.param('id'));
  return deleted ? c.json({ deleted: true }) : c.json({ error: 'Store not found' }, 404);
});

storesRoutes.post('/:id/activate', async c => {
  const ok = await setActiveStore(c.var.user.uid, c.req.param('id'));
  return ok ? c.json({ active: true }) : c.json({ error: 'Store not found' }, 404);
});

const MAX_DETAIL_LENGTH = 500;

function parseConnection(body: Record<string, unknown>): StoreConnectionRecord | null {
  if (body.status !== 'ok' && body.status !== 'error') return null;
  const text = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : undefined);
  return {
    status: body.status,
    reason: text(body.reason, 40),
    detail: text(body.detail, MAX_DETAIL_LENGTH),
    checkedAt: text(body.checkedAt, 40) ?? new Date().toISOString(),
  };
}

/** Records the outcome of the dashboard's last sync of this store (shown in Manage Stores). */
storesRoutes.put('/:id/connection', async c => {
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>));
  const connection = parseConnection(body);
  if (!connection) return c.json({ error: 'status must be "ok" or "error"' }, 400);

  const ok = await setStoreConnection(c.var.user.uid, c.req.param('id'), connection);
  return ok ? c.json({ connection }) : c.json({ error: 'Store not found' }, 404);
});
