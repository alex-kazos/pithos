import { useMemo, useState, type ReactNode } from 'react';
import { DashboardOrder, DashboardProduct } from '../../types/dashboard';
import { InventoryBand, InventoryRow, InventoryThresholds, skuKeyFor } from '../../utils/inventoryMetrics';
import { BAND_HEX, BAND_LABEL, BAND_PILL_BG, BAND_TEXT } from '../../constants/inventoryBands';
import { buildBurnDown, buildMonthlySeries, buildSellThrough, buildWeeklySeries } from '../../utils/skuChartSeries';

type ChartMode = '12m' | 'weekly' | 'burn' | 'sell' | 'peers';

const CHART_TABS: { id: ChartMode; label: string }[] = [
  { id: '12m', label: '12-month sales vs stock' },
  { id: 'weekly', label: 'Weekly sales + stock' },
  { id: 'burn', label: 'Burn-down to stockout' },
  { id: 'sell', label: 'Sell-through & cover' },
  { id: 'peers', label: 'Against the catalogue' },
];

const GREEN = '#5ec089';
const INDIGO = '#6b7aff';

function ticksFor(max: number): string[] {
  const step = Math.ceil(max / 4 / 5) * 5 || 1;
  const top = step * 4;
  return [String(top), String(step * 3), String(step * 2), String(step), '0'];
}

function insightFor(row: InventoryRow, thresholds: InventoryThresholds): string {
  if (row.band === 'stockout') {
    return `At ${row.weeklyVelocity.toFixed(1)} units a week, ${row.stock} units is ${row.coverWeeks?.toFixed(1)} weeks of cover — inside most suppliers' lead time. Sales have been steady, so this is a purchasing gap, not a demand drop.`;
  }
  if (row.band === 'reorder') {
    return `Cover has slipped to ${row.coverWeeks?.toFixed(1)} weeks, under your ${thresholds.reorderPointWeeks}-week reorder point. An order sized to the recent pace is enough to fix it.`;
  }
  if (row.band === 'healthy') {
    return 'Sell-through and cover have both held steady recently. Nothing to decide here beyond keeping the reorder cadence you already have.';
  }
  if (row.unitsSoldWindow === 0) {
    return `${row.stock} units have not moved in the last 30 days. The capital is idle rather than at risk — discounting or bundling is the way it comes back.`;
  }
  return `Cover sits at ${row.coverWeeks?.toFixed(1)} weeks, past your ${thresholds.overstockCeilingWeeks}-week ceiling. Demand is real but slow, so the fix is ordering less next time rather than clearing the shelf.`;
}

function suggestionFor(row: InventoryRow): string {
  if (row.band === 'stockout' || row.band === 'reorder') {
    return `${Math.round(row.weeklyVelocity * 8)} units (8 weeks of cover)`;
  }
  if (row.unitsSoldWindow === 0) return 'no reorder · clear existing units';
  return 'hold — next review in 4 weeks';
}

function Bars({ height, children }: { height: number; children: ReactNode }) {
  return (
    <div className="flex-1 min-w-0 relative border-b border-white/[0.12]" style={{ height }}>
      <div className="absolute inset-0 flex items-end gap-1.5">{children}</div>
    </div>
  );
}

function TickColumn({ ticks, height }: { ticks: string[]; height: number }) {
  return (
    <div
      className="flex-none w-9 flex flex-col justify-between items-end font-mono-ibm text-[10px] text-white/35"
      style={{ height }}
    >
      {ticks.map((t, i) => (
        <span key={i}>{t}</span>
      ))}
    </div>
  );
}

interface ProductDetailModalProps {
  row: InventoryRow | null;
  rows: InventoryRow[];
  products: DashboardProduct[];
  orders: DashboardOrder[];
  thresholds: InventoryThresholds;
  onClose: () => void;
}

