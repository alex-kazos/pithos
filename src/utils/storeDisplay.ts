export const ALL_STORES_ID = '__all__';
export const ALL_SHOPIFY_ID = '__all_shopify__';
export const ALL_WOOCOMMERCE_ID = '__all_woocommerce__';
export const ALL_DATABASE_ID = '__all_database__';

/** Maps a real store's platform to the sentinel id for "all stores on this platform". */
export function allStoresIdForPlatform(platform: string): string {
  if (platform === 'shopify') return ALL_SHOPIFY_ID;
  if (platform === 'woocommerce') return ALL_WOOCOMMERCE_ID;
  if (platform === 'database') return ALL_DATABASE_ID;
  return ALL_STORES_ID;
}

const LAYOUT_DOC_ID_OVERRIDES: Record<string, string> = {
  [ALL_STORES_ID]: 'all-stores',
  [ALL_SHOPIFY_ID]: 'all-shopify',
  [ALL_WOOCOMMERCE_ID]: 'all-woocommerce',
  [ALL_DATABASE_ID]: 'all-databases',
};

/**
 * Firestore rejects document ids that both start and end with a double
 * underscore (reserved for internal use) - which is exactly the shape of
 * the ALL_STORES_ID-style sentinels above. This maps them to a Firestore-safe
 * equivalent before they're used as a `dashboardLayouts/{storeKey}` doc id;
 * a real store id (a shop domain, etc.) is never one of these and passes
 * through unchanged.
 */
export function toLayoutDocId(storeId: string): string {
  return LAYOUT_DOC_ID_OVERRIDES[storeId] ?? storeId;
}

/**
 * Store `name` values are raw identifiers (a full shopUrl/storeUrl like
 * "alekekos.myshopify.com" or "https://my-shop.example.com/") - this turns
 * them into a short, human-friendly label by taking the first segment of
 * the hostname, dropping protocol and platform-suffix noise.
 */
export function getStoreDisplayName(rawName: string): string {
  if (!rawName) return 'Unnamed store';
  // A name the user typed (custom databases, e.g. "shop on db.example.com")
  // is already human-friendly - URLs and hostnames never contain spaces.
  if (/\s/.test(rawName.trim())) return rawName.trim();

  const withoutProtocol = rawName.replace(/^https?:\/\//i, '');
  const hostname = withoutProtocol.split('/')[0];
  const firstLabel = hostname.split('.')[0];

  return firstLabel || rawName;
}
