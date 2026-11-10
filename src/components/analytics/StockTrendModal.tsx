import React from 'react';
import { createPortal } from 'react-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { X } from 'lucide-react';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';

interface StockTrendModalProps {
  product: {
    name: string;
    sku: string;
    currentStock: number;
    predictedDemand: number;
    confidence: number;
    trend: number;
    historicalSales: number[];
    trendlineData: {
      historical: number[];
      future: number[];
    };
    seasonalityFactor: number;
  };
  isOpen: boolean;
  onClose: () => void;
}

export const StockTrendModal: React.FC<StockTrendModalProps> = ({ product, isOpen, onClose }) => {
  useLockBodyScroll(isOpen);
  if (!isOpen) return null;

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  // Get current month index
  const currentMonth = new Date().getMonth();

  // Prepare data for the chart
  const chartData = [...product.historicalSales].map((sales, index) => {
    const monthIndex = (currentMonth - (11 - index) + 12) % 12;
    return {
      month: months[monthIndex],
      sales,
      trend: product.trendlineData.historical[index],
      isFuture: false
    };
  });

  // Add future predictions
  product.trendlineData.future.forEach((prediction, index) => {
    const monthIndex = (currentMonth + index + 1) % 12;
    chartData.push({
      month: months[monthIndex],
      sales: null,
      trend: prediction,
      isFuture: true
    });
  });

  // Calculate min and max for Y axis
  const allValues = [
    ...product.historicalSales,
    ...product.trendlineData.historical,
    ...product.trendlineData.future
  ];
  const yMax = Math.max(...allValues) * 1.2;
  const yMin = Math.min(0, ...allValues);

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-archivo">
      <div className="bg-surface border border-white/[0.08] rounded-xl shadow-xl w-[90vw] max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex-none p-4 border-b border-white/[0.07] flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium text-white">{product.name}</h3>
            <p className="text-sm text-white/45 font-mono-ibm">SKU: {product.sku}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/45 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white/[0.04] border border-white/[0.07] p-4 rounded-lg">
              <p className="text-sm text-white/45 mb-1">Current Stock</p>
              <p className="text-xl font-medium text-white">{product.currentStock}</p>
            </div>
            <div className="bg-white/[0.04] border border-white/[0.07] p-4 rounded-lg">
              <p className="text-sm text-white/45 mb-1">Predicted Demand</p>
              <p className="text-xl font-medium text-white">{product.predictedDemand}</p>
            </div>
            <div className="bg-white/[0.04] border border-white/[0.07] p-4 rounded-lg">
              <p className="text-sm text-white/45 mb-1">Confidence</p>
              <p className="text-xl font-medium text-white">{product.confidence}%</p>
            </div>
            <div className="bg-white/[0.04] border border-white/[0.07] p-4 rounded-lg">
              <p className="text-sm text-white/45 mb-1">Seasonality Factor</p>
              <p className="text-xl font-medium text-white">
                {(product.seasonalityFactor * 100).toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Trend Chart */}
          <div className="h-[400px] mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="month"
                  stroke="rgba(255,255,255,0.35)"
                  tick={{ fill: 'rgba(255,255,255,0.5)' }}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.35)"
                  tick={{ fill: 'rgba(255,255,255,0.5)' }}
                  domain={[yMin, yMax]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#15141e',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '0.5rem'
                  }}
                  labelStyle={{ color: 'rgba(255,255,255,0.8)' }}
                  itemStyle={{ color: 'rgba(255,255,255,0.8)' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="sales"
                  stroke="#6b7aff"
                  strokeWidth={2}
                  dot={{ fill: '#6b7aff', r: 4 }}
                  name="Historical Sales"
                />
                <Line
                  type="monotone"
                  dataKey="trend"
                  stroke="#5ec089"
                  strokeWidth={2}
                  strokeDasharray={chartData.map(d => d.isFuture ? "3 3" : "0")}
                  dot={{ fill: '#5ec089', r: 4 }}
                  name="Trend & Forecast"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Insights */}
          <div className="bg-white/[0.04] border border-white/[0.07] p-4 rounded-lg">
            <h4 className="text-white font-medium mb-2">Insights</h4>
            <ul className="space-y-2 text-sm text-white/70">
              <li>• Trend Direction: {product.trend > 0 ? 'Upward' : product.trend < 0 ? 'Downward' : 'Stable'} ({Math.abs(product.trend).toFixed(1)}%)</li>
              <li>• Seasonality Impact: {product.seasonalityFactor > 1.1 ? 'High' : product.seasonalityFactor < 0.9 ? 'Low' : 'Normal'}</li>
              <li>• Stock Coverage: {(product.currentStock / product.predictedDemand).toFixed(1)} months at predicted demand</li>
              {product.confidence < 70 && (
                <li className="text-band-amber">• Note: Low confidence prediction due to variable historical data</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
