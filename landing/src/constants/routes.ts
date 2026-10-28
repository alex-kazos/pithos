/**
 * Routes served by the marketing site itself.
 */
export const ROUTES = {
  ROOT: '/',
  BLOG: '/blog',
  BLOG_POST: '/blog/:slug',
  PRIVACY: '/privacy',
  TERMS: '/terms',
} as const;

// The dashboard is a separate app (the repository root) deployed on its own
// origin, e.g. https://app.stockpilotai.com. Empty means "same origin".
const APP_URL = (import.meta.env.VITE_APP_URL ?? '').replace(/\/+$/, '');

/**
 * Links into the dashboard app. These are full page loads to another
 * deployment, not router navigations - use them as plain hrefs.
 */
export const APP_LINKS = {
  AUTH: `${APP_URL}/auth`,
  DASHBOARD: `${APP_URL}/dashboard`,
  DEMO: `${APP_URL}/demo`,
} as const;
