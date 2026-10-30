import { describe, it, expect, vi, beforeEach } from 'vitest';

const verifyAuth = vi.fn();
const createOAuthState = vi.fn();

vi.mock('../../lib/auth', () => ({ verifyAuth: (...args: unknown[]) => verifyAuth(...args) }));
vi.mock('../../lib/oauthState', () => ({ createOAuthState: (...args: unknown[]) => createOAuthState(...args) }));

process.env.APP_URL = 'https://app.example.com';

import { onRequest } from './oauthStart';

function startRequest(storeUrl: string) {
  return new Request('https://internal:3000/api/woocommerce/oauth/start', {
    method: 'POST',
    body: JSON.stringify({ storeUrl }),
  });
}

describe('POST /api/woocommerce/oauth/start', () => {
  beforeEach(() => {
    verifyAuth.mockReset();
    createOAuthState.mockReset();
  });

  it('rejects unauthenticated requests', async () => {
    verifyAuth.mockResolvedValueOnce(null);
    const response = await onRequest({ request: startRequest('https://my-shop.example.com') });
    expect(response.status).toBe(401);
    expect(createOAuthState).not.toHaveBeenCalled();
  });

  it('rejects an invalid store URL without writing any state', async () => {
    verifyAuth.mockResolvedValueOnce({ uid: 'user-1', email: 'a@b.com' });
    const response = await onRequest({ request: startRequest('not-a-url') });
    expect(response.status).toBe(400);
    expect(createOAuthState).not.toHaveBeenCalled();
  });

  it('rejects a non-https store URL (SSRF guard reused from the proxy)', async () => {
    verifyAuth.mockResolvedValueOnce({ uid: 'user-1', email: 'a@b.com' });
    const response = await onRequest({ request: startRequest('http://my-shop.example.com') });
    expect(response.status).toBe(400);
    expect(createOAuthState).not.toHaveBeenCalled();
  });

  it('stores the user+storeUrl against a fresh nonce and returns the authorize URL with public callbacks', async () => {
    verifyAuth.mockResolvedValueOnce({ uid: 'user-1', email: 'a@b.com' });

    const response = await onRequest({ request: startRequest('https://my-shop.example.com/') });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(createOAuthState).toHaveBeenCalledWith(expect.any(String), {
      userId: 'user-1',
      platform: 'woocommerce',
      target: 'https://my-shop.example.com',
      onboarding: false,
    });
    expect(body.url).toContain('https://my-shop.example.com/wc-auth/v1/authorize');
    expect(body.url).toContain('callback_url=https%3A%2F%2Fapp.example.com%2Fapi%2Fwoocommerce%2Foauth%2Fcallback');
    expect(body.url).toContain('return_url=https%3A%2F%2Fapp.example.com%2Fdashboard');
  });
});
