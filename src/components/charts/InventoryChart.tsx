import React from 'react';
import { Product } from '../../types/product';

interface InventoryChartProps {
  data: Product[];
}

export default function InventoryChart({ data }: InventoryChartProps) {
  const maxValue = Math.max(...data.flatMap(item => [item.stock, item.sales]));
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  return (
    <div className="bg-gray-900/50 rounded-xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-white font-semibold">Stock Levels vs. Sales</h3>
        <div className="flex items-center space-x-6">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-indigo-500 rounded-sm mr-2" />
            <span className="text-gray-400 text-sm">Current Stock</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-sm mr-2" />
            <span className="text-gray-400 text-sm">Monthly Sales</span>
          </div>
          <select className="bg-gray-800 text-gray-300 rounded-lg px-3 py-1 text-sm">
            <option>Last 12 Months</option>
            <option>Last 6 Months</option>
            <option>Last 30 Days</option>
          </select>
        </div>
      </div>
      
      <div className="relative h-64">
        {/* Y-axis labels */}
        <div className="absolute left-0 bottom-0 top-8 w-12 flex flex-col justify-between">
          {[...Array(6)].map((_, i) => (
            <span key={i} className="text-gray-500 text-xs text-right pr-2">
              {Math.round((maxValue / 5) * (5 - i))}
            </span>
          ))}
        </div>
        
        {/* Grid lines */}
        <div className="absolute left-12 right-0 bottom-0 top-8">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="border-t border-gray-800 absolute w-full"
              style={{ top: `${(i * 100) / 5}%` }}
            />
          ))}
        </div>
        
        {/* Bars */}
        <div className="absolute left-12 right-0 bottom-6 top-8 flex items-end justify-between px-4">
          {data.map((item, index) => (
            <div key={index} className="flex-1 flex items-end justify-center space-x-1">
              <div className="relative group">
                <div 
                  style={{ height: `${(item.stock / maxValue) * 100}%` }}
                  className="w-4 bg-indigo-500 rounded-sm transition-all hover:bg-indigo-400"
                />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  Stock: {item.stock}
                </div>
              </div>
              <div className="relative group">
                <div 
                  style={{ height: `${(item.sales / maxValue) * 100}%` }}
                  className="w-4 bg-green-500 rounded-sm transition-all hover:bg-green-400"
                />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  Sales: {item.sales}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* X-axis labels */}
        <div className="absolute left-12 right-0 bottom-0 flex justify-between px-4">
          {data.map((item, index) => (
            <div key={index} className="flex-1 text-center">
              <span className="text-gray-400 text-xs block truncate" title={item.name}>
                {item.name.split(' ')[0]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}