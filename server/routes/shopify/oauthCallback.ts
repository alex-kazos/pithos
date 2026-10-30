import { normalizeShopDomain, verifyCallbackHmac, exchangeCodeForToken, storeIdFromShop } from '../../lib/shopifyOAuth';
import { consumeOAuthState } from '../../lib/oauthState';
import { saveStore } from '../../lib/stores';
import { publicUrl } from '../../lib/config';

function redirectTo(status: 'connected' | 'error', detail?: string, onboarding?: boolean): Response {
  const url = new URL(publicUrl('/dashboard'));
  url.searchParams.set('shopify', status);
  if (detail) url.searchParams.set('shopify_detail', detail);
  if (onboarding) url.searchParams.set('onboarding', '1');
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

/**
 * Shopify redirects the merchant's browser here directly after they approve
 * (or decline) installation - so every safeguard here matters: HMAC
 * verification proves the request came from Shopify, and the one-time
 * `state` (written by oauthStart.ts, scoped to one user + shop) is what ties
 * this callback back to the StockPilot user who initiated it. Without both,
 * this endpoint would let anyone attach an arbitrary Shopify access token to
 * an arbitrary account.
 */
export async function onRequest(context: { request: Request }) {
  const { request } = context;
  const url = new URL(request.url);

  try {
    const shop = normalizeShopDomain(url.searchParams.get('shop') || '');
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!shop || !code || !state) {
      return redirectTo('error', 'missing_params');
    }

    const hmacValid = await verifyCallbackHmac(url.searchParams);
    if (!hmacValid) {
      console.error('Shopify OAuth callback: HMAC verification failed', { shop });
      return redirectTo('error', 'invalid_hmac');
    }

    // One-time use: consumed here, whether or not the rest succeeds.
    const consumed = await consumeOAuthState(state, 'shopify');
    if (!consumed.ok) {
      return redirectTo('error', consumed.reason === 'expired' ? 'state_expired' : 'invalid_state');
    }

    const { userId, target, onboarding } = consumed.state;
    if (target !== shop) {
      console.error('Shopify OAuth callback: shop mismatch against stored state', { expected: target, got: shop });
      return redirectTo('error', 'shop_mismatch');
    }

    const tokenResponse = await exchangeCodeForToken(shop, code);
    await saveStore(userId, {
      id: storeIdFromShop(shop),
      platform: 'shopify',
      url: shop,
      credentials: { apiToken: tokenResponse.access_token },
      authMethod: 'oauth',
      scope: tokenResponse.scope,
    });

    return redirectTo('connected', undefined, onboarding);
  } catch (error) {
    console.error('Shopify OAuth callback error:', (error as Error).message);
    return redirectTo('error', 'server_error');
  }
}
