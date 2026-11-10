import { describe, it, expect } from 'vitest';
import { computeInventoryMetrics, computeInventoryKpis, DEFAULT_INVENTORY_THRESHOLDS } from './inventoryMetrics';
import { DashboardProduct, DashboardOrder } from '../types/dashboard';

const NOW = new Date('2026-03-31T00:00:00.000Z');

function makeProduct(overrides: Partial<DashboardProduct> & { id: string }): DashboardProduct {
  return {
    name: `Product ${overrides.id}`,
    sku: `SKU-${overrides.id}`,
    stock: 20,
    product_type: 'Widgets',
    sales: 0,
    revenue: 0,
    variants: [],
    price: '9.99',
    compare_at_price: '9.99',
    ...overrides,
  };
}

function makeOrder(overrides: Partial<DashboardOrder> & { id: string; created_at: string; line_items: DashboardOrder['line_items'] }): DashboardOrder {
  return {
    order_number: Number(overrides.id),
    total_price: '0',
    ...overrides,
  };
}

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe('computeInventoryMetrics', () => {
  it('sums true unit quantity within the rolling window, not order count', () => {
    const products = [makeProduct({ id: '1', stock: 100 })];
    const orders: DashboardOrder[] = [
      makeOrder({ id: 'o1', created_at: daysAgo(5), line_items: [{ id: 'li1', product_id: '1', variant_id: '', quantity: 5, price: '10' }] }),
      makeOrder({ id: 'o2', created_at: daysAgo(10), line_items: [{ id: 'li2', product_id: '1', variant_id: '', quantity: 3, price: '10' }] }),
    ];
    const [row] = computeInventoryMetrics(products, orders, 30, DEFAULT_INVENTORY_THRESHOLDS, NOW);
    // 2 orders, but 8 real units - order-count math (the productMerger bug) would say 2.
    expect(row.unitsSoldWindow).toBe(8);
    expect(row.revenueWindow).toBe(80);
  });

  it('excludes orders outside the rolling window', () => {
    const products = [makeProduct({ id: '1', stock: 50 })];
    const orders: DashboardOrder[] = [
      makeOrder({ id: 'o1', created_at: daysAgo(5), line_items: [{ id: 'li1', product_id: '1', variant_id: '', quantity: 4, price: '10' }] }),
      makeOrder({ id: 'o2', created_at: daysAgo(45), line_items: [{ id: 'li2', product_id: '1', variant_id: '', quantity: 100, price: '10' }] }),
    ];
    const [row] = computeInventoryMetrics(products, orders, 30, DEFAULT_INVENTORY_THRESHOLDS, NOW);
    expect(row.unitsSoldWindow).toBe(4);
  });

  it('groups multiple product listings under the same SKU (fixes the per-listing split bug)', () => {
    const products = [
      makeProduct({ id: '1', sku: 'SHARED', stock: 10 }),
      makeProduct({ id: '2', sku: 'SHARED', stock: 15 }),
    ];
    const orders: DashboardOrder[] = [
      makeOrder({ id: 'o1', created_at: daysAgo(2), line_items: [{ id: 'li1', product_id: '1', variant_id: '', quantity: 2, price: '5' }] }),
      makeOrder({ id: 'o2', created_at: daysAgo(3), line_items: [{ id: 'li2', product_id: '2', variant_id: '', quantity: 3, price: '5' }] }),
    ];
    const rows = computeInventoryMetrics(products, orders, 30, DEFAULT_INVENTORY_THRESHOLDS, NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0].stock).toBe(25);
    expect(rows[0].unitsSoldWindow).toBe(5);
  });

  it('returns null cover and coverLabel "∞" for a SKU with zero velocity', () => {
    const products = [makeProduct({ id: '1', stock: 100 })];
    const [row] = computeInventoryMetrics(products, [], 30, DEFAULT_INVENTORY_THRESHOLDS, NOW);
    expect(row.coverWeeks).toBeNull();
    expect(row.coverLabel).toBe('∞');
    expect(row.band).toBe('overstock');
  });

  it('bands a SKU as stockout when cover is under 35% of the reorder point', () => {
    // reorderPointWeeks=6 -> stockout below 2.1 weeks. 3 units/week velocity, 5 stock -> 1.67w cover.
    const products = [makeProduct({ id: '1', stock: 5 })];
    const orders: DashboardOrder[] = [
      makeOrder({ id: 'o1', created_at: daysAgo(1), line_items: [{ id: 'li1', product_id: '1', variant_id: '', quantity: 13, price: '1' }] }),
    ];
    const [row] = computeInventoryMetrics(products, orders, 30, DEFAULT_INVENTORY_THRESHOLDS, NOW);
    expect(row.coverWeeks).toBeCloseTo(1.65, 1);
    expect(row.band).toBe('stockout');
  });

  it('bands a SKU as reorder when cover is between the stockout ratio and the reorder point', () => {
    const products = [makeProduct({ id: '1', stock: 20 })];
    const orders: DashboardOrder[] = [
      makeOrder({ id: 'o1', created_at: daysAgo(1), line_items: [{ id: 'li1', product_id: '1', variant_id: '', quantity: 20, price: '1' }] }),
    ];
    const [row] = computeInventoryMetrics(products, orders, 30, DEFAULT_INVENTORY_THRESHOLDS, NOW);
    // velocity ~4.67/wk, cover ~4.3w -> between 2.1 and 6
    expect(row.band).toBe('reorder');
  });

  it('bands a SKU as healthy when cover sits between the reorder point and the overstock ceiling', () => {
    // 30 units/30d -> 7/wk velocity; 63 stock -> exactly 9 weeks cover (between 6 and 12).
    const products = [makeProduct({ id: '1', stock: 63 })];
    const orders: DashboardOrder[] = [
      makeOrder({ id: 'o1', created_at: daysAgo(1), line_items: [{ id: 'li1', product_id: '1', variant_id: '', quantity: 30, price: '1' }] }),
    ];
    const [row] = computeInventoryMetrics(products, orders, 30, DEFAULT_INVENTORY_THRESHOLDS, NOW);
    expect(row.coverWeeks).toBeCloseTo(9, 0);
    expect(row.band).toBe('healthy');
  });

  it('bands a SKU as overstock when cover exceeds the overstock ceiling', () => {
    const products = [makeProduct({ id: '1', stock: 1000 })];
    const orders: DashboardOrder[] = [
      makeOrder({ id: 'o1', created_at: daysAgo(1), line_items: [{ id: 'li1', product_id: '1', variant_id: '', quantity: 1, price: '1' }] }),
    ];
    const [row] = computeInventoryMetrics(products, orders, 30, DEFAULT_INVENTORY_THRESHOLDS, NOW);
    expect(row.band).toBe('overstock');
  });

  it('matches line items by variant_id when set, even if product_id is absent', () => {
    const products = [makeProduct({ id: '1', stock: 10, variants: [{ id: 'v1', sku: 'SKU-1', inventory_quantity: 10 }] })];
    const orders: DashboardOrder[] = [
      makeOrder({ id: 'o1', created_at: daysAgo(1), line_items: [{ id: 'li1', product_id: '', variant_id: 'v1', quantity: 6, price: '2' }] }),
    ];
    const [row] = computeInventoryMetrics(products, orders, 30, DEFAULT_INVENTORY_THRESHOLDS, NOW);
    expect(row.unitsSoldWindow).toBe(6);
  });

  it('computes sell-through as units sold over sold-plus-remaining-stock', () => {
    const products = [makeProduct({ id: '1', stock: 10 })];
    const orders: DashboardOrder[] = [
      makeOrder({ id: 'o1', created_at: daysAgo(1), line_items: [{ id: 'li1', product_id: '1', variant_id: '', quantity: 10, price: '1' }] }),
    ];
    const [row] = computeInventoryMetrics(products, orders, 30, DEFAULT_INVENTORY_THRESHOLDS, NOW);
    expect(row.sellThroughPct).toBe(50); // 10 sold / (10 sold + 10 stock)
  });

  it('sorts rows by urgency: finite cover ascending, infinite cover last', () => {
    const products = [
      makeProduct({ id: 'a', stock: 100 }), // zero sales -> infinite cover
      makeProduct({ id: 'b', stock: 5 }),
    ];
    const orders: DashboardOrder[] = [
      makeOrder({ id: 'o1', created_at: daysAgo(1), line_items: [{ id: 'li1', product_id: 'b', variant_id: '', quantity: 20, price: '1' }] }),
    ];
    const rows = computeInventoryMetrics(products, orders, 30, DEFAULT_INVENTORY_THRESHOLDS, NOW);
    expect(rows[0].id).toBe('SKU-b');
    expect(rows[rows.length - 1].id).toBe('SKU-a');
  });

  it('returns an empty array for no products', () => {
    expect(computeInventoryMetrics([], [], 30, DEFAULT_INVENTORY_THRESHOLDS, NOW)).toEqual([]);
  });
});

