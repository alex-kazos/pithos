import { useState, useRef, useEffect } from 'react';
import { products } from '../data/productData';
import { Bot } from 'lucide-react';
import '../styles/scrollbar-hide.css';

interface Message {
  text: string;
  isUser: boolean;
}

const predefinedQA = {
  "Show me top-performing products across all channels": () => {
    const sortedProducts = [...products]
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 3);
    
    return `Here are your top 3 performing products:
    ${sortedProducts.map((p, i) => `
    ${i + 1}. ${p.name}
       - Sales: ${p.sales} units
       - Revenue: €${(p.sales * p.price).toFixed(2)}
       - Trend: ${p.trend}`).join('\n')}`;
  },
  
  "What's my projected revenue for next month?": () => {
    const totalCurrentRevenue = products.reduce((sum, p) => sum + (p.sales * p.price), 0);
    const growthProducts = products.filter(p => p.trend === 'up').length;
    const projectedGrowth = 1 + (growthProducts / products.length * 0.1);
    const projectedRevenue = totalCurrentRevenue * projectedGrowth;
    
    return `Based on current trends:\n
    - Projected Revenue: €${projectedRevenue.toFixed(2)}
    - ${growthProducts} products showing upward trends
    - This represents a ${((projectedGrowth - 1) * 100).toFixed(1)}% projected growth`;
  },
  
  "Which stores need inventory restocking?": () => {
    const lowStock = products.filter(p => p.stock <= p.reorderPoint);
    
    return lowStock.length > 0
      ? `These products need restocking:\n\n${lowStock.map(p => `- ${p.name} (${p.stock} units left, reorder point: ${p.reorderPoint})`).join('\n')}`
      : "All products are currently well-stocked!";
  },
  
  "What products should I promote this weekend?": () => {
    const promotionCandidates = products
      .filter(p => p.stock > p.reorderPoint * 1.5 && p.margin && p.margin > 0.5)
      .sort((a, b) => (b.margin || 0) - (a.margin || 0))
      .slice(0, 3);
    
    return `Here are the best products to promote:
    ${promotionCandidates.map(p => `
    - ${p.name}
      • High margin: ${((p.margin || 0) * 100).toFixed(0)}%
      • Good stock level: ${p.stock} units
      • Current price: €${p.price}`).join('\n')}`;
  }
};

export default function ChatAssistant() {
  const [messages, setMessages] = useState<Message[]>([{
    isUser: false,
    text: "Hello! I'm your AI assistant. How can I help you today?"
  }]);
  
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const handleQuestionClick = (question: string) => {
    setMessages(prev => [...prev, { text: question, isUser: true }]);
    
    const answer = predefinedQA[question as keyof typeof predefinedQA]();
    setTimeout(() => {
      setMessages(prev => [...prev, { text: answer, isUser: false }]);
    }, 500);
  };

  return (
    <div className="bg-[#1E1E2D] rounded-2xl p-4 md:p-8 mt-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-white flex items-center gap-2">
            <Bot className="w-5 h-5" />
            AI Assistant
          </h3>
          <p className="text-gray-400 text-sm mt-1">Ask me anything about your inventory</p>
        </div>
      </div>

      <div className="bg-[#1A1A27] rounded-lg overflow-hidden border border-[#2A2A3A]">
        {/* Messages Container */}
        <div ref={messagesContainerRef} className="h-[400px] overflow-y-auto p-4 space-y-4 scrollbar-hide">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  message.isUser
                    ? 'bg-[#6366F1] text-white'
                    : 'bg-[#2A2A3A] text-gray-300'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.text}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Questions */}
        <div className="p-4 border-t border-[#2A2A3A] bg-[#12121E]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {Object.keys(predefinedQA).map((question) => (
              <button
                key={question}
                onClick={() => handleQuestionClick(question)}
                className="text-left p-2 rounded hover:bg-[#2A2A3A] text-gray-400 hover:text-white transition-colors text-sm"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="text-gray-400 text-sm mt-4 ml-2 flex items-center">Available with OpenAI key</p>
    </div>
  );
}
