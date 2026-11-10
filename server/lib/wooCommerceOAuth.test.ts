import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildAuthorizeUrl, verifyWooCommerceKeysWork } from './wooCommerceOAuth';

describe('buildAuthorizeUrl', () => {
  it('builds a well-formed WooCommerce app-authentication URL with all required params', () => {
    const url = new URL(buildAuthorizeUrl(
      'https://my-shop.example.com',
      'nonce-123',
      'https://app.example.com/dashboard',
      'https://app.example.com/api/woocommerce/oauth/callback'
    ));

    expect(url.origin + url.pathname).toBe('https://my-shop.example.com/wc-auth/v1/authorize');
    expect(url.searchParams.get('app_name')).toBe('Pithos');
    expect(url.searchParams.get('scope')).toBe('read');
    expect(url.searchParams.get('user_id')).toBe('nonce-123');
    expect(url.searchParams.get('return_url')).toBe('https://app.example.com/dashboard');
    expect(url.searchParams.get('callback_url')).toBe('https://app.example.com/api/woocommerce/oauth/callback');
  });
});

describe('verifyWooCommerceKeysWork', () => {
  const ORIGINAL_FETCH = global.fetch;
  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
  });

  it('returns true when the store accepts the keys', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    const result = await verifyWooCommerceKeysWork('https://my-shop.example.com', 'ck_x', 'cs_x');
    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://my-shop.example.com/wp-json/wc/v3/products?per_page=1',
      expect.objectContaining({ headers: { Authorization: `Basic ${btoa('ck_x:cs_x')}` } })
    );
  });

  it('returns false when the store rejects the keys', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    expect(await verifyWooCommerceKeysWork('https://my-shop.example.com', 'ck_bad', 'cs_bad')).toBe(false);
  });

  it('returns false (not throw) when the request itself fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network error'));
    expect(await verifyWooCommerceKeysWork('https://my-shop.example.com', 'ck_x', 'cs_x')).toBe(false);
  });
});
