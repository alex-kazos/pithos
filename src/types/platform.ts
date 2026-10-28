export interface Platform {
  id: string;
  name: string;
  type: 'shopify' | 'woocommerce';
  status: 'connected' | 'disconnected' | 'syncing';
  lastSync: Date | null;
  productCount: number;
  ordersToday: number;
}

export interface SyncStats {
  products: number;
  orders: number;
  customers: number;
  lastUpdated: Date;
}