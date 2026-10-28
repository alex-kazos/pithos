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

process.env.SHOPIFY_API_KEY = 'test-client-id';
process.env.SHOPIFY_API_SECRET = 'test-secret';

import { onRequest } from './callback';

const ORIGINAL_FETCH = global.fetch;

async function signParams(params: URLSearchParams): Promise<string> {
  const pairs: string[] = [];
  params.forEach((value, key) => {
    if (key === 'hmac') return;
    pairs.push(`${key}=${value}`);
  });
  pairs.sort();
  const message = pairs.join('&');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('test-secret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function callbackRequest(paramOverrides: Record<string, string>): Request {
  const params = new URLSearchParams(paramOverrides);
  return new Request(`https://app.example.com/api/shopify/oauth/callback?${params.toString()}`);
}

function mockTokenExchange() {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ access_token: 'shpat_realtoken', scope: 'read_products' }),
  });
}

describe('GET /api/shopify/oauth/callback', () => {
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

  it('redirects with an error when required params are missing', async () => {
    const response = await onRequest({ request: callbackRequest({ shop: 'my-store.myshopify.com' }) });
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toContain('shopify=error');
    expect(response.headers.get('Location')).toContain('shopify_detail=missing_params');
  });

  it('rejects a callback with an invalid/tampered hmac', async () => {
    const response = await onRequest({
      request: callbackRequest({ shop: 'my-store.myshopify.com', code: 'abc', state: 'state1', hmac: 'not-valid' }),
    });
    expect(response.headers.get('Location')).toContain('shopify_detail=invalid_hmac');
    expect(getDoc).not.toHaveBeenCalled();
  });

  it('rejects a callback whose state was never issued (or already used)', async () => {
    const params = new URLSearchParams({ shop: 'my-store.myshopify.com', code: 'abc', state: 'unknown-state' });
    params.set('hmac', await signParams(params));
    getDoc.mockResolvedValueOnce({ exists: false, data: () => undefined });

    const response = await onRequest({ request: callbackRequest(Object.fromEntries(params)) });
    expect(response.headers.get('Location')).toContain('shopify_detail=invalid_state');
  });

  it('rejects when the shop does not match what was stored for this state', async () => {
    const params = new URLSearchParams({ shop: 'attacker-store.myshopify.com', code: 'abc', state: 'state1' });
    params.set('hmac', await signParams(params));
    getDoc.mockResolvedValueOnce({
      exists: true,
      data: () => ({ uid: 'user-1', shop: 'my-store.myshopify.com', createdAt: Date.now() }),
    });

    const response = await onRequest({ request: callbackRequest(Object.fromEntries(params)) });
    expect(response.headers.get('Location')).toContain('shopify_detail=shop_mismatch');
    expect(deleteDoc).toHaveBeenCalled(); // state must still be consumed even on failure
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('rejects an expired state', async () => {
    const params = new URLSearchParams({ shop: 'my-store.myshopify.com', code: 'abc', state: 'state1' });
    params.set('hmac', await signParams(params));
    getDoc.mockResolvedValueOnce({
      exists: true,
      data: () => ({ uid: 'user-1', shop: 'my-store.myshopify.com', createdAt: Date.now() - 20 * 60 * 1000 }),
    });

    const response = await onRequest({ request: callbackRequest(Object.fromEntries(params)) });
    expect(response.headers.get('Location')).toContain('shopify_detail=state_expired');
  });

  it('exchanges the code and writes the store on a fully valid callback', async () => {
    const params = new URLSearchParams({ shop: 'my-store.myshopify.com', code: 'abc', state: 'state1' });
    params.set('hmac', await signParams(params));
    getDoc.mockResolvedValueOnce({
      exists: true,
      data: () => ({ uid: 'user-1', shop: 'my-store.myshopify.com', createdAt: Date.now() }),
    });
    mockTokenExchange();

    const response = await onRequest({ request: callbackRequest(Object.fromEntries(params)) });

    expect(setDoc).toHaveBeenCalledWith(
      'users/user-1/stores/my-store',
      expect.objectContaining({
        shopUrl: 'my-store.myshopify.com',
        apiToken: 'shpat_realtoken',
        userId: 'user-1',
        storeId: 'my-store',
        isActive: true,
        authMethod: 'oauth',
      })
    );
    expect(response.headers.get('Location')).toContain('shopify=connected');
  });

  it('deactivates other active stores for this user after saving the new one', async () => {
    const params = new URLSearchParams({ shop: 'second-store.myshopify.com', code: 'abc', state: 'state1' });
    params.set('hmac', await signParams(params));
    getDoc.mockResolvedValueOnce({
      exists: true,
      data: () => ({ uid: 'user-1', shop: 'second-store.myshopify.com', createdAt: Date.now() }),
    });
    mockTokenExchange();
    queryCollection.mockResolvedValueOnce({
      empty: false,
      docs: [{ exists: true, id: 'first-store', data: () => ({ isActive: true }) }],
    });

    await onRequest({ request: callbackRequest(Object.fromEntries(params)) });

    expect(queryCollection).toHaveBeenCalledWith('users/user-1/stores', { field: 'isActive', value: true });
    expect(setDoc).toHaveBeenCalledWith('users/user-1/stores/first-store', { isActive: false }, { merge: true });
  });

  it('overwrites the credentials when reconnecting an already-connected store', async () => {
    const params = new URLSearchParams({ shop: 'my-store.myshopify.com', code: 'abc', state: 'state1' });
    params.set('hmac', await signParams(params));
    getDoc.mockResolvedValueOnce({
      exists: true,
      data: () => ({ uid: 'user-1', shop: 'my-store.myshopify.com', createdAt: Date.now() }),
    });
    mockTokenExchange();

    const response = await onRequest({ request: callbackRequest(Object.fromEntries(params)) });

    expect(response.headers.get('Location')).toContain('shopify=connected');
    expect(setDoc).toHaveBeenCalledWith('users/user-1/stores/my-store', expect.objectContaining({ isActive: true }));
  });
});
