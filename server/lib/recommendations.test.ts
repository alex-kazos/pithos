import { describe, it, expect, vi, beforeEach } from 'vitest';

const query = vi.fn();
vi.mock('./db', () => ({ query: (...args: unknown[]) => query(...args) }));

import { getCachedRecommendations } from './recommendations';

describe('getCachedRecommendations', () => {
  beforeEach(() => query.mockReset());

  it('returns null when nothing has been generated for the store yet', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    expect(await getCachedRecommendations('user-1', 'store-abc')).toBeNull();
  });

  it('treats a set generated less than a week ago as fresh', async () => {
    query.mockResolvedValueOnce({
      rows: [{ recommendations: [{ message: 'Restock X' }], generated_at: new Date() }],
    });

    const cached = await getCachedRecommendations('user-1', 'store-abc');
    expect(cached?.isStale).toBe(false);
    expect(cached?.recommendations).toEqual([{ message: 'Restock X' }]);
  });

  it('marks a set older than a week as stale', async () => {
    query.mockResolvedValueOnce({
      rows: [{ recommendations: [], generated_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) }],
    });

    expect((await getCachedRecommendations('user-1', 'store-abc'))?.isStale).toBe(true);
  });
});
