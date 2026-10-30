/**
 * Deployment settings read from the environment. Everything optional here
 * switches a feature off rather than breaking the app when it's missing.
 */

/** Public URL users reach the app on, e.g. https://stockpilot.example.com. */
export function appUrl(): string {
  return (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

/** Absolute URL for a path on this deployment (OAuth redirect URIs, etc.). */
export function publicUrl(path: string): string {
  return `${appUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

export function isGoogleSignInConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function isShopifyOAuthConfigured(): boolean {
  return Boolean(process.env.SHOPIFY_API_KEY && process.env.SHOPIFY_API_SECRET);
}
