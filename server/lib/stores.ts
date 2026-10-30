import { query, withTransaction } from './db';
import { decryptSecret, encryptSecret } from './crypto';

export type StorePlatform = 'shopify' | 'woocommerce';

export type StoreCredentials =
  | { apiToken: string }
  | { consumerKey: string; consumerSecret: string };

/** Health verdict the dashboard records after each sync (see src/services/storeHealthService.ts). */
export interface StoreConnectionRecord {
  status: 'ok' | 'error';
  reason?: string;
  detail?: string;
  checkedAt?: string;
}

/** What the browser is allowed to see about a store - never its credentials. */
export interface StoreSummary {
  id: string;
  platform: StorePlatform;
  url: string;
  authMethod: string;
  isActive: boolean;
  connection: StoreConnectionRecord | null;
  createdAt: string;
}

export interface StoreWithCredentials extends StoreSummary {
  credentials: StoreCredentials;
}

interface StoreRow {
  id: string;
  platform: StorePlatform;
  url: string;
  credentials_encrypted: string;
  auth_method: string;
  is_active: boolean;
  connection: StoreConnectionRecord | null;
  created_at: Date;
}

function toSummary(row: StoreRow): StoreSummary {
  return {
    id: row.id,
    platform: row.platform,
    url: row.url,
    authMethod: row.auth_method,
    isActive: row.is_active,
    connection: row.connection,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listStores(userId: string): Promise<StoreSummary[]> {
  const { rows } = await query<StoreRow>(
    'SELECT * FROM stores WHERE user_id = $1 ORDER BY created_at',
    [userId]
  );
  return rows.map(toSummary);
}

export async function getStore(userId: string, storeId: string): Promise<StoreWithCredentials | null> {
  const { rows } = await query<StoreRow>('SELECT * FROM stores WHERE user_id = $1 AND id = $2', [userId, storeId]);
  const row = rows[0];
  if (!row) return null;
  return {
    ...toSummary(row),
    credentials: JSON.parse(decryptSecret(row.credentials_encrypted)) as StoreCredentials,
  };
}

export interface SaveStoreInput {
  id: string;
  platform: StorePlatform;
  url: string;
  credentials: StoreCredentials;
  authMethod: string;
  scope?: string | null;
}

/**
 * Connects (or reconnects) a store and makes it the active one. Reconnecting
 * replaces the credentials and clears the last health verdict.
 */
export async function saveStore(userId: string, input: SaveStoreInput): Promise<StoreSummary> {
  return withTransaction(async client => {
    // Exactly one store per user is active (enforced by a partial unique index).
    await client.query('UPDATE stores SET is_active = false WHERE user_id = $1 AND id <> $2', [userId, input.id]);
    const { rows } = await client.query<StoreRow>(
      `INSERT INTO stores (user_id, id, platform, url, credentials_encrypted, auth_method, scope, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       ON CONFLICT (user_id, id) DO UPDATE SET
         platform = EXCLUDED.platform,
         url = EXCLUDED.url,
         credentials_encrypted = EXCLUDED.credentials_encrypted,
         auth_method = EXCLUDED.auth_method,
         scope = EXCLUDED.scope,
         is_active = true,
         connection = NULL,
         updated_at = now()
       RETURNING *`,
      [
        userId,
        input.id,
        input.platform,
        input.url,
        encryptSecret(JSON.stringify(input.credentials)),
        input.authMethod,
        input.scope ?? null,
      ]
    );
    return toSummary(rows[0]);
  });
}

/** Marks one store active (and every other store of the user inactive). */
export async function setActiveStore(userId: string, storeId: string): Promise<boolean> {
  return withTransaction(async client => {
    const exists = await client.query('SELECT 1 FROM stores WHERE user_id = $1 AND id = $2', [userId, storeId]);
    if (exists.rowCount === 0) return false;
    await client.query('UPDATE stores SET is_active = false WHERE user_id = $1 AND id <> $2', [userId, storeId]);
    await client.query('UPDATE stores SET is_active = true WHERE user_id = $1 AND id = $2', [userId, storeId]);
    return true;
  });
}

/**
 * Disconnects a store. If it was the active one, the oldest remaining store
 * takes over so the user always has an active store while they have any.
 */
export async function deleteStore(userId: string, storeId: string): Promise<boolean> {
  return withTransaction(async client => {
    const { rows } = await client.query<{ is_active: boolean }>(
      'DELETE FROM stores WHERE user_id = $1 AND id = $2 RETURNING is_active',
      [userId, storeId]
    );
    if (rows.length === 0) return false;

    if (rows[0].is_active) {
      await client.query(
        `UPDATE stores SET is_active = true
         WHERE user_id = $1 AND id = (SELECT id FROM stores WHERE user_id = $1 ORDER BY created_at LIMIT 1)`,
        [userId]
      );
    }
    return true;
  });
}

export async function setStoreConnection(
  userId: string,
  storeId: string,
  connection: StoreConnectionRecord
): Promise<boolean> {
  const { rowCount } = await query(
    'UPDATE stores SET connection = $3 WHERE user_id = $1 AND id = $2',
    [userId, storeId, JSON.stringify(connection)]
  );
  return (rowCount ?? 0) > 0;
}
