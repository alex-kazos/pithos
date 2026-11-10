import { describe, it, expect } from 'vitest';
import { mergeProductsBySku, transformForRecommendations } from './productMerger';
import { ShopifyProduct, ShopifyOrder } from '../types/shopify';

function makeProduct(overrides: Partial<ShopifyProduct> & { id: number }): ShopifyProduct {
  return {
    title: `Product ${overrides.id}`,
    variants: [{ id: overrides.id * 10, inventory_quantity: 5, price: '9.99', sku: `SKU-${overrides.id}` }],
    product_type: 'Widgets',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeOrder(overrides: Partial<ShopifyOrder> & { id: number }): ShopifyOrder {
  return {
    created_at: '2026-01-02T00:00:00Z',
    total_price: '9.99',
    line_items: [],
    ...overrides,
  };
}

describe('mergeProductsBySku', () => {
  it('returns an empty array when products input is missing or invalid', () => {
    expect(mergeProductsBySku(undefined as unknown as ShopifyProduct[], [])).toEqual([]);
    expect(mergeProductsBySku(null as unknown as ShopifyProduct[], [])).toEqual([]);
  });

  it('merges two products that share the same SKU into one entry', () => {
    const sharedSku = [{ id: 100, inventory_quantity: 3, price: '5.00', sku: 'SHARED' }];
    const products: ShopifyProduct[] = [
      makeProduct({ id: 1, title: 'Blue Shirt', variants: sharedSku }),
      makeProduct({ id: 2, title: 'Red Shirt', variants: sharedSku }),
    ];

    const merged = mergeProductsBySku(products, []);

    expect(merged).toHaveLength(1);
    expect(merged[0].sku).toBe('SHARED');
    expect(merged[0].productNames).toEqual(['Blue Shirt', 'Red Shirt']);
    expect(merged[0].stock).toBe(6); // 3 + 3
  });

  it('filters by category when selectedCategory is not "All"', () => {
    const products: ShopifyProduct[] = [
      makeProduct({ id: 1, product_type: 'Widgets' }),
      makeProduct({ id: 2, product_type: 'Gadgets' }),
    ];

    const merged = mergeProductsBySku(products, [], 'Gadgets');

    expect(merged).toHaveLength(1);
    expect(merged[0].product_type).toBe('Gadgets');
  });

  it('counts an order as a sale only when it references the product', () => {
    const products: ShopifyProduct[] = [makeProduct({ id: 1 })];
    const orders: ShopifyOrder[] = [
      makeOrder({ id: 1000, line_items: [{ id: 1, product_id: 1, quantity: 2, price: '9.99' }] }),
      makeOrder({ id: 1001, line_items: [{ id: 2, product_id: 999, quantity: 1, price: '9.99' }] }),
    ];

    const merged = mergeProductsBySku(products, orders);

    expect(merged[0].sales).toBe(1);
  });

  it('excludes orders outside the given date range', () => {
    const products: ShopifyProduct[] = [makeProduct({ id: 1 })];
    const orders: ShopifyOrder[] = [
      makeOrder({
        id: 1,
        created_at: '2025-06-15T00:00:00Z',
        line_items: [{ id: 1, product_id: 1, quantity: 1, price: '9.99' }],
      }),
    ];

    const merged = mergeProductsBySku(products, orders, 'All', { from: '2026-01-01', to: '2026-12-31' });

    expect(merged[0].sales).toBe(0);
  });
});

describe('transformForRecommendations', () => {
  it('joins multiple product names with " / "', () => {
    const [result] = transformForRecommendations([
      {
        id: '1',
        name: 'placeholder',
        productNames: ['Blue Shirt', 'Red Shirt'],
        sku: 'SHARED',
        stock: 6,
        sales: 0,
        product_type: 'Widgets',
        variants: [],
      },
    ]);

    expect(result.name).toBe('Blue Shirt / Red Shirt');
  });

  it('returns an empty array for invalid input', () => {
    expect(transformForRecommendations(null as unknown as [])).toEqual([]);
  });
});