describe('computeInventoryKpis', () => {
  it('aggregates units on hand, sell-through, median cover and dead stock', () => {
    const products = [
      makeProduct({ id: '1', stock: 100 }), // zero sales -> dead stock
      makeProduct({ id: '2', stock: 10 }),
    ];
    const orders: DashboardOrder[] = [
      makeOrder({ id: 'o1', created_at: daysAgo(1), line_items: [{ id: 'li1', product_id: '2', variant_id: '', quantity: 10, price: '1' }] }),
    ];
    const rows = computeInventoryMetrics(products, orders, 30, DEFAULT_INVENTORY_THRESHOLDS, NOW);
    const kpis = computeInventoryKpis(rows);
    expect(kpis.unitsOnHand).toBe(110);
    expect(kpis.deadStockUnits).toBe(100);
    expect(kpis.deadStockSkuCount).toBe(1);
    expect(kpis.medianCoverWeeks).not.toBeNull();
  });

  it('returns a null median cover when every SKU has zero velocity', () => {
    const products = [makeProduct({ id: '1', stock: 5 })];
    const rows = computeInventoryMetrics(products, [], 30, DEFAULT_INVENTORY_THRESHOLDS, NOW);
    expect(computeInventoryKpis(rows).medianCoverWeeks).toBeNull();
  });

  it('handles an empty row set without dividing by zero', () => {
    const kpis = computeInventoryKpis([]);
    expect(kpis.unitsOnHand).toBe(0);
    expect(kpis.sellThroughPct).toBe(0);
    expect(kpis.medianCoverWeeks).toBeNull();
  });
});
