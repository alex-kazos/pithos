import { describe, it, expect, vi, beforeEach } from 'vitest';

const verifyAuth = vi.fn();
const getDoc = vi.fn();
const queryCollection = vi.fn();

vi.mock('../../lib/auth', () => ({ verifyAuth: (...args: unknown[]) => verifyAuth(...args) }));
vi.mock('../../lib/firestoreRest', () => ({
  getDoc: (...args: unknown[]) => getDoc(...args),
  queryCollection: (...args: unknown[]) => queryCollection(...args),
}));

import { onRequest } from './[[path]]';

describe('Shopify proxy auth gate', () => {
  beforeEach(() => {
    verifyAuth.mockReset();
    getDoc.mockReset();
    queryCollection.mockReset();
  });

  it('responds to CORS preflight without requiring auth', async () => {
    const request = new Request('https://example.com/api/shopify/products', { method: 'OPTIONS' });
    const response = await onRequest({ request });

    expect(response.status).toBe(204);
    expect(verifyAuth).not.toHaveBeenCalled();
  });

  it('rejects requests with a missing or invalid Firebase ID token with 401', async () => {
    verifyAuth.mockResolvedValueOnce(null);
    const request = new Request('https://example.com/api/shopify/products', { method: 'GET' });

    const response = await onRequest({ request });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
    // Must never fall through to Firestore lookups without a verified identity.
    expect(getDoc).not.toHaveBeenCalled();
    expect(queryCollection).not.toHaveBeenCalled();
  });

  it('derives the user id from the verified token, not from client headers, for active-store lookups', async () => {
    verifyAuth.mockResolvedValueOnce({ uid: 'real-user', email: 'user@example.com' });
    queryCollection.mockResolvedValueOnce({ empty: true, docs: [] });

    const request = new Request('https://example.com/api/shopify/products', {
      method: 'GET',
      headers: { authorization: 'Bearer good-token' },
    });

    const response = await onRequest({ request });

    expect(queryCollection).toHaveBeenCalledWith('users/real-user/stores', { field: 'isActive', value: true }, 1);
    expect(response.status).toBe(404); // no active store found, but auth gate passed correctly
  });

  it('rejects a shop domain that is not *.myshopify.com, even from an authenticated user (SSRF guard)', async () => {
    verifyAuth.mockResolvedValueOnce({ uid: 'real-user', email: 'user@example.com' });
    const fetchSpy = vi.spyOn(global, 'fetch').mockRejectedValue(new Error('fetch should never be called'));

    const request = new Request('https://example.com/api/shopify/products', {
      method: 'GET',
      headers: {
        authorization: 'Bearer good-token',
        'x-shopify-access-token': 'shpat_whatever',
        'x-shop-domain': 'internal-metadata-service.local',
      },
    });

    const response = await onRequest({ request });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid Shopify store domain');
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});
