import { describe, it, expect } from 'vitest';
import { analyzeQuery, filterProductsByQueryContext } from './queryAnalyzer';
import { DashboardProduct, DashboardOrder } from '../types/dashboard';

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

describe('analyzeQuery', () => {
  it('classifies best-selling queries', () => {
    expect(analyzeQuery('What are my best selling products?').type).toBe('BEST_SELLING');
    expect(analyzeQuery('show me the top products').type).toBe('BEST_SELLING');
  });

  it('classifies low stock queries', () => {
    expect(analyzeQuery('Which items are low stock?').type).toBe('LOW_STOCK');
    expect(analyzeQuery('what is running low').type).toBe('LOW_STOCK');
  });

  it('classifies overstocked queries', () => {
    expect(analyzeQuery('what products are overstocked').type).toBe('OVERSTOCKED');
  });

  it('classifies category analysis queries and extracts the category', () => {
    const result = analyzeQuery('tell me about the electronics category');
    expect(result.type).toBe('CATEGORY_ANALYSIS');
    expect(result.category).toBe('electronics');
  });

  it('falls back to GENERAL for unrecognized queries', () => {
    expect(analyzeQuery('hello there').type).toBe('GENERAL');
  });
});

describe('filterProductsByQueryContext', () => {
  const products: DashboardProduct[] = [
    makeProduct({ id: '1', stock: 2 }),
    makeProduct({ id: '2', stock: 60 }),
    makeProduct({ id: '3', stock: 25 }),
  ];
  const orders: DashboardOrder[] = [];

  it('filters to low-stock products (< 10) sorted ascending', () => {
    const result = filterProductsByQueryContext(products, orders, { type: 'LOW_STOCK', limit: 10 });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('filters to overstocked products (> 50) sorted descending', () => {
    const result = filterProductsByQueryContext(products, orders, { type: 'OVERSTOCKED', limit: 10 });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('never returns more than 20 products', () => {
    const manyProducts = Array.from({ length: 30 }, (_, i) => makeProduct({ id: String(i) }));
    const result = filterProductsByQueryContext(manyProducts, orders, { type: 'GENERAL', limit: 10 });
    expect(result.length).toBeLessThanOrEqual(20);
  });
});
