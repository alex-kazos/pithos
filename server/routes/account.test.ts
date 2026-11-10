import { describe, it, expect, vi, beforeEach } from 'vitest';

const verifyAuth = vi.fn();
const clientQuery = vi.fn();

vi.mock('../lib/auth', () => ({ verifyAuth: (...args: unknown[]) => verifyAuth(...args) }));
vi.mock('../lib/db', () => ({
  withTransaction: async (fn: (client: { query: typeof clientQuery }) => Promise<unknown>) => fn({ query: clientQuery }),
}));

import { onRequest } from './account';

describe('POST /api/account/delete', () => {
  beforeEach(() => {
    verifyAuth.mockReset();
    clientQuery.mockReset();
    clientQuery.mockResolvedValue({ rows: [], rowCount: 1 });
  });

  it('rejects requests without a signed-in session', async () => {
    verifyAuth.mockResolvedValueOnce(null);
    const response = await onRequest({
      request: new Request('https://example.com/api/account/delete', { method: 'POST' }),
    });
    expect(response.status).toBe(401);
    expect(clientQuery).not.toHaveBeenCalled();
  });

  it('deletes the login, its sessions and accounts - app data cascades from the user row', async () => {
    verifyAuth.mockResolvedValueOnce({ uid: 'user-1', email: null });
    const response = await onRequest({
      request: new Request('https://example.com/api/account/delete', { method: 'POST' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true });
    const statements = clientQuery.mock.calls.map(([sql, params]) => [sql, params]);
    expect(statements).toEqual([
      ['DELETE FROM "session" WHERE "userId" = $1', ['user-1']],
      ['DELETE FROM "account" WHERE "userId" = $1', ['user-1']],
      ['DELETE FROM "user" WHERE id = $1', ['user-1']],
    ]);
  });
});
