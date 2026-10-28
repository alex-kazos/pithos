import { getDoc, queryCollection } from '../../lib/firestoreRest';
import { verifyAuth } from '../../lib/auth';
import { CORS_HEADERS, preflightResponse, jsonResponse } from '../../lib/cors';
import { normalizeShopDomain } from '../../lib/shopifyOAuth';

export async function onRequest(context: { request: Request }) {
  const { request } = context;

  console.log('Received request:', {
    path: new URL(request.url).pathname,
    method: request.method,
  });

  if (request.method === 'OPTIONS') {
    return preflightResponse();
  }

  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      console.error('Shopify proxy: missing or invalid Firebase ID token');
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const userId = auth.uid;

    // Check for Shopify access token directly in the headers
    const shopifyAccessToken = request.headers.get('x-shopify-access-token');
    const shopDomain = request.headers.get('x-shop-domain');
    const storeId = request.headers.get('x-store-id');

    // If we have a specific storeId, attempt to load that store (scoped to the authenticated user)
    if (storeId) {
      console.log(`Fetching specific store: ${storeId} for user: ${userId}`);
      try {
        const storeDoc = await getDoc(`users/${userId}/stores/${storeId}`);

        if (storeDoc.exists) {
          const storeData = storeDoc.data()!;
          console.log(`Found specific store: ${storeId}`);

          const token = shopifyAccessToken || (storeData.apiToken as string);
          return makeShopifyRequest(request, storeData.shopUrl as string, token);
        } else {
          console.error(`Store ID ${storeId} not found for user ${userId}`);
        }
      } catch (err) {
        console.error('Error fetching specific store:', err);
      }
    }

    // If we have a direct Shopify access token in headers, use it without querying Firestore
    if (shopifyAccessToken && shopDomain) {
      console.log('Using credentials from headers');
      return makeShopifyRequest(request, shopDomain, shopifyAccessToken);
    }

    console.log('Fetching credentials for user:', userId);

    try {
      const storesSnapshot = await queryCollection(`users/${userId}/stores`, { field: 'isActive', value: true }, 1);

      if (!storesSnapshot.empty) {
        const storeData = storesSnapshot.docs[0].data()!;
        console.log('Found active store:', storeData.storeId);
        return makeShopifyRequest(request, storeData.shopUrl as string, storeData.apiToken as string);
      } else {
        console.error('No active Shopify store found for user:', userId);
        return jsonResponse({ error: 'No active Shopify store found' }, 404);
      }
    } catch (err) {
      console.error('Error fetching store data:', err);
      return jsonResponse({
        error: 'Failed to retrieve Shopify credentials',
        details: (err as Error).message,
      }, 500);
    }
  } catch (error) {
    console.error('Shopify proxy error:', {
      message: (error as Error).message,
      stack: (error as Error).stack,
    });

    return jsonResponse({
      error: (error as Error).message,
      details: (error as any).response?.data,
    }, (error as any).response?.status || 500);
  }
}

async function makeShopifyRequest(request: Request, shopUrl: string, apiToken: string) {
  // shopUrl can come from a client-supplied x-shop-domain header, or from a
  // Firestore doc the authenticated user can write to directly (bypassing
  // any client-side form validation) - without this check, either path lets
  // an authenticated user point this server-side fetch() at an arbitrary
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
