import React, { useMemo } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { OverviewPage } from '../../components/dashboard/overview/OverviewPage';
import { ProductsTableWidget } from '../../components/dashboard/overview/ProductsTableWidget';
import { computeInventoryMetrics, computeInventoryKpis, InventoryBand, InventoryRow } from '../../utils/inventoryMetrics';
import { useAIAssistant } from '../../contexts/AIAssistantContext';
import { useUserPreferences } from '../../hooks/useUserPreferences';
import type { DashboardOutletContext } from '../../components/dashboard/DashboardShell';

const BAND_INFO: Record<InventoryBand, { dot: string; text: string }> = {
  stockout: { dot: 'bg-band-red', text: 'text-band-red' },
  reorder: { dot: 'bg-band-amber', text: 'text-band-amber' },
  healthy: { dot: 'bg-band-green', text: 'text-band-green' },
  overstock: { dot: 'bg-band-blue', text: 'text-band-blue' },
};

const PRIMARY_ACTION_LABEL: Record<string, string> = {
  RESTOCK: 'Reorder now',
  WARNING: 'Investigate',
  OPPORTUNITY: 'Review',
};

const CHAT_PROMPTS = [
  'What should I reorder this week?',
  'Which SKUs are dead stock?',
  'Summarize my sell-through',
];

/** How many rows the cover/attention/forecast widgets show - these cards size to content now, so this just keeps a very long catalogue from growing a card absurdly tall. */
const LIST_ITEM_LIMIT = 8;
const PRODUCTS_PAGE_SIZE = 8;

