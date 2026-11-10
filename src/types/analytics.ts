export interface StockForecast {
  productId: string;
  name: string;
  currentStock: number;
  predictedDemand: number;
  confidenceScore: number;
  recommendedAction: 'restock' | 'optimal' | 'excess';
  historicalData: {
    date: Date;
    sales: number;
    stock: number;
  }[];
}

export interface InventoryMetrics {
  totalProducts: number;
  lowStock: number;
  outOfStock: number;
  overstock: number;
  inventoryValue: number;
  turnoverRate: number;
}

export interface SalesTrend {
  period: string;
  revenue: number;
  units: number;
  growth: number;
}