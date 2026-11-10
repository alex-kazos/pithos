import { basicAuthHeader } from './wooCommerceAuth';

/**
 * WooCommerce's "application authentication" flow
 * (https://developer.woocommerce.com/docs/apis/rest-api/authentication/#application-authentication):
 * redirect the merchant to their own wp-admin to approve, then WooCommerce's
 * server POSTs the generated keys to our callback_url directly - no
 * signature on that POST the way Shopify signs its OAuth callback. The
 * `user_id` param we send is an opaque reference WooCommerce echoes straight
 * back in the callback body, so it doubles as our CSRF-protecting nonce
 * (same role as Shopify's `state`), even without a cryptographic guarantee
 * that the callback genuinely originated from WooCommerce.
 */
export function buildAuthorizeUrl(storeUrl: string, nonce: string, returnUrl: string, callbackUrl: string): string {
  const url = new URL(`${storeUrl}/wc-auth/v1/authorize`);
  url.searchParams.set('app_name', 'Pithos');
  url.searchParams.set('scope', 'read'); // read-only: nothing in this app writes back to the store
  url.searchParams.set('user_id', nonce);
  url.searchParams.set('return_url', returnUrl);
  url.searchParams.set('callback_url', callbackUrl);
  return url.toString();
}

export interface WooCommerceCallbackPayload {
  key_id: number;
  user_id: string;
  consumer_key: string;
  consumer_secret: string;
  key_permissions: string;
}

/**
 * The one verification we *can* do: confirm the received keys actually work
 * against the specific store this nonce was issued for, before ever saving
 * them. Doesn't fully close the gap against an attacker submitting their own
 * real store's keys against a guessed nonce (impractical given nonce entropy
 * regardless), but it does reject garbage/malformed/wrong-store submissions.
 */
export async function verifyWooCommerceKeysWork(storeUrl: string, consumerKey: string, consumerSecret: string): Promise<boolean> {
  try {
    const response = await fetch(`${storeUrl}/wp-json/wc/v3/products?per_page=1`, {
      headers: { Authorization: basicAuthHeader(consumerKey, consumerSecret) },
    });
    return response.ok;
  } catch {
    return false;
  }
}
