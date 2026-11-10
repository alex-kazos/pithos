import { normalizeShopDomain, requestClientCredentialsToken } from './shopifyOAuth';
import { updateStoreCredentials, type StoreWithCredentials } from './stores';

// Ask Shopify for a new token this long before the cached one expires.
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

/**
 * The Admin API token to use for a Shopify store. Stores connected with a
 * pasted token or through OAuth have a permanent one; stores connected with
 * a Dev Dashboard app's client ID + secret get a 24-hour token, which is
 * cached with the store and re-requested when it is about to expire.
 *
 * Returns null for a store with no usable Shopify credentials. Throws
 * ClientCredentialsError when Shopify refuses to issue a new token.
 */
export async function getShopifyAccessToken(userId: string, store: StoreWithCredentials): Promise<string | null> {
  const credentials = store.credentials;
  if ('apiToken' in credentials) return credentials.apiToken;
  if (!('clientId' in credentials)) return null;

  const expiresAt = credentials.tokenExpiresAt ? new Date(credentials.tokenExpiresAt).getTime() : 0;
  if (credentials.accessToken && expiresAt - REFRESH_MARGIN_MS > Date.now()) {
    return credentials.accessToken;
  }

  // Same SSRF guard as the proxy: only ever call a real *.myshopify.com host.
  const shop = normalizeShopDomain(store.url);
  if (!shop) return null;

  const token = await requestClientCredentialsToken(shop, credentials.clientId, credentials.clientSecret);
  await updateStoreCredentials(userId, store.id, {
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    accessToken: token.accessToken,
    tokenExpiresAt: token.expiresAt,
  });
  return token.accessToken;
}
