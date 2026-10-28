import { ChevronLeft, ChevronRight } from 'lucide-react';

interface TablePaginationProps {
  page: number;
  pageCount: number;
  /** Trailing context for the counter, e.g. "30 SKUs". */
  totalLabel: string;
  onPageChange: (page: number) => void;
  className?: string;
}

/** Prev/next pager shared by the Overview products card and the Products/Forecast tables. Renders nothing for a single page so short catalogues don't grow dead chrome. */
export function TablePagination({ page, pageCount, totalLabel, onPageChange, className = '' }: TablePaginationProps) {
  if (pageCount <= 1) return null;

  return (
    <div className={`flex items-center justify-between gap-4 ${className}`}>
      <button
        type="button"
        onClick={() => onPageChange(Math.max(0, page - 1))}
        disabled={page === 0}
        title="Previous page"
        className="w-6 h-6 rounded-md border border-white/10 text-white/60 disabled:opacity-30 flex items-center justify-center hover:text-white hover:border-white/25"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>
      <span className="font-mono-ibm text-[10.5px] text-white/40">
        {page + 1} / {pageCount} <span className="text-white/25">· {totalLabel}</span>
      </span>
      <button
        type="button"
        onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))}
        disabled={page === pageCount - 1}
        title="Next page"
        className="w-6 h-6 rounded-md border border-white/10 text-white/60 disabled:opacity-30 flex items-center justify-center hover:text-white hover:border-white/25"
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
