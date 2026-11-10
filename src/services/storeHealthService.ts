import { recordStoreConnection } from './api';
import { logger } from '../utils/logger';
import { StoreConnectionIssue, StoreIssueReason } from '../utils/storeHealth';

/**
 * The health verdict persisted on each connected store (the `connection`
 * column of the server's stores table).
 *
 * Manage Stores needs to show a store as broken the moment it's opened -
 * including on a fresh page load, before any dashboard fetch has run - so
 * the outcome of every fetch is written back to the server rather than kept
 * only in React state. Reconnecting a store clears it.
 */
export interface StoreConnectionRecord {
  status: 'ok' | 'error';
  reason?: StoreIssueReason;
  detail?: string;
  /** ISO timestamp. */
  checkedAt?: string;
}

/** Validates a stored verdict, so a malformed one reads as "never checked". */
export function readConnectionRecord(raw: unknown): StoreConnectionRecord | null {
  if (typeof raw !== 'object' || raw === null) return null;

  const { status, reason, detail, checkedAt } = raw as Record<string, unknown>;
  if (status !== 'ok' && status !== 'error') return null;

  return {
    status,
    reason: typeof reason === 'string' ? (reason as StoreIssueReason) : undefined,
    detail: typeof detail === 'string' ? detail : undefined,
    checkedAt: typeof checkedAt === 'string' ? checkedAt : undefined,
  };
}

/**
 * Last status written per store this session. Data refetches run on every
 * store switch and manual sync; without this, a stable store would take a
 * server write each time just to restate "still fine".
 */
const lastWritten = new Map<string, string>();

function cacheKey(userId: string, storeId: string): string {
  return `${userId}:${storeId}`;
}

/** Signature of a verdict - only a change in one of these is worth a write. */
function fingerprint(record: StoreConnectionRecord): string {
  return `${record.status}:${record.reason ?? ''}`;
}

/**
 * Seeds the dedupe cache from stores that were just listed anyway, so a
 * page load doesn't rewrite a verdict the server already holds.
 */
export function seedConnectionRecord(userId: string, storeId: string, record: StoreConnectionRecord | null): void {
  if (record) lastWritten.set(cacheKey(userId, storeId), fingerprint(record));
  else lastWritten.delete(cacheKey(userId, storeId));
}

async function writeRecord(userId: string, storeId: string, record: StoreConnectionRecord, force: boolean): Promise<void> {
  const key = cacheKey(userId, storeId);
  if (!force && lastWritten.get(key) === fingerprint(record)) return;

  try {
    await recordStoreConnection(storeId, record);
    lastWritten.set(key, fingerprint(record));
  } catch (error) {
    // Health tracking is diagnostic - never let a failed write surface as a
    // data-loading failure of its own.
    logger.error('storeHealthService', 'Failed to persist store connection status', {
      fileName: 'storeHealthService.ts',
      storeId,
      error: (error as Error).message,
    });
  }
}

/**
 * Records the outcome of a fetch that covered `checkedStoreIds`: every store
 * in that set is marked healthy unless it appears in `issues`.
 */
export async function recordStoreHealth(
  userId: string,
  checkedStoreIds: string[],
  issues: StoreConnectionIssue[],
  /** Set for an explicitly requested re-check, so `checkedAt` refreshes even when the verdict is unchanged. */
  force = false
): Promise<void> {
  const checkedAt = new Date().toISOString();
  const issueByStore = new Map(issues.map(issue => [issue.storeId, issue]));

  await Promise.all(
    checkedStoreIds.map(storeId => {
      const issue = issueByStore.get(storeId);

      // An 'api_error' means our own proxy never answered, so the store was
      // never actually contacted. Recording a verdict either way would be a
      // lie - leave whatever was last genuinely observed in place.
      if (issue?.reason === 'api_error') return Promise.resolve();

      return writeRecord(
        userId,
        storeId,
        issue
          ? { status: 'error', reason: issue.reason, detail: issue.detail, checkedAt }
          : { status: 'ok', checkedAt },
        force
      );
    })
  );
}
