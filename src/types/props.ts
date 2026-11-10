import { ShopifyProduct, ShopifyOrder, TransformedProduct } from './shopify';

export interface MetricCardsProps {
  products: ShopifyProduct[];
  orders: ShopifyOrder[];
}

export interface ProductSalesStockChartProps {
  products: ShopifyProduct[];
  orders: ShopifyOrder[];
}

export interface InventoryStatusProps {
  products: ShopifyProduct[];
}

export interface RevenueMetricsProps {
  orders: ShopifyOrder[];
}

export interface LowStockAlertProps {
  products: ShopifyProduct[];
}

export interface InventoryAlertsProps {
  products: ShopifyProduct[];
}

export interface AIStockPredictionsProps {
  products: ShopifyProduct[];
  orders: ShopifyOrder[];
}

export interface AIRecommendationsProps {
  products: TransformedProduct[];
}

export interface ProductTablesProps {
  products: ShopifyProduct[];
  orders: ShopifyOrder[];
} 