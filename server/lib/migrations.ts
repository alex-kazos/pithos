import { getMigrations } from 'better-auth/db/migration';
import { authOptions } from './auth';
import { getPool } from './db';

/**
 * Schema for Pithos's own data. Better Auth creates and migrates its
 * tables ("user", "session", "account", "verification") itself; everything
 * here hangs off "user" and is removed with it (ON DELETE CASCADE).
 *
 * Append new migrations to the end - never edit one that has shipped.
 */
const APP_MIGRATIONS: { id: string; sql: string }[] = [
  {
    id: '001_init',
    sql: `
      -- One row per connected Shopify/WooCommerce store. Credentials (access
      -- token, or consumer key + secret) are stored encrypted - see lib/crypto.ts.
      CREATE TABLE stores (
        user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        id TEXT NOT NULL,
        platform TEXT NOT NULL CHECK (platform IN ('shopify', 'woocommerce')),
        url TEXT NOT NULL,
        credentials_encrypted TEXT NOT NULL,
        auth_method TEXT NOT NULL,
        scope TEXT,
        is_active BOOLEAN NOT NULL DEFAULT false,
        connection JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, id)
      );
      CREATE UNIQUE INDEX stores_one_active_per_user ON stores (user_id) WHERE is_active;

      -- Account preferences, and the user's own OpenAI API key (encrypted).
      CREATE TABLE user_settings (
        user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
        preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
        openai_key_encrypted TEXT,
        openai_key_hint TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      -- Which Overview layout preset each store view uses.
      CREATE TABLE dashboard_layouts (
        user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        store_key TEXT NOT NULL,
        preset TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, store_key)
      );

      -- Last generated AI recommendations per store view, reused for a week.
      CREATE TABLE recommendations (
        user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        store_key TEXT NOT NULL,
        recommendations JSONB NOT NULL,
        generated_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (user_id, store_key)
      );

      -- One-time state for the Shopify/WooCommerce connect flows (~10 min TTL).
      CREATE TABLE oauth_states (
        state TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        platform TEXT NOT NULL CHECK (platform IN ('shopify', 'woocommerce')),
        target TEXT NOT NULL,
        onboarding BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `,
  },
];

// Arbitrary constant: keeps two app instances starting at once from
// applying the same migration twice.
const MIGRATION_LOCK_ID = 7_210_431;

export async function runMigrations(): Promise<void> {
  const authMigrations = await getMigrations(authOptions());
  await authMigrations.runMigrations();

  const client = await getPool().connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    const { rows } = await client.query<{ id: string }>('SELECT id FROM app_migrations');
    const applied = new Set(rows.map(row => row.id));

    for (const migration of APP_MIGRATIONS) {
      if (applied.has(migration.id)) continue;
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query('INSERT INTO app_migrations (id) VALUES ($1)', [migration.id]);
        await client.query('COMMIT');
        console.log(`Applied migration ${migration.id}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => {});
    client.release();
  }
}
