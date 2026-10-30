import { verifyAuth } from '../../lib/auth';
import { jsonResponse } from '../../lib/http';
import { normalizeShopDomain } from '../../lib/shopifyOAuth';
import { getStore } from '../../lib/stores';

/**
 * Server-side proxy for the Shopify Admin API. The browser names a store
 * with the x-store-id header; its access token is looked up (and decrypted)
 * here and never leaves the server.
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
    if (!store || store.platform !== 'shopify' || !('apiToken' in store.credentials)) {
      return jsonResponse({ error: 'Store not found' }, 404);
    }

    return makeShopifyRequest(request, store.url, store.credentials.apiToken);
  } catch (error) {
    console.error('Shopify proxy error:', (error as Error).message);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
}

async function makeShopifyRequest(request: Request, shopUrl: string, apiToken: string) {
  // Re-validated on every request, not just at connect time: this fetch()
  // runs server-side, so a bad value here would let it reach an arbitrary
  // host (SSRF) instead of a real Shopify store.
  const cleanShopUrl = normalizeShopDomain(shopUrl);
  if (!cleanShopUrl) {
    console.error('Rejected Shopify request: shopUrl is not a valid *.myshopify.com domain', { shopUrl });
    return jsonResponse({ error: 'Invalid Shopify store domain' }, 400);
  }

  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/');
  let apiVersion = '2024-01';
  let endpoint = '';

  for (let i = 0; i < pathSegments.length; i++) {
    if (pathSegments[i] === 'api' && pathSegments[i + 1] && /^\d{4}-\d{2}$/.test(pathSegments[i + 1])) {
      apiVersion = pathSegments[i + 1];
      if (pathSegments[i + 2]) {
        endpoint = pathSegments[i + 2];
      }
      break;
    }
  }

  if (!endpoint) {
    endpoint = pathSegments[pathSegments.length - 1];
  }

  const searchParams = new URL(request.url).searchParams;

  if (!searchParams.has('limit')) {
    searchParams.append('limit', '250');
  }
  if (endpoint === 'orders' && !searchParams.has('status')) {
    searchParams.append('status', 'any');
  }

  const shopifyUrl = `https://${cleanShopUrl}/admin/api/${apiVersion}/${endpoint}.json${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  console.log('Making Shopify request:', {
    method: request.method,
    url: shopifyUrl,
    hasToken: !!apiToken,
    endpoint,
    apiVersion,
  });

  const requestOptions: RequestInit = {
    method: request.method,
    headers: {
      'X-Shopify-Access-Token': apiToken,
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
    const shopifyResponse = await fetch(shopifyUrl, requestOptions);

    if (!shopifyResponse.ok) {
      // Pass Shopify's own status through rather than collapsing everything
      // into a 500. The client classifies a store's health from this (see
      // src/utils/storeHealth.ts): a 401 means the app was uninstalled or
      // the token revoked and the merchant must reconnect, while a 5xx is
      // worth simply retrying - advice we can't give from a blanket 500.
      console.error('Shopify API returned an error status:', shopifyResponse.status);
      return jsonResponse({
        error: `Shopify API error: ${shopifyResponse.status}`,
        upstreamStatus: shopifyResponse.status,
      }, shopifyResponse.status);
    }

    const responseData = await shopifyResponse.json();

    console.log('Shopify response received:', {
      status: shopifyResponse.status,
      hasData: !!responseData,
    });

    return jsonResponse(responseData, 200);
  } catch (error) {
    // Only a transport-level failure reaches here - DNS, TLS or a dropped
    // connection - which is genuinely "we couldn't reach the store".
    console.error('Error making Shopify API request:', error);
    return jsonResponse({
      error: 'Error making Shopify API request',
      details: (error as Error).message,
    }, 502);
  }
}
