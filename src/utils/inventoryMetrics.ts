import { DashboardProduct, DashboardOrder } from '../types/dashboard';

/**
 * Single source of truth for inventory health math, replacing three
 * previously-inconsistent computations:
 *  - productMerger.mergeProductsBySku groups by SKU but counts ORDERS, not
 *    units, as "sales" (a real bug elsewhere in the app - left as-is there).
 *  - queryAnalyzer.calculateProductSalesFromOrders sums real unit quantity
 *    but keys by raw product id, so same-SKU listings across products
 *    aren't merged.
 * This groups by SKU *and* sums true unit quantity, over a real rolling
 * date window rather than all-time or calendar-month buckets.
 */

export type InventoryBand = 'stockout' | 'reorder' | 'healthy' | 'overstock';

export interface InventoryThresholds {
  /** Weeks of cover below which a SKU is flagged for reorder. */
  reorderPointWeeks: number;
  /** Weeks of cover above which a SKU is considered overstocked. */
  overstockCeilingWeeks: number;
}

export const DEFAULT_INVENTORY_THRESHOLDS: InventoryThresholds = {
  reorderPointWeeks: 6,
  overstockCeilingWeeks: 12,
};

/** Below this fraction of the reorder point, a SKU is a stockout risk rather than just "reorder soon". */
const STOCKOUT_RATIO = 0.35;

export interface InventoryRow {
  /** SKU, or the product id when no SKU is set - the grouping key. */
  id: string;
  name: string;
  sku: string;
  stock: number;
  unitsSoldWindow: number;
  revenueWindow: number;
  weeklyVelocity: number;
  /** null when velocity is zero - i.e. cover is effectively infinite. */
  coverWeeks: number | null;
  coverLabel: string;
  /** 0-100, capped, for a cover bar chart. */
  barPct: number;
  band: InventoryBand;
  /** 0-100. */
  sellThroughPct: number;
}

export interface InventoryKpis {
  unitsOnHand: number;
  skuCount: number;
  sellThroughPct: number;
  medianCoverWeeks: number | null;
  deadStockUnits: number;
  deadStockSkuCount: number;
}

function bandFor(coverWeeks: number | null, thresholds: InventoryThresholds): InventoryBand {
  if (coverWeeks === null) return 'overstock';
  if (coverWeeks < thresholds.reorderPointWeeks * STOCKOUT_RATIO) return 'stockout';
  if (coverWeeks < thresholds.reorderPointWeeks) return 'reorder';
  if (coverWeeks <= thresholds.overstockCeilingWeeks) return 'healthy';
  return 'overstock';
}

export function skuKeyFor(product: DashboardProduct): string {
  return product.variants?.[0]?.sku || product.sku || product.id;
}

function stockFor(product: DashboardProduct): number {
  if (product.variants?.length) {
    return product.variants.reduce((sum, v) => sum + (v.inventory_quantity ?? 0), 0);
  }
  return product.stock;
}

/**
 * Computes per-SKU inventory health over a rolling window ending `now`.
 * `windowDays` controls both the sales/revenue window and the weekly
 * velocity denominator (windowDays / 7).
 */
export function computeInventoryMetrics(
  products: DashboardProduct[],
  orders: DashboardOrder[],
  windowDays: number = 30,
  thresholds: InventoryThresholds = DEFAULT_INVENTORY_THRESHOLDS,
  now: Date = new Date()
): InventoryRow[] {
  if (!products?.length) return [];

  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const weeksInWindow = windowDays / 7;

  // Group products by SKU first (fixes productMerger's per-listing split).
  const bySku = new Map<string, { name: string; sku: string; stock: number; productIds: Set<string>; variantIds: Set<string> }>();
  for (const product of products) {
    const sku = skuKeyFor(product);
    const existing = bySku.get(sku);
    const stock = stockFor(product);
    const variantIds = new Set((product.variants || []).map(v => v.id));
    if (existing) {
      existing.stock += stock;
      existing.productIds.add(product.id);
      for (const vid of variantIds) existing.variantIds.add(vid);
    } else {
      bySku.set(sku, { name: product.name, sku, stock, productIds: new Set([product.id]), variantIds });
    }
  }

  // Sum true unit quantity + revenue per SKU, within the rolling window.
  const salesBySku = new Map<string, { units: number; revenue: number }>();
  for (const order of orders || []) {
    const orderDate = new Date(order.created_at);
    if (orderDate < windowStart || orderDate > now) continue;
    for (const item of order.line_items || []) {
      const productId = item.product_id?.toString();
      const variantId = item.variant_id?.toString();
      let matchedSku: string | null = null;
      for (const [sku, group] of bySku) {
        if ((variantId && group.variantIds.has(variantId)) || (productId && group.productIds.has(productId))) {
          matchedSku = sku;
          break;
        }
      }
      if (!matchedSku) continue;
      const quantity = item.quantity || 0;
      const price = parseFloat(item.price || '0');
      const current = salesBySku.get(matchedSku) || { units: 0, revenue: 0 };
      salesBySku.set(matchedSku, { units: current.units + quantity, revenue: current.revenue + quantity * price });
    }
  }

  const rows: InventoryRow[] = [];
  for (const [sku, group] of bySku) {
    const sales = salesBySku.get(sku) || { units: 0, revenue: 0 };
    const weeklyVelocity = sales.units / weeksInWindow;
    const coverWeeks = weeklyVelocity > 0 ? group.stock / weeklyVelocity : null;
    const sellThroughDenominator = sales.units + group.stock;
    rows.push({
      id: sku,
      name: group.name,
      sku,
      stock: group.stock,
      unitsSoldWindow: sales.units,
      revenueWindow: sales.revenue,
      weeklyVelocity,
      coverWeeks,
      coverLabel: coverWeeks === null ? '∞' : `${coverWeeks.toFixed(1)}w`,
      barPct: coverWeeks === null ? 100 : Math.min(100, (coverWeeks / 16) * 100),
      band: bandFor(coverWeeks, thresholds),
      sellThroughPct: sellThroughDenominator > 0 ? Math.round((sales.units / sellThroughDenominator) * 100) : 0,
    });
  }

  // Most urgent first: finite cover ascending, then infinite-cover (dead/overstock) rows last.
  rows.sort((a, b) => (a.coverWeeks ?? Infinity) - (b.coverWeeks ?? Infinity));
  return rows;
}

export function computeInventoryKpis(rows: InventoryRow[]): InventoryKpis {
  const unitsOnHand = rows.reduce((sum, r) => sum + r.stock, 0);
  const unitsSold = rows.reduce((sum, r) => sum + r.unitsSoldWindow, 0);
  const sellThroughDenominator = unitsSold + unitsOnHand;
  const finiteCovers = rows.map(r => r.coverWeeks).filter((c): c is number => c !== null).sort((a, b) => a - b);
  const mid = Math.floor(finiteCovers.length / 2);
  const medianCoverWeeks = finiteCovers.length === 0
    ? null
    : finiteCovers.length % 2 === 0
      ? (finiteCovers[mid - 1] + finiteCovers[mid]) / 2
      : finiteCovers[mid];
  const deadStockRows = rows.filter(r => r.unitsSoldWindow === 0 && r.stock > 0);

  return {
    unitsOnHand,
    skuCount: rows.length,
    sellThroughPct: sellThroughDenominator > 0 ? Math.round((unitsSold / sellThroughDenominator) * 100) : 0,
    medianCoverWeeks,
    deadStockUnits: deadStockRows.reduce((sum, r) => sum + r.stock, 0),
    deadStockSkuCount: deadStockRows.length,
  };
}
