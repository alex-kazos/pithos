import { getDoc, setDoc, deleteDoc, queryCollection } from '../../../lib/firestoreRest';
import { normalizeShopDomain, verifyCallbackHmac, exchangeCodeForToken, storeIdFromShop } from '../../../lib/shopifyOAuth';

const STATE_COLLECTION = 'shopifyOAuthState';
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function redirectTo(origin: string, status: 'connected' | 'error', detail?: string, onboarding?: boolean): Response {
  const url = new URL('/dashboard', origin);
  url.searchParams.set('shopify', status);
  if (detail) url.searchParams.set('shopify_detail', detail);
  if (onboarding) url.searchParams.set('onboarding', '1');
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

/**
 * Shopify redirects the merchant's browser here directly after they approve
 * (or decline) installation - there's no Authorization header to check, so
 * every safeguard here matters: HMAC verification proves the request came
 * from Shopify, and the one-time `state` (written by oauth/start.ts, scoped
 * to a single Firebase uid + shop) is what ties this callback back to the
 * StockPilot user who initiated it. Without both, this endpoint would let
 * anyone attach an arbitrary Shopify access token to an arbitrary account.
 */
export async function onRequest(context: { request: Request }) {
  const { request } = context;
  const url = new URL(request.url);
  const origin = url.origin;

  try {
    const shop = normalizeShopDomain(url.searchParams.get('shop') || '');
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!shop || !code || !state) {
      return redirectTo(origin, 'error', 'missing_params');
    }

    const hmacValid = await verifyCallbackHmac(url.searchParams);
    if (!hmacValid) {
      console.error('Shopify OAuth callback: HMAC verification failed', { shop });
      return redirectTo(origin, 'error', 'invalid_hmac');
    }

    const statePath = `${STATE_COLLECTION}/${state}`;
    const stateDoc = await getDoc(statePath);

    if (!stateDoc.exists) {
      return redirectTo(origin, 'error', 'invalid_state');
    }

    const stateData = stateDoc.data()!;
    // One-time use: consume immediately, whether or not the rest succeeds.
    await deleteDoc(statePath);

    if (stateData.shop !== shop) {
      console.error('Shopify OAuth callback: shop mismatch against stored state', { expected: stateData.shop, got: shop });
      return redirectTo(origin, 'error', 'shop_mismatch');
    }
    if (Date.now() - (stateData.createdAt as number) > STATE_TTL_MS) {
      return redirectTo(origin, 'error', 'state_expired');
    }

    const uid = stateData.uid as string;
    const onboarding = stateData.onboarding === true;
    const storeId = storeIdFromShop(shop);
    const tokenResponse = await exchangeCodeForToken(shop, code);

    await setDoc(`users/${uid}/stores/${storeId}`, {
      shopUrl: shop,
      apiToken: tokenResponse.access_token,
      userId: uid,
      storeId,
      isActive: true,
      authMethod: 'oauth',
      scope: tokenResponse.scope,
      createdAt: new Date().toISOString(),
    });

    // Exactly one store may be isActive at a time - deactivate any others
    // before activating this one, so the "single active store" fetch paths
    // (functions/api/shopify/[[path]].ts's active-store fallback)
    // never see more than one candidate.
    const activeStores = await queryCollection(`users/${uid}/stores`, { field: 'isActive', value: true });
    await Promise.all(
      activeStores.docs
        .filter(doc => doc.id !== storeId)
        .map(doc => setDoc(`users/${uid}/stores/${doc.id}`, { isActive: false }, { merge: true }))
    );

    return redirectTo(origin, 'connected', undefined, onboarding);
  } catch (error) {
    console.error('Shopify OAuth callback error:', (error as Error).message);
    return redirectTo(origin, 'error', 'server_error');
  }
}
