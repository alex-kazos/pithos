import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { getPool } from './db';
import { appUrl, isGoogleSignInConfigured } from './config';

/**
 * Login is handled by Better Auth (open source, self-hosted): email/password
 * out of the box, plus "Continue with Google" when GOOGLE_CLIENT_ID and
 * GOOGLE_CLIENT_SECRET are set. Sessions are HTTP-only cookies on the app's
 * own origin, so API calls from the frontend need no token juggling.
 */
export function authOptions(): BetterAuthOptions {
  return {
    database: getPool(),
    baseURL: appUrl(),
    secret: process.env.BETTER_AUTH_SECRET,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
    },
    socialProviders: isGoogleSignInConfigured()
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          },
        }
      : {},
    user: {
      // No email is ever sent by a default install, so a changed address is
      // applied straight away rather than waiting on a confirmation link.
      changeEmail: { enabled: true, updateEmailWithoutVerification: true },
    },
  };
}

let instance: ReturnType<typeof betterAuth> | null = null;

export function getAuth() {
  if (!instance) instance = betterAuth(authOptions());
  return instance;
}

export interface AuthResult {
  uid: string;
  email: string | null;
}

/** Resolves the signed-in user from the request's session cookie. */
export async function verifyAuth(request: Request): Promise<AuthResult | null> {
  try {
    const session = await getAuth().api.getSession({ headers: request.headers });
    if (!session) return null;
    return { uid: session.user.id, email: session.user.email ?? null };
  } catch (error) {
    console.error('Session lookup failed:', (error as Error).message);
    return null;
  }
}
