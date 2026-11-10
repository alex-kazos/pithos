import React from 'react';
import { ArrowDown, ArrowUp, MoreVertical } from 'lucide-react';
import { Product, Order } from '../../types/shopify';
import { mergeProductsBySku } from '../../utils/productMerger';

interface ProductTablesProps {
  products: Product[];
  orders: Order[];
}

interface ProductPerformance {
  id: string;
  name: string;
  sku: string;
  stock: number;
  sales: number;
  revenue: number;
  margin: number;
}

export function ProductTables({ products, orders }: ProductTablesProps) {
  if (!products || !Array.isArray(products)) {
    return (
      <div className="p-4 text-center">
        <p className="text-white/45">No product data available</p>
      </div>
    );
  }

  // Use mergeProductsBySku to handle product names correctly
  const mergedProducts = mergeProductsBySku(products, orders);
  
  // Transform merged products into performance data
  const productPerformance = mergedProducts.reduce<Record<string, ProductPerformance>>((acc, product) => {
    const revenue = (orders || [])
      .flatMap(order => order.line_items || [])
      .filter(item => item.product_id === product.id)
      .reduce((total, item) => total + (parseFloat(item.price || '0') * (item.quantity || 0)), 0);

    // Calculate margin (placeholder calculation)
    const margin = revenue * 0.3; // 30% margin assumption

    acc[product.sku] = {
      id: product.id,
      name: product.name, // This will now include all variant names if they exist
      sku: product.sku,
      stock: product.stock,
      sales: product.sales,
      revenue,
      margin
    };

    return acc;
  }, {});

  const performanceData = Object.values(productPerformance);

  if (performanceData.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-white/45">No product performance data available</p>
      </div>
    );
  }

  // Convert to array and sort by sales
  const performanceArray = performanceData;

  // Top selling products (by number of sales)
  const topSellers = [...performanceArray]
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 5);

  // Slow moving products (lowest sales)
  const slowMoving = [...performanceArray]
    .sort((a, b) => a.sales - b.sales)
    .slice(0, 5);

  return (
    <div className="space-y-8 font-archivo">
      {/* Top Selling Products */}
      <div className="bg-surface border border-white/[0.07] rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <ArrowUp className="w-5 h-5 text-band-green" />
            <h3 className="text-lg font-semibold text-white">Top Selling Products</h3>
          </div>
          <MoreVertical className="w-5 h-5 text-white/40" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-white/[0.06]">
                <th className="pb-3 text-sm font-medium text-white/45">Product Name</th>
                <th className="pb-3 text-sm font-medium text-white/45">Total Revenue</th>
                <th className="pb-3 text-sm font-medium text-white/45">N of Sales</th>
                <th className="pb-3 text-sm font-medium text-white/45">% Margin</th>
              </tr>
            </thead>
            <tbody>
              {topSellers.map(product => (
                <tr
                  key={product.id}
                  className="border-b border-white/[0.05] hover:bg-white/[0.03] transition-colors duration-200"
                >
                  <td className="py-3">
                    <div className="flex flex-col">
                      <span className="text-white/85">{product.name}</span>
                      <span className="text-sm text-white/35 font-mono-ibm">{product.sku}</span>
                    </div>
                  </td>
                  <td className="py-3">
                    <span className="text-white/85">${product.revenue.toFixed(2)}</span>
                  </td>
                  <td className="py-3">
                    <span className="text-white/85">{product.sales}</span>
                  </td>
                  <td className="py-3">
                    <span className="text-band-green">{product.margin.toFixed(0)}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slow Moving Products */}
      <div className="bg-surface border border-white/[0.07] rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <ArrowDown className="w-5 h-5 text-band-red" />
            <h3 className="text-lg font-semibold text-white">Slow Moving Products</h3>
          </div>
          <MoreVertical className="w-5 h-5 text-white/40" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-white/[0.06]">
                <th className="pb-3 text-sm font-medium text-white/45">Product Name</th>
                <th className="pb-3 text-sm font-medium text-white/45">Total Revenue</th>
                <th className="pb-3 text-sm font-medium text-white/45">N of Sales</th>
                <th className="pb-3 text-sm font-medium text-white/45">% Margin</th>
              </tr>
            </thead>
            <tbody>
              {slowMoving.map(product => (
                <tr
                  key={product.id}
                  className="border-b border-white/[0.05] hover:bg-white/[0.03] transition-colors duration-200"
                >
                  <td className="py-3">
                    <div className="flex flex-col">
                      <span className="text-white/85">{product.name}</span>
                      <span className="text-sm text-white/35 font-mono-ibm">{product.sku}</span>
                    </div>
                  </td>
                  <td className="py-3">
                    <span className="text-white/85">${product.revenue.toFixed(2)}</span>
                  </td>
                  <td className="py-3">
                    <span className="text-white/85">{product.sales}</span>
                  </td>
                  <td className="py-3">
                    <span className="text-band-red">{product.margin.toFixed(0)}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}