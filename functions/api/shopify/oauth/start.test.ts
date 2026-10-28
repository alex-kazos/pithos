import { describe, it, expect, vi, beforeEach } from 'vitest';

const verifyAuth = vi.fn();
const setDoc = vi.fn();

vi.mock('../../../lib/auth', () => ({ verifyAuth: (...args: unknown[]) => verifyAuth(...args) }));
vi.mock('../../../lib/firestoreRest', () => ({ setDoc: (...args: unknown[]) => setDoc(...args) }));

process.env.SHOPIFY_API_KEY = 'test-client-id';
process.env.SHOPIFY_SCOPES = 'read_products';

import { onRequest } from './start';

describe('POST /api/shopify/oauth/start', () => {
  beforeEach(() => {
    verifyAuth.mockReset();
    setDoc.mockReset();
  });

  it('rejects unauthenticated requests', async () => {
    verifyAuth.mockResolvedValueOnce(null);
    const request = new Request('https://app.example.com/api/shopify/oauth/start', {
      method: 'POST',
      body: JSON.stringify({ shop: 'my-store.myshopify.com' }),
    });

    const response = await onRequest({ request });
    expect(response.status).toBe(401);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('rejects an invalid shop domain without writing any state', async () => {
    verifyAuth.mockResolvedValueOnce({ uid: 'user-1', email: 'a@b.com' });
    const request = new Request('https://app.example.com/api/shopify/oauth/start', {
      method: 'POST',
      body: JSON.stringify({ shop: 'not-a-shopify-domain.com' }),
    });

    const response = await onRequest({ request });
    expect(response.status).toBe(400);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('stores the uid+shop against a fresh state and returns the Shopify authorize URL', async () => {
    verifyAuth.mockResolvedValueOnce({ uid: 'user-1', email: 'a@b.com' });
    const request = new Request('https://app.example.com/api/shopify/oauth/start', {
      method: 'POST',
      body: JSON.stringify({ shop: 'MY-STORE.myshopify.com' }),
    });

    const response = await onRequest({ request });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(setDoc).toHaveBeenCalledWith(
      expect.stringMatching(/^shopifyOAuthState\/.+/),
      expect.objectContaining({ uid: 'user-1', shop: 'my-store.myshopify.com' })
    );
    expect(body.url).toContain('https://my-store.myshopify.com/admin/oauth/authorize');
    expect(body.url).toContain('redirect_uri=https%3A%2F%2Fapp.example.com%2Fapi%2Fshopify%2Foauth%2Fcallback');
  });
});
