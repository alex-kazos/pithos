import { verifyAuth } from '../../lib/auth';
import { jsonResponse } from '../../lib/http';
import { normalizeShopDomain, buildAuthorizeUrl } from '../../lib/shopifyOAuth';
import { createOAuthState } from '../../lib/oauthState';
import { isShopifyOAuthConfigured, publicUrl } from '../../lib/config';

/**
 * Starts the Shopify OAuth install flow. Called via fetch (not a page nav)
 * so it runs with the user's session - the returned authorize URL is then
 * navigated to directly. The user id is stashed server-side against the
 * one-time `state` value so the callback (which Shopify hits directly)
 * knows which Pithos user to attach the store to.
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

  if (!isShopifyOAuthConfigured()) {
    return jsonResponse(
      { error: 'One-click Shopify connect is not set up on this server. Paste an Admin API access token instead.' },
      503
    );
  }

  const body = await request.json().catch(() => ({} as any));
  const shop = typeof body.shop === 'string' ? normalizeShopDomain(body.shop) : null;
  if (!shop) {
    return jsonResponse({ error: 'Enter a valid Shopify store domain, e.g. your-store.myshopify.com' }, 400);
  }

  const state = crypto.randomUUID();
  await createOAuthState(state, {
    userId: auth.uid,
    platform: 'shopify',
    target: shop,
    onboarding: body.onboarding === true,
  });

  const url = buildAuthorizeUrl(shop, state, publicUrl('/api/shopify/oauth/callback'));
  return jsonResponse({ url });
}
