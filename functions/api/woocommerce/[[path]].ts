import { getDoc, queryCollection } from '../../lib/firestoreRest';
import { verifyAuth } from '../../lib/auth';
import { preflightResponse, jsonResponse } from '../../lib/cors';
import { normalizeStoreUrl, basicAuthHeader } from '../../lib/wooCommerceAuth';

/**
 * Server-side proxy for the WooCommerce REST API, mirroring
 * functions/api/shopify/[[path]].ts: verifies the caller's Firebase ID
 * token, looks up that user's own store credentials in Firestore, and
 * forwards the request. The consumer key/secret never reach the browser.
 *
 * Path shape: /api/woocommerce/<endpoint> (e.g. /api/woocommerce/products)
 * with an optional x-store-id header to target a specific connected store.
 */
export async function onRequest(context: { request: Request }) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return preflightResponse();
  }

  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      console.error('WooCommerce proxy: missing or invalid Firebase ID token');
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const userId = auth.uid;
    const storeId = request.headers.get('x-store-id');

    if (storeId) {
      const storeDoc = await getDoc(`users/${userId}/stores/${storeId}`);
      if (!storeDoc.exists) {
        return jsonResponse({ error: 'Store not found' }, 404);
      }
      const storeData = storeDoc.data()!;
      return makeWooCommerceRequest(
        request,
        storeData.storeUrl as string,
        storeData.consumerKey as string,
        storeData.consumerSecret as string
      );
    }

    const storesSnapshot = await queryCollection(
      `users/${userId}/stores`,
      { field: 'isActive', value: true },
      1
    );

    if (storesSnapshot.empty) {
      return jsonResponse({ error: 'No active WooCommerce store found' }, 404);
    }

    const storeData = storesSnapshot.docs[0].data()!;
    return makeWooCommerceRequest(
      request,
      storeData.storeUrl as string,
      storeData.consumerKey as string,
      storeData.consumerSecret as string
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
  // storeUrl comes from a Firestore doc the authenticated user can write to
  // directly - re-validate here (not just at connect-time) so a tampered
  // doc can't turn this server-side fetch() into an SSRF vector.
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

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        // Surface WooCommerce's pagination headers so the client can page through results.
        'X-WP-Total': wooResponse.headers.get('X-WP-Total') || '',
        'X-WP-TotalPages': wooResponse.headers.get('X-WP-TotalPages') || '',
      },
    });
  } catch (error) {
    // Transport-level failure - DNS, TLS, dropped connection. For a store
    // that's been taken down entirely this is the path that fires.
    console.error('Error making WooCommerce API request:', error);
    return jsonResponse({ error: 'Error making WooCommerce API request', details: (error as Error).message }, 502);
  }
}
