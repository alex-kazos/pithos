import { describe, it, expect } from 'vitest';
import { pemToDer } from './googleAuth';

// Arbitrary bytes, base64-encoded, standing in for a real PKCS8 key body -
// pemToDer doesn't care about the key's semantics, only that it recovers
// these exact bytes regardless of how the PEM was mangled in transit.
const PAYLOAD_BYTES = new TextEncoder().encode('the quick brown fox jumps over the lazy dog 0123456789');
const PAYLOAD_BASE64 = Buffer.from(PAYLOAD_BYTES).toString('base64');

function expectDecodesToPayload(pem: string) {
  const der = pemToDer(pem);
  // Compare as plain arrays: the test environment's Uint8Array and the one
  // TextEncoder produced can be different realms, which makes deep-equal
  // report typed-array instances as unequal even with identical bytes.
  expect(Array.from(new Uint8Array(der))).toEqual(Array.from(PAYLOAD_BYTES));
}

describe('pemToDer', () => {
  it('decodes a PEM with real newlines', () => {
    expectDecodesToPayload(`-----BEGIN PRIVATE KEY-----\n${PAYLOAD_BASE64}\n-----END PRIVATE KEY-----\n`);
  });

  it('decodes a PEM whose newlines are literal backslash-n escapes (dotenv style)', () => {
    expectDecodesToPayload(`-----BEGIN PRIVATE KEY-----\\n${PAYLOAD_BASE64}\\n-----END PRIVATE KEY-----\\n`);
  });

  it('decodes a PEM whose newlines were double-escaped (the production bug)', () => {
    // A stray backslash left behind by only a single level of un-escaping
    // used to reach atob() and blow up with "invalid base64-encoded data".
    expectDecodesToPayload(`-----BEGIN PRIVATE KEY-----\\\\n${PAYLOAD_BASE64}\\\\n-----END PRIVATE KEY-----\\\\n`);
  });

  it('decodes a PEM wrapped in stray surrounding quotes', () => {
    expectDecodesToPayload(`"-----BEGIN PRIVATE KEY-----\n${PAYLOAD_BASE64}\n-----END PRIVATE KEY-----\n"`);
  });

  it('decodes a PEM with Windows-style CRLF line endings', () => {
    expectDecodesToPayload(`-----BEGIN PRIVATE KEY-----\r\n${PAYLOAD_BASE64}\r\n-----END PRIVATE KEY-----\r\n`);
  });
});
