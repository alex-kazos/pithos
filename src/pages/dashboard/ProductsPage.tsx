import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { computeInventoryMetrics, InventoryRow, skuKeyFor } from '../../utils/inventoryMetrics';
import { useUserPreferences } from '../../hooks/useUserPreferences';
import { BAND_HEX, BAND_LABEL, BAND_PILL_BG, BAND_TEXT } from '../../constants/inventoryBands';
import { TablePagination } from '../../components/dashboard/TablePagination';
import type { DashboardOutletContext } from '../../components/dashboard/DashboardShell';

const CHART_HEIGHT = 220;
const PAGE_SIZE = 12;

function ticksFor(max: number): string[] {
  const step = Math.ceil(max / 4 / 5) * 5 || 1;
  const top = step * 4;
  return [String(top), String(step * 3), String(step * 2), String(step), '0'];
}

/** Sales-vs-stock overview plus the full, filterable SKU table - the redesign the older ProductTables view deferred. Shared by /demo and the real /dashboard since both feed it the same products/orders shape. */
export default function ProductsPage() {
  const { products, orders, openProduct } = useOutletContext<DashboardOutletContext>();
  const { preferences } = useUserPreferences();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [page, setPage] = useState(0);

  const thresholds = useMemo(
    () => ({ reorderPointWeeks: preferences.reorderPointWeeks, overstockCeilingWeeks: preferences.overstockCeilingWeeks }),
    [preferences.reorderPointWeeks, preferences.overstockCeilingWeeks]
  );

  const categoryBySku = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) map.set(skuKeyFor(p), p.product_type || 'Uncategorized');
    return map;
  }, [products]);

  const allRows = useMemo(() => computeInventoryMetrics(products, orders, 30, thresholds), [products, orders, thresholds]);

  const categories = useMemo(() => {
    const unique = new Set(Array.from(categoryBySku.values()));
    return ['All', ...Array.from(unique).sort()];
  }, [categoryBySku]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter(r => {
      const matchesCategory = category === 'All' || categoryBySku.get(r.id) === category;
      const matchesSearch = !q || r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [allRows, categoryBySku, category, search]);

  // A filter can shorten the list under the current page - snap back to the
  // first page so the table never renders empty with rows still available.
  useEffect(() => {
    setPage(0);
  }, [search, category]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pageRows = filteredRows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  // Scaled to the whole catalogue, not the page: a per-page max would rescale
  // the bars on every page turn and make two pages look falsely comparable.
  const peerMax = Math.max(10, ...allRows.map(r => Math.max(r.stock, r.unitsSoldWindow)));

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/[0.06]">
        <div>
          <h1 className="m-0 font-archivo font-semibold text-[19px] tracking-tight">Products</h1>
          <p className="mt-[3px] font-archivo text-xs text-white/45">Sales and stock per SKU · click a bar or a row to drill in</p>
        </div>
        <div className="flex items-center gap-3.5 flex-none text-[11.5px] text-white/50">
          <span className="flex items-center gap-1.5">
            <span className="w-[9px] h-[9px] rounded-sm bg-band-green" />
            Sales 30d
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-[9px] h-[9px] rounded-sm bg-band-blue" />
            Stock
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex-1 min-w-[200px] max-w-[420px] flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03]">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products…"
            className="flex-1 min-w-0 bg-transparent text-white text-xs outline-none placeholder:text-white/35"
          />
        </div>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg border border-white/[0.08] bg-surface-2 text-white/80 text-xs outline-none"
        >
          {categories.map(c => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <span className="flex-1" />
        <span className="font-mono-ibm text-[10px] tracking-wide text-white/30">
          {filteredRows.length} OF {allRows.length} SKUS
        </span>
      </div>

      <div className="p-[18px] pb-2.5 rounded-xl border border-white/10 bg-surface">
        <div className="flex gap-3">
          <div
            className="flex-none w-[34px] flex flex-col justify-between items-end font-mono-ibm text-[10px] text-white/35"
            style={{ height: CHART_HEIGHT }}
          >
            {ticksFor(peerMax).map((t, i) => (
              <span key={i}>{t}</span>
            ))}
          </div>
          <div className="flex-1 min-w-0 relative border-b border-white/[0.12]" style={{ height: CHART_HEIGHT }}>
            <div className="absolute inset-0 flex items-end gap-2.5">
              {pageRows.map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => openProduct(r.id)}
                  title={r.name}
                  className="flex-1 min-w-0 h-full flex items-end justify-center gap-[3px] rounded hover:bg-white/[0.04]"
                >
                  <div
                    style={{ width: 12, maxWidth: '40%', height: `${(r.unitsSoldWindow / peerMax) * 100}%`, minHeight: 2, borderRadius: '3px 3px 0 0', background: '#5ec089' }}
                  />
                  <div
                    style={{ width: 12, maxWidth: '40%', height: `${(r.stock / peerMax) * 100}%`, minHeight: 2, borderRadius: '3px 3px 0 0', background: '#6b7aff' }}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="ml-[46px] flex gap-2.5">
          {pageRows.map(r => (
            <div key={r.id} className="flex-1 min-w-0 pt-2 text-center text-[10px] text-white/40 truncate" title={r.name}>
              {r.name.split(' ')[0]}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-surface overflow-hidden">
        <div className="grid grid-cols-[minmax(0,3fr)_80px_80px_80px_90px_110px] gap-3 px-[18px] py-2.5 border-b border-white/[0.07] font-mono-ibm text-[10px] tracking-wide text-white/40">
          <span>PRODUCT</span>
          <span>STOCK</span>
          <span>SOLD 30D</span>
          <span>COVER</span>
          <span>VELOCITY</span>
          <span />
        </div>
        {filteredRows.length === 0 && <p className="px-[18px] py-6 text-[12.5px] text-white/40">No products match this filter.</p>}
        {pageRows.map((r: InventoryRow) => (
          <button
            key={r.id}
            type="button"
            onClick={() => openProduct(r.id)}
            className="w-full grid grid-cols-[minmax(0,3fr)_80px_80px_80px_90px_110px] gap-3 items-center px-[18px] py-[11px] border-b border-white/[0.05] text-left hover:bg-white/[0.03]"
          >
            <div className="min-w-0">
              <div className="truncate text-[12.5px] text-white/90">{r.name}</div>
              <div className="font-mono-ibm text-[10px] text-white/35">{r.sku}</div>
            </div>
            <span className="font-mono-ibm text-xs text-white/85">{r.stock}</span>
            <span className="font-mono-ibm text-xs text-white/85">{r.unitsSoldWindow}</span>
            <span className={`font-mono-ibm text-xs font-semibold ${BAND_TEXT[r.band]}`}>{r.coverLabel}</span>
            <span className="font-mono-ibm text-xs text-white/50">{r.weeklyVelocity.toFixed(1)}/wk</span>
            <span
              className={`justify-self-end px-2 py-[3px] rounded-full text-[10px] font-semibold tracking-wide ${BAND_PILL_BG[r.band]}`}
              style={{ color: BAND_HEX[r.band] }}
            >
              {BAND_LABEL[r.band]}
            </span>
          </button>
        ))}

        <TablePagination
          page={page}
          pageCount={pageCount}
          totalLabel={`${filteredRows.length} SKUs`}
          onPageChange={setPage}
          className="px-[18px] py-2.5"
        />
      </div>
    </div>
  );
}
