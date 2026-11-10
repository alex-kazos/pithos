import { query } from './db';

// Recommendations are generated once per store and reused for up to a week,
// rather than regenerated on every visit. A manual refresh always
// regenerates regardless of this window - it only governs the passive
// "still fresh enough to show without asking OpenAI again" check.
const RECOMMENDATIONS_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface CachedRecommendations {
  recommendations: unknown[];
  generatedAt: string;
  isStale: boolean;
}

export async function getCachedRecommendations(uid: string, storeKey: string): Promise<CachedRecommendations | null> {
  const { rows } = await query<{ recommendations: unknown[]; generated_at: Date }>(
    'SELECT recommendations, generated_at FROM recommendations WHERE user_id = $1 AND store_key = $2',
    [uid, storeKey]
  );
  const row = rows[0];
  if (!row || !Array.isArray(row.recommendations)) return null;

  const generatedAt = row.generated_at;
  const isStale = Date.now() - generatedAt.getTime() >= RECOMMENDATIONS_CACHE_TTL_MS;
  return { recommendations: row.recommendations, generatedAt: generatedAt.toISOString(), isStale };
}

export async function saveRecommendations(
  uid: string,
  storeKey: string,
  recommendations: unknown[]
): Promise<CachedRecommendations> {
  const generatedAt = new Date();
  await query(
    `INSERT INTO recommendations (user_id, store_key, recommendations, generated_at) VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, store_key) DO UPDATE SET
       recommendations = EXCLUDED.recommendations,
       generated_at = EXCLUDED.generated_at`,
    [uid, storeKey, JSON.stringify(recommendations), generatedAt]
  );
  return { recommendations, generatedAt: generatedAt.toISOString(), isStale: false };
}
