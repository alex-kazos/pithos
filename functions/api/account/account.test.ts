import { describe, it, expect, vi, beforeEach } from 'vitest';

const verifyAuth = vi.fn();
const deleteDoc = vi.fn();
const listCollection = vi.fn();

vi.mock('../../lib/auth', () => ({ verifyAuth: (...args: unknown[]) => verifyAuth(...args) }));
vi.mock('../../lib/firestoreRest', () => ({
  deleteDoc: (...args: unknown[]) => deleteDoc(...args),
  listCollection: (...args: unknown[]) => listCollection(...args),
}));

import { onRequest } from './[[path]]';

describe('POST /api/account/delete-data', () => {
  beforeEach(() => {
    verifyAuth.mockReset();
    deleteDoc.mockReset();
    listCollection.mockReset();
  });

  it('rejects requests with a missing or invalid Firebase ID token', async () => {
    verifyAuth.mockResolvedValueOnce(null);
    const request = new Request('https://example.com/api/account/delete-data', { method: 'POST' });
    const response = await onRequest({ request });
    expect(response.status).toBe(401);
    expect(deleteDoc).not.toHaveBeenCalled();
  });

  it('wipes every store and AI usage doc for the user', async () => {
    verifyAuth.mockResolvedValueOnce({ uid: 'user-1', email: null });
    listCollection.mockImplementation((path: string) => {
      if (path === 'users/user-1/stores') {
        return Promise.resolve({ empty: false, docs: [{ id: 'store-1' }, { id: 'store-2' }] });
      }
      if (path === 'users/user-1/aiUsage') {
        return Promise.resolve({ empty: false, docs: [{ id: 'chat' }] });
      }
      return Promise.resolve({ empty: true, docs: [] });
    });

    const request = new Request('https://example.com/api/account/delete-data', {
      method: 'POST',
      headers: { authorization: 'Bearer good-token' },
    });

    const response = await onRequest({ request });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(deleteDoc).toHaveBeenCalledWith('users/user-1/stores/store-1');
    expect(deleteDoc).toHaveBeenCalledWith('users/user-1/stores/store-2');
    expect(deleteDoc).toHaveBeenCalledWith('users/user-1/aiUsage/chat');
    expect(body.deleted).toEqual({ stores: 2, aiUsage: 1 });
  });
});
