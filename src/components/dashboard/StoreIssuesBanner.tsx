import React from 'react';
import { AlertTriangle, RefreshCw, Settings2 } from 'lucide-react';
import { StoreConnectionIssue, STORE_ISSUE_COPY } from '../../utils/storeHealth';
import { getStoreDisplayName } from '../../utils/storeDisplay';

interface StoreIssuesBannerProps {
  issues: StoreConnectionIssue[];
  /** Used to turn a store id into the name the merchant recognises. */
  storeNames: Record<string, string>;
  onManageStores: () => void;
  onRetry: () => void;
  isRetrying: boolean;
}

/**
 * Sits above the dashboard rather than replacing it. A store that stops
 * answering - deleted site, uninstalled app, rotated keys - used to blank
 * the whole page behind "Failed to load store data", which hid both the
 * data from every healthy store and the only two fixes there are:
 * reconnect it, or remove it.
 */
export const StoreIssuesBanner: React.FC<StoreIssuesBannerProps> = ({
  issues,
  storeNames,
  onManageStores,
  onRetry,
  isRetrying,
}) => {
  if (issues.length === 0) return null;

  const heading =
    issues.length === 1
      ? `${getStoreDisplayName(storeNames[issues[0].storeId] ?? issues[0].storeId)} isn't syncing`
      : `${issues.length} stores aren't syncing`;

  return (
    <div
      role="status"
      className="mb-5 p-4 rounded-xl bg-band-amber/[0.07] border border-band-amber/30 font-archivo"
    >
      <div className="flex items-start gap-3 flex-wrap">
        <AlertTriangle className="w-[18px] h-[18px] text-band-amber shrink-0 mt-[1px]" />

        <div className="min-w-0 flex-1">
          <div className="font-semibold text-[13px] text-white">{heading}</div>
          <p className="mt-1 text-[12px] leading-snug text-white/55">
            Figures below exclude {issues.length === 1 ? 'it' : 'them'}. Reconnect or remove{' '}
            {issues.length === 1 ? 'the store' : 'the stores'} in Manage Stores to fix this.
          </p>

          <ul className="mt-2.5 flex flex-col gap-1">
            {issues.map(issue => {
              const copy = STORE_ISSUE_COPY[issue.reason];
              return (
                <li key={issue.storeId} className="text-[12px] leading-snug">
                  <span className="text-white/80">
                    {getStoreDisplayName(storeNames[issue.storeId] ?? issue.storeId)}
                  </span>
                  <span className="mx-2 font-mono-ibm text-[10px] uppercase tracking-wide text-band-amber whitespace-nowrap">
                    {copy.label}
                  </span>
                  <span className="text-white/40">{copy.description}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/[0.12] text-white/65 hover:text-white font-medium text-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Retrying…' : 'Retry'}
          </button>
          <button
            type="button"
            onClick={onManageStores}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.12] text-white hover:border-accent/40 font-medium text-xs"
          >
            <Settings2 className="w-3.5 h-3.5 text-accent-soft" />
            Manage stores
          </button>
        </div>
      </div>
    </div>
  );
};
