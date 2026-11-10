import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const verifyAuth = vi.fn();
const listStores = vi.fn();
const saveStore = vi.fn();
const deleteStore = vi.fn();
const setActiveStore = vi.fn();
const setStoreConnection = vi.fn();

vi.mock('../lib/auth', () => ({ verifyAuth: (...args: unknown[]) => verifyAuth(...args) }));
vi.mock('../lib/stores', () => ({
  listStores: (...args: unknown[]) => listStores(...args),
  saveStore: (...args: unknown[]) => saveStore(...args),
  deleteStore: (...args: unknown[]) => deleteStore(...args),
  setActiveStore: (...args: unknown[]) => setActiveStore(...args),
  setStoreConnection: (...args: unknown[]) => setStoreConnection(...args),
}));

import { storesRoutes } from './stores';

const ORIGINAL_FETCH = global.fetch;
const TOKEN = `shpat_${'a'.repeat(32)}`;

function post(body: unknown) {
  return storesRoutes.request('/', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
}

describe('/api/stores', () => {
  beforeEach(() => {
    for (const fn of [verifyAuth, listStores, saveStore, deleteStore, setActiveStore, setStoreConnection]) fn.mockReset();
    verifyAuth.mockResolvedValue({ uid: 'user-1', email: null });
    saveStore.mockImplementation(async (_uid, input) => ({ id: input.id, platform: input.platform, url: input.url, isActive: true }));
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
  });

  it('requires a session', async () => {
    verifyAuth.mockResolvedValueOnce(null);
    const response = await storesRoutes.request('/');
    expect(response.status).toBe(401);
    expect(listStores).not.toHaveBeenCalled();
  });

  it("lists only the session user's stores", async () => {
    listStores.mockResolvedValueOnce([{ id: 'my-store' }]);
    const response = await storesRoutes.request('/');
    expect(await response.json()).toEqual({ stores: [{ id: 'my-store' }] });
    expect(listStores).toHaveBeenCalledWith('user-1');
  });

  it('exchanges a Dev Dashboard client ID + secret for a token and saves all of it', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'issued-token', scope: 'read_products,read_orders', expires_in: 86399 }),
    });

    const response = await post({ platform: 'shopify', shop: 'my-store', clientId: ' client-id-123 ', clientSecret: 'client-secret-123' });

    expect(response.status).toBe(201);
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('https://my-store.myshopify.com/admin/oauth/access_token');
    expect(saveStore).toHaveBeenCalledWith('user-1', {
      id: 'my-store',
      platform: 'shopify',
      url: 'my-store.myshopify.com',
      credentials: {
        clientId: 'client-id-123',
        clientSecret: 'client-secret-123',
        accessToken: 'issued-token',
        tokenExpiresAt: expect.any(String),
      },
      authMethod: 'client_credentials',
      scope: 'read_products,read_orders',
    });
  });

  it('does not save a client ID + secret Shopify refuses, and says why', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'shop_not_permitted' }),
    });

    const response = await post({ platform: 'shopify', shop: 'my-store', clientId: 'client-id-123', clientSecret: 'client-secret-123' });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/same organization/);
    expect(saveStore).not.toHaveBeenCalled();
  });

  it('verifies a pasted Shopify token against the shop before saving it', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true, status: 200 });

    const response = await post({ platform: 'shopify', shop: 'my-store', apiToken: TOKEN });

    expect(response.status).toBe(201);
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('https://my-store.myshopify.com/admin/api/2024-04/shop.json');
    expect(saveStore).toHaveBeenCalledWith('user-1', {
      id: 'my-store',
      platform: 'shopify',
      url: 'my-store.myshopify.com',
      credentials: { apiToken: TOKEN },
      authMethod: 'token',
    });
  });

  it('does not save a Shopify token the shop rejects', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status: 401 });
    const response = await post({ platform: 'shopify', shop: 'my-store.myshopify.com', apiToken: TOKEN });
    expect(response.status).toBe(400);
    expect(saveStore).not.toHaveBeenCalled();
  });

  it('rejects malformed input without calling the store', async () => {
    expect((await post({ platform: 'shopify', shop: 'evil.example.com', apiToken: TOKEN })).status).toBe(400);
    expect((await post({ platform: 'shopify', shop: 'my-store', apiToken: 'nope' })).status).toBe(400);
    expect((await post({ platform: 'woocommerce', storeUrl: 'http://insecure.example.com', consumerKey: 'x', consumerSecret: 'y' })).status).toBe(400);
    expect((await post({ platform: 'square' })).status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(saveStore).not.toHaveBeenCalled();
  });

  it('verifies WooCommerce keys against the store before saving them', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true });
    const consumerKey = `ck_${'a'.repeat(40)}`;
    const consumerSecret = `cs_${'b'.repeat(40)}`;

    const response = await post({ platform: 'woocommerce', storeUrl: 'https://my-shop.example.com/', consumerKey, consumerSecret });

    expect(response.status).toBe(201);
    expect(saveStore).toHaveBeenCalledWith('user-1', {
      id: 'my-shop-example-com',
      platform: 'woocommerce',
      url: 'https://my-shop.example.com',
      credentials: { consumerKey, consumerSecret },
      authMethod: 'manual',
    });
  });

  it('deletes and activates stores, 404ing on ones the user does not have', async () => {
    deleteStore.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect((await storesRoutes.request('/my-store', { method: 'DELETE' })).status).toBe(200);
    expect((await storesRoutes.request('/someone-elses', { method: 'DELETE' })).status).toBe(404);
    expect(deleteStore).toHaveBeenCalledWith('user-1', 'my-store');

    setActiveStore.mockResolvedValueOnce(true);
    expect((await storesRoutes.request('/my-store/activate', { method: 'POST' })).status).toBe(200);
    expect(setActiveStore).toHaveBeenCalledWith('user-1', 'my-store');
  });

  it('records a sync verdict, clamping free-text fields', async () => {
    setStoreConnection.mockResolvedValueOnce(true);
    const response = await storesRoutes.request('/my-store/connection', {
      method: 'PUT',
      body: JSON.stringify({ status: 'error', reason: 'auth', detail: 'x'.repeat(2000), checkedAt: '2026-10-30T10:00:00.000Z' }),
    });

    expect(response.status).toBe(200);
    const [, , connection] = setStoreConnection.mock.calls[0];
    expect(connection.status).toBe('error');
    expect(connection.detail.length).toBe(500);

    expect((await storesRoutes.request('/my-store/connection', { method: 'PUT', body: JSON.stringify({ status: 'bogus' }) })).status).toBe(400);
  });
});