/** Real per-kind widget rendering for Overview, driven by computeInventoryMetrics/Kpis and cached AI recommendations. */
export default function OverviewRoute() {
  const { products, orders, storeKey, cachedRecommendations, openProduct } = useOutletContext<DashboardOutletContext>();
  const { sendMessage, openAssistant } = useAIAssistant();
  const { preferences } = useUserPreferences();

  const thresholds = useMemo(
    () => ({ reorderPointWeeks: preferences.reorderPointWeeks, overstockCeilingWeeks: preferences.overstockCeilingWeeks }),
    [preferences.reorderPointWeeks, preferences.overstockCeilingWeeks]
  );
  const allRows: InventoryRow[] = useMemo(() => computeInventoryMetrics(products, orders, 30, thresholds), [products, orders, thresholds]);
  const rows = useMemo(
    () => (preferences.hideZeroSales ? allRows.filter(r => r.unitsSoldWindow > 0) : allRows),
    [allRows, preferences.hideZeroSales]
  );
  const kpis = useMemo(() => computeInventoryKpis(rows), [rows]);
  const attentionRows = useMemo(() => rows.filter(r => r.band === 'stockout' || r.band === 'reorder'), [rows]);
  const recommendations = cachedRecommendations?.recommendations ?? [];

  const renderWidgetContent = (id: string, span: 1 | 2 | 3) => {
    // A KPI normally sits top-left in a compact card. When it's the trailing
    // card in an under-filled preset row (see withTrailingCardWidened) it
    // gets stretched to fill the row instead of sitting alone with empty
    // columns beside it - centering it as a "hero stat" makes that width a
    // deliberate choice instead of a small box floating in a big one.
    const kpi = (value: React.ReactNode, meta: React.ReactNode) =>
      span >= 2 ? (
        <div className="py-2 flex flex-col items-center text-center gap-1.5">
          <div className="font-mono-ibm text-5xl font-semibold">{value}</div>
          <div className="text-xs text-white/40">{meta}</div>
        </div>
      ) : (
        <div>
          <div className="font-mono-ibm text-2xl font-semibold">{value}</div>
          <div className="mt-1 text-[11px] text-white/40">{meta}</div>
        </div>
      );

    switch (id) {
      case 'kpi-units':
        return kpi(kpis.unitsOnHand, `across ${kpis.skuCount} SKUs`);
      case 'kpi-sell':
        return kpi(<>{kpis.sellThroughPct}<span className="text-base text-white/50">%</span></>, 'last 30 days');
      case 'kpi-cover':
        return kpi(
          <>{kpis.medianCoverWeeks !== null ? kpis.medianCoverWeeks.toFixed(1) : '—'}<span className="text-base text-white/50">wk</span></>,
          'median across catalogue'
        );
      case 'kpi-dead':
        return kpi(
          <span className="text-band-red">{kpis.deadStockUnits}<span className="text-base text-band-red/70"> units</span></span>,
          `${kpis.deadStockSkuCount} SKUs idle`
        );
      case 'cover': {
        const visible = rows.slice(0, LIST_ITEM_LIMIT);
        return (
          <div className="flex flex-col gap-2">
            {rows.length === 0 && <p className="text-[11.5px] text-white/40">No sales data yet for this window.</p>}
            {visible.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => openProduct(r.id)}
                className="grid grid-cols-[minmax(0,280px)_1fr_56px] gap-2.5 items-center rounded-md -mx-1 px-1 text-left hover:bg-white/[0.04]"
              >
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-white/85">{r.name}</div>
                  <div className="font-mono-ibm text-[10px] text-white/35">{r.sku}</div>
                </div>
                <div className="h-2 rounded-full bg-white/5 relative overflow-hidden">
                  <div className={`absolute inset-y-0 left-0 rounded-full ${BAND_INFO[r.band].dot}`} style={{ width: `${r.barPct}%` }} />
                </div>
                <div className={`text-right font-mono-ibm text-xs font-semibold ${BAND_INFO[r.band].text}`}>{r.coverLabel}</div>
              </button>
            ))}
            {rows.length > visible.length && (
              <Link to="products" className="text-[10.5px] text-accent-soft hover:text-white">
                +{rows.length - visible.length} more in Products →
              </Link>
            )}
          </div>
        );
      }
      case 'recs': {
        const preview = recommendations.slice(0, 2);
        return (
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-white/50">Top item{preview.length > 1 ? 's' : ''} by money at risk:</span>
              {!!recommendations.length && (
                <span className="flex-none font-mono-ibm text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-band-red/[0.16] text-[#ff9d93]">
                  {recommendations.length} WAITING
                </span>
              )}
            </div>
            {preview.length > 0 ? (
              <div className="mt-2.5 flex flex-col gap-2 max-w-[640px]">
                {preview.map(rec => (
                  <div key={`${rec.sku}-${rec.type}`} className="p-3 rounded-lg bg-black/20 border border-white/[0.07]">
                    <div className="flex items-center gap-2">
                      <span className="font-mono-ibm text-[9.5px] tracking-wide px-1.5 py-0.5 rounded bg-band-red/[0.14] text-[#ff9d93]">
                        {rec.type}
                      </span>
                      <span className="font-mono-ibm text-[10.5px] text-white/35">{rec.sku}</span>
                    </div>
                    <p className="mt-2 text-[11.5px] leading-relaxed text-white/70">{rec.message}</p>
                    <div className="mt-2.5 flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => openProduct(rec.sku)}
                        className="px-2.5 py-1.5 rounded-md bg-accent hover:bg-accent-hover text-canvas font-semibold text-[11.5px]"
                      >
                        {PRIMARY_ACTION_LABEL[rec.type] ?? 'Open'}
                      </button>
                      <Link
                        to="recommendations"
                        className="px-2.5 py-1.5 rounded-md border border-white/[0.14] text-white/70 hover:text-white font-medium text-[11.5px]"
                      >
                        See all {recommendations.length}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2.5 text-[11.5px] text-white/40">No recommendations generated yet.</p>
            )}
          </div>
        );
      }
      case 'attention': {
        const visible = attentionRows.slice(0, LIST_ITEM_LIMIT);
        return (
          <div className="flex flex-col gap-1">
            {visible.length === 0 && <p className="text-[11.5px] text-white/40">Nothing needs attention right now.</p>}
            {visible.map(r => (
              <div key={r.id} className="max-w-[480px] flex items-center gap-2.5">
                <span className={`flex-none w-1.5 h-1.5 rounded-full ${BAND_INFO[r.band].dot}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-white/85">{r.name}</div>
                  <div className="font-mono-ibm text-[10px] text-white/35">{r.sku}</div>
                </div>
                <button
                  type="button"
                  onClick={() => openProduct(r.id)}
                  className="flex-none px-2 py-1 rounded-md border border-white/[0.12] text-white/65 hover:text-white hover:border-white/25 font-medium text-[10.5px]"
                >
                  {r.band === 'stockout' ? 'Reorder' : 'View'}
                </button>
              </div>
            ))}
            {attentionRows.length > visible.length && (
              <Link to="products" className="text-[10.5px] text-accent-soft hover:text-white">
                +{attentionRows.length - visible.length} more in Products →
              </Link>
            )}
          </div>
        );
      }
      case 'forecast': {
        const visible = rows.slice(0, LIST_ITEM_LIMIT);
        return (
          <div className="flex flex-col gap-2">
            {visible.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => openProduct(r.id)}
                className="max-w-[420px] flex items-center gap-3 text-xs text-left rounded-md -mx-1 px-1 hover:bg-white/[0.04]"
              >
                <span className="min-w-0 flex-1 truncate text-white/80">{r.name}</span>
                <span className="flex-none font-mono-ibm text-white/50">{r.weeklyVelocity.toFixed(1)}/wk</span>
                <span className={`flex-none font-mono-ibm font-semibold ${BAND_INFO[r.band].text}`}>{r.coverLabel}</span>
              </button>
            ))}
          </div>
        );
      }
      case 'products':
        return <ProductsTableWidget rows={rows} pageSize={PRODUCTS_PAGE_SIZE} onOpen={openProduct} />;
      case 'chat':
        return (
          <div className="flex flex-wrap gap-2">
            {CHAT_PROMPTS.map(prompt => (
              <button
                key={prompt}
                type="button"
                onClick={() => {
                  openAssistant();
                  sendMessage(prompt);
                }}
                className="px-2.5 py-1.5 rounded-full border border-white/10 text-[11px] text-white/70 hover:border-accent/50 hover:text-white text-left"
              >
                {prompt}
              </button>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  const renderWidgetSub = (id: string): string | undefined => {
    if (id === 'recs' && cachedRecommendations) {
      const generated = new Date(cachedRecommendations.generatedAt);
      const days = Math.max(0, Math.floor((Date.now() - generated.getTime()) / 86400000));
      return `${recommendations.length} open decisions · generated ${days === 0 ? 'today' : `${days}d ago`}`;
    }
    return undefined;
  };

  const subtitle = `${kpis.skuCount} SKUs · ${kpis.unitsOnHand} units on hand · last 30 days`;

  return (
    <OverviewPage
      storeId={storeKey}
      renderWidgetContent={renderWidgetContent}
      renderWidgetSub={renderWidgetSub}
      subtitle={subtitle}
    />
  );
}
