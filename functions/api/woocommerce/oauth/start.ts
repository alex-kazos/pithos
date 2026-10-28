import { setDoc } from '../../../lib/firestoreRest';
import { verifyAuth } from '../../../lib/auth';
import { preflightResponse, jsonResponse } from '../../../lib/cors';
import { normalizeStoreUrl } from '../../../lib/wooCommerceAuth';
import { buildAuthorizeUrl } from '../../../lib/wooCommerceOAuth';

const STATE_COLLECTION = 'woocommerceOAuthState';

/**
 * Starts the WooCommerce "Connect with WooCommerce" flow. Called via fetch
 * (not a page nav) so it can carry the Firebase ID token - the returned
 * authorize URL is then navigated to directly. Mirrors
 * functions/api/shopify/oauth/start.ts.
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
  const storeUrl = typeof body.storeUrl === 'string' ? normalizeStoreUrl(body.storeUrl) : null;
  if (!storeUrl) {
    return jsonResponse({ error: 'Enter a valid store URL, e.g. https://your-store.com' }, 400);
  }

  const nonce = crypto.randomUUID();
  await setDoc(`${STATE_COLLECTION}/${nonce}`, {
    uid: auth.uid,
    storeUrl,
    createdAt: Date.now(),
  });

  const returnUrl = new URL(body.onboarding === true ? '/dashboard?onboarding=1' : '/dashboard', request.url).toString();
  const callbackUrl = new URL('/api/woocommerce/oauth/callback', request.url).toString();

  const url = buildAuthorizeUrl(storeUrl, nonce, returnUrl, callbackUrl);
  return jsonResponse({ url });
}
