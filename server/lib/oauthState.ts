import { query } from './db';
import type { StorePlatform } from './stores';

/**
 * One-time state tying a Shopify/WooCommerce connect callback back to the
 * StockPilot user who started it. The platform calls our callback directly
 * (no session cookie we can rely on), so this row is the only link.
 */
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface OAuthState {
  userId: string;
  platform: StorePlatform;
  /** Shop domain (Shopify) or store URL (WooCommerce) the flow was started for. */
  target: string;
  onboarding: boolean;
  createdAt: Date;
}

export async function createOAuthState(
  state: string,
  input: { userId: string; platform: StorePlatform; target: string; onboarding: boolean }
): Promise<void> {
  // Opportunistic cleanup of abandoned flows.
  await query(`DELETE FROM oauth_states WHERE created_at < now() - interval '1 day'`);
  await query(
    'INSERT INTO oauth_states (state, user_id, platform, target, onboarding) VALUES ($1, $2, $3, $4, $5)',
    [state, input.userId, input.platform, input.target, input.onboarding]
  );
}

export type ConsumeResult =
  | { ok: true; state: OAuthState }
  | { ok: false; reason: 'invalid' | 'expired' };

/**
 * Deletes and returns the state in one statement, so it can only ever be
 * used once - even if the callback is replayed concurrently.
 */
export async function consumeOAuthState(state: string, platform: StorePlatform): Promise<ConsumeResult> {
  const { rows } = await query<{
    user_id: string;
    platform: StorePlatform;
    target: string;
    onboarding: boolean;
    created_at: Date;
  }>('DELETE FROM oauth_states WHERE state = $1 AND platform = $2 RETURNING *', [state, platform]);

  const row = rows[0];
  if (!row) return { ok: false, reason: 'invalid' };
  if (Date.now() - row.created_at.getTime() > STATE_TTL_MS) return { ok: false, reason: 'expired' };

  return {
    ok: true,
    state: {
      userId: row.user_id,
      platform: row.platform,
      target: row.target,
      onboarding: row.onboarding,
      createdAt: row.created_at,
    },
  };
}
