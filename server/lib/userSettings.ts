import { query } from './db';
import { decryptSecret, encryptSecret } from './crypto';

export async function getPreferences(userId: string): Promise<Record<string, unknown>> {
  const { rows } = await query<{ preferences: Record<string, unknown> }>(
    'SELECT preferences FROM user_settings WHERE user_id = $1',
    [userId]
  );
  return rows[0]?.preferences ?? {};
}

/** Shallow-merges `patch` into the stored preferences and returns the result. */
export async function updatePreferences(
  userId: string,
  patch: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { rows } = await query<{ preferences: Record<string, unknown> }>(
    `INSERT INTO user_settings (user_id, preferences) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET
       preferences = user_settings.preferences || EXCLUDED.preferences,
       updated_at = now()
     RETURNING preferences`,
    [userId, JSON.stringify(patch)]
  );
  return rows[0].preferences;
}

export interface OpenAIKeyStatus {
  configured: boolean;
  /** Last few characters, so the user can tell which key is saved. */
  hint: string | null;
}

export async function getOpenAIKeyStatus(userId: string): Promise<OpenAIKeyStatus> {
  const { rows } = await query<{ openai_key_hint: string | null; configured: boolean }>(
    'SELECT openai_key_hint, openai_key_encrypted IS NOT NULL AS configured FROM user_settings WHERE user_id = $1',
    [userId]
  );
  return { configured: rows[0]?.configured ?? false, hint: rows[0]?.openai_key_hint ?? null };
}

/** The user's decrypted OpenAI key, or null if they haven't added one. */
export async function getOpenAIKey(userId: string): Promise<string | null> {
  const { rows } = await query<{ openai_key_encrypted: string | null }>(
    'SELECT openai_key_encrypted FROM user_settings WHERE user_id = $1',
    [userId]
  );
  const encrypted = rows[0]?.openai_key_encrypted;
  if (!encrypted) return null;

  try {
    return decryptSecret(encrypted);
  } catch {
    // Encrypted under a previous BETTER_AUTH_SECRET - treat it as missing
    // so the user is asked to enter it again.
    return null;
  }
}

export async function saveOpenAIKey(userId: string, apiKey: string): Promise<OpenAIKeyStatus> {
  const hint = `…${apiKey.slice(-4)}`;
  await query(
    `INSERT INTO user_settings (user_id, openai_key_encrypted, openai_key_hint) VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET
       openai_key_encrypted = EXCLUDED.openai_key_encrypted,
       openai_key_hint = EXCLUDED.openai_key_hint,
       updated_at = now()`,
    [userId, encryptSecret(apiKey), hint]
  );
  return { configured: true, hint };
}

export async function deleteOpenAIKey(userId: string): Promise<void> {
  await query(
    `UPDATE user_settings SET openai_key_encrypted = NULL, openai_key_hint = NULL, updated_at = now()
     WHERE user_id = $1`,
    [userId]
  );
}
