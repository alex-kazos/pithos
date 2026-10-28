/**
 * Exchanges the Firebase Admin service account for a Google OAuth2 access
 * token, entirely via fetch() + Web Crypto - no Node `https`/gRPC involved.
 *
 * This exists because `firebase-admin`'s own Firestore client doesn't work
 * in the Cloudflare Workers runtime: it initializes a gRPC/Node-`https`
 * based transport that isn't available here. Firestore's REST API
 * (functions/lib/firestoreRest.ts) needs a bearer token with the
 * `datastore` scope, which is what this module produces via the standard
 * "OAuth 2.0 for Server to Server Applications" JWT-bearer flow:
 * https://developers.google.com/identity/protocols/oauth2/service-account#jwt-auth
 */

interface CachedToken {
  token: string;
  expiresAt: number;
}

export const DATASTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';
export const IDENTITY_TOOLKIT_SCOPE = 'https://www.googleapis.com/auth/identitytoolkit';

const cachedTokens = new Map<string, CachedToken>();

function base64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = '';
  bytes.forEach(b => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Depending on how FIREBASE_PRIVATE_KEY was pasted into the host's secret
 * store, its line breaks can survive as real newlines, as literal `\n`
 * escapes, or (if it went through an extra layer of escaping) as `\\n` -
 * and the value may also carry surrounding quote characters. Collapsing
 * literal backslash-n sequences to real newlines *before* stripping
 * whitespace avoids leaving a stray `n` behind (which is otherwise valid
 * base64 data and would silently corrupt the key), and a final sweep for
 * any remaining non-base64 character makes this tolerant of quotes or
 * other stray formatting rather than failing atob() with an opaque error.
 */
export function pemToDer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/\\+n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/[^A-Za-z0-9+/=]/g, '');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function signServiceAccountJwt(clientEmail: string, privateKeyPem: string, scope: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: clientEmail,
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(signingInput));

  return `${signingInput}.${base64url(signature)}`;
}

/**
 * @param scope Google OAuth2 scope to request. Defaults to Firestore's
 * `datastore` scope (used by nearly every caller); pass `IDENTITY_TOOLKIT_SCOPE`
 * for Firebase Auth admin operations (e.g. deleting a user).
 */
export async function getGoogleAccessToken(scope: string = DATASTORE_SCOPE): Promise<string> {
  const cached = cachedTokens.get(scope);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!clientEmail || !privateKey) {
    throw new Error('Missing FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY environment variables.');
  }

  const assertion = await signServiceAccountJwt(clientEmail, privateKey, scope);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to obtain Google access token: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  const token = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  cachedTokens.set(scope, token);
  return token.token;
}
