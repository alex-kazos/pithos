import { useState, useMemo } from 'react';
import { Filter } from 'lucide-react';
import { products, generateAlerts } from '../data/productData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ChatAssistant from './ChatAssistant';

export default function Dashboard() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('last_12_months');

  const filteredProducts = selectedCategory === 'all' 
    ? products 
    : products.filter(p => p.category === selectedCategory);

  const alerts = generateAlerts(filteredProducts);

  const chartData = useMemo(() => {
    return filteredProducts.map(product => ({
      name: product.name,
      stock: product.stock,
      sales: product.sales,
      category: product.category,
      subCategory: product.subCategory,
      sku: product.sku
    }));
  }, [filteredProducts]);

  return (
    <section id="dashboard" className="py-24 relative">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4 text-center">
            Your Entire Stock at a Glance
          </h2>
          <p className="text-gray-400 text-center mb-8 md:mb-16">
            Guided by Your AI Advisor (Sneak Peek)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
            {[/* ... */].map((_metric, index) => (
              <div key={index} className="bg-[#1A1A27] rounded-xl p-4">
                {/* ... */}
              </div>
            ))}
          </div>
            
          <div className="bg-[#1E1E2D] rounded-2xl p-4 md:p-8">
            <div className="flex flex-col space-y-6">
              <div className="flex flex-col md:flex-row md:justify-between md:items-center space-y-4 md:space-y-0">
                <h3 className="text-xl font-semibold text-white">Stock Levels vs. Sales</h3>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-[#6366F1] rounded-full"></div>
                    <span className="text-gray-400 text-sm">Current Stock</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-[#22C55E] rounded-full"></div>
                    <span className="text-gray-400 text-sm">Sales</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-4 bg-[#1A1A27] p-4 rounded-lg">
                <div className="flex items-center space-x-4 w-full md:w-auto">
                  <Filter className="w-5 h-5 text-gray-400" />
                  <select 
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="bg-[#12121E] text-white px-4 py-2 rounded-lg outline-none border border-gray-800 hover:border-gray-700 transition-colors w-full md:w-auto"
                  >
                    <option value="all">All Categories</option>
                    <option value="apparel">Apparel</option>
                    <option value="shoes">Shoes</option>
                    <option value="accessories">Accessories</option>
                  </select>
                </div>
                <select 
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="bg-[#12121E] text-white px-4 py-2 rounded-lg outline-none border border-gray-800 hover:border-gray-700 transition-colors w-full md:w-auto"
                >
                  <option value="last_12_months">Last 12 Months</option>
                  <option value="last_6_months">Last 6 Months</option>
                  <option value="last_30_days">Last 30 Days</option>
                </select>
              </div>
            </div>
            
            <div className="h-[300px] md:h-[400px] w-full mt-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke="#2D2D3B" 
                    vertical={false}
                  />
                  <XAxis 
                    dataKey="name" 
                    stroke="#9CA3AF"
                    tick={{ fill: '#9CA3AF' }}
                    axisLine={{ stroke: '#2D2D3B' }}
                  />
                  <YAxis 
                    stroke="#9CA3AF"
                    tick={{ fill: '#9CA3AF' }}
                    axisLine={{ stroke: '#2D2D3B' }}
                    tickLine={{ stroke: '#2D2D3B' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1A1A27',
                      border: 'none',
                      borderRadius: '0.5rem',
                      color: '#fff',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                    }}
                    cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-[#1A1A27] p-3 rounded-lg shadow-lg">
                            <p className="text-white font-semibold mb-2">{data.name}</p>
                            <div className="space-y-1">
                              <p className="text-[#6366F1]">Stock: {data.stock}</p>
                              <p className="text-[#22C55E]">Sales: {data.sales}</p>
                              <p className="text-gray-400">SKU: {data.sku}</p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar 
                    dataKey="stock" 
                    fill="#6366F1" 
                    name="Current Stock"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar 
                    dataKey="sales" 
                    fill="#22C55E" 
                    name="Monthly Sales"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[#1E1E2D] rounded-2xl p-4 md:p-8 mt-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-semibold text-white">AI Recommendations</h3>
                <p className="text-gray-400 text-sm mt-1">Actionable insights based on your data</p>
              </div>
              {alerts.length > 5 && (
                <span className="text-gray-400 text-sm mt-2 md:mt-0">
                  +{alerts.length - 5} more alerts
                </span>
              )}
            </div>
            
            <div className="space-y-4">
              {alerts.slice(0, 5).map((alert) => (
                <div 
                  key={alert.id}
                  className="bg-[#1A1A27] rounded-xl p-4 hover:bg-[#1F1F2E] transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between mb-3 space-y-2 md:space-y-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                        alert.type === 'RESTOCK' ? 'bg-red-500/20 text-red-400' :
                        alert.type === 'OPPORTUNITY' ? 'bg-blue-500/20 text-blue-400' :
                        alert.type === 'WARNING' ? 'bg-yellow-500/20 text-yellow-400' :
                        alert.type === 'TREND' ? 'bg-purple-500/20 text-purple-400' :
                        'bg-green-500/20 text-green-400'
                      }`}>
                        {alert.type}
                      </div>
                      <div className={`px-2 py-0.5 rounded-full text-xs ${
                        alert.priority === 'HIGH' ? 'bg-red-500/10 text-red-400' :
                        alert.priority === 'MEDIUM' ? 'bg-yellow-500/10 text-yellow-400' :
                        'bg-gray-500/10 text-gray-400'
                      }`}>
                        {alert.priority}
                      </div>
                    </div>
                    {alert.potentialRevenue && (
                      <span className="text-blue-400 text-sm">
                        €{alert.potentialRevenue.toLocaleString('en-EU', { 
                          maximumFractionDigits: 0 
                        })} potential revenue
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-gray-300">{alert.message}</p>
                    {alert.insight && (
                      <p className="text-gray-400 text-sm italic">
                        {alert.insight}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center text-sm mt-4 space-y-2 md:space-y-0">
                    <div className="flex flex-col md:flex-row md:items-center space-y-1 md:space-y-0 md:space-x-4">
                      <span className="text-gray-500">SKU: {alert.product.sku}</span>
                      <span className="text-gray-500">Category: {alert.product.category}</span>
                    </div>
                    <button className="flex items-center space-x-1 text-indigo-400 hover:text-indigo-300 transition-colors">
                      <span>Take Action</span>
                      <span className="text-lg">→</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {alerts.length > 5 && (
              <div className="mt-4 text-center">
                <button className="text-indigo-400 hover:text-indigo-300 transition-colors">
                  View All Recommendations →
                </button>
              </div>
            )}
            <p className="text-gray-400 text-sm mt-4 ml-2">Available with OpenAI key</p>
          </div>

          {/* AI Assistant */}
          <ChatAssistant />
        </div>
      </div>
    </section>
  );
}