import { isValidConsumerKey, isValidConsumerSecret, storeIdFromUrl } from '../../lib/wooCommerceAuth';
import { verifyWooCommerceKeysWork, type WooCommerceCallbackPayload } from '../../lib/wooCommerceOAuth';
import { jsonResponse } from '../../lib/http';
import { consumeOAuthState } from '../../lib/oauthState';
import { saveStore } from '../../lib/stores';

/**
 * WooCommerce's server POSTs the generated keys here directly - unlike
 * Shopify's callback, this is server-to-server, not a browser redirect
 * (the merchant's browser separately lands on `return_url` from
 * oauthStart.ts, which we don't control the timing/response of). There's
 * no signature to verify on this POST, so every other safeguard matters
 * more: the one-time nonce ties this back to the right Pithos user and
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

    // One-time use: consumed here, whether or not the rest succeeds.
    const consumed = await consumeOAuthState(String(payload.user_id), 'woocommerce');
    if (!consumed.ok) {
      return jsonResponse(
        { error: consumed.reason === 'expired' ? 'Authorization expired' : 'Invalid or already-used authorization' },
        400
      );
    }

    const { userId, target: storeUrl } = consumed.state;

    const keysWork = await verifyWooCommerceKeysWork(storeUrl, payload.consumer_key, payload.consumer_secret);
    if (!keysWork) {
      console.error('WooCommerce OAuth callback: received keys do not work against the store', { storeUrl });
      return jsonResponse({ error: 'Could not verify the provided credentials against the store' }, 400);
    }

    await saveStore(userId, {
      id: storeIdFromUrl(storeUrl),
      platform: 'woocommerce',
      url: storeUrl,
      credentials: { consumerKey: payload.consumer_key, consumerSecret: payload.consumer_secret },
      authMethod: 'oauth',
      scope: payload.key_permissions,
    });

    return jsonResponse({ received: true });
  } catch (error) {
    console.error('WooCommerce OAuth callback error:', (error as Error).message);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}
