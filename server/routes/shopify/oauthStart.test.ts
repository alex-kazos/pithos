import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const verifyAuth = vi.fn();
const createOAuthState = vi.fn();

vi.mock('../../lib/auth', () => ({ verifyAuth: (...args: unknown[]) => verifyAuth(...args) }));
vi.mock('../../lib/oauthState', () => ({ createOAuthState: (...args: unknown[]) => createOAuthState(...args) }));

import { onRequest } from './oauthStart';

const ORIGINAL_ENV = { ...process.env };

function startRequest(shop: string) {
  return new Request('https://internal:3000/api/shopify/oauth/start', {
    method: 'POST',
    body: JSON.stringify({ shop }),
  });
}

describe('POST /api/shopify/oauth/start', () => {
  beforeEach(() => {
    verifyAuth.mockReset();
    createOAuthState.mockReset();
    process.env.SHOPIFY_API_KEY = 'test-client-id';
    process.env.SHOPIFY_API_SECRET = 'test-secret';
    process.env.SHOPIFY_SCOPES = 'read_products';
    process.env.APP_URL = 'https://app.example.com';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('rejects unauthenticated requests', async () => {
    verifyAuth.mockResolvedValueOnce(null);
    const response = await onRequest({ request: startRequest('my-store.myshopify.com') });
    expect(response.status).toBe(401);
    expect(createOAuthState).not.toHaveBeenCalled();
  });

  it('explains that one-click connect is off when no Shopify app is configured', async () => {
    verifyAuth.mockResolvedValueOnce({ uid: 'user-1', email: 'a@b.com' });
    delete process.env.SHOPIFY_API_SECRET;

    const response = await onRequest({ request: startRequest('my-store.myshopify.com') });
    expect(response.status).toBe(503);
    expect(createOAuthState).not.toHaveBeenCalled();
  });

  it('rejects an invalid shop domain without writing any state', async () => {
    verifyAuth.mockResolvedValueOnce({ uid: 'user-1', email: 'a@b.com' });
    const response = await onRequest({ request: startRequest('not-a-shopify-domain.com') });
    expect(response.status).toBe(400);
    expect(createOAuthState).not.toHaveBeenCalled();
  });

  it('stores the user+shop against a fresh state and returns the authorize URL with the public callback', async () => {
    verifyAuth.mockResolvedValueOnce({ uid: 'user-1', email: 'a@b.com' });

    const response = await onRequest({ request: startRequest('MY-STORE.myshopify.com') });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(createOAuthState).toHaveBeenCalledWith(expect.any(String), {
      userId: 'user-1',
      platform: 'shopify',
      target: 'my-store.myshopify.com',
      onboarding: false,
    });
    expect(body.url).toContain('https://my-store.myshopify.com/admin/oauth/authorize');
    expect(body.url).toContain('redirect_uri=https%3A%2F%2Fapp.example.com%2Fapi%2Fshopify%2Foauth%2Fcallback');
  });
});
