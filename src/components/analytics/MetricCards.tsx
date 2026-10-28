import React, { useMemo } from 'react';
import { MetricCardsProps } from '../../types/props';
import { CubeIcon, ShoppingCartIcon, CurrencyDollarIcon, ChartBarIcon, ArrowTrendingUpIcon } from '@heroicons/react/24/solid';
import { logger } from '../../utils/logger';

export const MetricCards: React.FC<MetricCardsProps> = ({ products = [], orders = [] }) => {
  const metrics = useMemo(() => {
    logger.debug('MetricCards', 'Calculating metrics', {
      productsCount: products.length,
      ordersCount: orders.length,
      hasProducts: !!products.length,
      hasOrders: !!orders.length
    });

    const totalProducts = products.length;
    const totalOrders = orders.length;

    console.log('MetricCards: Calculated totalProducts', totalProducts);
    console.log('MetricCards: Calculated totalOrders', totalOrders);

    // Calculate total revenue from orders
    const totalRevenue = orders.reduce((sum, order) => {
      const orderTotal = Number(order.total_price) || 0;
      return sum + orderTotal;
    }, 0);

    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    // Calculate inventory turnover ratio
    const totalInventory = products.reduce((sum, product) => {
      const inventory = Number(product.variants?.[0]?.inventory_quantity) || 0;
      return sum + inventory;
    }, 0);

    const costOfGoodsSold = orders.reduce((sum, order) => {
      return sum + (order.line_items || []).reduce((itemSum, item) => {
        const product = products.find(p => 
          p.variants?.some(v => v.id?.toString() === item.variant_id?.toString())
        );
        const cost = Number(product?.variants?.[0]?.price) || 0;
        const quantity = Number(item.quantity) || 0;
        return itemSum + (cost * quantity);
      }, 0);
    }, 0);

    const turnoverRatio = totalInventory > 0 ? (costOfGoodsSold / totalInventory).toFixed(2) : '0.00';

    logger.debug('MetricCards', 'Metrics calculated', {
      totalProducts,
      totalOrders,
      totalRevenue,
      averageOrderValue,
      totalInventory,
      costOfGoodsSold,
      turnoverRatio
    });

    return {
      totalProducts,
      totalOrders,
      totalRevenue,
      averageOrderValue,
      turnoverRatio
    };
  }, [products, orders]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
      <div className="bg-[#1C1B23] border-2 border-gray-800 rounded-lg p-6 hover:bg-[#1F1D2A] transition-colors duration-200">
        <div className="flex items-center justify-between">
          <h3 className="text-gray-400 text-sm font-medium">Total Products</h3>
          <div className="p-2 rounded-lg bg-indigo-500/10">
            <CubeIcon className="w-5 h-5 text-indigo-500" />
          </div>
        </div>
        <p className="text-white text-2xl font-bold mt-2">{metrics.totalProducts}</p>
      </div>
      
      <div className="bg-[#1C1B23] border-2 border-gray-800 rounded-lg p-6 hover:bg-[#1F1D2A] transition-colors duration-200">
        <div className="flex items-center justify-between">
          <h3 className="text-gray-400 text-sm font-medium">Total Orders</h3>
          <div className="p-2 rounded-lg bg-indigo-500/10">
            <ShoppingCartIcon className="w-5 h-5 text-indigo-500" />
          </div>
        </div>
        <p className="text-white text-2xl font-bold mt-2">{metrics.totalOrders}</p>
      </div>
      
      <div className="bg-[#1C1B23] border-2 border-gray-800 rounded-lg p-6 hover:bg-[#1F1D2A] transition-colors duration-200">
        <div className="flex items-center justify-between">
          <h3 className="text-gray-400 text-sm font-medium">Total Revenue</h3>
          <div className="p-2 rounded-lg bg-indigo-500/10">
            <CurrencyDollarIcon className="w-5 h-5 text-indigo-500" />
          </div>
        </div>
        <p className="text-white text-2xl font-bold mt-2">
          ${metrics.totalRevenue.toFixed(2)}
        </p>
      </div>
      
      <div className="bg-[#1C1B23] border-2 border-gray-800 rounded-lg p-6 hover:bg-[#1F1D2A] transition-colors duration-200">
        <div className="flex items-center justify-between">
          <h3 className="text-gray-400 text-sm font-medium">Average Order Value</h3>
          <div className="p-2 rounded-lg bg-indigo-500/10">
            <ChartBarIcon className="w-5 h-5 text-indigo-500" />
          </div>
        </div>
        <p className="text-white text-2xl font-bold mt-2">
          ${metrics.averageOrderValue.toFixed(2)}
        </p>
      </div>

      <div className="bg-[#1C1B23] border-2 border-gray-800 rounded-lg p-6 hover:bg-[#1F1D2A] transition-colors duration-200">
        <div className="flex items-center justify-between">
          <h3 className="text-gray-400 text-sm font-medium">Turnover Ratio</h3>
          <div className="p-2 rounded-lg bg-indigo-500/10">
            <ArrowTrendingUpIcon className="w-5 h-5 text-indigo-500" />
          </div>
        </div>
        <p className="text-white text-2xl font-bold mt-2">{metrics.turnoverRatio}x</p>
      </div>
    </div>
  );
};
