/**
 * Per-store connection health.
 *
 * A connected store can stop answering at any time - the merchant deletes
 * the WooCommerce site, uninstalls the Shopify app, rotates API keys, or
 * the host simply goes down. Before this module those failures propagated
 * as one opaque "Failed to load store data" that replaced the entire
 * dashboard, even when every *other* connected store was healthy and even
 * though the only useful next step (reconnect it, or remove it) lives in
 * Manage Stores.
 *
 * Everything here is about turning a raw transport error into something a
 * merchant can act on: which store, why, and what to do about it.
 */

export type StorePlatform = 'shopify' | 'woocommerce';

export type StoreIssueReason =
  | 'auth'         // credentials rejected - app uninstalled or keys revoked/rotated
  | 'not_found'    // the store/shop itself is gone from that address
  | 'unreachable'  // DNS/timeout/5xx - offline, deleted, or temporarily down
  | 'rate_limited' // platform throttling us - transient by definition
  | 'api_error'    // our own /api proxy never answered - says nothing about the store
  | 'unknown';

export interface StoreConnectionIssue {
  storeId: string;
  platform: StorePlatform;
  reason: StoreIssueReason;
  /** Upstream HTTP status, when one could be recovered from the error. */
  status?: number;
  /** Raw technical message - shown as small print and kept for logs. */
  detail: string;
}

/** What a per-store fetch produced: whatever data came back, plus who failed. */
export interface StoreFetchResult<T> {
  data: T[];
  issues: StoreConnectionIssue[];
}

interface IssueCopy {
  /** Short badge text. */
  label: string;
  /** One sentence explaining the state and the way out of it. */
  description: string;
  /** What Manage Stores should push the merchant towards. */
  suggestedAction: 'reconnect' | 'remove' | 'retry';
}

export const STORE_ISSUE_COPY: Record<StoreIssueReason, IssueCopy> = {
  auth: {
    label: 'Access revoked',
    description: 'Pithos is no longer authorised to read this store. Reconnect it to restore syncing.',
    suggestedAction: 'reconnect',
  },
  not_found: {
    label: 'Store not found',
    description: 'Nothing answers at this store\'s address any more. Reconnect it if it moved, or remove it.',
    suggestedAction: 'remove',
  },
  unreachable: {
    label: 'Unreachable',
    description: 'The store did not respond. It may be offline, deleted, or temporarily down.',
    suggestedAction: 'retry',
  },
  rate_limited: {
    label: 'Rate limited',
    description: 'The store is throttling requests right now. Syncing should recover on its own shortly.',
    suggestedAction: 'retry',
  },
  api_error: {
    label: 'Sync unavailable',
    description: 'Pithos could not reach its own sync service, so this store was never contacted. Nothing is wrong with your store.',
    suggestedAction: 'retry',
  },
  unknown: {
    label: 'Not syncing',
    description: 'We could not read products and orders from this store.',
    suggestedAction: 'retry',
  },
};

/**
 * Both proxies wrap an upstream failure in a 500 of their own
 * (functions/api/shopify/[[path]].ts, functions/api/woocommerce/[[path]].ts),
 * putting the platform's real status in the body as text like
 * "Shopify API error: 401". A 500 alone would classify as 'unreachable' and
 * tell the merchant to wait it out, when the actual fix is to reconnect - so
 * dig the upstream status back out before deciding.
 */
function parseUpstreamStatus(text: unknown): number | undefined {
  if (typeof text !== 'string') return undefined;
  const match = text.match(/\b([45]\d{2})\b/);
  return match ? Number(match[1]) : undefined;
}

/** Reads a property off a value that may be anything at all. */
function field(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[key] : undefined;
}

function extractStatus(error: unknown): number | undefined {
  const response = field(error, 'response');
  const rawStatus = field(response, 'status');
  const direct = typeof rawStatus === 'number' ? rawStatus : undefined;

  const body = field(response, 'data');
  const declared = field(body, 'upstreamStatus');
  const upstream =
    typeof declared === 'number'
      ? declared
      : parseUpstreamStatus(field(body, 'details')) ?? parseUpstreamStatus(field(body, 'error'));

  if (direct === 500 && upstream) return upstream;
  return direct ?? upstream;
}

function reasonFromStatus(status: number): StoreIssueReason {
  if (status === 401 || status === 403) return 'auth';
  if (status === 404 || status === 410) return 'not_found';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'unreachable';
  return 'unknown';
}

/** Axios never gets a response for DNS failures, TLS errors or timeouts. */
function reasonFromTransport(error: unknown): StoreIssueReason | undefined {
  const code = field(error, 'code');
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT' || code === 'ERR_NETWORK' || code === 'ENOTFOUND') {
    return 'unreachable';
  }
  if (field(error, 'request') && !field(error, 'response')) return 'unreachable';
  return undefined;
}

/**
 * Both proxies answer with a JSON object, always. A status carrying anything
 * else - an HTML error page, an empty body - did not come from them, so it
 * describes our own API layer rather than the merchant's store.
 *
 * This matters because the most common such response is a bare 404 (the
 * /api routes not deployed, or a dev server that only serves the SPA), and
 * reading that as "your store no longer exists" would push a merchant to
 * delete a store that is perfectly healthy.
 */
function cameFromOurProxy(error: unknown): boolean {
  const body = field(field(error, 'response'), 'data');
  return typeof body === 'object' && body !== null;
}

export function classifyStoreError(error: unknown): { reason: StoreIssueReason; status?: number; detail: string } {
  const message = field(error, 'message');
  const detail = typeof message === 'string' ? message : String(error);
  const status = extractStatus(error);

  if (status !== undefined) {
    if (!cameFromOurProxy(error)) {
      return { reason: 'api_error', status, detail };
    }
    return { reason: reasonFromStatus(status), status, detail };
  }

  const transport = reasonFromTransport(error);
  if (transport) return { reason: transport, detail };

  // Thrown by the services before any request goes out, when the Firestore
  // doc a store id points at has been deleted.
  if (/not found/i.test(detail)) return { reason: 'not_found', detail };

  return { reason: 'unknown', detail };
}

export function toStoreIssue(storeId: string, platform: StorePlatform, error: unknown): StoreConnectionIssue {
  return { storeId, platform, ...classifyStoreError(error) };
}

/**
 * Products and orders are fetched independently, so one dead store shows up
 * twice. Collapse to one issue per store, keeping the first (both describe
 * the same underlying failure).
 */
export function dedupeStoreIssues(...groups: StoreConnectionIssue[][]): StoreConnectionIssue[] {
  const byStore = new Map<string, StoreConnectionIssue>();
  for (const issue of groups.flat()) {
    if (!byStore.has(issue.storeId)) byStore.set(issue.storeId, issue);
  }
  return [...byStore.values()];
}
