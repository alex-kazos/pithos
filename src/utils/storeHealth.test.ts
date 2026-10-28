import { describe, it, expect } from 'vitest';
import { classifyStoreError, toStoreIssue, dedupeStoreIssues, StoreConnectionIssue } from './storeHealth';

/** Shapes an axios-style rejection the way the services actually see one. */
function axiosError(status: number, data: unknown, message = 'Request failed'): Error {
  return Object.assign(new Error(message), { response: { status, data } });
}

describe('classifyStoreError', () => {
  it('reads a revoked token as something to reconnect, not wait out', () => {
    const result = classifyStoreError(axiosError(401, { error: 'Unauthorized' }));
    expect(result.reason).toBe('auth');
    expect(result.status).toBe(401);
  });

  it('treats a forbidden response as an auth problem too', () => {
    expect(classifyStoreError(axiosError(403, {})).reason).toBe('auth');
  });

  it('reads 404 as the store no longer being there', () => {
    expect(classifyStoreError(axiosError(404, { error: 'Store not found' })).reason).toBe('not_found');
  });

  it('separates throttling from an outage', () => {
    expect(classifyStoreError(axiosError(429, {})).reason).toBe('rate_limited');
    expect(classifyStoreError(axiosError(503, {})).reason).toBe('unreachable');
  });

  // The proxies used to collapse every upstream failure into a 500 of their
  // own. Deployed builds may still be doing that, so the upstream status has
  // to be recoverable from the body - otherwise a revoked token reads as a
  // transient outage and the merchant is told to just retry, forever.
  it('recovers the platform status from a proxy 500 that carries it', () => {
    expect(classifyStoreError(axiosError(500, { upstreamStatus: 401 })).reason).toBe('auth');

    const fromDetails = classifyStoreError(
      axiosError(500, { error: 'Error making Shopify API request', details: 'Shopify API error: 401' })
    );
    expect(fromDetails.reason).toBe('auth');
    expect(fromDetails.status).toBe(401);
  });

  it('still reports a genuine proxy 500 as unreachable', () => {
    expect(classifyStoreError(axiosError(500, { error: 'Something broke' })).reason).toBe('unreachable');
  });

  // The /api routes not being served in front of the SPA answers every call
  // with a bare 404 and an HTML (or empty) body. Reading that as "your store
  // is gone" would push a merchant to delete a perfectly healthy store.
  it('does not blame the store when the response did not come from our proxy', () => {
    const htmlBody = classifyStoreError(axiosError(404, '<!DOCTYPE html><title>404</title>'));
    expect(htmlBody.reason).toBe('api_error');
    expect(htmlBody.status).toBe(404);

    expect(classifyStoreError(axiosError(404, '')).reason).toBe('api_error');
    expect(classifyStoreError(axiosError(401, undefined)).reason).toBe('api_error');
  });

  it('still trusts a JSON body from our own proxy', () => {
    expect(classifyStoreError(axiosError(404, { error: 'Store not found' })).reason).toBe('not_found');
  });

  it('classifies a timeout with no response at all', () => {
    const timeout = Object.assign(new Error('timeout of 30000ms exceeded'), { code: 'ECONNABORTED' });
    expect(classifyStoreError(timeout).reason).toBe('unreachable');
  });

  it('classifies a store whose Firestore doc has been deleted', () => {
    expect(classifyStoreError(new Error('Store my-shop not found')).reason).toBe('not_found');
  });

  it('falls back to unknown rather than guessing', () => {
    const result = classifyStoreError(new Error('Something unexpected'));
    expect(result.reason).toBe('unknown');
    expect(result.detail).toBe('Something unexpected');
  });
});

describe('toStoreIssue', () => {
  it('tags the classification with the store it came from', () => {
    const issue = toStoreIssue('my-shop', 'woocommerce', axiosError(401, {}));
    expect(issue).toMatchObject({ storeId: 'my-shop', platform: 'woocommerce', reason: 'auth' });
  });
});

describe('dedupeStoreIssues', () => {
  // Products and orders are fetched independently, so one dead store fails
  // twice - the merchant should still see it named once.
  it('collapses the products and orders failures of one store', () => {
    const products: StoreConnectionIssue[] = [
      { storeId: 'a', platform: 'shopify', reason: 'auth', detail: 'products failed' },
    ];
    const orders: StoreConnectionIssue[] = [
      { storeId: 'a', platform: 'shopify', reason: 'auth', detail: 'orders failed' },
      { storeId: 'b', platform: 'woocommerce', reason: 'unreachable', detail: 'timeout' },
    ];

    const merged = dedupeStoreIssues(products, orders);
    expect(merged).toHaveLength(2);
    expect(merged.map(i => i.storeId)).toEqual(['a', 'b']);
    expect(merged[0].detail).toBe('products failed');
  });

  it('returns nothing when every store is healthy', () => {
    expect(dedupeStoreIssues([], [])).toEqual([]);
  });
});
