import { getDoc, setDoc, deleteDoc, queryCollection } from '../../../lib/firestoreRest';
import { isValidConsumerKey, isValidConsumerSecret, storeIdFromUrl } from '../../../lib/wooCommerceAuth';
import { verifyWooCommerceKeysWork, type WooCommerceCallbackPayload } from '../../../lib/wooCommerceOAuth';
import { jsonResponse } from '../../../lib/cors';

const STATE_COLLECTION = 'woocommerceOAuthState';
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * WooCommerce's server POSTs the generated keys here directly - unlike
 * Shopify's callback, this is server-to-server, not a browser redirect
 * (the merchant's browser separately lands on `return_url` from
 * oauth/start.ts, which we don't control the timing/response of). There's
 * no signature to verify on this POST, so every other safeguard matters
 * more: the one-time nonce ties this back to the right StockPilot user and
 * the right store, and verifyWooCommerceKeysWork() confirms the keys
 * actually work against that specific store before anything is saved.
 */
export async function onRequest(context: { request: Request }) {
  const { request } = context;

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const payload = (await request.json().catch(() => null)) as WooCommerceCallbackPayload | null;
    if (!payload || !payload.user_id || !payload.consumer_key || !payload.consumer_secret) {
      return jsonResponse({ error: 'Missing required fields' }, 400);
    }

    if (!isValidConsumerKey(payload.consumer_key) || !isValidConsumerSecret(payload.consumer_secret)) {
      console.error('WooCommerce OAuth callback: malformed consumer key/secret');
      return jsonResponse({ error: 'Malformed credentials' }, 400);
    }

    const statePath = `${STATE_COLLECTION}/${payload.user_id}`;
    const stateDoc = await getDoc(statePath);
    if (!stateDoc.exists) {
      return jsonResponse({ error: 'Invalid or already-used authorization' }, 400);
    }

    const stateData = stateDoc.data()!;
    // One-time use: consume immediately, whether or not the rest succeeds.
    await deleteDoc(statePath);

    if (Date.now() - (stateData.createdAt as number) > STATE_TTL_MS) {
      return jsonResponse({ error: 'Authorization expired' }, 400);
    }

    const uid = stateData.uid as string;
    const storeUrl = stateData.storeUrl as string;

    const keysWork = await verifyWooCommerceKeysWork(storeUrl, payload.consumer_key, payload.consumer_secret);
    if (!keysWork) {
      console.error('WooCommerce OAuth callback: received keys do not work against the store', { storeUrl });
      return jsonResponse({ error: 'Could not verify the provided credentials against the store' }, 400);
    }

    const storeId = storeIdFromUrl(storeUrl);

    await setDoc(`users/${uid}/stores/${storeId}`, {
      storeUrl,
      consumerKey: payload.consumer_key,
      consumerSecret: payload.consumer_secret,
      platform: 'woocommerce',
      userId: uid,
      storeId,
      isActive: true,
      authMethod: 'oauth',
      keyPermissions: payload.key_permissions,
      createdAt: new Date().toISOString(),
    });

    // Exactly one store may be isActive at a time - deactivate any others first.
    const activeStores = await queryCollection(`users/${uid}/stores`, { field: 'isActive', value: true });
    await Promise.all(
      activeStores.docs
        .filter(doc => doc.id !== storeId)
        .map(doc => setDoc(`users/${uid}/stores/${doc.id}`, { isActive: false }, { merge: true }))
    );

    return jsonResponse({ received: true });
  } catch (error) {
    console.error('WooCommerce OAuth callback error:', (error as Error).message);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}
