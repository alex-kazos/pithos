import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const getDoc = vi.fn();
const deleteDoc = vi.fn();
const setDoc = vi.fn();
const queryCollection = vi.fn();

vi.mock('../../../lib/firestoreRest', () => ({
  getDoc: (...args: unknown[]) => getDoc(...args),
  deleteDoc: (...args: unknown[]) => deleteDoc(...args),
  setDoc: (...args: unknown[]) => setDoc(...args),
  queryCollection: (...args: unknown[]) => queryCollection(...args),
}));

import { onRequest } from './callback';

const ORIGINAL_FETCH = global.fetch;
const validKey = `ck_${'a'.repeat(40)}`;
const validSecret = `cs_${'b'.repeat(40)}`;

function callbackRequest(body: Record<string, unknown>): Request {
  return new Request('https://app.example.com/api/woocommerce/oauth/callback', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/woocommerce/oauth/callback', () => {
  beforeEach(() => {
    getDoc.mockReset();
    deleteDoc.mockReset();
    setDoc.mockReset();
    queryCollection.mockReset();
    queryCollection.mockResolvedValue({ empty: true, docs: [] });
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
  });

  it('rejects requests missing required fields', async () => {
    const response = await onRequest({ request: callbackRequest({ user_id: 'nonce1' }) });
    expect(response.status).toBe(400);
    expect(getDoc).not.toHaveBeenCalled();
  });

  it('rejects malformed consumer key/secret before ever touching Firestore', async () => {
    const response = await onRequest({
      request: callbackRequest({ user_id: 'nonce1', consumer_key: 'not-a-key', consumer_secret: 'also-bad' }),
    });
    expect(response.status).toBe(400);
    expect(getDoc).not.toHaveBeenCalled();
  });

  it('rejects an unknown or already-used nonce', async () => {
    getDoc.mockResolvedValueOnce({ exists: false, data: () => undefined });
    const response = await onRequest({
      request: callbackRequest({ user_id: 'unknown-nonce', consumer_key: validKey, consumer_secret: validSecret }),
    });
    expect(response.status).toBe(400);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('rejects an expired nonce', async () => {
    getDoc.mockResolvedValueOnce({
      exists: true,
      data: () => ({ uid: 'user-1', storeUrl: 'https://my-shop.example.com', createdAt: Date.now() - 20 * 60 * 1000 }),
    });
    const response = await onRequest({
      request: callbackRequest({ user_id: 'nonce1', consumer_key: validKey, consumer_secret: validSecret }),
    });
    expect(response.status).toBe(400);
    expect(deleteDoc).toHaveBeenCalled(); // consumed even though rejected
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('rejects keys that fail the live verification test-call against the store', async () => {
    getDoc.mockResolvedValueOnce({
      exists: true,
      data: () => ({ uid: 'user-1', storeUrl: 'https://my-shop.example.com', createdAt: Date.now() }),
    });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false });

    const response = await onRequest({
      request: callbackRequest({ user_id: 'nonce1', consumer_key: validKey, consumer_secret: validSecret }),
    });

    expect(response.status).toBe(400);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('deactivates other stores and saves on a fully valid callback', async () => {
    getDoc.mockResolvedValueOnce({
      exists: true,
      data: () => ({ uid: 'user-1', storeUrl: 'https://my-shop.example.com', createdAt: Date.now() }),
    });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true });
    queryCollection.mockResolvedValueOnce({
      empty: false,
      docs: [{ exists: true, id: 'other-store', data: () => ({ isActive: true }) }],
    });

    const response = await onRequest({
      request: callbackRequest({
        user_id: 'nonce1',
        consumer_key: validKey,
        consumer_secret: validSecret,
        key_permissions: 'read',
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.received).toBe(true);
    expect(setDoc).toHaveBeenCalledWith('users/user-1/stores/other-store', { isActive: false }, { merge: true });
    expect(setDoc).toHaveBeenCalledWith(
      'users/user-1/stores/my-shop-example-com',
      expect.objectContaining({
        storeUrl: 'https://my-shop.example.com',
        consumerKey: validKey,
        consumerSecret: validSecret,
        platform: 'woocommerce',
        userId: 'user-1',
        isActive: true,
        authMethod: 'oauth',
      })
    );
  });

  it('overwrites the credentials when reconnecting an already-connected store', async () => {
    getDoc.mockResolvedValueOnce({
      exists: true,
      data: () => ({ uid: 'user-1', storeUrl: 'https://my-shop.example.com', createdAt: Date.now() }),
    });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true });

    const response = await onRequest({
      request: callbackRequest({ user_id: 'nonce1', consumer_key: validKey, consumer_secret: validSecret }),
    });

    expect(response.status).toBe(200);
    expect(setDoc).toHaveBeenCalledWith('users/user-1/stores/my-shop-example-com', expect.objectContaining({ isActive: true }));
  });
});
