import { useState, useEffect } from 'react';
import axios from 'axios';

interface Product {
  id: string;
  name: string;
  stock_level: number;
  selling_price: number;
  sales: {
    count_of_sales: number;
  };
}

interface Recommendation {
  title: string;
  description: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  affectedProducts: string[];
  potentialRevenue?: string;
}

export const RestockRecommendations = ({ products }: { products: Product[] }) => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const productData = products.map(p => `${p.name} Stock: ${p.stock_level} Price: $${p.selling_price} Sales: ${p.sales.count_of_sales}`).join('\n');
        
        const response = await axios.post('/api/recommendations', {
          prompt: `You are a restock Recommendation expert, based on sales of these products, create 3-4 actionable recommendations to optimize sales. Format the response as JSON array with objects containing: title (string), description (string), priority (HIGH/MEDIUM/LOW), affectedProducts (array of product names), and potentialRevenue (string, optional). Products data:\n${productData}`,
          products: products
        });

        setRecommendations(response.data);
      } catch (error) {
        console.error('Error fetching recommendations:', error);
      } finally {
        setLoading(false);
      }
    };

    if (products.length > 0) {
      fetchRecommendations();
    }
  }, [products]);

  if (loading) {
    return (
      <div className="animate-pulse p-6 bg-gray-800 rounded-lg">
        <div className="h-4 bg-gray-700 rounded w-1/4 mb-4"></div>
        <div className="space-y-3">
          <div className="h-8 bg-gray-700 rounded"></div>
          <div className="h-8 bg-gray-700 rounded"></div>
          <div className="h-8 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <h2 className="text-xl font-semibold text-white">AI Recommendations</h2>
        <p className="text-gray-400 text-sm">Next best actions for inventory optimization</p>
      </div>

      <div className="space-y-4">
        {recommendations.map((rec, index) => (
          <div key={index} className="bg-gray-900 rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-medium text-white">{rec.title}</h3>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                rec.priority === 'HIGH' ? 'bg-red-900 text-red-200' :
                rec.priority === 'MEDIUM' ? 'bg-yellow-900 text-yellow-200' :
                'bg-green-900 text-green-200'
              }`}>
                {rec.priority}
              </span>
            </div>
            
            {rec.potentialRevenue && (
              <p className="text-blue-400 text-sm mb-2">{rec.potentialRevenue}</p>
            )}
            
            <p className="text-gray-400 text-sm mb-3">{rec.description}</p>
            
            <div className="mt-2">
              <p className="text-gray-500 text-sm mb-1">Affected Products:</p>
              <div className="flex flex-wrap gap-2">
                {rec.affectedProducts.map((product, idx) => (
                  <span key={idx} className="px-2 py-1 bg-gray-800 rounded-full text-xs text-gray-300">
                    {product}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
