import { describe, it, expect, vi, beforeEach } from 'vitest';

const verifyAuth = vi.fn();
const setDoc = vi.fn();

vi.mock('../../../lib/auth', () => ({ verifyAuth: (...args: unknown[]) => verifyAuth(...args) }));
vi.mock('../../../lib/firestoreRest', () => ({ setDoc: (...args: unknown[]) => setDoc(...args) }));

import { onRequest } from './start';

describe('POST /api/woocommerce/oauth/start', () => {
  beforeEach(() => {
    verifyAuth.mockReset();
    setDoc.mockReset();
  });

  it('rejects unauthenticated requests', async () => {
    verifyAuth.mockResolvedValueOnce(null);
    const request = new Request('https://app.example.com/api/woocommerce/oauth/start', {
      method: 'POST',
      body: JSON.stringify({ storeUrl: 'https://my-shop.example.com' }),
    });

    const response = await onRequest({ request });
    expect(response.status).toBe(401);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('rejects an invalid store URL without writing any state', async () => {
    verifyAuth.mockResolvedValueOnce({ uid: 'user-1', email: 'a@b.com' });
    const request = new Request('https://app.example.com/api/woocommerce/oauth/start', {
      method: 'POST',
      body: JSON.stringify({ storeUrl: 'not-a-url' }),
    });

    const response = await onRequest({ request });
    expect(response.status).toBe(400);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('rejects a non-https store URL (SSRF guard reused from the proxy)', async () => {
    verifyAuth.mockResolvedValueOnce({ uid: 'user-1', email: 'a@b.com' });
    const request = new Request('https://app.example.com/api/woocommerce/oauth/start', {
      method: 'POST',
      body: JSON.stringify({ storeUrl: 'http://my-shop.example.com' }),
    });

    const response = await onRequest({ request });
    expect(response.status).toBe(400);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('stores the uid+storeUrl against a fresh nonce and returns the authorize URL', async () => {
    verifyAuth.mockResolvedValueOnce({ uid: 'user-1', email: 'a@b.com' });
    const request = new Request('https://app.example.com/api/woocommerce/oauth/start', {
      method: 'POST',
      body: JSON.stringify({ storeUrl: 'https://my-shop.example.com/' }),
    });

    const response = await onRequest({ request });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(setDoc).toHaveBeenCalledWith(
      expect.stringMatching(/^woocommerceOAuthState\/.+/),
      expect.objectContaining({ uid: 'user-1', storeUrl: 'https://my-shop.example.com' })
    );
    expect(body.url).toContain('https://my-shop.example.com/wc-auth/v1/authorize');
    expect(body.url).toContain('callback_url=https%3A%2F%2Fapp.example.com%2Fapi%2Fwoocommerce%2Foauth%2Fcallback');
  });
});
