import { query } from './db';

export async function getLayoutPreset(userId: string, storeKey: string): Promise<string | null> {
  const { rows } = await query<{ preset: string }>(
    'SELECT preset FROM dashboard_layouts WHERE user_id = $1 AND store_key = $2',
    [userId, storeKey]
  );
  return rows[0]?.preset ?? null;
}

export async function setLayoutPreset(userId: string, storeKey: string, preset: string): Promise<void> {
  await query(
    `INSERT INTO dashboard_layouts (user_id, store_key, preset) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, store_key) DO UPDATE SET preset = EXCLUDED.preset, updated_at = now()`,
    [userId, storeKey, preset]
  );
}
