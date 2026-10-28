/**
 * WooCommerce stores are self-hosted on an arbitrary domain (unlike Shopify's
 * `*.myshopify.com` suffix), so a store URL can't be validated with a simple
 * allowlist pattern - this module has to actually check the hostname isn't
 * pointing at internal infrastructure before the backend ever fetch()es it.
 * See functions/api/woocommerce/[[path]].ts for where this is enforced.
 */

const PRIVATE_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^0\.0\.0\.0$/,
  /^127\./, // loopback
  /^10\./, // RFC1918
  /^172\.(1[6-9]|2\d|3[0-1])\./, // RFC1918
  /^192\.168\./, // RFC1918
  /^169\.254\./, // link-local, includes the 169.254.169.254 cloud metadata endpoint
  /^::1$/, // IPv6 loopback
  /^fc00:/i, // IPv6 unique local
  /^fe80:/i, // IPv6 link-local
];

/**
 * Validates and normalizes a WooCommerce store URL. Requires HTTPS and
 * rejects loopback/private/link-local hosts to prevent SSRF - but this is
 * string-level validation only; it can't catch DNS rebinding (a public
 * hostname that resolves to a private IP at request time). That's a known,
 * accepted residual risk shared by any "validate the URL string" defense
 * without controlling DNS resolution directly, which Workers' fetch() doesn't
 * expose a hook for.
 */
export function normalizeStoreUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }

  if (url.protocol !== 'https:') {
    return null;
  }

  const hostname = url.hostname.toLowerCase();
  if (PRIVATE_HOSTNAME_PATTERNS.some(pattern => pattern.test(hostname))) {
    return null;
  }

  if (!hostname.includes('.')) {
    // No TLD at all (e.g. a bare internal hostname like "http://mywpserver")
    return null;
  }

  return `${url.protocol}//${url.host}`;
}

export function storeIdFromUrl(storeUrl: string): string {
  const hostname = new URL(storeUrl).hostname;
  return hostname.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
}

// WooCommerce consumer keys/secrets are ck_/cs_ followed by a 40-char hex string.
const CONSUMER_KEY_PATTERN = /^ck_[a-f0-9]{40}$/i;
const CONSUMER_SECRET_PATTERN = /^cs_[a-f0-9]{40}$/i;

export function isValidConsumerKey(key: string): boolean {
  return CONSUMER_KEY_PATTERN.test(key.trim());
}

export function isValidConsumerSecret(secret: string): boolean {
  return CONSUMER_SECRET_PATTERN.test(secret.trim());
}

export function basicAuthHeader(consumerKey: string, consumerSecret: string): string {
  return `Basic ${btoa(`${consumerKey}:${consumerSecret}`)}`;
}
