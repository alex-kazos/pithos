import { setDoc } from '../../../lib/firestoreRest';
import { verifyAuth } from '../../../lib/auth';
import { preflightResponse, jsonResponse } from '../../../lib/cors';
import { normalizeShopDomain, buildAuthorizeUrl } from '../../../lib/shopifyOAuth';

const STATE_COLLECTION = 'shopifyOAuthState';

/**
 * Starts the Shopify OAuth install flow. Called via fetch (not a page nav)
 * so it can carry the Firebase ID token - the returned authorize URL is then
 * navigated to directly. The Firebase uid is stashed server-side against the
 * one-time `state` value so the callback (which Shopify hits directly, with
 * no way to attach our auth header) knows which StockPilot user to attach
 * the store to.
 */
export async function onRequest(context: { request: Request }) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return preflightResponse();
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const auth = await verifyAuth(request);
  if (!auth) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const body = await request.json().catch(() => ({} as any));
  const shop = typeof body.shop === 'string' ? normalizeShopDomain(body.shop) : null;
  if (!shop) {
    return jsonResponse({ error: 'Enter a valid Shopify store domain, e.g. your-store.myshopify.com' }, 400);
  }

  const state = crypto.randomUUID();
  await setDoc(`${STATE_COLLECTION}/${state}`, {
    uid: auth.uid,
    shop,
    onboarding: body.onboarding === true,
    createdAt: Date.now(),
  });

  const redirectUri = new URL('/api/shopify/oauth/callback', request.url).toString();

  try {
    const url = buildAuthorizeUrl(shop, state, redirectUri);
    return jsonResponse({ url });
  } catch (error) {
    console.error('Failed to build Shopify authorize URL:', (error as Error).message);
    return jsonResponse({ error: 'Shopify OAuth is not configured on the server yet' }, 500);
  }
}
