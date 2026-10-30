import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const verifyAuth = vi.fn();
const getStore = vi.fn();

vi.mock('../../lib/auth', () => ({ verifyAuth: (...args: unknown[]) => verifyAuth(...args) }));
vi.mock('../../lib/stores', () => ({ getStore: (...args: unknown[]) => getStore(...args) }));

import { onRequest } from './proxy';

const ORIGINAL_FETCH = global.fetch;

function shopifyStore(url: string) {
  return {
    id: 'my-store',
    platform: 'shopify',
    url,
    credentials: { apiToken: 'shpat_storedtoken' },
    isActive: true,
  };
}

function proxyRequest(headers: Record<string, string> = { 'x-store-id': 'my-store' }) {
  return new Request('https://example.com/api/shopify/admin/api/2024-04/products?limit=1', { method: 'GET', headers });
}

describe('Shopify proxy', () => {
  beforeEach(() => {
    verifyAuth.mockReset();
    getStore.mockReset();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
  });

  it('rejects requests without a signed-in session with 401', async () => {
    verifyAuth.mockResolvedValueOnce(null);
    const response = await onRequest({ request: proxyRequest() });

    expect(response.status).toBe(401);
    // Must never look up credentials without a verified identity.
    expect(getStore).not.toHaveBeenCalled();
  });

  it('requires an x-store-id header', async () => {
    verifyAuth.mockResolvedValueOnce({ uid: 'real-user', email: null });
    const response = await onRequest({ request: proxyRequest({}) });
    expect(response.status).toBe(400);
  });

  it("looks the store up under the session's user and uses the stored token", async () => {
    verifyAuth.mockResolvedValueOnce({ uid: 'real-user', email: null });
    getStore.mockResolvedValueOnce(shopifyStore('my-store.myshopify.com'));
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ products: [] }) });

    const response = await onRequest({ request: proxyRequest() });

    expect(response.status).toBe(200);
    expect(getStore).toHaveBeenCalledWith('real-user', 'my-store');
    const [calledUrl, calledOptions] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(calledUrl).toBe('https://my-store.myshopify.com/admin/api/2024-04/products.json?limit=1');
    expect((calledOptions.headers as Record<string, string>)['X-Shopify-Access-Token']).toBe('shpat_storedtoken');
  });

  it("returns 404 for another user's store id, or a store on a different platform", async () => {
    verifyAuth.mockResolvedValue({ uid: 'real-user', email: null });
    getStore.mockResolvedValueOnce(null);
    expect((await onRequest({ request: proxyRequest() })).status).toBe(404);

    getStore.mockResolvedValueOnce({ ...shopifyStore('x'), platform: 'woocommerce', credentials: { consumerKey: 'ck', consumerSecret: 'cs' } });
    expect((await onRequest({ request: proxyRequest() })).status).toBe(404);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects a stored shop domain that is not *.myshopify.com (SSRF guard)', async () => {
    verifyAuth.mockResolvedValueOnce({ uid: 'real-user', email: null });
    getStore.mockResolvedValueOnce(shopifyStore('internal-metadata-service.local'));

    const response = await onRequest({ request: proxyRequest() });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid Shopify store domain');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("passes Shopify's own error status through so the dashboard can classify it", async () => {
    verifyAuth.mockResolvedValueOnce({ uid: 'real-user', email: null });
    getStore.mockResolvedValueOnce(shopifyStore('my-store.myshopify.com'));
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });

    const response = await onRequest({ request: proxyRequest() });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.upstreamStatus).toBe(401);
  });
});
