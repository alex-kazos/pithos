import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { normalizeShopDomain, verifyCallbackHmac, storeIdFromShop, buildAuthorizeUrl } from './shopifyOAuth';

const ORIGINAL_ENV = { ...process.env };

describe('normalizeShopDomain', () => {
  it('accepts a bare shop name and appends .myshopify.com is NOT done here (validation only)', () => {
    expect(normalizeShopDomain('my-store.myshopify.com')).toBe('my-store.myshopify.com');
  });

  it('lowercases and strips protocol/trailing slash', () => {
    expect(normalizeShopDomain('HTTPS://My-Store.MyShopify.com/')).toBe('my-store.myshopify.com');
  });

  it('rejects a domain that is not a myshopify.com subdomain', () => {
    expect(normalizeShopDomain('evil.com')).toBeNull();
    expect(normalizeShopDomain('my-store.myshopify.com.evil.com')).toBeNull();
  });

  it('rejects empty or malformed input', () => {
    expect(normalizeShopDomain('')).toBeNull();
    expect(normalizeShopDomain('-leading-hyphen.myshopify.com')).toBeNull();
  });
});

describe('storeIdFromShop', () => {
  it('strips the .myshopify.com suffix', () => {
    expect(storeIdFromShop('my-store.myshopify.com')).toBe('my-store');
  });
});

describe('buildAuthorizeUrl', () => {
  beforeEach(() => {
    process.env.SHOPIFY_API_KEY = 'test-client-id';
    process.env.SHOPIFY_SCOPES = 'read_products,read_orders';
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('builds a well-formed Shopify authorize URL with all required params', () => {
    const url = new URL(buildAuthorizeUrl('my-store.myshopify.com', 'state123', 'https://app.example.com/callback'));

    expect(url.origin + url.pathname).toBe('https://my-store.myshopify.com/admin/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('test-client-id');
    expect(url.searchParams.get('scope')).toBe('read_products,read_orders');
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.example.com/callback');
    expect(url.searchParams.get('state')).toBe('state123');
  });

  it('throws when SHOPIFY_API_KEY is not configured', () => {
    delete process.env.SHOPIFY_API_KEY;
    expect(() => buildAuthorizeUrl('my-store.myshopify.com', 'state123', 'https://app.example.com/callback')).toThrow();
  });
});

describe('verifyCallbackHmac', () => {
  beforeEach(() => {
    process.env.SHOPIFY_API_SECRET = 'test-secret';
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  async function computeExpectedHmac(secret: string, params: URLSearchParams): Promise<string> {
    const pairs: string[] = [];
    params.forEach((value, key) => {
      if (key === 'hmac') return;
      pairs.push(`${key}=${value}`);
    });
    pairs.sort();
    const message = pairs.join('&');
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
    return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  it('accepts a correctly signed set of params', async () => {
    const params = new URLSearchParams({ shop: 'my-store.myshopify.com', code: 'abc123', state: 'xyz', timestamp: '1700000000' });
    const validHmac = await computeExpectedHmac('test-secret', params);
    params.set('hmac', validHmac);

    expect(await verifyCallbackHmac(params)).toBe(true);
  });

  it('rejects params that were tampered with after signing', async () => {
    const params = new URLSearchParams({ shop: 'my-store.myshopify.com', code: 'abc123', state: 'xyz', timestamp: '1700000000' });
    const validHmac = await computeExpectedHmac('test-secret', params);
    params.set('hmac', validHmac);
    params.set('shop', 'attacker-store.myshopify.com'); // tamper after signing

    expect(await verifyCallbackHmac(params)).toBe(false);
  });

  it('rejects a request with no hmac param at all', async () => {
    const params = new URLSearchParams({ shop: 'my-store.myshopify.com', code: 'abc123' });
    expect(await verifyCallbackHmac(params)).toBe(false);
  });

  it('rejects a request signed with the wrong secret', async () => {
    const params = new URLSearchParams({ shop: 'my-store.myshopify.com', code: 'abc123' });
    const wrongHmac = await computeExpectedHmac('a-different-secret', params);
    params.set('hmac', wrongHmac);

    expect(await verifyCallbackHmac(params)).toBe(false);
  });
});
