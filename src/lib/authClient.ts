import { createAuthClient } from 'better-auth/react';

/**
 * Better Auth client. The API is served from the same origin as the app
 * (Vite proxies /api during development), so sessions are plain HTTP-only
 * cookies and no base URL or token handling is needed here.
 */
export const authClient = createAuthClient();
