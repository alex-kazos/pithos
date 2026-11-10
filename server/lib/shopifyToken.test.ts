import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const updateStoreCredentials = vi.fn();
vi.mock('./stores', () => ({ updateStoreCredentials: (...args: unknown[]) => updateStoreCredentials(...args) }));

import { getShopifyAccessToken } from './shopifyToken';
import { ClientCredentialsError } from './shopifyOAuth';

const ORIGINAL_FETCH = global.fetch;
const HOUR = 60 * 60 * 1000;

function store(credentials: Record<string, unknown>, url = 'my-store.myshopify.com') {
  return { id: 'my-store', platform: 'shopify', url, credentials, isActive: true } as never;
}

describe('getShopifyAccessToken', () => {
  beforeEach(() => {
    updateStoreCredentials.mockReset();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
  });

  it('returns a pasted or OAuth token as-is', async () => {
    expect(await getShopifyAccessToken('user-1', store({ apiToken: 'shpat_x' }))).toBe('shpat_x');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('reuses a cached client-credentials token that is still well within its 24 hours', async () => {
    const credentials = {
      clientId: 'client-id-123',
      clientSecret: 'client-secret-123',
      accessToken: 'cached-token',
      tokenExpiresAt: new Date(Date.now() + 2 * HOUR).toISOString(),
    };
    expect(await getShopifyAccessToken('user-1', store(credentials))).toBe('cached-token');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('asks Shopify for a new token when the cached one is about to expire, and saves it', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'fresh-token', scope: 'read_products', expires_in: 86399 }),
    });
    const credentials = {
      clientId: 'client-id-123',
      clientSecret: 'client-secret-123',
      accessToken: 'old-token',
      tokenExpiresAt: new Date(Date.now() + 60 * 1000).toISOString(),
    };

    expect(await getShopifyAccessToken('user-1', store(credentials))).toBe('fresh-token');

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://my-store.myshopify.com/admin/oauth/access_token');
    expect(init.method).toBe('POST');
    expect(Object.fromEntries(new URLSearchParams(init.body))).toEqual({
      grant_type: 'client_credentials',
      client_id: 'client-id-123',
      client_secret: 'client-secret-123',
    });
    expect(updateStoreCredentials).toHaveBeenCalledWith('user-1', 'my-store', {
      clientId: 'client-id-123',
      clientSecret: 'client-secret-123',
      accessToken: 'fresh-token',
      tokenExpiresAt: expect.any(String),
    });
  });

  it("explains Shopify's same-organization rule when it refuses the store", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'shop_not_permitted' }),
    });

    const attempt = getShopifyAccessToken('user-1', store({ clientId: 'client-id-123', clientSecret: 'client-secret-123' }));
    await expect(attempt).rejects.toBeInstanceOf(ClientCredentialsError);
    await expect(attempt).rejects.toMatchObject({ reason: 'not_permitted' });
    expect(updateStoreCredentials).not.toHaveBeenCalled();
  });

  it('never calls a stored URL that is not a *.myshopify.com shop (SSRF guard)', async () => {
    const result = await getShopifyAccessToken(
      'user-1',
      store({ clientId: 'client-id-123', clientSecret: 'client-secret-123' }, 'internal-service.local')
    );
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
