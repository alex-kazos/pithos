import { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AlertTriangle, PackageX } from 'lucide-react';
import { computeInventoryMetrics } from '../../utils/inventoryMetrics';
import { useUserPreferences } from '../../hooks/useUserPreferences';
import type { DashboardOutletContext } from '../../components/dashboard/DashboardShell';

/** Stock levels split into the three states a shop owner actually acts on differently: still-selling-but-thin, dead-in-the-water, and completely dry. */
export default function AlertsPage() {
  const { products, orders, openProduct } = useOutletContext<DashboardOutletContext>();
  const { preferences } = useUserPreferences();

  const thresholds = useMemo(
    () => ({ reorderPointWeeks: preferences.reorderPointWeeks, overstockCeilingWeeks: preferences.overstockCeilingWeeks }),
    [preferences.reorderPointWeeks, preferences.overstockCeilingWeeks]
  );
  const rows = useMemo(() => computeInventoryMetrics(products, orders, 30, thresholds), [products, orders, thresholds]);

  const lowStock = rows.filter(r => r.band === 'stockout' && r.stock > 0);
  const outOfStock = rows.filter(r => r.stock === 0);
  const deadStock = rows.filter(r => r.unitsSoldWindow === 0 && r.stock > 0);
  const deadStockUnits = deadStock.reduce((sum, r) => sum + r.stock, 0);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="pb-4 border-b border-white/[0.06]">
        <h1 className="m-0 font-archivo font-semibold text-[19px] tracking-tight">Alerts</h1>
        <p className="mt-[3px] font-archivo text-xs text-white/45">
          Stock levels against your {thresholds.reorderPointWeeks}-week reorder point
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-start">
        <div className="p-5 rounded-xl border border-band-amber/25 bg-surface">
          <div className="flex items-center justify-between">
            <h3 className="m-0 text-base font-semibold text-band-amber">Low Stock</h3>
            <AlertTriangle className="w-5 h-5 text-band-amber" />
          </div>
          <div className="mt-4 flex flex-col gap-4">
            {lowStock.length === 0 && <p className="text-sm text-white/45">No low-stock items.</p>}
            {lowStock.map(r => (
              <button key={r.id} type="button" onClick={() => openProduct(r.id)} className="block w-full text-left">
                <div className="text-sm font-medium text-accent-soft">{r.name}</div>
                <div className="mt-[3px] flex items-center justify-between gap-3">
                  <span className="text-xs text-white/45">
                    SKU: {r.sku} | {r.stock} units remaining
                  </span>
                  <span className="flex-none text-xs font-semibold text-band-amber">Low Stock</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 rounded-xl border border-band-red/25 bg-surface min-h-[200px]">
          <div className="flex items-center justify-between">
            <h3 className="m-0 text-base font-semibold text-band-red">Out of Stock</h3>
            <PackageX className="w-5 h-5 text-band-red" />
          </div>
          {outOfStock.length === 0 ? (
            <p className="mt-[18px] text-sm text-white/45">No out of stock items</p>
          ) : (
            <div className="mt-4 flex flex-col gap-4">
              {outOfStock.map(r => (
                <button key={r.id} type="button" onClick={() => openProduct(r.id)} className="block w-full text-left">
                  <div className="text-sm font-medium text-accent-soft">{r.name}</div>
                  <div className="mt-[3px] text-xs text-white/45">SKU: {r.sku} | 0 units remaining</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-5 rounded-xl border border-accent/20 bg-surface">
        <div className="flex items-center justify-between">
          <h3 className="m-0 text-base font-semibold text-accent-soft">Idle capital</h3>
          <span className="font-mono-ibm text-[11px] text-white/40">
            {deadStockUnits} units · {deadStock.length} SKU{deadStock.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="mt-4 flex flex-col gap-3.5">
          {deadStock.length === 0 && <p className="text-sm text-white/45">No idle stock right now.</p>}
          {deadStock.map(r => (
            <button key={r.id} type="button" onClick={() => openProduct(r.id)} className="block w-full text-left">
              <div className="text-sm font-medium text-accent-soft">{r.name}</div>
              <div className="mt-[3px] text-xs text-white/45">
                SKU: {r.sku} | {r.stock} units, zero sales in the last 30 days
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
