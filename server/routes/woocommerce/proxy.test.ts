import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const verifyAuth = vi.fn();
const getStore = vi.fn();

vi.mock('../../lib/auth', () => ({ verifyAuth: (...args: unknown[]) => verifyAuth(...args) }));
vi.mock('../../lib/stores', () => ({ getStore: (...args: unknown[]) => getStore(...args) }));

import { onRequest } from './proxy';

const ORIGINAL_FETCH = global.fetch;

function wooStore(url: string) {
  return {
    id: 'my-shop',
    platform: 'woocommerce',
    url,
    credentials: { consumerKey: 'ck_x', consumerSecret: 'cs_x' },
    isActive: true,
  };
}

function proxyRequest(headers: Record<string, string> = { 'x-store-id': 'my-shop' }) {
  return new Request('https://example.com/api/woocommerce/products', { method: 'GET', headers });
}

describe('WooCommerce proxy', () => {
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
    expect(getStore).not.toHaveBeenCalled();
  });

  it('requires an x-store-id header', async () => {
    verifyAuth.mockResolvedValueOnce({ uid: 'user-1', email: null });
    expect((await onRequest({ request: proxyRequest({}) })).status).toBe(400);
  });

  it('returns 404 when the store does not belong to the user', async () => {
    verifyAuth.mockResolvedValueOnce({ uid: 'user-1', email: null });
    getStore.mockResolvedValueOnce(null);

    const response = await onRequest({ request: proxyRequest() });
    expect(getStore).toHaveBeenCalledWith('user-1', 'my-shop');
    expect(response.status).toBe(404);
  });

  it('rejects a stored URL that fails SSRF validation', async () => {
    verifyAuth.mockResolvedValueOnce({ uid: 'user-1', email: null });
    getStore.mockResolvedValueOnce(wooStore('https://169.254.169.254'));

    const response = await onRequest({ request: proxyRequest() });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid WooCommerce store URL');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('forwards to the store with Basic Auth and passes pagination headers back', async () => {
    verifyAuth.mockResolvedValueOnce({ uid: 'user-1', email: null });
    getStore.mockResolvedValueOnce(wooStore('https://my-shop.example.com'));
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'X-WP-Total': '3', 'X-WP-TotalPages': '1' }),
      json: async () => [{ id: 1, name: 'Widget' }],
    });

    const response = await onRequest({ request: proxyRequest() });

    const [calledUrl, calledOptions] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(calledUrl).toContain('https://my-shop.example.com/wp-json/wc/v3/products');
    expect((calledOptions.headers as Record<string, string>).Authorization).toBe(`Basic ${btoa('ck_x:cs_x')}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('X-WP-TotalPages')).toBe('1');
  });
});
