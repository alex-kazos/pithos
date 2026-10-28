import React from 'react';

export default function Stats() {
  const stats = [
    {
      value: "20%",
      source: "Average Savings",
      description: "on stock investments"
    },
    {
      value: "15+",
      source: "Integrations",
      description: "with e-commerce platforms"
    },
    {
      value: "24/7",
      source: "Real-time Monitoring",
      description: "of your inventory"
    }
  ];

  return (
    <section className="py-8 relative">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-white text-center mb-4">
            Don't take our word for it. Listen to the world.
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8 mt-16">
            {stats.map((stat, index) => (
              <div key={index} className="relative group">
                {/* Hover gradient */}
                <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/30 to-emerald-500/30 rounded-xl blur opacity-30 group-hover:opacity-100 transition duration-500" />
                
                <div className="relative bg-[#1A1A27] rounded-xl p-8 h-full backdrop-blur-sm">
                  <div className="text-4xl font-bold text-white mb-2">{stat.value}</div>
                  <div className="text-lg font-semibold text-indigo-400 mb-2">{stat.source}</div>
                  <p className="text-gray-400">{stat.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
} 