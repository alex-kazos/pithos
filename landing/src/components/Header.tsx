import { BarChart3, Brain, MessageSquare } from 'lucide-react';
import { APP_LINKS } from '../constants/routes';
import NavBar from './NavBar';

export default function Header() {
  return (
    <>
      <NavBar />

      {/* Hero Section */}
      <section className="pt-32 pb-24 relative">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col items-center text-center">
              <span className="px-4 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-sm mb-6">
                Designed for e-Commerce Stores
              </span>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
                Losing Money on Stock-outs, Overstocking or Missed sales?
              </h1>
              <p className="text-lg md:text-xl text-gray-300 mb-8">
                Save thousands on stock investments with our AI-powered inventory management solution.
              </p>
              <div className="flex flex-col items-center space-y-4">
                <div className="flex items-center space-x-4">
                  <button
                    className="bg-[#6366F1] text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-indigo-600 transition-transform hover:scale-105"
                    onClick={() => window.location.assign(APP_LINKS.AUTH)}
                  >
                    Sign Up
                  </button>
                  <button
                    className="border border-gray-700 text-white px-8 py-3 rounded-lg text-lg font-medium hover:border-gray-500 hover:bg-white/5 transition-colors"
                    onClick={() => window.location.assign(APP_LINKS.DEMO)}
                  >
                    View Live Demo
                  </button>
                </div>

              </div>
            </div>

            {/* Feature Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24">
              {[
                {
                  icon: <Brain className="w-6 h-6 text-indigo-400" />,
                  title: "Your AI Growth Partner",
                  description: "Get real-time insights to predict stock-outs, recommend cross-sells, and align inventory with demand—your 24/7 retail analyst."
                },
                {
                  icon: <BarChart3 className="w-6 h-6 text-indigo-400" />,
                  title: "Unified Intelligence Hub",
                  description: "Say goodbye to messy spreadsheets and disconnected systems. All your sales channels in one place, with AI insights that guide every decision."
                },
                {
                  icon: <MessageSquare className="w-6 h-6 text-indigo-400" />,
                  title: "Talk to Your Data",
                  description: "No more endless searches for data. Just ask what you need to know, and get instant, actionable insights to drive your business forward."
                }
              ].map((feature, index) => (
                <div key={index} className="relative group h-full">
                  {/* Hover gradient */}
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/30 to-emerald-500/30 rounded-xl blur opacity-30 group-hover:opacity-100 transition duration-500" />

                  <div className="relative bg-[#1A1A27] p-8 rounded-xl backdrop-blur-sm h-full flex flex-col">
                    <div className="bg-[#12121E] w-12 h-12 rounded-xl flex items-center justify-center mb-6">
                      {feature.icon}
                    </div>
                    <h3 className="text-white text-lg font-semibold mb-3 min-h-[48px]">{feature.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
