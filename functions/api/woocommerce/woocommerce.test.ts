import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const verifyAuth = vi.fn();
const getDoc = vi.fn();
const queryCollection = vi.fn();

vi.mock('../../lib/auth', () => ({ verifyAuth: (...args: unknown[]) => verifyAuth(...args) }));
vi.mock('../../lib/firestoreRest', () => ({
  getDoc: (...args: unknown[]) => getDoc(...args),
  queryCollection: (...args: unknown[]) => queryCollection(...args),
}));

import { onRequest } from './[[path]]';

const ORIGINAL_FETCH = global.fetch;

describe('WooCommerce proxy', () => {
  beforeEach(() => {
    verifyAuth.mockReset();
    getDoc.mockReset();
    queryCollection.mockReset();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
  });

  it('responds to CORS preflight without requiring auth', async () => {
    const request = new Request('https://example.com/api/woocommerce/products', { method: 'OPTIONS' });
    const response = await onRequest({ request });
    expect(response.status).toBe(204);
    expect(verifyAuth).not.toHaveBeenCalled();
  });

  it('rejects requests with a missing or invalid Firebase ID token with 401', async () => {
    verifyAuth.mockResolvedValueOnce(null);
    const request = new Request('https://example.com/api/woocommerce/products', { method: 'GET' });

    const response = await onRequest({ request });

    expect(response.status).toBe(401);
    expect(getDoc).not.toHaveBeenCalled();
    expect(queryCollection).not.toHaveBeenCalled();
  });

  it('returns 404 when no active WooCommerce store is found', async () => {
    verifyAuth.mockResolvedValueOnce({ uid: 'user-1', email: null });
    queryCollection.mockResolvedValueOnce({ empty: true, docs: [] });

    const request = new Request('https://example.com/api/woocommerce/products', {
      method: 'GET',
      headers: { authorization: 'Bearer good-token' },
    });

    const response = await onRequest({ request });
    expect(queryCollection).toHaveBeenCalledWith('users/user-1/stores', { field: 'isActive', value: true }, 1);
    expect(response.status).toBe(404);
  });

  it('rejects a stored URL that fails SSRF validation, even for an authenticated user', async () => {
    verifyAuth.mockResolvedValueOnce({ uid: 'user-1', email: null });
    queryCollection.mockResolvedValueOnce({
      empty: false,
      docs: [{
        exists: true,
        id: 'evil',
        data: () => ({ storeUrl: 'https://169.254.169.254', consumerKey: 'ck_x', consumerSecret: 'cs_x' }),
      }],
    });

    const request = new Request('https://example.com/api/woocommerce/products', {
      method: 'GET',
      headers: { authorization: 'Bearer good-token' },
    });

    const response = await onRequest({ request });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid WooCommerce store URL');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('forwards to the correct store with Basic Auth when everything is valid', async () => {
    verifyAuth.mockResolvedValueOnce({ uid: 'user-1', email: null });
    getDoc.mockResolvedValueOnce({
      exists: true,
      id: 'my-shop',
      data: () => ({ storeUrl: 'https://my-shop.example.com', consumerKey: 'ck_x', consumerSecret: 'cs_x' }),
    });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'X-WP-Total': '3', 'X-WP-TotalPages': '1' }),
      json: async () => [{ id: 1, name: 'Widget' }],
    });

    const request = new Request('https://example.com/api/woocommerce/products', {
      method: 'GET',
      headers: { authorization: 'Bearer good-token', 'x-store-id': 'my-shop' },
    });

    const response = await onRequest({ request });

    expect(getDoc).toHaveBeenCalledWith('users/user-1/stores/my-shop');
    const [calledUrl, calledOptions] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(calledUrl).toContain('https://my-shop.example.com/wp-json/wc/v3/products');
    expect((calledOptions.headers as Record<string, string>).Authorization).toBe(`Basic ${btoa('ck_x:cs_x')}`);
    expect(response.status).toBe(200);
  });
});
