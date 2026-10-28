import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS_URL = new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!jwks) jwks = createRemoteJWKSet(JWKS_URL);
  return jwks;
}

export interface AuthResult {
  uid: string;
  email: string | null;
}

/**
 * Verifies the Firebase ID token sent in the Authorization header
 * (`Authorization: Bearer <idToken>`). This is the ONLY access control on
 * these endpoints - they talk to Firestore with a service account that
 * bypasses Firestore rules entirely, so a missing/invalid token must always
 * be rejected.
 *
 * Deliberately not using firebase-admin's verifyIdToken(): its cert-fetch
 * path calls Node's `https.request`, which Cloudflare's nodejs_compat layer
 * doesn't implement, so it throws for every real (non-malformed) token.
 * This follows Firebase's own documented algorithm for verifying ID tokens
 * without the Admin SDK - https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library -
 * via `jose`, which is fetch()/WebCrypto-based and works natively in Workers.
 *
 * Returns null (never throws) so callers can respond with a clean 401.
 */
export async function verifyAuth(request: Request): Promise<AuthResult | null> {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken) {
    return null;
  }

  const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) {
    console.error('Missing VITE_FIREBASE_PROJECT_ID - cannot verify Firebase ID tokens.');
    return null;
  }

  try {
    const { payload } = await jwtVerify(idToken, getJwks(), {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ['RS256'],
    });

    // jose validates exp/nbf/iss/aud/signature; Firebase's own algorithm also
    // requires iat and auth_time to be in the past, which jose doesn't check.
    const now = Math.floor(Date.now() / 1000);
    if (!payload.sub) return null;
    if (typeof payload.iat !== 'number' || payload.iat > now) return null;
    if (typeof payload.auth_time !== 'number' || payload.auth_time > now) return null;

    return { uid: payload.sub, email: typeof payload.email === 'string' ? payload.email : null };
  } catch (error) {
    console.error('Failed to verify Firebase ID token:', (error as Error).message);
    return null;
  }
}
