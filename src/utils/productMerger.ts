import { ShopifyProduct, ShopifyOrder } from '../types/shopify';
import { DashboardProduct, DashboardOrder } from '../types/dashboard';
import { logger } from './logger';

export interface MergedProduct {
  id: string;
  name: string;
  productNames: string[];  // Array to hold all product names with this SKU
  sku: string;
  stock: number;
  sales: number;
  product_type: string;
  variants: Array<{
    id: number | string;
    sku: string;
    inventory_quantity: number;
    price?: string;
    compare_at_price?: string;
  }>;
}

export const mergeProductsBySku = (
  products: (ShopifyProduct | DashboardProduct)[],
  orders: (ShopifyOrder | DashboardOrder)[],
  selectedCategory: string = 'All',
  dateRange?: { from: string; to: string }
): MergedProduct[] => {
  logger.debug('ProductMerger', 'Starting product merge', {
    productsCount: products?.length,
    ordersCount: orders?.length,
    selectedCategory,
    dateRange
  });

  // Create a map to group products by SKU
  const skuMap = new Map<string, MergedProduct>();

  if (!products || !Array.isArray(products)) {
    logger.warning('ProductMerger', 'No products or invalid products array provided');
    return [];
  }

  products
    .filter(product => {
      if (selectedCategory === 'All') return true;
      return (product.product_type || 'Uncategorized') === selectedCategory;
    })
    .forEach(product => {
      // Handle both Shopify and Dashboard product types
      const productVariants = 'variants' in product ? product.variants : [];
      const firstVariant = productVariants?.[0];
      
      logger.debug('ProductMerger', 'Processing product', {
        id: product.id,
        title: 'title' in product ? product.title : product.name,
        variantsCount: productVariants?.length
      });

      // Get SKU from variant or fallback to product ID
      const sku = firstVariant?.sku || product.id.toString();
      
      // Get product name based on type
      const productName = ('title' in product ? product.title : product.name) || 'Unnamed Product';

      // Calculate sales from orders
      const productSales = orders?.filter(order => {
        const hasProduct = order.line_items?.some(item => 
          item.product_id === product.id || 
          ('variant_id' in item && item.variant_id === firstVariant?.id)
        );
        if (!hasProduct) return false;
        
        if (dateRange?.from && dateRange?.to) {
          const orderDate = new Date(order.created_at);
          const fromDate = new Date(dateRange.from);
          const toDate = new Date(dateRange.to);
          return orderDate >= fromDate && orderDate <= toDate;
        }
        
        return true;
      }).length || 0;

      if (skuMap.has(sku)) {
        // If SKU exists, merge the data
        const existing = skuMap.get(sku)!;
        
        // Add stock from variant or product
        existing.stock += firstVariant?.inventory_quantity || 0;
        existing.sales += productSales;
        
        // Add the product name if it's not already in the array
        if (productName && !existing.productNames.includes(productName)) {
          existing.productNames.push(productName);
          // Update the main name to include all variants
          existing.name = existing.productNames.join(' / ');
        }
        
        // Update variants array
        if (productVariants) {
          existing.variants = [...existing.variants, ...productVariants];
        }
      } else {
        // If SKU doesn't exist, create new entry
        skuMap.set(sku, {
          id: product.id.toString(),
          name: productName,
          productNames: [productName],
          sku: sku,
          stock: firstVariant?.inventory_quantity || 0,
          sales: productSales,
          product_type: product.product_type || 'Uncategorized',
          variants: productVariants || []
        });
      }
    });

  const mergedProducts = Array.from(skuMap.values());
  
  logger.debug('ProductMerger', 'Completed product merge', {
    mergedCount: mergedProducts.length,
    sampleProduct: mergedProducts[0]
  });

  return mergedProducts;
};

export const transformForRecommendations = (mergedProducts: MergedProduct[]): MergedProduct[] => {
  logger.debug('ProductMerger', 'Starting recommendations transformation', {
    inputCount: mergedProducts?.length
  });

  if (!mergedProducts || !Array.isArray(mergedProducts)) {
    logger.warning('ProductMerger', 'No merged products or invalid array provided');
    return [];
  }

  return mergedProducts.map(product => ({
    ...product,
    // Use all product names in the name field if there are multiple
    name: product.productNames.join(' / ')
  }));
};
