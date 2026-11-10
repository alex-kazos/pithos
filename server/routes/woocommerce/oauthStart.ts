import { verifyAuth } from '../../lib/auth';
import { jsonResponse } from '../../lib/http';
import { normalizeStoreUrl } from '../../lib/wooCommerceAuth';
import { buildAuthorizeUrl } from '../../lib/wooCommerceOAuth';
import { createOAuthState } from '../../lib/oauthState';
import { publicUrl } from '../../lib/config';

/**
 * Starts the WooCommerce "Connect with WooCommerce" flow. Called via fetch
 * (not a page nav) so it runs with the user's session - the returned
 * authorize URL is then navigated to directly. Mirrors
 * routes/shopify/oauthStart.ts.
 */
export async function onRequest(context: { request: Request }) {
  const { request } = context;

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
  await createOAuthState(nonce, {
    userId: auth.uid,
    platform: 'woocommerce',
    target: storeUrl,
    onboarding: body.onboarding === true,
  });

  const returnUrl = publicUrl(body.onboarding === true ? '/dashboard?onboarding=1' : '/dashboard');
  const callbackUrl = publicUrl('/api/woocommerce/oauth/callback');

  const url = buildAuthorizeUrl(storeUrl, nonce, returnUrl, callbackUrl);
  return jsonResponse({ url });
}
