import { DashboardProduct, DashboardOrder } from '../types/dashboard';
import { logger } from './logger';

export type QueryType = 
  | 'BEST_SELLING' 
  | 'LOW_STOCK' 
  | 'OVERSTOCKED'
  | 'SPECIFIC_PRODUCT'
  | 'CATEGORY_ANALYSIS'
  | 'SALES_TREND'
  | 'FULL_INVENTORY'
  | 'ORDER_ANALYSIS'
  | 'GENERAL';

export interface QueryContext {
  type: QueryType;
  productName?: string;
  category?: string;
  limit?: number;
  sku?: string;
  productId?: string;
  timeFrame?: 'day' | 'week' | 'month' | 'quarter' | 'year';
}

/**
 * Analyzes a user query to determine what type of information is needed.
 */
export function analyzeQuery(query: string): QueryContext {
  const normalizedQuery = query.toLowerCase();
  
  // Detect specific product queries
  const productNameMatch = normalizedQuery.match(/(?:about|info|details|data) (?:for|on|about) ['"]?([\w\s-]+)['"]?/i) || 
                           normalizedQuery.match(/([\w\s-]+) (?:product|item)(?:'s)? (?:info|data|details|stocks|sales)/i);
  
  if (productNameMatch && productNameMatch[1]) {
    return {
      type: 'SPECIFIC_PRODUCT',
      productName: productNameMatch[1].trim()
    };
  }
  
  // Detect best selling products query
  if (
    normalizedQuery.includes('best sell') || 
    normalizedQuery.includes('top sell') || 
    normalizedQuery.includes('most popular') ||
    normalizedQuery.includes('highest sell') ||
    normalizedQuery.includes('most sell') ||
    normalizedQuery.includes('top product') ||
    normalizedQuery.includes('best product') ||
    (normalizedQuery.includes('most') && 
     (normalizedQuery.includes('sale') || normalizedQuery.includes('sales') || normalizedQuery.includes('orders') || normalizedQuery.includes('sold')))
  ) {
    return {
      type: 'BEST_SELLING',
      limit: 10
    };
  }
  
  // Detect low stock products query
  if (
    normalizedQuery.includes('low stock') || 
    normalizedQuery.includes('out of stock') || 
    normalizedQuery.includes('need to restock') ||
    normalizedQuery.includes('running low') ||
    normalizedQuery.includes('almost out')
  ) {
    return {
      type: 'LOW_STOCK',
      limit: 10
    };
  }
  
  // Detect overstocked products query
  if (
    normalizedQuery.includes('overstock') || 
    normalizedQuery.includes('too much stock') || 
    normalizedQuery.includes('too many items') ||
    normalizedQuery.includes('highest stock') ||
    normalizedQuery.includes('excess inventory')
  ) {
    return {
      type: 'OVERSTOCKED',
      limit: 10
    };
  }
  
  // Detect sales trend query
  if (
    normalizedQuery.includes('sales trend') || 
    normalizedQuery.includes('trend in sales') || 
    normalizedQuery.includes('sales analysis') ||
    normalizedQuery.includes('sales performance') ||
    (normalizedQuery.includes('how') && normalizedQuery.includes('sell'))
  ) {
    return {
      type: 'SALES_TREND',
      limit: 10
    };
  }
  
  // Detect category analysis query
  const categoryMatch = normalizedQuery.match(/(?:about|in|for) (?:the)? ([\w\s-]+) category/i) ||
                        normalizedQuery.match(/([\w\s-]+) category/i);
  
  if (categoryMatch && categoryMatch[1]) {
    return {
      type: 'CATEGORY_ANALYSIS',
      category: categoryMatch[1].trim(),
      limit: 10
    };
  }
  
  // Check for full inventory queries
  if (
    normalizedQuery.includes('all product') || 
    normalizedQuery.includes('entire inventory') || 
    normalizedQuery.includes('full inventory') ||
    (normalizedQuery.includes('list') && normalizedQuery.includes('all'))
  ) {
    return {
      type: 'FULL_INVENTORY',
      limit: 20 // Limit to 20 items to avoid overwhelming the AI
    };
  }
  
  // Check for order-related queries
  if (
    normalizedQuery.includes('order') || 
    normalizedQuery.includes('purchase') ||
    normalizedQuery.includes('transaction') ||
    normalizedQuery.includes('customer buy') ||
    normalizedQuery.includes('sale') ||
    normalizedQuery.includes('sold')
  ) {
    return {
      type: 'ORDER_ANALYSIS',
      limit: 10
    };
  }
  
  // Default to general query
  return {
    type: 'GENERAL',
    limit: 10
  };
}

/**
 * Filters product data based on the query context
 */
export function filterProductsByQueryContext(
  products: DashboardProduct[],
  orders: DashboardOrder[],
  queryContext: QueryContext
): DashboardProduct[] {
  let filteredProducts = [...products];
  
  // Always calculate product sales data from all orders for proper metrics
  const productSales = calculateProductSalesFromOrders(products, orders);
  
  // For specific product queries, filter to products that match the specific product
  if (queryContext.type === 'SPECIFIC_PRODUCT' && queryContext.productName) {
    const productName = queryContext.productName.toLowerCase();
    
    filteredProducts = filteredProducts.filter(product => {
      const matchesName = product.name.toLowerCase().includes(productName);
      const matchesSku = product.sku.toLowerCase().includes(productName);
      return matchesName || matchesSku;
    });
  }
  
  // For other query types
  switch (queryContext.type) {
    case 'LOW_STOCK':
      // Filter to low stock products (less than 10 in stock)
      filteredProducts = filteredProducts.filter(product => product.stock < 10);
      
      // Sort by stock (ascending)
      filteredProducts.sort((a, b) => a.stock - b.stock);
      break;
    
    case 'OVERSTOCKED':
      // Filter to overstocked products (more than 50 in stock)
      filteredProducts = filteredProducts.filter(product => product.stock > 50);
      
      // Sort by stock (descending)
      filteredProducts.sort((a, b) => b.stock - a.stock);
      break;
    
    case 'BEST_SELLING':
      // Enhance products with sales data
      filteredProducts = filteredProducts.map(product => ({
        ...product,
        sales: productSales.get(product.id)?.sales || 0,
        revenue: productSales.get(product.id)?.revenue || 0,
        orderIds: productSales.get(product.id)?.orderIds || [],
        lastOrderDate: productSales.get(product.id)?.lastOrderDate || ''
      }));
      
      // Sort by sales (descending)
      filteredProducts.sort((a, b) => (b.sales || 0) - (a.sales || 0));
      break;
    
    case 'CATEGORY_ANALYSIS':
      if (queryContext.category) {
        const category = queryContext.category.toLowerCase();
        filteredProducts = filteredProducts.filter(product => 
          product.product_type?.toLowerCase().includes(category)
        );
      }
      break;
    
    case 'SALES_TREND':
      // Enhance products with sales data for trend analysis
      filteredProducts = filteredProducts.map(product => ({
        ...product,
        sales: productSales.get(product.id)?.sales || 0,
        revenue: productSales.get(product.id)?.revenue || 0,
        orderIds: productSales.get(product.id)?.orderIds || [],
        lastOrderDate: productSales.get(product.id)?.lastOrderDate || ''
      }));
      
      // Sort by revenue (descending)
      filteredProducts.sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
      break;
      
    default:
      // For other types or 'general' queries, include sales data but don't filter
      filteredProducts = filteredProducts.map(product => ({
        ...product,
        sales: productSales.get(product.id)?.sales || 0,
        revenue: productSales.get(product.id)?.revenue || 0,
        orderIds: productSales.get(product.id)?.orderIds || [],
        lastOrderDate: productSales.get(product.id)?.lastOrderDate || ''
      }));
      break;
  }
  
  // Limit to at most 20 most relevant products
  return filteredProducts.slice(0, 20);
}

/**
 * Generates a human-readable context description for relevant products.
 */
export function generateContextDescription(context: QueryContext, products: DashboardProduct[]): string {
  let description = `You are StockPilot AI, an inventory assistant for Shopify store owners.\n\n`;
  
  // Add query-specific context
  switch (context.type) {
    case 'BEST_SELLING':
      description += `The user is asking about best-selling products. Here are the top ${products.length} products by sales:\n\n`;
      break;
      
    case 'LOW_STOCK':
      description += `The user is asking about low stock products. Here are the ${products.length} products with the lowest stock levels:\n\n`;
      break;
      
    case 'OVERSTOCKED':
      description += `The user is asking about overstocked products. Here are the ${products.length} products with the highest stock levels:\n\n`;
      break;
      
    case 'SPECIFIC_PRODUCT':
      if (products.length === 0) {
        description += `No products found matching your query for "${context.productName || ''}"\n\n`;
      } else if (products.length === 1) {
        description += `Here is the information for the product "${products[0].name}":\n\n`;
      } else {
        description += `Here is information about ${products.length} products that match your query "${context.productName || ''}":\n\n`;
      }
      break;
      
    case 'CATEGORY_ANALYSIS':
      description += `The user is asking about products in the ${context.category} category. Here are ${products.length} products in this category:\n\n`;
      break;
      
    case 'SALES_TREND':
      description += `The user is asking about sales trends. Here are ${products.length} products with sales data:\n\n`;
      break;
      
    case 'FULL_INVENTORY':
      description += `The user is asking about the full inventory. Here are ${products.length} products from the inventory (limited to keep response size manageable):\n\n`;
      break;
      
    case 'ORDER_ANALYSIS':
      description += `The user is asking about order information. Here are ${products.length} products with detailed order data:\n\n`;
      break;
      
    default:
      description += `Here are ${products.length} products from the inventory that may be relevant to your query:\n\n`;
      break;
  }
  
  // Add product details
  products.forEach((p, i) => {
    description += `Product ${i + 1}: ${p.name}\n`;
    description += `   • SKU: ${p.sku}\n`;
    description += `   • Price: $${p.price}\n`;
    description += `   • Current Stock: ${p.stock} units\n`;
    
    if (p.product_type) {
      description += `   • Category: ${p.product_type}\n`;
    }
    
    if (p.vendor) {
      description += `   • Vendor: ${p.vendor}\n`;
    }
    
    if (p.sales !== undefined) {
      description += `   • Total Sales: ${p.sales} units\n`;
    }
    
    if (p.revenue !== undefined) {
      description += `   • Total Revenue: $${p.revenue.toFixed(2)}\n`;
    }
    
    description += `   • Stock status: ${p.stock < 10 ? 'LOW STOCK' : p.stock > 50 ? 'WELL STOCKED' : 'MODERATE'}\n`;
    
    if (p.orderIds !== undefined && p.orderIds.length > 0) {
      const orderCount = p.orderIds.length;
      description += `   • Orders: ${orderCount} order${orderCount !== 1 ? 's' : ''}\n`;
      
      if (orderCount > 0) {
        description += `   • Order IDs: ${p.orderIds.slice(0, 5).join(', ')}${orderCount > 5 ? '...' : ''}\n`;
      }
    } else {
      description += `   • Orders: No orders for this product\n`;
    }
    
    if (p.lastOrderDate) {
      description += `   • Last order date: ${new Date(p.lastOrderDate).toLocaleDateString()}\n`;
    }
  });
  
  return description;
}

// Function to calculate sales data from orders
function calculateProductSalesFromOrders(
  products: DashboardProduct[],
  orders: DashboardOrder[]
): Map<string, { sales: number, revenue: number, orderIds: string[], lastOrderDate: string }> {
  const productMetrics = new Map<string, { sales: number, revenue: number, orderIds: string[], lastOrderDate: string }>();
  
  // Initialize with zeros for all products
  products.forEach(product => {
    productMetrics.set(product.id, { 
      sales: 0, 
      revenue: 0, 
      orderIds: [],
      lastOrderDate: ''
    });
  });
  
  // Process orders to calculate sales and revenue
  orders.forEach(order => {
    const orderDate = new Date(order.created_at).toISOString();
    order.line_items?.forEach(item => {
      const productId = item.product_id?.toString() || '';
      if (!productId) return;
      
      const currentMetrics = productMetrics.get(productId) || { 
        sales: 0, 
        revenue: 0, 
        orderIds: [],
        lastOrderDate: ''
      };
      
      const quantity = item.quantity || 0;
      const itemPrice = parseFloat(item.price || '0');
      
      // Only add the order ID if it's not already in the list
      const updatedOrderIds = currentMetrics.orderIds.includes(order.id.toString())
        ? currentMetrics.orderIds
        : [...currentMetrics.orderIds, order.id.toString()];
      
      // Update the last order date if this order is more recent
      const lastOrderDate = currentMetrics.lastOrderDate
        ? (new Date(orderDate) > new Date(currentMetrics.lastOrderDate) ? orderDate : currentMetrics.lastOrderDate)
        : orderDate;
      
      productMetrics.set(productId, {
        sales: currentMetrics.sales + quantity,
        revenue: currentMetrics.revenue + (itemPrice * quantity),
        orderIds: updatedOrderIds,
        lastOrderDate
      });
    });
  });
  
  return productMetrics;
}
