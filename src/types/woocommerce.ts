export interface WooCommerceProduct {
  id: number;
  name: string;
  sku: string;
  type: string;
  status: string;
  price: string;
  regular_price: string;
  sale_price: string;
  stock_quantity: number | null;
  manage_stock: boolean;
  categories: Array<{ id: number; name: string; slug: string }>;
  date_created: string;
  date_modified: string;
}

export interface WooCommerceOrderLineItem {
  id: number;
  name: string;
  product_id: number;
  variation_id: number;
  quantity: number;
  sku: string;
  price: number;
  total: string;
  subtotal: string;
}

export interface WooCommerceOrder {
  id: number;
  status: string;
  currency: string;
  total: string;
  date_created: string;
  line_items: WooCommerceOrderLineItem[];
}
