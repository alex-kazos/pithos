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

// Admin API access tokens from a custom app: shpat_/shpca_/shppa_ + hex.
const ACCESS_TOKEN_PATTERN = /^(shpat|shpca|shppa)_[a-f0-9]{32,}$/i;

export function isValidAccessToken(token: string): boolean {
  return ACCESS_TOKEN_PATTERN.test(token);
}

/**
 * Checks a pasted Admin API access token against its shop before it is
 * saved, so a typo or a token for a different shop is caught at connect time.
 */
export async function verifyAccessToken(shop: string, token: string): Promise<'valid' | 'rejected' | 'unreachable'> {
  try {
    const response = await fetch(`https://${shop}/admin/api/2024-04/shop.json`, {
      headers: { 'X-Shopify-Access-Token': token },
    });
    if (response.ok) return 'valid';
    if (response.status === 401 || response.status === 403 || response.status === 404) return 'rejected';
    return 'unreachable';
  } catch {
    return 'unreachable';
  }
}

export interface ClientCredentialsToken {
  accessToken: string;
  scope: string;
  /** ISO time the token stops working (Shopify issues them for 24 hours). */
  expiresAt: string;
}

/** Why Shopify refused a client ID + secret, phrased for the merchant. */
export class ClientCredentialsError extends Error {
  constructor(message: string, readonly reason: 'not_permitted' | 'rejected' | 'unreachable') {
    super(message);
  }
}

/**
 * Custom apps created since 2026 live in Shopify's Dev Dashboard and never
 * show an access token in the admin. Instead the app's client ID and secret
 * are exchanged for a token (the "client credentials grant"). The token
 * lasts 24 hours and there is no refresh token: just ask again.
 * https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/client-credentials-grant
 */
export async function requestClientCredentialsToken(
  shop: string,
  clientId: string,
  clientSecret: string
): Promise<ClientCredentialsToken> {
  let response: Response;
  try {
    response = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
    });
  } catch {
    throw new ClientCredentialsError(`Could not reach ${shop}. Check the store URL and try again.`, 'unreachable');
  }

  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || typeof body.access_token !== 'string') {
    if (body.error === 'shop_not_permitted') {
      throw new ClientCredentialsError(
        'Shopify only gives tokens to apps in the same organization as the store. Create the app from the Dev Dashboard of the organization that owns this store, and install it on the store.',
        'not_permitted'
      );
    }
    if (response.status >= 500) {
      throw new ClientCredentialsError(`Shopify is not responding right now (HTTP ${response.status}). Try again shortly.`, 'unreachable');
    }
    throw new ClientCredentialsError(
      'Shopify rejected that client ID and secret. Check both values, and that the app is installed on this store.',
      'rejected'
    );
  }

  const expiresIn = typeof body.expires_in === 'number' ? body.expires_in : 86399;
  return {
    accessToken: body.access_token,
    scope: typeof body.scope === 'string' ? body.scope : '',
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  };
}
