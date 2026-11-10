import React from 'react';

interface ErrorStateProps {
  /** Technical detail shown under the headline. */
  message: string;
  onRetry?: () => void;
}

/**
 * Whole-page failure - reserved for the case where nothing could be
 * attempted at all. A single store that can't be read is not this: it
 * surfaces as a StoreIssuesBanner over an otherwise working dashboard.
 */
export const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry }) => {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center font-archivo">
      <div className="text-center max-w-sm px-6">
        <p className="text-[#ff9d93] font-semibold mb-2">Failed to load store data</p>
        <p className="text-white/45 text-[13px] leading-snug">{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-5 px-4 py-2 rounded-lg border border-white/[0.12] text-white/70 hover:text-white font-medium text-xs"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
};
