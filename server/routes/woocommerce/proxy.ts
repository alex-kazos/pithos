import { verifyAuth } from '../../lib/auth';
import { jsonResponse } from '../../lib/http';
import { normalizeStoreUrl, basicAuthHeader } from '../../lib/wooCommerceAuth';
import { getStore } from '../../lib/stores';

/**
 * Server-side proxy for the WooCommerce REST API, mirroring
 * routes/shopify/proxy.ts: the browser names a store with the x-store-id
 * header, and its consumer key/secret are looked up (and decrypted) here.
 * They never reach the browser.
 *
 * Path shape: /api/woocommerce/<endpoint> (e.g. /api/woocommerce/products).
 */
export async function onRequest(context: { request: Request }) {
  const { request } = context;

  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const storeId = request.headers.get('x-store-id');
    if (!storeId) {
      return jsonResponse({ error: 'x-store-id header is required' }, 400);
    }

    const store = await getStore(auth.uid, storeId);
    if (!store || store.platform !== 'woocommerce' || !('consumerKey' in store.credentials)) {
      return jsonResponse({ error: 'Store not found' }, 404);
    }

    return makeWooCommerceRequest(
      request,
      store.url,
      store.credentials.consumerKey,
      store.credentials.consumerSecret
    );
  } catch (error) {
    console.error('WooCommerce proxy error:', (error as Error).message);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
}

async function makeWooCommerceRequest(
  request: Request,
  storeUrl: string,
  consumerKey: string,
  consumerSecret: string
) {
  // Re-validated on every request, not just at connect time, so a bad
  // stored value can't turn this server-side fetch() into an SSRF vector.
  const validStoreUrl = normalizeStoreUrl(storeUrl);
  if (!validStoreUrl) {
    console.error('Rejected WooCommerce request: storeUrl failed validation', { storeUrl });
    return jsonResponse({ error: 'Invalid WooCommerce store URL' }, 400);
  }

  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/').filter(Boolean); // ['api', 'woocommerce', ...endpoint]
  const endpoint = pathSegments.slice(2).join('/') || 'products';

  const searchParams = new URLSearchParams(url.searchParams);
  if (!searchParams.has('per_page')) {
    searchParams.set('per_page', '100');
  }

  const wooUrl = `${validStoreUrl}/wp-json/wc/v3/${endpoint}?${searchParams.toString()}`;

  const requestOptions: RequestInit = {
    method: request.method,
    headers: {
      Authorization: basicAuthHeader(consumerKey, consumerSecret),
      'Content-Type': 'application/json',
    },
  };

  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    const contentType = request.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      requestOptions.body = await request.text();
    }
  }

  try {
    const wooResponse = await fetch(wooUrl, requestOptions);

    if (!wooResponse.ok) {
      const details = await wooResponse.text();
      // `upstreamStatus` lets the client tell "reconnect this store" apart
      // from "retry later" - see src/utils/storeHealth.ts.
      return jsonResponse(
        { error: `WooCommerce API error: ${wooResponse.status}`, upstreamStatus: wooResponse.status, details },
        wooResponse.status
      );
    }

    const data = await wooResponse.json();

    return jsonResponse(data, 200, {
      // Surface WooCommerce's pagination headers so the client can page through results.
      'X-WP-Total': wooResponse.headers.get('X-WP-Total') || '',
      'X-WP-TotalPages': wooResponse.headers.get('X-WP-TotalPages') || '',
    });
  } catch (error) {
    // Transport-level failure - DNS, TLS, dropped connection. For a store
    // that's been taken down entirely this is the path that fires.
    console.error('Error making WooCommerce API request:', error);
    return jsonResponse({ error: 'Error making WooCommerce API request', details: (error as Error).message }, 502);
  }
}
