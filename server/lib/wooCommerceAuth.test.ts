import { describe, it, expect } from 'vitest';
import { normalizeStoreUrl, storeIdFromUrl, isValidConsumerKey, isValidConsumerSecret, basicAuthHeader } from './wooCommerceAuth';

describe('normalizeStoreUrl', () => {
  it('accepts a well-formed https store URL', () => {
    expect(normalizeStoreUrl('https://my-shop.example.com')).toBe('https://my-shop.example.com');
  });

  it('strips a trailing path/slash down to the origin', () => {
    expect(normalizeStoreUrl('https://my-shop.example.com/')).toBe('https://my-shop.example.com');
    expect(normalizeStoreUrl('https://my-shop.example.com/wp-json/wc/v3')).toBe('https://my-shop.example.com');
  });

  it('rejects non-https URLs', () => {
    expect(normalizeStoreUrl('http://my-shop.example.com')).toBeNull();
  });

  it('rejects malformed input', () => {
    expect(normalizeStoreUrl('not a url')).toBeNull();
    expect(normalizeStoreUrl('')).toBeNull();
  });

  it('rejects loopback and localhost (SSRF guard)', () => {
    expect(normalizeStoreUrl('https://localhost')).toBeNull();
    expect(normalizeStoreUrl('https://127.0.0.1')).toBeNull();
    expect(normalizeStoreUrl('https://127.0.0.1:8080')).toBeNull();
  });

  it('rejects private/link-local IP ranges (SSRF guard)', () => {
    expect(normalizeStoreUrl('https://10.0.0.5')).toBeNull();
    expect(normalizeStoreUrl('https://172.16.0.5')).toBeNull();
    expect(normalizeStoreUrl('https://172.31.255.255')).toBeNull();
    expect(normalizeStoreUrl('https://192.168.1.1')).toBeNull();
    // The cloud metadata endpoint - classic SSRF target for credential theft
    expect(normalizeStoreUrl('https://169.254.169.254')).toBeNull();
  });

  it('does not reject public IP-range lookalikes that are not actually private', () => {
    // 172.32.x.x is outside the RFC1918 172.16-31 range and is a real public range
    expect(normalizeStoreUrl('https://172.32.0.1')).toBe('https://172.32.0.1');
  });

  it('rejects a bare hostname with no TLD', () => {
    expect(normalizeStoreUrl('https://internal-wp-server')).toBeNull();
  });
});

describe('storeIdFromUrl', () => {
  it('derives a Firestore-safe id from the hostname', () => {
    expect(storeIdFromUrl('https://my-shop.example.com')).toBe('my-shop-example-com');
  });
});

describe('consumer key/secret validation', () => {
  const validKey = `ck_${'a'.repeat(40)}`;
  const validSecret = `cs_${'b'.repeat(40)}`;

  it('accepts well-formed keys', () => {
    expect(isValidConsumerKey(validKey)).toBe(true);
    expect(isValidConsumerSecret(validSecret)).toBe(true);
  });

  it('rejects malformed keys', () => {
    expect(isValidConsumerKey('not-a-key')).toBe(false);
    expect(isValidConsumerKey(validSecret)).toBe(false); // wrong prefix
    expect(isValidConsumerSecret('cs_tooshort')).toBe(false);
  });
});

describe('basicAuthHeader', () => {
  it('base64-encodes key:secret per RFC 7617', () => {
    const header = basicAuthHeader('ck_abc', 'cs_def');
    expect(header).toBe(`Basic ${btoa('ck_abc:cs_def')}`);
  });
});
