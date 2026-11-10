import { DashboardOrder, DashboardProduct } from '../types/dashboard';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface SeriesPoint {
  label: string;
  sales: number;
  /** Reconstructed stock-on-hand as of this point - see buildMonthlySeries. */
  stock: number;
}

/**
 * Finds every order line item that belongs to the same SKU group as `sku`,
 * mirroring the product/variant matching computeInventoryMetrics uses so a
 * chart drawn here agrees with the KPI/band numbers computed there.
 */
function lineItemsForSku(sku: string, products: DashboardProduct[], orders: DashboardOrder[]) {
  const productIds = new Set<string>();
  const variantIds = new Set<string>();
  for (const product of products) {
    const productSku = product.variants?.[0]?.sku || product.sku || product.id;
    if (productSku !== sku) continue;
    productIds.add(product.id);
    for (const variant of product.variants || []) variantIds.add(variant.id);
  }

  const items: { date: Date; quantity: number }[] = [];
  for (const order of orders || []) {
    const date = new Date(order.created_at);
    for (const item of order.line_items || []) {
      const variantId = item.variant_id?.toString();
      const productId = item.product_id?.toString();
      if ((variantId && variantIds.has(variantId)) || (productId && productIds.has(productId))) {
        items.push({ date, quantity: item.quantity || 0 });
      }
    }
  }
  return items;
}

/**
 * Only current stock is ever recorded, never a history of it, so past levels
 * are reconstructed rather than looked up: working backward from `now`,
 * each earlier bucket's stock is today's stock plus everything sold since
 * then. This assumes no restock happened inside the window - the same
 * assumption a burn-down projection makes, just run in reverse.
 */
function reconstructStock(currentStock: number, salesByBucketDesc: number[]): number[] {
  const stockDesc: number[] = [];
  let cumulative = 0;
  for (const sold of salesByBucketDesc) {
    stockDesc.push(currentStock + cumulative);
    cumulative += sold;
  }
  return stockDesc;
}

export function buildMonthlySeries(
  sku: string,
  currentStock: number,
  products: DashboardProduct[],
  orders: DashboardOrder[],
  months = 12,
  now: Date = new Date()
): SeriesPoint[] {
  const items = lineItemsForSku(sku, products, orders);

  // Bucket index 0 = most recent (current) month, counting back.
  const salesDesc: number[] = new Array(months).fill(0);
  const labelsDesc: string[] = [];
  for (let i = 0; i < months; i++) {
    const bucketDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labelsDesc.push(MONTH_LABELS[bucketDate.getMonth()]);
  }
  for (const item of items) {
    const monthsAgo = (now.getFullYear() - item.date.getFullYear()) * 12 + (now.getMonth() - item.date.getMonth());
    if (monthsAgo >= 0 && monthsAgo < months) salesDesc[monthsAgo] += item.quantity;
  }

  const stockDesc = reconstructStock(currentStock, salesDesc);
  const points: SeriesPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    points.push({ label: labelsDesc[i], sales: salesDesc[i], stock: stockDesc[i] });
  }
  return points;
}

export function buildWeeklySeries(
  sku: string,
  currentStock: number,
  products: DashboardProduct[],
  orders: DashboardOrder[],
  weeks = 13,
  now: Date = new Date()
): SeriesPoint[] {
  const items = lineItemsForSku(sku, products, orders);
  const salesDesc: number[] = new Array(weeks).fill(0);
  for (const item of items) {
    const daysAgo = (now.getTime() - item.date.getTime()) / MS_PER_DAY;
    const weeksAgo = Math.floor(daysAgo / 7);
    if (weeksAgo >= 0 && weeksAgo < weeks) salesDesc[weeksAgo] += item.quantity;
  }
  const stockDesc = reconstructStock(currentStock, salesDesc);
  const points: SeriesPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    points.push({ label: i === 0 ? 'now' : `-${i}w`, sales: salesDesc[i], stock: stockDesc[i] });
  }
  return points;
}

export interface BurnDownPoint {
  label: string;
  unitsLeft: number;
}

/** Forward projection (not history): how stock depletes if the current weekly velocity holds. */
export function buildBurnDown(currentStock: number, weeklyVelocity: number, coverWeeks: number | null): { points: BurnDownPoint[]; stockoutAt: number | null; unit: 'd' | 'w' } {
  if (weeklyVelocity <= 0 || coverWeeks === null) {
    const points: BurnDownPoint[] = [];
    for (let i = 0; i <= 14; i++) points.push({ label: i === 0 ? 'now' : `+${i}w`, unitsLeft: currentStock });
    return { points, stockoutAt: null, unit: 'w' };
  }

  // Short-cover SKUs run out inside a week or two, so weekly steps would
  // leave an almost-empty chart - step in days instead once cover drops
  // under 4 weeks, matching the granularity a buyer actually needs.
  const byDay = coverWeeks < 4;
  const perStep = byDay ? weeklyVelocity / 7 : weeklyVelocity;
  const steps = Math.min(16, Math.ceil(byDay ? coverWeeks * 7 : coverWeeks) + 2);
  const unit = byDay ? 'd' : 'w';

  const points: BurnDownPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    points.push({ label: i === 0 ? 'now' : `+${i}${unit}`, unitsLeft: Math.max(0, currentStock - perStep * i) });
  }
  const stockoutAt = byDay ? coverWeeks * 7 : coverWeeks;
  return { points, stockoutAt, unit };
}

export interface SellThroughPoint {
  label: string;
  sellThroughPct: number;
  coverWeeks: number;
}

export function buildSellThrough(monthly: SeriesPoint[]): SellThroughPoint[] {
  return monthly.map(m => {
    const denom = m.sales + m.stock;
    const sellThroughPct = denom > 0 ? Math.round((m.sales / denom) * 100) : 0;
    const weeklyVelocity = m.sales / 4.286;
    const coverWeeks = weeklyVelocity > 0 ? Math.min(14, m.stock / weeklyVelocity) : 14;
    return { label: m.label, sellThroughPct, coverWeeks };
  });
}
