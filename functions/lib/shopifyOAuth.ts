const SHOP_DOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;

export function normalizeShopDomain(rawShop: string): string | null {
  const shop = rawShop.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
  return SHOP_DOMAIN_PATTERN.test(shop) ? shop : null;
}

function getApiKey(): string {
  const key = process.env.SHOPIFY_API_KEY;
  if (!key) throw new Error('Missing SHOPIFY_API_KEY environment variable.');
  return key;
}

function getApiSecret(): string {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) throw new Error('Missing SHOPIFY_API_SECRET environment variable.');
  return secret;
}

function getScopes(): string {
  return process.env.SHOPIFY_SCOPES || 'read_products,read_orders,read_customers';
}

export function buildAuthorizeUrl(shop: string, state: string, redirectUri: string): string {
  const url = new URL(`https://${shop}/admin/oauth/authorize`);
  url.searchParams.set('client_id', getApiKey());
  url.searchParams.set('scope', getScopes());
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  return url.toString();
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Verifies the `hmac` query param Shopify attaches to the OAuth callback
 * request, per https://shopify.dev/docs/apps/build/authentication-authorization/get-access-tokens/authorization-code-grant#step-4-confirm-installation
 */
export async function verifyCallbackHmac(searchParams: URLSearchParams): Promise<boolean> {
  const hmac = searchParams.get('hmac');
  if (!hmac) return false;

  const pairs: string[] = [];
  searchParams.forEach((value, key) => {
    if (key === 'hmac' || key === 'signature') return;
    pairs.push(`${key}=${value}`);
  });
  pairs.sort();
  const message = pairs.join('&');

  const computed = await hmacHex(getApiSecret(), message);
  return timingSafeEqual(computed, hmac);
}

export interface ShopifyAccessTokenResponse {
  access_token: string;
  scope: string;
}

export async function exchangeCodeForToken(shop: string, code: string): Promise<ShopifyAccessTokenResponse> {
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: getApiKey(),
      client_secret: getApiSecret(),
      code,
    }),
  });

  if (!response.ok) {
    throw new Error(`Shopify token exchange failed: ${response.status}`);
  }

  return response.json();
}

export function storeIdFromShop(shop: string): string {
  return shop.replace(/\.myshopify\.com$/, '');
}