/** Full drill-down for one SKU: stat tiles, five chart views built from real order history, and the same reorder-suggestion logic the Overview/Recommendations widgets use. Rendered once by DashboardShell and opened via the outlet context's `openProduct`. */
export function ProductDetailModal({ row, rows, products, orders, thresholds, onClose }: ProductDetailModalProps) {
  const [chartMode, setChartMode] = useState<ChartMode>('12m');

  const product = useMemo(
    () => (row ? products.find(p => skuKeyFor(p) === row.id) : undefined),
    [row, products]
  );

  if (!row) return null;

  const band: InventoryBand = row.band;
  const category = product?.product_type || 'Uncategorized';
  const priceLabel = product?.price ? `$${Number(product.price).toFixed(2)}` : null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center p-8 bg-black/[0.72] backdrop-blur-[3px]"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-[880px] max-h-full overflow-y-auto rounded-2xl border border-white/[0.11] bg-surface shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 px-[22px] pt-5 pb-4 border-b border-white/[0.07]">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="m-0 text-lg font-semibold tracking-tight">{row.name}</h2>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${BAND_PILL_BG[band]} ${BAND_TEXT[band]}`}>
                {BAND_LABEL[band]}
              </span>
            </div>
            <div className="mt-1 font-mono-ibm text-[11px] text-white/40">
              {row.sku} · {category}
              {priceLabel && <> · {priceLabel}</>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-none w-7 h-7 rounded-lg border border-white/[0.12] text-white/60 hover:text-white hover:border-white/30"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-4 gap-px bg-white/[0.07]">
          {[
            { label: 'STOCK', value: String(row.stock), color: '#fff' },
            { label: 'SOLD 30D', value: String(row.unitsSoldWindow), color: '#fff' },
            { label: 'COVER', value: row.coverLabel, color: BAND_HEX[band] },
            { label: 'VELOCITY', value: `${row.weeklyVelocity.toFixed(1)}/wk`, color: '#fff' },
          ].map(s => (
            <div key={s.label} className="p-3.5 px-[18px] bg-surface">
              <div className="font-mono-ibm text-[9.5px] tracking-wide text-white/40">{s.label}</div>
              <div className="mt-[5px] font-mono-ibm text-[19px] font-semibold" style={{ color: s.color }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        <div className="px-[22px] pt-4 pb-1 flex gap-1.5 flex-wrap">
          {CHART_TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setChartMode(t.id)}
              className={`px-[11px] py-1.5 rounded-lg text-[11.5px] ${
                t.id === chartMode
                  ? 'border border-accent/45 bg-accent/[0.14] text-accent-soft font-semibold'
                  : 'border border-white/10 bg-transparent text-white/55 font-medium'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="px-[22px] pt-2.5">
          <ChartBody mode={chartMode} row={row} rows={rows} products={products} orders={orders} />
        </div>

        <div className="mx-[22px] mt-[18px] p-3.5 px-4 rounded-lg border border-accent/[0.14] bg-accent/[0.05]">
          <div className="text-[11px] font-semibold text-accent-soft">What StockPilot reads from this</div>
          <p className="mt-1.5 text-xs leading-relaxed text-white/70">{insightFor(row, thresholds)}</p>
        </div>

        <div className="flex items-center justify-between gap-3 px-[22px] pt-[18px] pb-5">
          <span className="text-[11px] text-white/35">Suggested order: {suggestionFor(row)}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg border border-white/[0.14] text-white/70 hover:text-white text-xs font-medium"
            >
              Close
            </button>
            <button
              type="button"
              className="px-3.5 py-2 rounded-lg bg-accent hover:bg-accent-hover text-canvas text-xs font-semibold"
            >
              Reorder now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChartBody({
  mode,
  row,
  rows,
  products,
  orders,
}: {
  mode: ChartMode;
  row: InventoryRow;
  rows: InventoryRow[];
  products: DashboardProduct[];
  orders: DashboardOrder[];
}) {
  const height = 220;

  if (mode === '12m' || mode === 'weekly') {
    const series =
      mode === '12m'
        ? buildMonthlySeries(row.id, row.stock, products, orders, 12)
        : buildWeeklySeries(row.id, row.stock, products, orders, 13);
    const max = Math.max(10, ...series.map(p => Math.max(p.sales, p.stock)));
    return (
      <>
        <Caption
          text={
            mode === '12m'
              ? 'Units sold each month against stock on hand at month end, last 12 months. Bars drifting apart mean stock is building up faster than it sells.'
              : 'Units sold each week over the last quarter, with stock on hand reconstructed alongside it.'
          }
          legend={[
            { swatchClass: 'w-[9px] h-[9px] rounded-sm', color: GREEN, label: 'Sales' },
            { swatchClass: 'w-[9px] h-[9px] rounded-sm', color: INDIGO, label: 'Stock' },
          ]}
        />
        <div className="mt-3.5 flex gap-3">
          <TickColumn ticks={ticksFor(max)} height={height} />
          <Bars height={height}>
            {series.map((p, i) => (
              <div key={i} className="flex-1 min-w-0 h-full flex items-end justify-center gap-[3px]">
                <div style={{ width: 11, maxWidth: '46%', height: `${(p.sales / max) * 100}%`, minHeight: 2, borderRadius: '3px 3px 0 0', background: GREEN }} />
                <div style={{ width: 11, maxWidth: '46%', height: `${(p.stock / max) * 100}%`, minHeight: 2, borderRadius: '3px 3px 0 0', background: INDIGO }} />
              </div>
            ))}
          </Bars>
        </div>
        <div className="ml-[46px] flex gap-1.5">
          {series.map((p, i) => (
            <div key={i} className="flex-1 min-w-0 pt-2 text-center font-mono-ibm text-[9.5px] text-white/35 truncate">
              {p.label}
            </div>
          ))}
        </div>
      </>
    );
  }

  if (mode === 'burn') {
    const { points, stockoutAt, unit } = buildBurnDown(row.stock, row.weeklyVelocity, row.coverWeeks);
    const max = Math.max(4, row.stock);
    const steps = points.length - 1;
    return (
      <>
        <Caption
          text={
            row.weeklyVelocity > 0
              ? `Stock left if demand holds at ${row.weeklyVelocity.toFixed(1)} units a week. The marker is when this SKU hits zero.`
              : 'No sales in the window, so there is no burn-down: these units sit still until something changes.'
          }
          legend={[{ swatchClass: 'w-[9px] h-[9px] rounded-sm', color: INDIGO, label: 'Projected units left' }]}
        />
        <div className="mt-3.5 flex gap-3">
          <TickColumn ticks={ticksFor(max)} height={height} />
          <div className="flex-1 min-w-0 relative border-b border-white/[0.12]" style={{ height }}>
            <div className="absolute inset-0 flex items-end gap-1.5">
              {points.map((p, i) => (
                <div key={i} className="flex-1 min-w-0 h-full flex items-end justify-center">
                  <div
                    style={{
                      width: 13,
                      maxWidth: '46%',
                      height: `${(p.unitsLeft / max) * 100}%`,
                      minHeight: 2,
                      borderRadius: '3px 3px 0 0',
                      background: p.unitsLeft <= 0 ? 'rgba(240,101,92,0.35)' : INDIGO,
                    }}
                  />
                </div>
              ))}
            </div>
            {stockoutAt !== null && (
              <div
                className="absolute top-0 bottom-0 w-0 border-l border-dashed border-band-red"
                style={{ left: `${Math.min(96, (stockoutAt / Math.max(1, steps)) * 100)}%` }}
              >
                <span className="absolute -top-[9px] left-1.5 font-mono-ibm text-[9.5px] text-band-red whitespace-nowrap">
                  stockout ≈ {stockoutAt.toFixed(unit === 'd' ? 0 : 1)}{unit}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="ml-[46px] flex gap-1.5">
          {points.map((p, i) => (
            <div key={i} className="flex-1 min-w-0 pt-2 text-center font-mono-ibm text-[9.5px] text-white/35 truncate">
              {p.label}
            </div>
          ))}
        </div>
      </>
    );
  }

  if (mode === 'sell') {
    const monthly = buildMonthlySeries(row.id, row.stock, products, orders, 12);
    const cols = buildSellThrough(monthly);
    const linePoints = cols
      .map((c, i) => `${(((i + 0.5) / cols.length) * 100).toFixed(2)},${(100 - c.sellThroughPct).toFixed(2)}`)
      .join(' ');
    const line2Points = cols
      .map((c, i) => `${(((i + 0.5) / cols.length) * 100).toFixed(2)},${(100 - (c.coverWeeks / 14) * 100).toFixed(2)}`)
      .join(' ');
    return (
      <>
        <Caption
          text="Sell-through percentage against weeks of cover, month by month - cover is drawn on its own 0-14 week scale. The two lines converging means stock is failing to keep up with demand."
          legend={[
            { swatchClass: 'w-3.5 h-0.5', color: GREEN, label: 'Sell-through %' },
            { swatchClass: 'w-3.5 h-0.5', color: INDIGO, label: 'Cover · 0-14wk scale' },
          ]}
        />
        <div className="mt-3.5 flex gap-3">
          <TickColumn ticks={['100%', '75%', '50%', '25%', '0']} height={height} />
          <div className="flex-1 min-w-0 relative border-b border-white/[0.12]" style={{ height }}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible">
              <polyline points={linePoints} fill="none" stroke={GREEN} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
              <polyline points={line2Points} fill="none" stroke={INDIGO} strokeWidth="1.6" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
        <div className="ml-[46px] flex gap-1.5">
          {cols.map((c, i) => (
            <div key={i} className="flex-1 min-w-0 pt-2 text-center font-mono-ibm text-[9.5px] text-white/35 truncate">
              {c.label}
            </div>
          ))}
        </div>
      </>
    );
  }

  // peers
  const max = Math.max(1, ...rows.map(r => Math.max(r.stock, r.unitsSoldWindow)));
  return (
    <>
      <Caption
        text="Every SKU in the catalogue, sales against stock. This SKU is highlighted; the rest are dimmed for context."
        legend={[
          { swatchClass: 'w-[9px] h-[9px] rounded-sm', color: GREEN, label: 'Sales 30d' },
          { swatchClass: 'w-[9px] h-[9px] rounded-sm', color: INDIGO, label: 'Stock' },
        ]}
      />
      <div className="mt-3.5 flex gap-3">
        <TickColumn ticks={ticksFor(max)} height={height} />
        <Bars height={height}>
          {rows.map(r => {
            const on = r.id === row.id;
            return (
              <div key={r.id} className="flex-1 min-w-0 h-full flex items-end justify-center gap-[3px]">
                <div
                  style={{
                    width: 10,
                    maxWidth: '40%',
                    height: `${(r.unitsSoldWindow / max) * 100}%`,
                    minHeight: 2,
                    borderRadius: '3px 3px 0 0',
                    background: on ? GREEN : 'rgba(94,192,137,0.28)',
                  }}
                />
                <div
                  style={{
                    width: 10,
                    maxWidth: '40%',
                    height: `${(r.stock / max) * 100}%`,
                    minHeight: 2,
                    borderRadius: '3px 3px 0 0',
                    background: on ? INDIGO : 'rgba(107,122,255,0.28)',
                  }}
                />
              </div>
            );
          })}
        </Bars>
      </div>
      <div className="ml-[46px] flex gap-1.5">
        {rows.map(r => (
          <div key={r.id} className="flex-1 min-w-0 pt-2 text-center font-mono-ibm text-[9.5px] text-white/35 truncate">
            {r.sku.replace(/^[A-Z]+-/, '')}
          </div>
        ))}
      </div>
    </>
  );
}

function Caption({ text, legend }: { text: string; legend: { swatchClass: string; color: string; label: string }[] }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <p className="m-0 text-[11.5px] text-white/45 max-w-[520px]">{text}</p>
      <div className="flex-none flex gap-3 text-[11px] text-white/50">
        {legend.map(l => (
          <span key={l.label} className="flex items-center gap-1.5">
            <span className={l.swatchClass} style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
