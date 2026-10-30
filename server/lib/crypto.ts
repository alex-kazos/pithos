import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

/**
 * Encryption at rest for user secrets: each user's OpenAI API key and every
 * connected store's credentials. A database dump on its own reveals none of
 * them.
 *
 * AES-256-GCM, with the key derived from BETTER_AUTH_SECRET so a deployment
 * has one secret to manage. Changing that secret makes previously stored
 * values unreadable: users then re-enter their OpenAI key and reconnect
 * their stores.
 */
const VERSION = 'v1';
const IV_BYTES = 12;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('BETTER_AUTH_SECRET must be set to at least 32 characters (try `openssl rand -base64 32`).');
  }

  cachedKey = Buffer.from(hkdfSync('sha256', secret, 'stockpilot', 'stockpilot:secrets:v1', 32));
  return cachedKey;
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(':');
}

export function decryptSecret(payload: string): string {
  const [version, iv, tag, ciphertext] = payload.split(':');
  if (version !== VERSION || !iv || !tag || !ciphertext) {
    throw new Error('Unrecognized encrypted value.');
  }

  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8');
}

/** Test-only: forget the derived key so a changed BETTER_AUTH_SECRET takes effect. */
export function resetKeyCacheForTests(): void {
  cachedKey = null;
}
