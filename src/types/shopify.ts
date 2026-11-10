export interface ShopifyProduct {
  id: number;
  title: string;
  variants: Array<{
    id: number;
    inventory_quantity: number;
    price: string;
    sku: string;
  }>;
  product_type?: string;
  created_at: string;
  updated_at: string;
}

export interface ShopifyOrder {
  id: number;
  order_number?: number;
  created_at: string;
  total_price: string;
  line_items: Array<{
    id: number;
    product_id: number;
    // Present on real Shopify order payloads; optional here since some
    // callers (productMerger.ts) already guard its absence at runtime.
    variant_id?: number;
    quantity: number;
    price: string;
  }>;
}

export interface ShopifyCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  orders_count: number;
  total_spent: string;
}

export interface TransformedProduct {
  id: string;
  name: string;
  stock: number;
  sales: number;
  sku: string;
  product_type: string;
}