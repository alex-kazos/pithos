export interface Product {
  id: string;
  name: string;
  sku: string;
  category: 'apparel' | 'shoes' | 'accessories';
  subCategory: string;
  stock: number;
  price: number;
  sales: number;
  reorderPoint: number;
  lastMonthSales?: number;
  trend?: 'up' | 'down' | 'stable';
  margin?: number;
}

export const products: Product[] = [
  {
    id: '1',
    name: 'Blue T-Shirt',
    sku: 'TS-001',
    category: 'apparel',
    subCategory: 't-shirts',
    stock: 5,
    price: 29.99,
    sales: 38,
    reorderPoint: 20,
    lastMonthSales: 42,
    trend: 'down',
    margin: 0.45
  },
  {
    id: '3',
    name: 'White T-Shirt',
    sku: 'TS-003',
    category: 'apparel',
    subCategory: 't-shirts',
    stock: 28,
    price: 59.99,
    sales: 62,
    reorderPoint: 35,
    lastMonthSales: 45,
    trend: 'up',
    margin: 0.60
  },
  {
    id: '4',
    name: 'Black Running Shoes',
    sku: 'RS-001',
    category: 'shoes',
    subCategory: 'running',
    stock: 8,
    price: 89.99,
    sales: 25,
    reorderPoint: 20,
    lastMonthSales: 28,
    trend: 'stable',
    margin: 0.50
  },
  {
    id: '6',
    name: 'Sports Backpack',
    sku: 'BP-001',
    category: 'accessories',
    subCategory: 'bags',
    stock: 15,
    price: 49.99,
    sales: 38,
    reorderPoint: 20,
    lastMonthSales: 42,
    trend: 'up',
    margin: 0.65
  },
  {
    id: '7',
    name: 'Training Socks',
    sku: 'SK-001',
    category: 'accessories',
    subCategory: 'socks',
    stock: 120,
    price: 12.99,
    sales: 95,
    reorderPoint: 50,
    lastMonthSales: 85,
    trend: 'up',
    margin: 0.70
  },
  {
    id: '10',
    name: 'Red Running Shoes',
    sku: 'RS-003',
    category: 'shoes',
    subCategory: 'running',
    stock: 18,
    price: 79.99,
    sales: 22,
    reorderPoint: 20,
    lastMonthSales: 25,
    trend: 'stable',
    margin: 0.50
  }
];

export interface AlertData {
  id: string;
  type: 'RESTOCK' | 'OPPORTUNITY' | 'WARNING' | 'TREND' | 'PERFORMANCE' | 'PROFIT';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  product: Product;
  potentialRevenue?: number;
  insight?: string;
  category: string;
}

export function generateAlerts(products: Product[]): AlertData[] {
  const allAlerts: AlertData[] = [];
  const categoryPerformance = new Map<string, { sales: number; stock: number }>();

  // Calculate category performance
  products.forEach(product => {
    const current = categoryPerformance.get(product.category) || { sales: 0, stock: 0 };
    categoryPerformance.set(product.category, {
      sales: current.sales + product.sales,
      stock: current.stock + product.stock
    });
  });

  products.forEach(product => {
    const productAlerts: AlertData[] = [];

    // Critical Low Stock Alert
    if (product.stock <= product.reorderPoint / 2) {
      productAlerts.push({
        id: `critical-${product.id}`,
        type: 'RESTOCK',
        priority: 'HIGH',
        message: `Critical: ${product.name} stock is dangerously low (${product.stock} units)`,
        insight: 'Immediate restock recommended to prevent lost sales',
        product,
        potentialRevenue: product.price * (product.reorderPoint - product.stock),
        category: product.category
      });
    }

    // High Margin Opportunity
    if (product.margin && product.margin > 0.6 && product.trend === 'up') {
      productAlerts.push({
        id: `profit-${product.id}`,
        type: 'PROFIT',
        priority: 'HIGH',
        message: `${product.name} has high profit margin (${(product.margin * 100).toFixed(0)}%) with upward trend`,
        insight: 'Consider increasing marketing spend for this high-margin product',
        product,
        potentialRevenue: product.price * product.sales * product.margin,
        category: product.category
      });
    }

    // Strong Growth Trend
    if (product.trend === 'up' && product.lastMonthSales) {
      const growthRate = ((product.lastMonthSales - product.sales) / product.sales) * 100;
      if (growthRate > 20) {
        productAlerts.push({
          id: `trend-up-${product.id}`,
          type: 'TREND',
          priority: 'HIGH',
          message: `${product.name} shows exceptional growth (+${growthRate.toFixed(1)}%)`,
          insight: 'Consider increasing stock levels and marketing investment',
          product,
          potentialRevenue: product.price * (product.lastMonthSales - product.stock),
          category: product.category
        });
      }
    }

    // Significant Decline
    if (product.trend === 'down' && product.lastMonthSales) {
      const declineRate = ((product.sales - product.lastMonthSales) / product.sales) * 100;
      if (declineRate > 15) {
        productAlerts.push({
          id: `trend-down-${product.id}`,
          type: 'WARNING',
          priority: 'HIGH',
          message: `${product.name} sales declining significantly (-${declineRate.toFixed(1)}%)`,
          insight: 'Urgent: Review pricing strategy and marketing approach',
          product,
          category: product.category
        });
      }
    }

    // High Demand Opportunity
    if (product.sales > product.stock * 1.5) {
      productAlerts.push({
        id: `demand-${product.id}`,
        type: 'OPPORTUNITY',
        priority: 'HIGH',
        message: `High demand detected for ${product.name}`,
        insight: 'Current demand exceeds stock levels by 50%',
        product,
        potentialRevenue: product.price * (product.sales - product.stock),
        category: product.category
      });
    }

    // Add the most important alert for this product
    if (productAlerts.length > 0) {
      // Sort product alerts by priority and potential revenue
      productAlerts.sort((a, b) => {
        const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        const aRevenue = a.potentialRevenue || 0;
        const bRevenue = b.potentialRevenue || 0;
        return bRevenue - aRevenue;
      });

      allAlerts.push(productAlerts[0]);
    }
  });

  // Group alerts by category and select the most important one per category
  const categoryAlerts = new Map<string, AlertData>();
  allAlerts.forEach(alert => {
    const existingAlert = categoryAlerts.get(alert.category);
    if (!existingAlert || 
        (existingAlert.priority === alert.priority && 
         (alert.potentialRevenue || 0) > (existingAlert.potentialRevenue || 0)) ||
        (existingAlert.priority !== alert.priority && 
         alert.priority === 'HIGH')) {
      categoryAlerts.set(alert.category, alert);
    }
  });

  // Convert map back to array and sort by priority and potential revenue
  return Array.from(categoryAlerts.values()).sort((a, b) => {
    const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    const aRevenue = a.potentialRevenue || 0;
    const bRevenue = b.potentialRevenue || 0;
    return bRevenue - aRevenue;
  });
}