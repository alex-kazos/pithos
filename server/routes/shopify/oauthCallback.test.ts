import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const consumeOAuthState = vi.fn();
const saveStore = vi.fn();

vi.mock('../../lib/oauthState', () => ({ consumeOAuthState: (...args: unknown[]) => consumeOAuthState(...args) }));
vi.mock('../../lib/stores', () => ({ saveStore: (...args: unknown[]) => saveStore(...args) }));

process.env.SHOPIFY_API_KEY = 'test-client-id';
process.env.SHOPIFY_API_SECRET = 'test-secret';
process.env.APP_URL = 'https://app.example.com';

import { onRequest } from './oauthCallback';

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

async function signedRequest(fields: Record<string, string>): Promise<Request> {
  const params = new URLSearchParams(fields);
  params.set('hmac', await signParams(params));
  return new Request(`https://internal:3000/api/shopify/oauth/callback?${params.toString()}`);
}

function validState(shop: string, onboarding = false) {
  return { ok: true, state: { userId: 'user-1', platform: 'shopify', target: shop, onboarding, createdAt: new Date() } };
}

function mockTokenExchange() {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ access_token: 'shpat_realtoken', scope: 'read_products' }),
  });
}

describe('GET /api/shopify/oauth/callback', () => {
  beforeEach(() => {
    consumeOAuthState.mockReset();
    saveStore.mockReset();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
  });

  it('redirects with an error when required params are missing', async () => {
    const response = await onRequest({
      request: new Request('https://internal:3000/api/shopify/oauth/callback?shop=my-store.myshopify.com'),
    });
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toContain('shopify=error');
    expect(response.headers.get('Location')).toContain('shopify_detail=missing_params');
  });

  it('rejects a callback with an invalid/tampered hmac before touching the state', async () => {
    const response = await onRequest({
      request: new Request(
        'https://internal:3000/api/shopify/oauth/callback?shop=my-store.myshopify.com&code=abc&state=s1&hmac=not-valid'
      ),
    });
    expect(response.headers.get('Location')).toContain('shopify_detail=invalid_hmac');
    expect(consumeOAuthState).not.toHaveBeenCalled();
  });

  it('rejects a callback whose state was never issued (or already used)', async () => {
    consumeOAuthState.mockResolvedValueOnce({ ok: false, reason: 'invalid' });
    const response = await onRequest({
      request: await signedRequest({ shop: 'my-store.myshopify.com', code: 'abc', state: 'unknown-state' }),
    });
    expect(response.headers.get('Location')).toContain('shopify_detail=invalid_state');
  });

  it('rejects an expired state', async () => {
    consumeOAuthState.mockResolvedValueOnce({ ok: false, reason: 'expired' });
    const response = await onRequest({
      request: await signedRequest({ shop: 'my-store.myshopify.com', code: 'abc', state: 'state1' }),
    });
    expect(response.headers.get('Location')).toContain('shopify_detail=state_expired');
  });

  it('rejects when the shop does not match what was stored for this state', async () => {
    consumeOAuthState.mockResolvedValueOnce(validState('my-store.myshopify.com'));
    const response = await onRequest({
      request: await signedRequest({ shop: 'attacker-store.myshopify.com', code: 'abc', state: 'state1' }),
    });
    expect(response.headers.get('Location')).toContain('shopify_detail=shop_mismatch');
    expect(consumeOAuthState).toHaveBeenCalledWith('state1', 'shopify'); // consumed even on failure
    expect(saveStore).not.toHaveBeenCalled();
  });

  it('exchanges the code, saves the store and redirects to the public app URL', async () => {
    consumeOAuthState.mockResolvedValueOnce(validState('my-store.myshopify.com', true));
    mockTokenExchange();

    const response = await onRequest({
      request: await signedRequest({ shop: 'my-store.myshopify.com', code: 'abc', state: 'state1' }),
    });

    expect(saveStore).toHaveBeenCalledWith('user-1', {
      id: 'my-store',
      platform: 'shopify',
      url: 'my-store.myshopify.com',
      credentials: { apiToken: 'shpat_realtoken' },
      authMethod: 'oauth',
      scope: 'read_products',
    });
    const location = response.headers.get('Location')!;
    expect(location.startsWith('https://app.example.com/dashboard')).toBe(true);
    expect(location).toContain('shopify=connected');
    expect(location).toContain('onboarding=1');
  });
});
