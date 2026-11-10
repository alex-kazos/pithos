import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { computeInventoryMetrics } from '../../utils/inventoryMetrics';
import { useUserPreferences } from '../../hooks/useUserPreferences';
import { BAND_TEXT } from '../../constants/inventoryBands';
import { TablePagination } from '../../components/dashboard/TablePagination';
import type { DashboardOutletContext } from '../../components/dashboard/DashboardShell';

const PAGE_SIZE = 12;

/** Naive continuation of the last 30 days' pace - not a real forecasting model, just "if nothing changes". Confidence leans on sample size: a SKU with more recorded sales gets a higher score, and zero sales always reads as low-confidence rather than a demand collapse. */
function confidenceFor(unitsSoldWindow: number): number {
  if (unitsSoldWindow === 0) return 35;
  return Math.min(94, 58 + Math.round(unitsSoldWindow * 0.8));
}

/** Forecast relocated into its own route, redesigned to match the product handoff: one table instead of the older AIStockPredictions widget. Shared by /demo and the real /dashboard. */
export default function ForecastPage() {
  const { products, orders, openProduct } = useOutletContext<DashboardOutletContext>();
  const { preferences } = useUserPreferences();
  const [page, setPage] = useState(0);

  const thresholds = useMemo(
    () => ({ reorderPointWeeks: preferences.reorderPointWeeks, overstockCeilingWeeks: preferences.overstockCeilingWeeks }),
    [preferences.reorderPointWeeks, preferences.overstockCeilingWeeks]
  );
  const rows = useMemo(() => computeInventoryMetrics(products, orders, 30, thresholds), [products, orders, thresholds]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="pb-4 border-b border-white/[0.06]">
        <h1 className="m-0 font-archivo font-semibold text-[19px] tracking-tight">Forecast</h1>
        <p className="mt-[3px] font-archivo text-xs text-white/45">30-day demand and how much to trust it</p>
      </div>

      <div className="rounded-xl border border-white/10 bg-surface overflow-hidden">
        <div className="grid grid-cols-[minmax(0,3fr)_100px_110px_90px_minmax(0,140px)] gap-3 px-[18px] py-2.5 border-b border-white/[0.07] font-mono-ibm text-[10px] tracking-wide text-white/40">
          <span>PRODUCT</span>
          <span>VELOCITY</span>
          <span>NEXT 30D</span>
          <span>COVER</span>
          <span>CONFIDENCE</span>
        </div>
        {rows.length === 0 && <p className="px-[18px] py-6 text-[12.5px] text-white/40">No sales data yet for this window.</p>}
        {pageRows.map(r => {
          const conf = confidenceFor(r.unitsSoldWindow);
          const confColor = conf > 75 ? '#5ec089' : conf > 50 ? '#e0a341' : '#f0655c';
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => openProduct(r.id)}
              className="w-full grid grid-cols-[minmax(0,3fr)_100px_110px_90px_minmax(0,140px)] gap-3 items-center px-[18px] py-[11px] border-b border-white/[0.05] text-left hover:bg-white/[0.03]"
            >
              <div className="min-w-0">
                <div className="truncate text-[12.5px] text-white/90">{r.name}</div>
                <div className="font-mono-ibm text-[10px] text-white/35">{r.sku}</div>
              </div>
              <span className="font-mono-ibm text-xs text-white/60">{r.weeklyVelocity.toFixed(1)}/wk</span>
              <span className="font-mono-ibm text-xs text-white/85">{Math.round(r.unitsSoldWindow * 1.02)} units</span>
              <span className={`font-mono-ibm text-xs font-semibold ${BAND_TEXT[r.band]}`}>{r.coverLabel}</span>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-[5px] rounded-full bg-white/[0.07] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${conf}%`, background: confColor }} />
                </div>
                <span className="flex-none font-mono-ibm text-[10.5px] text-white/50">{conf}%</span>
              </div>
            </button>
          );
        })}

        <TablePagination
          page={page}
          pageCount={pageCount}
          totalLabel={`${rows.length} SKUs`}
          onPageChange={setPage}
          className="px-[18px] py-2.5"
        />
      </div>
    </div>
  );
}
