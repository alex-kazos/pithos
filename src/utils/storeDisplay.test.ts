import { describe, it, expect } from 'vitest';
import { getStoreDisplayName, toLayoutDocId, ALL_STORES_ID, ALL_SHOPIFY_ID, ALL_WOOCOMMERCE_ID } from './storeDisplay';

describe('getStoreDisplayName', () => {
  it('strips the .myshopify.com suffix', () => {
    expect(getStoreDisplayName('alekekos.myshopify.com')).toBe('alekekos');
    expect(getStoreDisplayName('test-store-wqkw7z0o.myshopify.com')).toBe('test-store-wqkw7z0o');
  });

  it('strips protocol and multi-level domain suffixes', () => {
    expect(getStoreDisplayName('https://kazosalexandros-rdkea-studio.wp.build')).toBe('kazosalexandros-rdkea-studio');
  });

  it('strips a trailing path', () => {
    expect(getStoreDisplayName('https://my-shop.example.com/wp-json')).toBe('my-shop');
  });

  it('handles a bare hostname with no dots', () => {
    expect(getStoreDisplayName('https://myshop')).toBe('myshop');
  });

  it('falls back to the raw value for empty input', () => {
    expect(getStoreDisplayName('')).toBe('Unnamed store');
  });
});

describe('toLayoutDocId', () => {
  it('maps the double-underscore sentinels to Firestore-safe ids', () => {
    expect(toLayoutDocId(ALL_STORES_ID)).toBe('all-stores');
    expect(toLayoutDocId(ALL_SHOPIFY_ID)).toBe('all-shopify');
    expect(toLayoutDocId(ALL_WOOCOMMERCE_ID)).toBe('all-woocommerce');
  });

  it('passes a real store id through unchanged', () => {
    expect(toLayoutDocId('alekekos.myshopify.com')).toBe('alekekos.myshopify.com');
  });
});
