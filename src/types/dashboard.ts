export interface DashboardProduct {
  id: string;
  name: string;
  sku: string;
  stock: number;
  product_type: string;
  sales: number;
  revenue: number;
  variants: Array<{
    id: string;
    sku?: string;
    inventory_quantity?: number;
    price?: string;
    compare_at_price?: string;
  }>;
  created_at?: string;
  updated_at?: string;
  status?: string;
  vendor?: string;
  price: string;
  compare_at_price: string;
}

export interface DashboardOrder {
  id: string;
  order_number: number;
  created_at: string;
  total_price: string;
  line_items: Array<{
    id: string;
    product_id: string;
    variant_id: string;
    quantity: number;
    price: string;
  }>;
  customer?: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
  };
  financial_status?: string;
  fulfillment_status?: string;
}

export interface TransformedProduct {
  id: string;
  name: string;
  sku: string;
  category: string;
  stock: number;
  sales: number;
  revenue: number;
  historicalSales: number[];
  predictedDemand?: number;
  confidence?: number;
  trend?: number;
  stockCoverage?: string;
  status?: string;
  vendor?: string;
  price?: string;
  compare_at_price?: string;
}

export interface ProductMetrics {
  totalProducts: number;
  totalStock: number;
  totalSales: number;
  totalRevenue: number;
  lowStockCount: number;
  outOfStockCount: number;
  topSellingProducts: DashboardProduct[];
  recentOrders: DashboardOrder[];
}

export interface DateRange {
  from: string;
  to: string;
}

export interface FilterState {
  dateRange: DateRange | null;
  category: string;
  stockRange: [number, number];
  salesRange: [number, number];
  searchQuery: string;
}
