export interface Product {
  id: string;
  name: string;
  sku: string;
  stock: number;
  sales: number;
  price: number;
  category: string;
  brand: string;
  lastRestocked?: string;
  reorderPoint: number;
}

export type AlertPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type AlertType = 'RESTOCK' | 'OPPORTUNITY' | 'WARNING';

export interface AlertData {
  id: string;
  type: AlertType;
  priority: AlertPriority;
  product: Product;
  message: string;
  potentialRevenue?: number;
  createdAt: string;
}