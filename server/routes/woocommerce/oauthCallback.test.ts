import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const consumeOAuthState = vi.fn();
const saveStore = vi.fn();

vi.mock('../../lib/oauthState', () => ({ consumeOAuthState: (...args: unknown[]) => consumeOAuthState(...args) }));
vi.mock('../../lib/stores', () => ({ saveStore: (...args: unknown[]) => saveStore(...args) }));

import { onRequest } from './oauthCallback';

const ORIGINAL_FETCH = global.fetch;
const validKey = `ck_${'a'.repeat(40)}`;
const validSecret = `cs_${'b'.repeat(40)}`;

function callbackRequest(body: Record<string, unknown>): Request {
  return new Request('https://app.example.com/api/woocommerce/oauth/callback', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const validState = {
  ok: true,
  state: { userId: 'user-1', platform: 'woocommerce', target: 'https://my-shop.example.com', onboarding: false, createdAt: new Date() },
};

describe('POST /api/woocommerce/oauth/callback', () => {
  beforeEach(() => {
    consumeOAuthState.mockReset();
    saveStore.mockReset();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
  });

  it('rejects requests missing required fields', async () => {
    const response = await onRequest({ request: callbackRequest({ user_id: 'nonce1' }) });
    expect(response.status).toBe(400);
    expect(consumeOAuthState).not.toHaveBeenCalled();
  });

  it('rejects malformed consumer key/secret before touching the stored state', async () => {
    const response = await onRequest({
      request: callbackRequest({ user_id: 'nonce1', consumer_key: 'not-a-key', consumer_secret: 'also-bad' }),
    });
    expect(response.status).toBe(400);
    expect(consumeOAuthState).not.toHaveBeenCalled();
  });

  it('rejects an unknown, already-used or expired nonce', async () => {
    consumeOAuthState.mockResolvedValueOnce({ ok: false, reason: 'invalid' });
    let response = await onRequest({
      request: callbackRequest({ user_id: 'unknown-nonce', consumer_key: validKey, consumer_secret: validSecret }),
    });
    expect(response.status).toBe(400);

    consumeOAuthState.mockResolvedValueOnce({ ok: false, reason: 'expired' });
    response = await onRequest({
      request: callbackRequest({ user_id: 'nonce1', consumer_key: validKey, consumer_secret: validSecret }),
    });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('Authorization expired');
    expect(saveStore).not.toHaveBeenCalled();
  });

  it('rejects keys that fail the live verification test-call against the store', async () => {
    consumeOAuthState.mockResolvedValueOnce(validState);
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false });

    const response = await onRequest({
      request: callbackRequest({ user_id: 'nonce1', consumer_key: validKey, consumer_secret: validSecret }),
    });

    expect(response.status).toBe(400);
    expect(saveStore).not.toHaveBeenCalled();
  });

  it('saves the store for the user who started the flow on a fully valid callback', async () => {
    consumeOAuthState.mockResolvedValueOnce(validState);
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true });

    const response = await onRequest({
      request: callbackRequest({
        user_id: 'nonce1',
        consumer_key: validKey,
        consumer_secret: validSecret,
        key_permissions: 'read',
      }),
    });

    expect(response.status).toBe(200);
    expect((await response.json()).received).toBe(true);
    expect(consumeOAuthState).toHaveBeenCalledWith('nonce1', 'woocommerce');
    expect(saveStore).toHaveBeenCalledWith('user-1', {
      id: 'my-shop-example-com',
      platform: 'woocommerce',
      url: 'https://my-shop.example.com',
      credentials: { consumerKey: validKey, consumerSecret: validSecret },
      authMethod: 'oauth',
      scope: 'read',
    });
  });
});
