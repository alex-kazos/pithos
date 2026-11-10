import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { decryptSecret, encryptSecret, resetKeyCacheForTests } from './crypto';

const ORIGINAL_ENV = { ...process.env };

describe('secret encryption', () => {
  beforeEach(() => {
    process.env.BETTER_AUTH_SECRET = 'a'.repeat(40);
    resetKeyCacheForTests();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetKeyCacheForTests();
  });

  it('round-trips a value', () => {
    const encrypted = encryptSecret('sk-user-own-key-1234567890');
    expect(encrypted).not.toContain('sk-user');
    expect(decryptSecret(encrypted)).toBe('sk-user-own-key-1234567890');
  });

  it('uses a fresh IV each time, so equal values encrypt differently', () => {
    expect(encryptSecret('same')).not.toBe(encryptSecret('same'));
  });

  it('refuses to decrypt a tampered value', () => {
    const [version, iv, tag, ciphertext] = encryptSecret('secret').split(':');
    const flipped = Buffer.from(ciphertext, 'base64');
    flipped[0] ^= 0xff;
    expect(() => decryptSecret([version, iv, tag, flipped.toString('base64')].join(':'))).toThrow();
  });

  it('cannot decrypt values encrypted under a different BETTER_AUTH_SECRET', () => {
    const encrypted = encryptSecret('secret');
    process.env.BETTER_AUTH_SECRET = 'b'.repeat(40);
    resetKeyCacheForTests();
    expect(() => decryptSecret(encrypted)).toThrow();
  });

  it('requires a long enough BETTER_AUTH_SECRET', () => {
    process.env.BETTER_AUTH_SECRET = 'short';
    resetKeyCacheForTests();
    expect(() => encryptSecret('secret')).toThrow(/BETTER_AUTH_SECRET/);
  });
});
