import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const jwtVerify = vi.fn();

vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => 'mock-jwks-instance'),
  jwtVerify: (...args: unknown[]) => jwtVerify(...args),
}));

import { verifyAuth } from './auth';

function requestWithHeader(header?: string) {
  return new Request('https://example.com/api/test', {
    headers: header ? { Authorization: header } : {},
  });
}

const ORIGINAL_ENV = { ...process.env };

describe('verifyAuth', () => {
  beforeEach(() => {
    jwtVerify.mockReset();
    process.env.VITE_FIREBASE_PROJECT_ID = 'test-project';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('returns null when the Authorization header is missing', async () => {
    const result = await verifyAuth(requestWithHeader());
    expect(result).toBeNull();
    expect(jwtVerify).not.toHaveBeenCalled();
  });

  it('returns null when the header does not start with "Bearer "', async () => {
    const result = await verifyAuth(requestWithHeader('Basic abc123'));
    expect(result).toBeNull();
    expect(jwtVerify).not.toHaveBeenCalled();
  });

  it('returns null when the token is empty after "Bearer "', async () => {
    const result = await verifyAuth(requestWithHeader('Bearer '));
    expect(result).toBeNull();
  });

  it('returns null when VITE_FIREBASE_PROJECT_ID is not configured', async () => {
    delete process.env.VITE_FIREBASE_PROJECT_ID;
    const result = await verifyAuth(requestWithHeader('Bearer some-token'));
    expect(result).toBeNull();
    expect(jwtVerify).not.toHaveBeenCalled();
  });

  it('returns null when signature/issuer/audience verification fails', async () => {
    jwtVerify.mockRejectedValueOnce(new Error('signature verification failed'));
    const result = await verifyAuth(requestWithHeader('Bearer bad-token'));
    expect(result).toBeNull();
  });

  it('returns null when the token has no sub claim', async () => {
    const now = Math.floor(Date.now() / 1000);
    jwtVerify.mockResolvedValueOnce({ payload: { iat: now - 10, auth_time: now - 10 } });
    const result = await verifyAuth(requestWithHeader('Bearer token'));
    expect(result).toBeNull();
  });

  it('returns null when iat is in the future (jose does not check this itself)', async () => {
    const now = Math.floor(Date.now() / 1000);
    jwtVerify.mockResolvedValueOnce({ payload: { sub: 'user-123', iat: now + 3600, auth_time: now - 10 } });
    const result = await verifyAuth(requestWithHeader('Bearer token'));
    expect(result).toBeNull();
  });

  it('returns null when auth_time is in the future', async () => {
    const now = Math.floor(Date.now() / 1000);
    jwtVerify.mockResolvedValueOnce({ payload: { sub: 'user-123', iat: now - 10, auth_time: now + 3600 } });
    const result = await verifyAuth(requestWithHeader('Bearer token'));
    expect(result).toBeNull();
  });

  it('returns the uid and email for a fully valid token', async () => {
    const now = Math.floor(Date.now() / 1000);
    jwtVerify.mockResolvedValueOnce({
      payload: { sub: 'user-123', email: 'user@example.com', iat: now - 10, auth_time: now - 10 },
    });

    const result = await verifyAuth(requestWithHeader('Bearer good-token'));

    expect(result).toEqual({ uid: 'user-123', email: 'user@example.com' });
    expect(jwtVerify).toHaveBeenCalledWith(
      'good-token',
      'mock-jwks-instance',
      expect.objectContaining({
        issuer: 'https://securetoken.google.com/test-project',
        audience: 'test-project',
        algorithms: ['RS256'],
      })
    );
  });

  it('returns null email when the token has no email claim', async () => {
    const now = Math.floor(Date.now() / 1000);
    jwtVerify.mockResolvedValueOnce({ payload: { sub: 'user-123', iat: now - 10, auth_time: now - 10 } });
    const result = await verifyAuth(requestWithHeader('Bearer good-token'));
    expect(result).toEqual({ uid: 'user-123', email: null });
  });
});
