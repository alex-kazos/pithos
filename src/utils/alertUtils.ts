import { Product, AlertData, AlertPriority, AlertType } from '../types/product';

export function generateAlerts(products: Product[]): AlertData[] {
  const alerts: AlertData[] = [];

  products.forEach(product => {
    // Check for low stock
    if (product.stock <= 5) {
      alerts.push({
        id: `alert-${product.id}-restock`,
        type: 'RESTOCK',
        priority: 'HIGH',
        product,
        message: `${product.name} has only ${product.stock} left in stock`,
        potentialRevenue: product.price * (product.reorderPoint - product.stock),
        createdAt: new Date().toISOString()
      });
    }
    
    // Check for sales opportunities
    if (product.sales > product.stock * 1.5) {
      alerts.push({
        id: `alert-${product.id}-opportunity`,
        type: 'OPPORTUNITY',
        priority: 'MEDIUM',
        product,
        message: `Opportunity to restock ${product.name} due to high sales`,
        potentialRevenue: product.price * (product.sales - product.stock),
        createdAt: new Date().toISOString()
      });
    }
    
    // Check for overstock
    if (product.stock > product.sales * 2) {
      alerts.push({
        id: `alert-${product.id}-warning`,
        type: 'WARNING',
        priority: 'LOW',
        product,
        message: `Warning: Overstock of ${product.name}`,
        createdAt: new Date().toISOString()
      });
    }
  });

  return alerts.sort((a, b) => {
    const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}