import { DashboardOrder, DashboardProduct } from '../types/dashboard';
import { computeInventoryMetrics, computeInventoryKpis, skuKeyFor, InventoryRow } from './inventoryMetrics';

/**
 * Canned assistant replies for the public demo. They are computed from the
 * same metrics pipeline the dashboard renders, not hardcoded prose, so they
 * stay true for whichever demo store is selected and never contradict the
 * numbers on screen.
 */

function joinList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function priceBySku(products: DashboardProduct[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const product of products) map.set(skuKeyFor(product), Number(product.price) || 0);
  return map;
}

function describe(row: InventoryRow): string {
  return `${row.name} (${row.stock} units, ${row.coverLabel} of cover)`;
}

function restockAnswer(rows: InventoryRow[]): string {
  const urgent = rows.filter(r => r.band === 'stockout');
  const soon = rows.filter(r => r.band === 'reorder');

  if (urgent.length === 0 && soon.length === 0) {
    return 'Nothing is below your reorder point right now — every SKU has more than six weeks of cover at its current pace.';
  }

  const parts: string[] = [];
  if (urgent.length > 0) {
    parts.push(
      `${urgent.length === 1 ? 'One SKU needs' : `${urgent.length} SKUs need`} an order today: ${joinList(urgent.slice(0, 3).map(describe))}. At the current pace ${urgent.length === 1 ? 'it runs' : 'they run'} out inside a fortnight.`
    );
  }
  if (soon.length > 0) {
    parts.push(
      `${urgent.length > 0 ? 'Next up' : 'Below your six-week reorder point'}: ${joinList(soon.slice(0, 3).map(describe))}.`
    );
  }
  return parts.join(' ');
}

function deadStockAnswer(rows: InventoryRow[], prices: Map<string, number>): string {
  const idle = rows.filter(r => r.unitsSoldWindow === 0 && r.stock > 0);
  if (idle.length === 0) {
    return 'No dead stock — every SKU has sold at least one unit in the last 30 days.';
  }

  const units = idle.reduce((sum, r) => sum + r.stock, 0);
  const capital = idle.reduce((sum, r) => sum + r.stock * (prices.get(r.id) ?? 0), 0);
  const names = joinList(idle.slice(0, 3).map(r => `${r.name} (${r.stock} units)`));

  return `${idle.length === 1 ? 'One SKU has' : `${idle.length} SKUs have`} not sold a unit in the last 30 days: ${names}. That is ${units} units sitting still, roughly $${Math.round(capital).toLocaleString('en-US')} of capital. Discounting or bundling is usually the cheapest way to move it.`;
}

function topSellersAnswer(rows: InventoryRow[]): string {
  const top = [...rows].sort((a, b) => b.unitsSoldWindow - a.unitsSoldWindow).slice(0, 3).filter(r => r.unitsSoldWindow > 0);
  if (top.length === 0) {
    return 'No sales recorded in the last 30 days, so there is nothing to rank yet.';
  }
  const lines = top.map(r => `${r.name} at ${r.unitsSoldWindow} units (${r.weeklyVelocity.toFixed(1)}/wk)`);
  return `Your fastest movers over the last 30 days are ${joinList(lines)}. ${top[0].name} leads on volume, and with ${top[0].coverLabel} of cover it is ${top[0].band === 'stockout' || top[0].band === 'reorder' ? 'also the one most at risk of running dry' : 'comfortably stocked for now'}.`;
}

function sellThroughAnswer(rows: InventoryRow[]): string {
  const kpis = computeInventoryKpis(rows);
  const median = kpis.medianCoverWeeks !== null ? `${kpis.medianCoverWeeks.toFixed(1)} weeks` : 'not measurable';
  const thin = rows.filter(r => r.band === 'stockout' || r.band === 'reorder').length;
  const over = rows.filter(r => r.band === 'overstock').length;

  return `Across ${kpis.skuCount} SKUs you are holding ${kpis.unitsOnHand} units with ${kpis.sellThroughPct}% sell-through over the last 30 days. Median cover is ${median}. ${thin} ${thin === 1 ? 'SKU sits' : 'SKUs sit'} below the reorder point and ${over} ${over === 1 ? 'is' : 'are'} above the overstock ceiling — that split is where most of the money is being made or tied up.`;
}

function coverAnswer(rows: InventoryRow[]): string {
  const thinnest = rows.filter(r => r.coverWeeks !== null).slice(0, 3);
  if (thinnest.length === 0) return 'No sales in the window, so cover is effectively infinite for every SKU.';
  return `Thinnest cover first: ${joinList(thinnest.map(describe))}. Cover is stock divided by the last 30 days' weekly pace, so it moves as demand does — open any SKU to see its burn-down to zero.`;
}

export function answerForQuestion(
  question: string,
  products: DashboardProduct[],
  orders: DashboardOrder[]
): string {
  const rows = computeInventoryMetrics(products, orders, 30);
  if (rows.length === 0) return 'There is no product data loaded for this store yet.';

  const q = question.toLowerCase();

  if (/dead stock|idle|capital|discount|clear|bundle|not sold|slow/.test(q)) {
    return deadStockAnswer(rows, priceBySku(products));
  }
  if (/restock|reorder|re-order|order this week|low stock|run out|stockout|buy/.test(q)) {
    return restockAnswer(rows);
  }
  if (/top|best|fastest|most sold|selling/.test(q)) {
    return topSellersAnswer(rows);
  }
  if (/sell-through|sell through|summar|overview|how am i|performance|doing/.test(q)) {
    return sellThroughAnswer(rows);
  }
  if (/cover|forecast|demand|next 30|predict|trend/.test(q)) {
    return coverAnswer(rows);
  }

  const kpis = computeInventoryKpis(rows);
  return `This is a demo, so I answer from the sample store's data — ${kpis.skuCount} SKUs, ${kpis.unitsOnHand} units on hand — with a fixed set of replies. Try asking what to reorder, which SKUs are dead stock, what your top sellers are, or for a sell-through summary.`;
}
